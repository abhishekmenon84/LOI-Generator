"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const QUICK_ACTIONS = [
  { value: "purchase_loi", label: "Purchase LOI", glyph: "▤" },
  { value: "commercial_lease", label: "Commercial Lease", glyph: "▥" },
  { value: "residential_lease", label: "Residential Lease", glyph: "▦" },
];

// Quick-create just navigates to the dashboard with a query param the
// existing DealList.jsx create-flow reads to pre-select a document type,
// rather than duplicating DealList.jsx's own folder+ledger POST sequence
// here -- keeps creation logic in exactly one place.
export default function TopBar({ onOpenSearch, userInitial = "?" }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  function startQuickCreate(documentType) {
    setCreateOpen(false);
    router.push(`/dashboard?quickCreate=${documentType}`);
  }

  return (
    <div
      style={{
        height: 64,
        flex: "0 0 auto",
        background: "white",
        borderBottom: "1px solid oklch(88% 0.008 60)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
      }}
    >
      <div
        onClick={onOpenSearch}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          width: 340,
          padding: "9px 13px",
          borderRadius: 10,
          border: "1px solid oklch(88% 0.008 60)",
          background: "oklch(97% 0.006 60)",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, color: "oklch(60% 0.01 264)" }}>⌕</span>
        <span style={{ fontSize: 13.5, color: "oklch(60% 0.01 264)", flex: 1 }}>Search documents...</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(50% 0.012 264)", background: "white", border: "1px solid oklch(88% 0.008 60)", padding: "2px 6px", borderRadius: 6 }}>
          ⌘K
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontSize: 17, cursor: "pointer", lineHeight: 1 }}
        >
          +
        </button>
        {createOpen && (
          <div
            style={{
              position: "absolute",
              top: 42,
              right: 88,
              width: 220,
              background: "white",
              border: "1px solid oklch(88% 0.008 60)",
              borderRadius: 14,
              boxShadow: "0 12px 32px rgba(17,17,17,0.12)",
              padding: 8,
              zIndex: 40,
            }}
          >
            {QUICK_ACTIONS.map((qa) => (
              <div
                key={qa.value}
                onClick={() => startQuickCreate(qa.value)}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 9, cursor: "pointer" }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: "center", color: "oklch(50% 0.012 264)" }}>{qa.glyph}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{qa.label}</span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid oklch(88% 0.008 60)", background: "white", cursor: "pointer", fontSize: 14, color: "oklch(50% 0.012 264)" }}
        >
          ◔
        </button>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "oklch(24% 0.015 264)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {userInitial}
        </div>
      </div>
    </div>
  );
}
