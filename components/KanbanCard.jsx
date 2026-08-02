"use client";

import { useState } from "react";

// Exact OKLCH values from the design handoff's TYPE_META
// (Design/real-estate-deal-kanban-board/project/Ledgerlot App.dc.html, ~L413-418),
// keyed by this codebase's real Ledger.documentType values instead of the
// handoff's display-label keys.
const TYPE_META = {
  purchase_loi: { label: "Purchase LOI", accent: "oklch(62% 0.15 75)", bg: "oklch(94% 0.06 75)", fg: "oklch(42% 0.13 75)" },
  commercial_lease: { label: "Commercial Lease", accent: "oklch(60% 0.13 235)", bg: "oklch(93% 0.04 235)", fg: "oklch(40% 0.12 235)" },
  residential_lease: { label: "Residential Lease", accent: "oklch(62% 0.14 155)", bg: "oklch(94% 0.05 155)", fg: "oklch(38% 0.12 155)" },
  custom_template: { label: "Custom Template", accent: "oklch(50% 0.012 264)", bg: "oklch(93% 0.012 60)", fg: "oklch(24% 0.015 264)" },
};
const DEFAULT_TYPE_META = TYPE_META.custom_template;

function typeMeta(documentType) {
  return TYPE_META[documentType] || DEFAULT_TYPE_META;
}

// Exact OKLCH values from the design handoff's STATUS_META (~L419-426).
const STATUS_META = {
  draft: { label: "Draft", dot: "oklch(58% 0.01 264)", bg: "oklch(92% 0.006 264)", fg: "oklch(42% 0.01 264)" },
  active: { label: "Active", dot: "oklch(24% 0.015 264)", bg: "oklch(93% 0.012 60)", fg: "oklch(24% 0.015 264)" },
  pending: { label: "Pending", dot: "oklch(72% 0.15 75)", bg: "oklch(94% 0.06 75)", fg: "oklch(42% 0.13 75)" },
  closed: { label: "Closed", dot: "oklch(62% 0.15 155)", bg: "oklch(94% 0.05 155)", fg: "oklch(38% 0.12 155)" },
  archive: { label: "Archived", dot: "oklch(60% 0.01 264)", bg: "oklch(92% 0.006 264)", fg: "oklch(45% 0.01 264)" },
  trash: { label: "Trashed", dot: "oklch(58% 0.18 25)", bg: "oklch(93% 0.05 25)", fg: "oklch(45% 0.16 25)" },
};

// Exact OKLCH values + cycle order from the design handoff's PRIORITY_META /
// PRIORITY_ORDER (~L427-431).
const PRIORITY_ORDER = ["green", "yellow", "grey"];
const PRIORITY_META = {
  green: { color: "oklch(62% 0.15 155)", label: "High priority" },
  yellow: { color: "oklch(78% 0.15 90)", label: "Medium priority" },
  grey: { color: "oklch(65% 0.01 264)", label: "Low priority" },
};

function ThreadRow({ child, hasGreenSibling, onOpen, onUnnest, onCyclePriority }) {
  const priorityMeta = PRIORITY_META[child.priority] || PRIORITY_META.grey;
  const statusMeta = STATUS_META[child.stage] || STATUS_META.draft;
  const opacity = hasGreenSibling && child.priority !== "green" ? 0.5 : 1;
  return (
    <div
      onClick={() => onOpen(child.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 9px",
        borderRadius: 8,
        background: "oklch(97% 0.005 60)",
        opacity,
        cursor: "pointer",
        transition: "opacity .15s",
      }}
    >
      <span
        title={priorityMeta.label}
        onClick={(e) => {
          e.stopPropagation();
          onCyclePriority(child.id, child.priority);
        }}
        style={{ width: 9, height: 9, borderRadius: "50%", background: priorityMeta.color, flex: "0 0 auto", cursor: "pointer" }}
      />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {child.name}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 7px",
          borderRadius: 20,
          background: statusMeta.bg,
          color: statusMeta.fg,
          flex: "0 0 auto",
        }}
      >
        {statusMeta.label}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onUnnest(child.id);
        }}
        title="Move back to its own column"
        style={{ border: "none", background: "transparent", color: "oklch(50% 0.02 264)", cursor: "pointer", fontSize: 12, padding: "2px 4px", flex: "0 0 auto" }}
      >
        ⤴
      </button>
    </div>
  );
}

