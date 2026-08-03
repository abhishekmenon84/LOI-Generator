"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";

const DOCUMENT_TYPES = [
  { value: "incorporation_certificate", label: "Incorporation Certificate" },
  { value: "business_registration", label: "Business Registration" },
  { value: "partnership_agreement", label: "Partnership Agreement" },
  { value: "sole_proprietor_id", label: "Sole Proprietor ID" },
  { value: "other", label: "Other" },
];

// One-time prompt right after business signup, reached via
// app/dashboard/page.js's redirect once the Organization row is created
// (a verification document is a real file, which can't be threaded
// through the magic-link callbackUrl the way the rest of the business
// signup fields are). Skippable -- verification is purely informational
// per product decision (see app/api/orgs/[id]/verification/route.js's
// comment), never a blocker.
export default function VerifyBusinessPage() {
  return (
    <Suspense fallback={null}>
      <VerifyBusinessForm />
    </Suspense>
  );
}

function VerifyBusinessForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgId = searchParams.get("orgId");

  const [documentType, setDocumentType] = useState("incorporation_certificate");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", documentType);
      const res = await fetch(`/api/orgs/${orgId}/verification`, { method: "POST", body });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Could not submit verification.");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Verify your business</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480 }}>
          Upload proof of business registration so we can verify your account. This is optional and never blocks you
          from using Ledgerlot — you can skip this and do it later from Settings.
        </p>

        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400, marginTop: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Document type</span>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>File (PDF, image, or Word document, up to 25MB)</span>
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.heic" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>

          {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="marketing-cta-button" disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Submit for verification"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "none", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              Skip for now
            </button>
          </div>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
