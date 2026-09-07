// supabase/functions/generate-download-url/index.ts
//
// PURPOSE: Generate a short-lived presigned GET URL for downloading a product
//          file from the PRIVATE nothifilesproducts R2 bucket.
//
// Security model:
//   - Caller must be authenticated (JWT verified).
//   - Caller must have EITHER:
//       a) a 'completed' purchase row (buyer_id = caller, product_id = requested)
//       b) be the product's seller_id (sellers can verify their own uploaded file)
//   - If neither condition is met → 403. No guessable URLs are ever issued.
//   - Presigned GET URL expires in 10 minutes — short enough to prevent sharing.
//   - file_path is looked up server-side and NEVER returned to the client —
//     only the time-limited presigned URL is sent back.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
      });
    }

    // Verify the caller's JWT (user-scoped client)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
      });
    }

    const { productId } = await req.json();
    if (!productId) throw new Error('Missing productId');

    // Service role for all internal lookups — DB data never forwarded to client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch product's seller and file_path (internal only — never returned to client)
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, seller_id, file_path')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404
      });
    }

    // ── AUTHORIZATION ────────────────────────────────────────────────────────
    // Check 1: caller is the seller (always allowed to download their own file)
    const isSeller = product.seller_id === user.id;

    // Check 2: caller has a verified completed purchase for this product
    // maybeSingle() — avoids throwing when no row exists (unlike .single())
    let isBuyer = false;
    if (!isSeller) {
      const { data: purchase } = await supabaseAdmin
        .from('purchases')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('product_id', productId)
        .eq('status', 'completed')
        .maybeSingle();
      isBuyer = !!purchase;
    }

    if (!isSeller && !isBuyer) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: purchase required to download this product' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Seller has not uploaded a file yet
    if (!product.file_path) {
      return new Response(
        JSON.stringify({
          error: 'no_file',
          message: 'The seller has not uploaded a downloadable file for this product yet.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Build R2 S3 client targeting the PRIVATE bucket
    const accountId       = Deno.env.get('R2_ACCOUNT_ID') ?? '';
    const accessKeyId     = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
    const bucketName      = Deno.env.get('R2_PRODUCT_FILES_BUCKET_NAME') ?? '';

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing R2 environment variables');
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    // Extract original filename by stripping the timestamp prefix added during upload
    const pathParts = product.file_path.split('/');
    const filePart = pathParts[pathParts.length - 1]; // e.g. "1730_myfile.zip"
    const firstUnderscore = filePart.indexOf('_');
    const originalFilename = firstUnderscore !== -1 ? filePart.substring(firstUnderscore + 1) : filePart;

    // Generate presigned GET URL — 10-minute expiry prevents link sharing/reuse
    const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: bucketName,
      Key: product.file_path,
    }), { expiresIn: 600 }); // 10 minutes

    return new Response(
      JSON.stringify({ downloadUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
