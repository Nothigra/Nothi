// supabase/functions/generate-product-file-upload-url/index.ts
//
// PURPOSE: Generate a presigned PUT URL for uploading a seller's product file
//          to the PRIVATE nothifilesproducts R2 bucket.
//
// Security model:
//   - Caller must be authenticated (JWT verified).
//   - Caller must be the seller_id of the given productId (ownership check).
//   - File extension must be in the explicit allowlist.
//   - File size must be within the plan limit (Free: 300 MB, Pro: 1 GB).
//   - Every upload gets a new key; the previous file is only removed by the
//     'finalize' action, after the client has saved the new path (so a failed
//     upload never leaves buyers without a file).
//   - Returned filePath (object key) must be saved to products.file_path by
//     the client after a successful upload — it is NEVER a public URL.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Explicit extension allowlist — covers common video-editing deliverables.
// Intentionally excludes executables (.exe, .dmg, .pkg, .sh, .bat).
const ALLOWED_EXTENSIONS = new Set([
  // Archives
  '.zip', '.rar', '.7z',
  // Project files
  '.aep', '.aet', '.prproj', '.mogrt', '.drp', '.drfx', '.setting', '.comp',
  '.blend', '.c4d', '.fcpxml', '.motn', '.veg', '.capcut',
  // Presets
  '.ffx', '.prfpset', '.xmp', '.lrtemplate', '.dng', '.atn', '.abr',
  // Colour (LUTs)
  '.cube', '.3dl', '.look', '.lut', '.csp',
  // Audio (SFX, music)
  '.wav', '.mp3', '.aiff', '.aif', '.flac', '.ogg', '.m4a',
  // Video, images, overlays
  '.mp4', '.mov', '.webm', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.psd', '.svg', '.exr',
  // Fonts, plug-ins, documents
  '.otf', '.ttf', '.aex', '.pdf',
]);

// Keep in sync with src/config/plans.js (PLAN_LIMITS)
const FREE_MAX_BYTES = 300 * 1024 * 1024;  // 300 MB
const PRO_MAX_BYTES  = 1024 * 1024 * 1024; //   1 GB

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    // Verify the caller's JWT (user-scoped client)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // Parse request body
    const body = await req.json();
    const { productId, filename, contentType, fileSize } = body;

    // ── finalize: after the client saved the new file_path, remove older
    // uploads of this product (and only of this product) from the bucket.
    if (body.action === 'finalize') {
      if (!productId) throw new Error('Missing productId');
      const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: prod } = await db.from('products').select('seller_id, file_path').eq('id', productId).single();
      if (!prod || prod.seller_id !== user.id) throw new Error('Forbidden: you do not own this product');
      if (!prod.file_path) return new Response(JSON.stringify({ removed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const s3c = new S3Client({
        region: 'auto',
        endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '', secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '' },
        forcePathStyle: true,
      });
      const Bucket = Deno.env.get('R2_PRODUCT_FILES_BUCKET_NAME') ?? '';
      const listed = await s3c.send(new ListObjectsV2Command({ Bucket, Prefix: `product-files/${user.id}/${productId}/` }));
      let removed = 0;
      for (const o of listed.Contents ?? []) {
        if (o.Key && o.Key !== prod.file_path) {
          await s3c.send(new DeleteObjectCommand({ Bucket, Key: o.Key })).catch(() => null);
          removed++;
        }
      }
      return new Response(JSON.stringify({ removed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!productId || !filename || !contentType || fileSize == null) {
      throw new Error('Missing required fields: productId, filename, contentType, fileSize');
    }

    // Extension validation — primary guard.
    // MIME types are unreliable for custom formats (.aep, .prproj, .drp send as application/octet-stream)
    const ext = '.' + (filename.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `File type '${ext}' is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`
      );
    }

    // Service role client for all internal DB lookups (bypasses RLS safely server-side)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller owns the product AND retrieve existing file_path for cleanup
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, seller_id, file_path')
      .eq('id', productId)
      .single();

    if (productError || !product) throw new Error('Product not found');
    if (product.seller_id !== user.id) throw new Error('Forbidden: you do not own this product');

    // Retrieve the seller's plan to determine the size limit
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Could not retrieve seller profile');

    const maxBytes = profile.plan === 'pro' ? PRO_MAX_BYTES : FREE_MAX_BYTES;
    if (fileSize > maxBytes) {
      const maxMB = maxBytes / (1024 * 1024);
      const maxLabel = maxMB >= 1024 ? `${maxMB / 1024} GB` : `${maxMB} MB`;
      throw new Error(
        `File size exceeds the ${maxLabel} limit for your '${profile.plan}' plan`
      );
    }

    // Build R2 S3 client (shared for delete + presign, targeting PRIVATE bucket)
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

    // The previous file is NOT deleted here: if this upload failed, buyers
    // would be left without a file. A new, unique key is used instead, and
    // the old object is removed by the finalize action (above) once the client has saved
    // the new path on the product.
    // Derive a user/product-scoped path — never guessable, never a public URL.
    // The key ends with the clean file name (used for the download name).
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const version = Date.now().toString(36);
    const filePath = `product-files/${user.id}/${productId}/${version}/${sanitizedFilename}`;

    // Generate the presigned PUT URL
    // 1-hour expiry — large files (up to 1 GB for Pro) may take several minutes
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      ContentType: contentType,
      ContentLength: fileSize,
    }), {
      expiresIn: 3600,
      signableHeaders: new Set(['content-type', 'content-length']),
    });

    // Return the presigned PUT URL AND the new filePath key.
    // Client MUST save filePath to products.file_path after a successful upload.
    return new Response(
      JSON.stringify({ uploadUrl, filePath }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
