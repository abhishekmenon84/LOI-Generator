"use client";

import { useState } from "react";
import KanbanCard from "./KanbanCard";

// Exact dot colors from the design handoff's STATUS_META (~L419-426).
const STATUS_DOTS = {
  draft: "oklch(58% 0.01 264)",
  active: "oklch(24% 0.015 264)",
  pending: "oklch(72% 0.15 75)",
  closed: "oklch(62% 0.15 155)",
};

const DRAG_ACTIVE_MAIN = "oklch(89% 0.03 300 / 0.5)";
const IDLE_MAIN = "oklch(93.5% 0.008 60 / 0.7)";

// The Archive/Trash side-columns this component used to render (via a
// `side` prop) moved to the dedicated /archive page -- Trash no longer
// exists as a concept at all, and archived folders are no longer shown
// inline in the Kanban board. This component now only renders the 4
// active-stage columns.
export default function KanbanColumn({
  stage,
  label,
  folders,
  onDragStart,
  onDrop,
  onArchive,
  childrenByParent,
  onUnnestChild,
  onCyclePriority,
  onNest,
  onOpen,
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        onDrop(e, stage);
      }}
      style={{
        flex: "0 0 272px",
        minWidth: 272,
        background: dragOver ? DRAG_ACTIVE_MAIN : IDLE_MAIN,
        borderRadius: 14,
        padding: 14,
        minHeight: 140,
        transition: "background .12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", display: "inline-block", background: STATUS_DOTS[stage] }} />
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{label}</span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "oklch(46% 0.015 264)",
            background: "oklch(99% 0.003 60)",
            padding: "2px 8px",
            borderRadius: 20,
          }}
        >
          {folders.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {folders.length === 0 ? (
          <div style={{ fontSize: 13, color: "oklch(55% 0.01 264)", padding: "10px 4px" }}>
            No folders here yet.
          </div>
        ) : (
          folders.map((folder) => (
            <KanbanCard
              key={folder.id}
              folder={folder}
              onDragStart={onDragStart}
              onArchive={folder.writeAccess ? onArchive : undefined}
              childThreads={childrenByParent?.get(folder.id) || []}
              onUnnestChild={onUnnestChild}
              onCyclePriority={onCyclePriority}
              onNest={onNest}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}
