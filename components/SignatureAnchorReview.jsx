"use client";

// Lighter sibling of AnchorEditor.jsx, purpose-built for the "Send for
// signature" placement-review step -- NOT a reuse of AnchorEditor itself,
// since most of its surface (checkbox/radio/custom wizard question,
// arbitrary type picker) is template-authoring-only and doesn't apply to a
// sender confirming where THIS signer's signature/initials/date box goes.
// Reuses AnchorBox (drag/resize rendering) and lib/anchorEditorState.mjs
// (pure clamp/patch helpers) as-is.

import { useEffect, useRef, useState } from "react";
import AnchorBox from "./AnchorBox";
import {
  patchAnchorByCid,
  removeAnchorByCid,
  clampAnchorPosition,
  clampAnchorSize,
} from "../lib/anchorEditorState.mjs";
import { ANCHOR_TYPES, validateSignatureAnchors } from "../lib/signatureAnchors.js";

const TYPE_LABELS = { signature: "Signature", initials: "Initials", date: "Date" };

let cidCounter = 0;
function nextCid() {
  cidCounter += 1;
  return `review_cid_${Date.now()}_${cidCounter}`;
}

// suggestedAnchors are signerOrder-keyed (percent, page-based, no _cid);
// this seeds the editable, _cid-keyed working copy the rest of the
// component operates on, tagging each with that signer's display label.
function seedAnchors(suggestedAnchors, participants) {
  return (suggestedAnchors || []).map((a) => ({
    ...a,
    _cid: nextCid(),
    label: participants[a.signerOrder]?.name || `Signer ${a.signerOrder + 1}`,
  }));
}

export default function SignatureAnchorReview({ pdfBase64, pageSizes, suggestedAnchors, participants, onConfirm, onCancel, submitting = false, externalError = null }) {
  const signerParticipants = participants
    .map((p, index) => ({ ...p, _participantIndex: index }))
    .filter((p) => p.kind === "signer" && (p.name || "").trim());
  // Re-derive each signer's own signerOrder the same way the create route
  // will (ascending among kind==="signer" only) -- this component only
  // ever sees `participants` before any SignerSlot/order exists server-side.
  let orderCounter = 0;
  const signersWithOrder = signerParticipants.map((p) => ({ ...p, signerOrder: orderCounter++ }));

  const [anchors, setAnchors] = useState(() => seedAnchors(suggestedAnchors, signersWithOrder));
  const [selectedSignerOrder, setSelectedSignerOrder] = useState(signersWithOrder[0]?.signerOrder ?? 0);
  const [selectedType, setSelectedType] = useState("signature");
  const [selectedAnchor, setSelectedAnchor] = useState(null);
  const [pageImages, setPageImages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
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
    render();
    return () => {
      cancelled = true;
    };
  }, [pdfBase64]);

  function handlePageClick(pageIndex, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const signer = signersWithOrder.find((s) => s.signerOrder === selectedSignerOrder);
    const newAnchor = {
      _cid: nextCid(),
      signerOrder: selectedSignerOrder,
      label: signer?.name || `Signer ${selectedSignerOrder + 1}`,
      type: selectedType,
      page: pageIndex,
      xPct,
      yPct,
      widthPct: 12,
      heightPct: 4,
    };
    setAnchors((prev) => [...prev, newAnchor]);
    setSelectedAnchor(newAnchor);
  }

  function handleDelete(toDelete) {
    setAnchors((prev) => removeAnchorByCid(prev, toDelete._cid));
    setSelectedAnchor((prev) => (prev && prev._cid === toDelete._cid ? null : prev));
  }

  function handleMove(anchor, xPct, yPct) {
    const clamped = clampAnchorPosition(xPct, yPct, anchor.widthPct, anchor.heightPct);
    const { anchors: updated, selected } = patchAnchorByCid(anchors, anchor._cid, clamped);
    setAnchors(updated);
    if (selectedAnchor?._cid === anchor._cid) setSelectedAnchor(selected);
  }

  function handleResize(anchor, widthPct, heightPct) {
    const clamped = clampAnchorSize(anchor.xPct, anchor.yPct, widthPct, heightPct);
    const { anchors: updated, selected } = patchAnchorByCid(anchors, anchor._cid, clamped);
    setAnchors(updated);
    if (selectedAnchor?._cid === anchor._cid) setSelectedAnchor(selected);
  }

  function handleConfirm() {
    const payload = anchors.map(({ signerOrder, type, page, xPct, yPct, widthPct, heightPct }) => ({
      signerOrder,
      type,
      page,
      xPct,
      yPct,
      widthPct,
      heightPct,
    }));
    const errors = validateSignatureAnchors(payload, signersWithOrder.map((s) => s.signerOrder));
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    setError(null);
    onConfirm(payload);
  }

  const sidebarButtonStyle = (active) => ({
    padding: "6px 10px",
    borderRadius: "6px",
    border: active ? "2px solid oklch(45% 0.2 264)" : "1px solid var(--border)",
    background: active ? "oklch(45% 0.2 264 / 0.1)" : "none",
    cursor: "pointer",
    fontSize: "12px",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-base)", zIndex: 1100, display: "flex" }}>
      <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--border)", padding: "16px 14px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
        <strong style={{ fontSize: "13px" }}>Confirm signature placement</strong>
        <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", margin: 0 }}>
          Select a signer, pick a type, then click on the page to place it. Drag to move, use the corner handle to resize.
        </p>
        {signersWithOrder.map((s) => (
          <div key={s.signerOrder} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
            <button type="button" onClick={() => setSelectedSignerOrder(s.signerOrder)} style={sidebarButtonStyle(selectedSignerOrder === s.signerOrder)}>
              {s.name}
            </button>
            {selectedSignerOrder === s.signerOrder && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ANCHOR_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setSelectedType(t)} style={sidebarButtonStyle(selectedType === t)}>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* externalError comes from the parent's submit attempt (e.g. the
            create-request POST failing after the user confirmed placement);
            it takes precedence since it reflects the most recent action. Our
            own validation `error` still shows when there's no external one. */}
        {(externalError || error) && (
          <div className="status-banner status-error" role="alert">⚠️ {externalError || error}</div>
        )}

        <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} disabled={submitting} style={{ flex: 1, background: "none", border: "1px solid var(--border)", padding: "8px 10px", borderRadius: 8, cursor: submitting ? "not-allowed" : "pointer" }}>
            Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className="marketing-cta-button" style={{ flex: 1 }}>
            {submitting ? "Sending…" : "Continue"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 16 }}>
        {pageImages.map((src, i) => (
          <div key={i} data-anchor-page="true" onClick={(e) => handlePageClick(i, e)} style={{ position: "relative", cursor: "crosshair", maxWidth: "100%" }}>
            <img src={src} alt={`Page ${i + 1}`} style={{ width: "100%", display: "block" }} />
            {anchors.filter((a) => a.page === i).map((a) => (
              <AnchorBox
                key={a._cid}
                anchor={a}
                onSelect={setSelectedAnchor}
                onDelete={handleDelete}
                onMove={handleMove}
                onResize={handleResize}
                selected={a._cid === selectedAnchor?._cid}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
