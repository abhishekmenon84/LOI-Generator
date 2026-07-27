"use client";

// Edit screen reached from the templates list's "edit" link
// (app/templates/page.js). Not called out as its own file in the Task 9
// brief, but the list explicitly links to per-template editing, and this is
// a thin wire-up of two already-built, already-reviewed pieces: AnchorEditor
// (Task 8) and GET/PATCH /api/templates/[id] (Task 7) -- the same shape as
// KeeperTemplates.jsx's existing edit flow for the older CustomTemplate
// system.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AnchorEditor from "../../../components/AnchorEditor";

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/templates/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Template not found.");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setTemplate(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function handleSave(anchors) {
    const fields = anchors.map((a, index) => ({
      // Included so PATCH can match this anchor back to its existing
      // FormField row and preserve its `key` (I4, final-review.md) --
      // undefined for anchors the user newly placed in this edit session,
      // which is exactly when a fresh key SHOULD be minted server-side.
      id: a.id,
      label: a.label,
      type: a.type,
      page: a.page,
      xPct: a.xPct,
      yPct: a.yPct,
      widthPct: a.widthPct,
      heightPct: a.heightPct,
      required: !!a.required,
      radioGroup: a.radioGroup || undefined,
      signerRole: a.signerRole || undefined,
      confidence: typeof a.confidence === "number" ? a.confidence : undefined,
      order: index,
    }));

    const res = await fetch(`/api/templates/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save the template.");
      return;
    }
    router.push("/templates");
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }
  if (error || !template) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ color: "oklch(45% 0.18 25)", marginBottom: 12 }}>⚠️ {error || "Template not found."}</div>
        <button type="button" onClick={() => router.push("/templates")}>Back to templates</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px" }}>
      <h1 style={{ marginBottom: 4 }}>{template.name}</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        {template.pageCount} page{template.pageCount === 1 ? "" : "s"} · {template.sourceTier}
      </p>
      <AnchorEditor
        fileUrl={template.pdfUrl}
        pageCount={template.pageCount}
        anchors={(template.fields || []).map((f) => ({ ...f }))}
        onSave={handleSave}
        onCancel={() => router.push("/templates")}
      />
    </div>
  );
}