export default function KanbanCard({
  folder,
  onDragStart,
  compact = false,
  onArchive,
  onTrash,
  onRestore,
  childThreads = [],
  onUnnestChild,
  onCyclePriority,
  onNest,
  onOpen,
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = typeMeta(folder.documentType);
  const statusMeta = STATUS_META[folder.stage] || STATUS_META.draft;
  const showStatusPill = folder.stage !== "active";

  function handleClick(e) {
    if (e.defaultPrevented) return;
    onOpen?.(folder.id);
  }

  if (compact) {
    return (
      <div
        draggable={folder.writeAccess}
        onDragStart={(e) => onDragStart(e, folder.id)}
        style={{
          background: "oklch(99% 0.003 60 / 0.9)",
          borderRadius: 9,
          padding: "10px 11px",
          cursor: "grab",
          borderLeft: `2px solid ${meta.accent}`,
          fontSize: 12.5,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span>{folder.name}</span>
          {onRestore && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onRestore(folder.id);
              }}
              title="Restore"
              style={{ border: "none", background: "transparent", color: "oklch(45% 0.13 155)", cursor: "pointer", fontSize: 11.5 }}
            >
              ↩
            </button>
          )}
        </div>
        <span style={{ fontSize: 10.5, color: "oklch(52% 0.012 264)" }}>{meta.label}</span>
      </div>
    );
  }

  return (
    <div
      draggable={folder.writeAccess}
      onDragStart={(e) => onDragStart(e, folder.id)}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === folder.id) return;
        onNest?.(draggedId, folder.id);
      }}
      style={{
        background: "oklch(99% 0.003 60)",
        borderRadius: 12,
        padding: 14,
        cursor: "grab",
        borderLeft: `3px solid ${meta.accent}`,
        boxShadow: "0 1px 2px rgba(30,25,15,.06)",
        transition: "box-shadow .12s, transform .12s",
      }}
      title={folder.name}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 9 }}>
        <div style={{ fontWeight: 650, fontSize: 14.5, lineHeight: 1.35, cursor: "pointer" }} onClick={handleClick}>
          {folder.name}
        </div>
        <div style={{ display: "flex", gap: 4, flex: "0 0 auto" }}>
          {onArchive && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onArchive(folder.id);
              }}
              title="Archive"
              className="kanban-card-overflow-btn"
              style={{ border: "none", background: "transparent", color: "oklch(55% 0.015 264)", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 6, lineHeight: 1 }}
            >
              🗄
            </button>
          )}
          {onTrash && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onTrash(folder.id);
              }}
              title="Trash"
              className="kanban-card-overflow-btn"
              style={{ border: "none", background: "transparent", color: "oklch(55% 0.015 264)", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 6, lineHeight: 1 }}
            >
              🗑
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
        {showStatusPill && (
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2.5px 8px", borderRadius: 20, background: statusMeta.bg, color: statusMeta.fg }}>
            {statusMeta.label}
          </span>
        )}
        {childThreads.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            style={{ border: "none", background: "oklch(93% 0.012 60)", color: "oklch(24% 0.015 264)", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, cursor: "pointer" }}
          >
            {childThreads.length} sub folder{childThreads.length === 1 ? "" : "s"} {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>

      {expanded && childThreads.length > 0 && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px dashed oklch(88% 0.008 60)", display: "flex", flexDirection: "column", gap: 7 }}>
          {childThreads.map((child) => (
            <ThreadRow
              key={child.id}
              child={child}
              hasGreenSibling={childThreads.some((c) => c.priority === "green")}
              onOpen={onOpen}
              onUnnest={onUnnestChild}
              onCyclePriority={onCyclePriority}
            />
          ))}
        </div>
      )}
    </div>
  );
}
