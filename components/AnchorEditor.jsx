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
  const [selectedAnchor, setSelectedAnchor] = useState(null);
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
    const newAnchor = {
      type: selectedType,
      label,
      page: pageIndex,
      xPct,
      yPct,
      widthPct: 12,
      heightPct: 4,
      required: false,
      radioGroup: "",
      signerRole: "",
    };
    setAnchors((prev) => [...prev, newAnchor]);
    setSelectedAnchor(newAnchor);
    setLabelInput("");
  }

  function handleDelete(toDelete) {
    setAnchors((prev) => prev.filter((a) => a !== toDelete));
    setSelectedAnchor((prev) => (prev === toDelete ? null : prev));
  }

  function handleSelect(a) {
    if (readOnly) return;
    setSelectedAnchor(a);
  }

  function handleUpdateSelected(patch) {
    setAnchors((prev) => prev.map((a) => (a === selectedAnchor ? { ...a, ...patch } : a)));
    setSelectedAnchor((prev) => (prev ? { ...prev, ...patch } : prev));
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

      {!readOnly && selectedAnchor && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            padding: "10px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        >
          <strong style={{ fontSize: "12px" }}>Edit field</strong>
          <input
            type="text"
            placeholder="Label"
            value={selectedAnchor.label || ""}
            onChange={(e) => handleUpdateSelected({ label: e.target.value })}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
          />
          <select
            value={selectedAnchor.type}
            onChange={(e) => handleUpdateSelected({ type: e.target.value })}
            style={{ padding: "6px 10px", borderRadius: "6px" }}
          >
            {ANCHOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={!!selectedAnchor.required}
              onChange={(e) => handleUpdateSelected({ required: e.target.checked })}
            />
            Required
          </label>
          {selectedAnchor.type === "radio" && (
            <input
              type="text"
              placeholder="Radio group"
              value={selectedAnchor.radioGroup || ""}
              onChange={(e) => handleUpdateSelected({ radioGroup: e.target.value })}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          )}
          {(selectedAnchor.type === "signature" || selectedAnchor.type === "initials") && (
            <input
              type="text"
              placeholder="Signer role (e.g. Buyer)"
              value={selectedAnchor.signerRole || ""}
              onChange={(e) => handleUpdateSelected({ signerRole: e.target.value })}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
            />
          )}
          <button
            type="button"
            onClick={() => setSelectedAnchor(null)}
            style={{ background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}
          >
            Done
          </button>
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
            <AnchorBox
              key={idx}
              anchor={a}
              onSelect={handleSelect}
              onDelete={handleDelete}
              readOnly={readOnly}
              selected={a === selectedAnchor}
            />
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
