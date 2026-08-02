// Shared limits for arbitrary user uploads (folder attachments). Deliberately
// stricter than what a virus scanner would catch -- this is a first line of
// defense against obviously-wrong uploads (executables, archives, oversized
// files), not a substitute for real malware scanning (not yet integrated).
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "text/plain",
]);

export function isAllowedUploadMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}
