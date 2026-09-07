import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOLDER_CONFIG = {
  'product-images': { types: ['image/jpeg', 'image/png', 'image/webp'], maxSize: 15 * 1024 * 1024 },
  'avatars': { types: ['image/jpeg', 'image/png', 'image/webp'], maxSize: 15 * 1024 * 1024 },
  'product-videos': { types: ['video/mp4', 'video/webm'], maxSize: 100 * 1024 * 1024 },
  'chat-attachments': { 
    types: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
      'application/pdf', 'application/zip', 'text/plain', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ], 
    maxSize: 25 * 1024 * 1024 
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { folder, filename, contentType, fileSize } = await req.json();
    if (!folder || !filename || !contentType || !fileSize) throw new Error('Missing fields');
    
    // Validate folder and MIME type dynamically via config
    const config = FOLDER_CONFIG[folder as keyof typeof FOLDER_CONFIG];
    if (!config) throw new Error('Invalid folder');
    if (!config.types.includes(contentType)) throw new Error(`Invalid type: ${contentType}`);
    if (fileSize > config.maxSize) throw new Error('File size exceeds maximum allowed for this folder');

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${user.id}/${Date.now()}_${sanitizedFilename}`;

    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME');
    const publicUrlBase = Deno.env.get('R2_PUBLIC_URL');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrlBase) {
      throw new Error('Missing environment variables');
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      ContentType: contentType,
      ContentLength: fileSize,
    });

    const url = await getSignedUrl(s3Client, command, { 
      expiresIn: 600, // 10 minutes expiration for large video uploads
      signableHeaders: new Set(['content-type', 'content-length'])
    });

    return new Response(
      JSON.stringify({
        uploadUrl: url,
        publicUrl: `${publicUrlBase}/${path}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
});
