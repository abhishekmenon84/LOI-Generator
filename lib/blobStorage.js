import { put } from "@vercel/blob";

export async function uploadFile(buffer, filename, contentType) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured. Create a Vercel Blob store and set this env var before uploading files.");
  }
  const blob = await put(filename, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return { url: blob.url };
}
