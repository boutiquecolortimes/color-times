// Checks that the Vercel Blob token can actually store a public image.
// Usage (from the project folder):
//   node --env-file=.env.local scripts/test-blob-upload.mjs
// or with the live token from Vercel → Settings → Environment Variables:
//   BLOB_READ_WRITE_TOKEN='vercel_blob_rw_...' node scripts/test-blob-upload.mjs
import { put, del } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.log("BLOB_READ_WRITE_TOKEN is NOT set — uploads cannot work.");
  process.exit(1);
}
console.log(`Token found (starts with ${token.slice(0, 16)}…)`);

// 1x1 transparent PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

try {
  const blob = await put(`products/upload-test-${Date.now()}.png`, png, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/png",
  });
  console.log("UPLOAD OK →", blob.url);
  await del(blob.url);
  console.log("Test file cleaned up. Blob storage is working.");
} catch (error) {
  console.log("UPLOAD FAILED:", error?.name, "-", error?.message);
}
