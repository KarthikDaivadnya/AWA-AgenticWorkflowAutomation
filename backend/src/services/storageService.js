import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const STORAGE_MODE = process.env.STORAGE_MODE || "local";

if (STORAGE_MODE === "local" && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Swaps transparently to S3 when STORAGE_MODE=aws. See /aws/README.md
// for the IAM policy and bucket setup this expects.
export async function saveFile(file) {
  if (STORAGE_MODE === "aws") {
    const { S3Client, PutObjectCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const key = `uploads/${Date.now()}-${file.originalname}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    return {
      url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      name: file.originalname,
    };
  }

  // local mode
  const filename = `${Date.now()}-${file.originalname}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return { url: `/uploads/${filename}`, name: file.originalname };
}

export function readLocalFileAsText(relativeUrl) {
  const filePath = path.join(UPLOAD_DIR, path.basename(relativeUrl));
  return fs.readFileSync(filePath, "utf-8");
}
