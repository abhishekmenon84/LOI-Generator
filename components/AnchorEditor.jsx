"use client";

import { useEffect, useRef, useState } from "react";
import AnchorBox from "./AnchorBox";
import {
  patchAnchorByCid,
  removeAnchorByCid,
  clampAnchorPosition,
  clampAnchorSize,
} from "../lib/anchorEditorState.mjs";

const ANCHOR_TYPES = [
  { value: "signature", label: "Signature" },
  { value: "date", label: "Date" },
  { value: "initials", label: "Initials" },
  { value: "text", label: "Text box" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio button" },
];

// Client-only identifier used to track "which anchor is this" across
// repeated edits. Deliberately NOT sent to the server (handleSaveTemplate /
// [id]/page.js both build an explicit field whitelist that omits it) --
// it exists only so selection/update logic can key off a stable id instead
// of object identity, which broke under repeated edits (see C1 fix below).
let cidCounter = 0;
function nextCid() {
  cidCounter += 1;
  return `cid_${Date.now()}_${cidCounter}`;
}

function withCids(list) {
  return (list || []).map((a) => (a._cid ? a : { ...a, _cid: nextCid() }));
}

export default function AnchorEditor({ fileUrl, pageCount, anchors: initialAnchors, onSave, onCancel, readOnly = false }) {
  const [anchors, setAnchors] = useState(() => withCids(initialAnchors));
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
      _cid: nextCid(),
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
    setAnchors((prev) => removeAnchorByCid(prev, toDelete._cid));
    setSelectedAnchor((prev) => (prev && prev._cid === toDelete._cid ? null : prev));
  }

  function handleSelect(a) {
    if (readOnly) return;
    setSelectedAnchor(a);
  }

  // C1 fix (see final-review.md): the previous version built two SEPARATE
  // patched objects -- one folded into `anchors`, another assigned to
  // `selectedAnchor` -- so after the first edit they were no longer the
  // same reference and the `a === selectedAnchor` identity guard never
  // matched again; every keystroke after the first patched a stale copy.
  // `patchAnchorByCid` (lib/anchorEditorState.mjs) fixes this by
  // construction: it keys off the stable `_cid` (not object identity) and
  // derives `selected` by reading it back OUT of the freshly-updated array,
  // so the two can never drift apart.
  function handleUpdateSelected(patch) {
    if (!selectedAnchor) return;
    const { anchors: updatedAnchors, selected } = patchAnchorByCid(anchors, selectedAnchor._cid, patch);
    setAnchors(updatedAnchors);
    setSelectedAnchor(selected);
  }

  function handleMove(anchor, xPct, yPct) {
    const clamped = clampAnchorPosition(xPct, yPct, anchor.widthPct, anchor.heightPct);
    const { anchors: updatedAnchors, selected } = patchAnchorByCid(anchors, anchor._cid, clamped);
    setAnchors(updatedAnchors);
    if (selectedAnchor?._cid === anchor._cid) setSelectedAnchor(selected);
  }

  function handleResize(anchor, widthPct, heightPct) {
    const clamped = clampAnchorSize(anchor.xPct, anchor.yPct, widthPct, heightPct);
    const { anchors: updatedAnchors, selected } = patchAnchorByCid(anchors, anchor._cid, clamped);
    setAnchors(updatedAnchors);
    if (selectedAnchor?._cid === anchor._cid) setSelectedAnchor(selected);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(anchors);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12.5px" };

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {!readOnly && (
        <div
          style={{
            flexShrink: 0,
            width: 240,
            height: "100%",
            overflowY: "auto",
            background: "var(--bg-panel, white)",
            borderRight: "1px solid var(--border)",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <strong style={{ fontSize: "12px" }}>{selectedAnchor ? "Editing anchor" : "New anchor"}</strong>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={selectedAnchor ? selectedAnchor.type : selectedType}
              onChange={(e) =>
                selectedAnchor ? handleUpdateSelected({ type: e.target.value }) : setSelectedType(e.target.value)
              }
              style={{ ...inputStyle, flex: 1 }}
            >
              {ANCHOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={!!selectedAnchor?.required}
                disabled={!selectedAnchor}
                onChange={(e) => handleUpdateSelected({ required: e.target.checked })}
              />
              Required
            </label>
          </div>

          <input
            type="text"
            placeholder="Label (e.g. Buyer)"
            value={selectedAnchor ? selectedAnchor.label || "" : labelInput}
            onChange={(e) =>
              selectedAnchor ? handleUpdateSelected({ label: e.target.value }) : setLabelInput(e.target.value)
            }
            style={inputStyle}
          />

          {selectedAnchor?.type === "radio" && (
            <input
              type="text"
              placeholder="Radio group"
              value={selectedAnchor.radioGroup || ""}
              onChange={(e) => handleUpdateSelected({ radioGroup: e.target.value })}
              style={inputStyle}
            />
          )}
          {selectedAnchor && (selectedAnchor.type === "signature" || selectedAnchor.type === "initials") && (
            <input
              type="text"
              placeholder="Signer role (e.g. Buyer)"
              value={selectedAnchor.signerRole || ""}
              onChange={(e) => handleUpdateSelected({ signerRole: e.target.value })}
              style={inputStyle}
            />
          )}

          {selectedAnchor ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setSelectedAnchor(null)}
                style={{ flex: 1, background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selectedAnchor)}
                style={{ flex: 1, background: "oklch(50% 0.17 25)", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
              >
                Delete
              </button>
            </div>
          ) : (
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>Click on the page to place it.</p>
          )}

          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />

          <button type="button" onClick={handleSave} disabled={saving} className="marketing-cta-button">
            {saving ? "Saving…" : "Save anchors"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{ background: "none", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "16px" }}>
        {pageCanvases.map((dataUrl, i) => (
          <div
            key={i}
            data-anchor-page="true"
            ref={(el) => (containerRefs.current[i] = el)}
            onClick={(e) => handlePageClick(i, e)}
            style={{ position: "relative", cursor: readOnly ? "default" : "crosshair", maxWidth: "100%" }}
          >
            <img src={dataUrl} alt={`Page ${i + 1}`} style={{ width: "100%", display: "block" }} />
            {anchors.filter((a) => a.page === i).map((a) => (
              <AnchorBox
                key={a._cid}
                anchor={a}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onMove={readOnly ? undefined : handleMove}
                onResize={readOnly ? undefined : handleResize}
                readOnly={readOnly}
                selected={a._cid === selectedAnchor?._cid}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
