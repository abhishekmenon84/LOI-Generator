"use client";

import { useEffect, useRef, useState } from "react";
import AnchorBox from "./AnchorBox";

const ANCHOR_TYPES = [
  { value: "signature", label: "Signature" },
  { value: "date", label: "Date" },
  { value: "initials", label: "Initials" },
  { value: "text", label: "Text box" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio button" },
];

export default function AnchorEditor({ fileUrl, pageCount, anchors: initialAnchors, onSave, onCancel, readOnly = false }) {
  const [anchors, setAnchors] = useState(initialAnchors || []);
  const [selectedType, setSelectedType] = useState("signature");
  const [labelInput, setLabelInput] = useState("");
  const [pageCanvases, setPageCanvases] = useState([]);
  const [saving, setSaving] = useState(false);
  const containerRefs = useRef([]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      // pdfjs-dist 6.x's getDocument() reads `src.url` directly — it does NOT
      // accept a bare string. Passing a string here silently fails to load
      // (src.url is undefined). Must pass { url: fileUrl }.
      const doc = await pdfjsLib.getDocument({ url: fileUrl }).promise;
      const canvases = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        canvases.push(canvas.toDataURL());
      }
      if (!cancelled) setPageCanvases(canvases);
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  function handlePageClick(pageIndex, e) {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const label = labelInput.trim() || ANCHOR_TYPES.find((t) => t.value === selectedType).label;
    setAnchors((prev) => [
      ...prev,
      { type: selectedType, label, page: pageIndex, xPct, yPct, widthPct: 12, heightPct: 4 },
    ]);
    setLabelInput("");
  }

  function handleDelete(toDelete) {
    setAnchors((prev) => prev.filter((a) => a !== toDelete));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(anchors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {!readOnly && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px" }}>
            {ANCHOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Label (e.g. Buyer)"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
          />
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Click on the page below to place an anchor.</span>
        </div>
      )}

      {pageCanvases.map((dataUrl, i) => (
        <div
          key={i}
          ref={(el) => (containerRefs.current[i] = el)}
          onClick={(e) => handlePageClick(i, e)}
          style={{ position: "relative", cursor: readOnly ? "default" : "crosshair" }}
        >
          <img src={dataUrl} alt={`Page ${i + 1}`} style={{ width: "100%", display: "block" }} />
          {anchors.filter((a) => a.page === i).map((a, idx) => (
            <AnchorBox key={idx} anchor={a} onDelete={handleDelete} readOnly={readOnly} />
          ))}
        </div>
      ))}

      {!readOnly && (
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleSave} disabled={saving} className="marketing-cta-button">
            {saving ? "Saving…" : "Save anchors"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{ background: "none", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: "8px" }}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
