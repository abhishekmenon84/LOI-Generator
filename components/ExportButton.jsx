"use client";

import { useEffect, useRef, useState } from "react";

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

const FORMATS = [
  { value: "docx", label: "Word (.docx)" },
  { value: "pdf", label: "PDF (.pdf)" },
];

// One "Export" button with a format dropdown, replacing two separate
// always-visible Word/PDF buttons -- same single action (download this
// document), the only real choice is which file format, so it reads as
// one decision instead of two competing buttons.
export default function ExportButton({ onExport, exportState, className = "btn-doc-action" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isExporting = !!exportState?.loading;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handlePick(format) {
    setOpen(false);
    onExport(format);
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className={className}
        disabled={isExporting}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isExporting ? <div className="spinner" /> : <DownloadIcon />}
        Export{isExporting ? ` (${exportState.format === "docx" ? "Word" : "PDF"}…)` : ""}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 160,
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(17,17,17,0.16)",
            zIndex: 50,
            padding: 4,
          }}
        >
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="menuitem"
              onClick={() => handlePick(f.value)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 6,
                border: "none",
                background: "none",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-subtle, rgba(0,0,0,0.05))")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
