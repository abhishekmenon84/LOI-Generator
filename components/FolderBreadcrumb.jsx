"use client";

import Link from "next/link";

// Matches the design handoff's isWorkspace breadcrumb row
// (Design/real-estate-deal-kanban-board/project/Ledgerlot App.dc.html, ~L149-156)
// and its buildBreadcrumb() logic (~L667-687): "Ledgerboard" always links to
// the board; each ancestor folder is a clickable link; the current folder
// segment renders bold/static unless a document is selected, in which case
// the current folder becomes a link too and the selected document name
// becomes the new bold/static trailing segment.
export default function FolderBreadcrumb({ ancestors = [], current, selectedDocName }) {
  const activeColor = "oklch(24% 0.015 264)";
  const staticColor = "oklch(30% 0.01 264)";
  const sepColor = "oklch(75% 0.01 264)";

  const currentIsStatic = !selectedDocName;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "14px 28px",
        background: "oklch(99% 0.003 60)",
        borderBottom: "1px solid oklch(91% 0.006 60)",
        fontSize: "13px",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Link
          href="/documents"
          style={{ cursor: "pointer", fontWeight: 600, color: activeColor, textDecoration: "none" }}
        >
          Ledgerboard
        </Link>
        <span style={{ color: sepColor }}>&rsaquo;</span>
      </span>

      {ancestors.map((ancestor) => (
        <span key={ancestor.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Link
            href={`/ledgerboard/folder/${ancestor.id}`}
            style={{ cursor: "pointer", fontWeight: 600, color: activeColor, textDecoration: "none" }}
          >
            {ancestor.name}
          </Link>
          <span style={{ color: sepColor }}>&rsaquo;</span>
        </span>
      ))}

      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {currentIsStatic ? (
          <span style={{ fontWeight: 700, color: staticColor, cursor: "default" }}>{current?.name}</span>
        ) : (
          // Fix round 1 (Minor #8): plain span instead of an inert
          // Link href="#" that preventDefaults its own click -- matches how
          // the handoff renders all breadcrumb segments as clickable spans,
          // not anchor tags with dead hrefs.
          <span style={{ fontWeight: 600, color: activeColor, cursor: "default" }}>
            {current?.name}
          </span>
        )}
        {selectedDocName ? <span style={{ color: sepColor }}>&rsaquo;</span> : null}
      </span>

      {selectedDocName ? (
        <span style={{ fontWeight: 700, color: staticColor }}>{selectedDocName}</span>
      ) : null}
    </div>
  );
}
