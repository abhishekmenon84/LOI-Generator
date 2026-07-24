import { randomBytes, createHash } from "crypto";

// SHA-256 hash of a PDF buffer, hex-encoded — used both to record what was
// signed and later to re-hash and compare for tamper detection.
export function hashDocument(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

// A URL-safe, unguessable single-use token for a signer's signing link.
export function generateSigningToken() {
  return randomBytes(24).toString("base64url");
}

// A short, human-shareable code for the public verify page — shorter than
// a signing token since it's meant to be printed on the document footer and
// typed/read aloud, not just clicked.
export function generateVerifyCode() {
  return randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}
