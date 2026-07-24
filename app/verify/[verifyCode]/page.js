"use client";

import { useEffect, useState } from "react";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";

export default function VerifyPage({ params }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/verify/${params.verifyCode}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not found."))))
      .then(setData)
      .catch((err) => setError(err.message));
  }, [params.verifyCode]);

  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Document Verification</h1>
        {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}
        {!data && !error && <p>Loading…</p>}
        {data && (
          <>
            <p>
              <strong>{data.dealName}</strong>
            </p>
            <div
              className="status-banner"
              style={{
                background: data.integrityValid ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${data.integrityValid ? "#10b981" : "#ef4444"}`,
              }}
              role="status"
            >
              {data.integrityValid ? "✅ Document integrity verified — unaltered since signing." : "❌ Document integrity check failed."}
            </div>
            <h2>Signers</h2>
            <ul>
              {data.signers.map((s, i) => (
                <li key={i}>
                  {s.name} — {s.role} — signed {new Date(s.signedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
