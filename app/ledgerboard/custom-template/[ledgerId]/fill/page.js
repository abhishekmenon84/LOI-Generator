"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { groupAnchorsForWizard, generateQuestionLabel } from "../../../../../lib/customTemplateQuestions.mjs";

export default function CustomTemplateFillWizardPage() {
  const params = useParams();
  const router = useRouter();
  const ledgerId = params.ledgerId;

  const [ledger, setLedger] = useState(null);
  const [template, setTemplate] = useState(null);
  const [pageImages, setPageImages] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [answers, setAnswers] = useState({}); // { [anchorId]: string | boolean }
  const [pageIndex, setPageIndex] = useState(0); // index into `groups`, not the PDF page number
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!ledgerId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    async function load() {
      const ledgerRes = await fetch(`/api/ledgers/${ledgerId}`).catch(() => null);
      if (!ledgerRes || !ledgerRes.ok) throw new Error("Ledger not found.");
      const ledgerData = await ledgerRes.json();
      if (cancelled) return;
      setLedger(ledgerData);

      const templateId = ledgerData.formData?.templateId;
      if (!templateId) throw new Error("This Ledger has no associated template.");

      const folderRes = await fetch(`/api/folders/${ledgerData.folderId}`).catch(() => null);
      if (!folderRes || !folderRes.ok) throw new Error("Folder not found.");
      const folderData = await folderRes.json();
      if (cancelled) return;
      const orgId = folderData.orgId;
      if (!orgId) throw new Error("Could not resolve this Ledger's organization.");

      const templateRes = await fetch(`/api/orgs/${orgId}/templates/${templateId}`).catch(() => null);
      if (!templateRes || !templateRes.ok) throw new Error("Template not found.");
      const templateData = await templateRes.json();
      if (cancelled) return;
      setTemplate(templateData);

      const existingAnswers = ledgerData.formData?.customTemplateAnswers || {};
      setAnswers(existingAnswers);

      // Client-side page rendering, same approach as components/AnchorEditor.jsx
      // (pdfjs-dist canvas render per page, converted to a data URL) -- no new
      // PDF-rendering code path.
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const doc = await pdfjsLib.getDocument({ url: templateData.pdfUrl }).promise;
      const images = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL());
      }
      if (!cancelled) setPageImages(images);
    }

    load()
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ledgerId]);

  const groups = template ? groupAnchorsForWizard(template.anchors || []) : [];
  const currentGroup = groups[pageIndex];

  function setTextAnswer(anchorId, value) {
    setAnswers((prev) => ({ ...prev, [anchorId]: value }));
  }

  function setCheckboxAnswer(anchorId, checked) {
    setAnswers((prev) => ({ ...prev, [anchorId]: checked }));
  }

  function setRadioAnswer(radioGroupAnchors, selectedAnchorId) {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const a of radioGroupAnchors) next[a.id] = a.id === selectedAnchorId;
      return next;
    });
  }

  async function saveCurrentAnswers() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/ledgers/${ledgerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: { templateId: template.id, customTemplateAnswers: answers },
        }),
      });
      if (!res.ok) throw new Error("Could not save your answers. Please try again.");
      return true;
    } catch (err) {
      setSaveError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    const ok = await saveCurrentAnswers();
    if (!ok) return;
    if (pageIndex < groups.length - 1) {
      setPageIndex((i) => i + 1);
    } else {
      router.push(`/ledgerboard/custom-template/${ledgerId}`);
    }
  }

  function handleBack() {
    if (pageIndex > 0) setPageIndex((i) => i - 1);
  }

  if (loadError) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        <div style={{ color: "oklch(45% 0.18 25)", marginBottom: "12px" }}>⚠️ {loadError}</div>
        <button type="button" onClick={() => router.back()}>Back</button>
      </div>
    );
  }

  if (loading || !template) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        Loading…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        <div style={{ marginBottom: "16px" }}>This template has no fillable fields.</div>
        <button type="button" onClick={() => router.push(`/ledgerboard/custom-template/${ledgerId}`)}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
        color: "oklch(24% 0.015 264)",
        background: "oklch(97% 0.006 60)",
        padding: "28px 32px",
      }}
    >
      <div style={{ marginBottom: "18px" }}>
        {ledger?.folderId && (
          <button
            type="button"
            onClick={() => router.push(`/ledgerboard/folder/${ledger.folderId}`)}
            style={{ marginBottom: "10px", background: "none", border: "none", padding: 0, color: "oklch(24% 0.015 264)", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
          >
            ← Back to folder
          </button>
        )}
        <div style={{ fontSize: "19px", fontWeight: 800, marginBottom: "4px" }}>
          {ledger?.name || "Ledger"}
        </div>
        <div style={{ fontSize: "12.5px", color: "oklch(50% 0.01 264)" }}>
          Page {pageIndex + 1} of {groups.length}
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px", minWidth: "280px" }}>
          {pageImages[currentGroup.page] && (
            <div style={{ position: "relative" }}>
              <img
                src={pageImages[currentGroup.page]}
                alt={`Page ${currentGroup.page + 1}`}
                style={{ width: "100%", display: "block", borderRadius: "8px", border: "1px solid var(--border)" }}
              />
              {/* Client-side answer overlay -- no server-side stamping round
                  trip. Positions each answered anchor (from the SAME
                  anchor list groupAnchorsForWizard already filtered to
                  this page) directly over the rendered page image using
                  its existing xPct/yPct/widthPct/heightPct, the identical
                  percentage-geometry convention AnchorEditor.jsx uses for
                  placement. Won't match the final PDF's exact font/kerning
                  (that only happens via stampCustomTemplate at signing
                  time), but gives immediate visual feedback as you type. */}
              {currentGroup.items.flatMap((item) => (item.kind === "radioGroup" ? item.anchors : [item.anchor])).map((anchor) => {
                const answer = answers[anchor.id];
                const overlayStyle = {
                  position: "absolute",
                  left: `${anchor.xPct}%`,
                  top: `${anchor.yPct}%`,
                  width: `${anchor.widthPct}%`,
                  height: `${anchor.heightPct}%`,
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                  overflow: "hidden",
                  fontSize: "clamp(8px, 1.4vw, 13px)",
                  color: "oklch(30% 0.15 264)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                };
                if (anchor.type === "checkbox" || anchor.type === "radio") {
                  if (!answer) return null;
                  return (
                    <div key={anchor.id} style={{ ...overlayStyle, justifyContent: "center", fontWeight: 800 }}>
                      ✕
                    </div>
                  );
                }
                if (typeof answer !== "string" || !answer) return null;
                return (
                  <div key={anchor.id} style={overlayStyle}>
                    {answer}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            flex: "1 1 340px",
            minWidth: "300px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "white",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid oklch(91% 0.006 60)",
          }}
        >
          {currentGroup.items.map((item) => {
            if (item.kind === "radioGroup") {
              const selected = item.anchors.find((a) => answers[a.id] === true);
              return (
                <div key={item.radioGroup} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>
                    {generateQuestionLabel({ type: "radio", radioGroup: item.radioGroup })}
                  </div>
                  {item.anchors.map((a, idx) => (
                    <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                      <input
                        type="radio"
                        name={item.radioGroup}
                        checked={selected?.id === a.id}
                        onChange={() => setRadioAnswer(item.anchors, a.id)}
                      />
                      {a.role || a.label || `Option ${idx + 1}`}
                    </label>
                  ))}
                </div>
              );
            }

            const anchor = item.anchor;
            return (
              <div key={anchor.id} style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "12px", borderBottom: "1px solid oklch(93% 0.006 60)" }}>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>{generateQuestionLabel(anchor)}</div>
                {(anchor.type === "text" || anchor.type === "date") && (
                  <input
                    type={anchor.type === "date" ? "date" : "text"}
                    value={typeof answers[anchor.id] === "string" ? answers[anchor.id] : ""}
                    onChange={(e) => setTextAnswer(anchor.id, e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  />
                )}
                {anchor.type === "checkbox" && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <input
                      type="checkbox"
                      checked={answers[anchor.id] === true}
                      onChange={(e) => setCheckboxAnswer(anchor.id, e.target.checked)}
                    />
                    Yes
                  </label>
                )}
              </div>
            );
          })}

          {saveError && <div style={{ color: "oklch(45% 0.18 25)", fontSize: "12.5px" }}>⚠️ {saveError}</div>}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {pageIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={saving}
                style={{ padding: "10px 18px", borderRadius: "9px", border: "1px solid var(--border)", background: "white", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: "9px",
                border: "none",
                background: "oklch(24% 0.015 264)",
                color: "white",
                fontWeight: 600,
                fontSize: "13px",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : pageIndex < groups.length - 1 ? "Next" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
