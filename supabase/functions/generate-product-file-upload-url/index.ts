// supabase/functions/generate-product-file-upload-url/index.ts
//
// PURPOSE: Generate a presigned PUT URL for uploading a seller's product file
//          to the PRIVATE nothifilesproducts R2 bucket.
//
// Security model:
//   - Caller must be authenticated (JWT verified).
//   - Caller must be the seller_id of the given productId (ownership check).
//   - File extension must be in the explicit allowlist.
//   - File size must be within the plan limit (free: 500MB, premium: 5GB).
//   - If the product already has an existing file_path, the old R2 object is
//     DELETED before generating the new presigned URL (orphan cleanup).
//   - Returned filePath (object key) must be saved to products.file_path by
//     the client after a successful upload — it is NEVER a public URL.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
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
  // Video editing projects
  '.aep',     // After Effects
  '.prproj',  // Premiere Pro
  '.mogrt',   // Motion Graphics Template
  '.drp',     // DaVinci Resolve
  '.blend',   // Blender
  '.c4d',     // Cinema 4D
  '.fcpxml',  // Final Cut Pro XML
  // Finished video/image formats
  '.mp4', '.mov', '.png',
  // Color & preset formats
  '.lut', '.cube', // LUT files
  '.xmp',          // Lightroom/Premiere presets
  '.dng',          // Digital Negative (photo/raw)
  '.ffx',          // After Effects preset
]);

const FREE_MAX_BYTES    =  500 * 1024 * 1024;        //   500 MB
const PREMIUM_MAX_BYTES =    5 * 1024 * 1024 * 1024; //     5 GB

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
    const { productId, filename, contentType, fileSize } = await req.json();
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

    const maxBytes = profile.plan === 'premium' ? PREMIUM_MAX_BYTES : FREE_MAX_BYTES;
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

    // ── ORPHAN CLEANUP ───────────────────────────────────────────────────────
    // If the product already has a file, delete the old R2 object now.
    // The old storage key never leaves the server — transparent to the client.
    // Trade-off: brief window between delete and new upload where the object
    // is gone, but products.file_path still points to the old (deleted) key
    // until the client saves the new one — acceptable since the seller is
    // actively replacing the file.
    if (product.file_path) {
      try {
        await s3.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: product.file_path,
        }));
        console.log(`Cleaned up old product file: ${product.file_path}`);
      } catch (deleteErr) {
        // Log but don't fail — old file deletion is best-effort.
        // If it fails (e.g. already deleted), the upload can still proceed.
        console.warn(`Failed to delete old file (proceeding anyway): ${deleteErr.message}`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Derive a user/product-scoped path — never guessable, never a public URL
    // By using just the sanitized filename (without a timestamp prefix),
    // the downloaded file will naturally have the clean original filename
    // when the browser derives it from the URL path, bypassing the need for Content-Disposition.
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `product-files/${user.id}/${productId}/${sanitizedFilename}`;

    // Generate the presigned PUT URL
    // 1-hour expiry — large files (up to 5 GB for premium) may take several minutes
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
