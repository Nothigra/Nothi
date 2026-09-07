import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import mime from "mime-types";

dotenv.config({ path: ".env.r2" });

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
  console.error("Missing one or more required env variables in .env.r2");
  process.exit(1);
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function uploadBadges() {
  const dirPath = path.resolve("./public/badges");
  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    return;
  }

  const files = fs.readdirSync(dirPath).filter(file => file.endsWith(".png") || file.endsWith(".jpg"));
  if (files.length === 0) {
    console.log("No images found in public/badges.");
    return;
  }

  console.log(`Found ${files.length} images to upload...`);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.lookup(filePath) || "image/png";
    const key = `badges/${file}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        // Make sure it is publicly readable if needed, though R2 relies on public bucket config
      }));
      console.log(`? Uploaded ${file} -> ${R2_PUBLIC_URL}/${key}`);
    } catch (err) {
      console.error(`? Failed to upload ${file}:`, err.message);
    }
  }
  
  console.log("Upload complete!");
}

uploadBadges();
