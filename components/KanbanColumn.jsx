"use client";

import { useState } from "react";
import KanbanCard from "./KanbanCard";

// Exact dot colors from the design handoff's STATUS_META (~L419-426).
const STATUS_DOTS = {
  draft: "oklch(58% 0.01 264)",
  active: "oklch(24% 0.015 264)",
  pending: "oklch(72% 0.15 75)",
  closed: "oklch(62% 0.15 155)",
  archive: "oklch(60% 0.01 264)",
  trash: "oklch(58% 0.18 25)",
};

const DRAG_ACTIVE_MAIN = "oklch(89% 0.03 300 / 0.5)";
const IDLE_MAIN = "oklch(93.5% 0.008 60 / 0.7)";
const DRAG_ACTIVE_SIDE = "oklch(89% 0.03 300 / 0.5)";
const IDLE_SIDE = "oklch(94% 0.006 60 / 0.5)";

export default function KanbanColumn({
  stage,
  label,
  folders,
  onDragStart,
  onDrop,
  onArchive,
  onTrash,
  onRestore,
  side = false,
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
        flex: side ? "0 0 192px" : "0 0 272px",
        minWidth: side ? 192 : 272,
        background: dragOver ? (side ? DRAG_ACTIVE_SIDE : DRAG_ACTIVE_MAIN) : (side ? IDLE_SIDE : IDLE_MAIN),
        borderRadius: 14,
        padding: side ? 12 : 14,
        minHeight: side ? 110 : 140,
        opacity: side ? 0.88 : 1,
        transition: "background .12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: side ? 12 : 14, padding: side ? "0 2px" : "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: side ? 7 : 8 }}>
          <span style={{ width: side ? 8 : 9, height: side ? 8 : 9, borderRadius: "50%", display: "inline-block", background: STATUS_DOTS[stage] }} />
          <span style={{ fontWeight: side ? 650 : 700, fontSize: side ? 13 : 14.5, color: side ? "oklch(40% 0.012 264)" : undefined }}>{label}</span>
        </div>
        <span
          style={{
            fontSize: side ? 11 : 12,
            fontWeight: 600,
            color: side ? "oklch(50% 0.012 264)" : "oklch(46% 0.015 264)",
            background: "oklch(99% 0.003 60)",
            padding: side ? "1px 7px" : "2px 8px",
            borderRadius: 20,
          }}
        >
          {folders.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: side ? 8 : 10 }}>
        {folders.length === 0 ? (
          <div style={{ fontSize: side ? 12 : 13, color: side ? "oklch(58% 0.01 264)" : "oklch(55% 0.01 264)", padding: side ? "6px 2px" : "10px 4px" }}>
            {side ? "Empty" : "No folders here yet."}
          </div>
        ) : (
          folders.map((folder) =>
            side ? (
              <KanbanCard
                key={folder.id}
                folder={folder}
                onDragStart={onDragStart}
                compact
                onRestore={onRestore ? () => onRestore(folder.id) : undefined}
              />
            ) : (
              <KanbanCard
                key={folder.id}
                folder={folder}
                onDragStart={onDragStart}
                onArchive={folder.writeAccess ? onArchive : undefined}
                onTrash={folder.writeAccess ? onTrash : undefined}
                childThreads={childrenByParent?.get(folder.id) || []}
                onUnnestChild={onUnnestChild}
                onCyclePriority={onCyclePriority}
                onNest={onNest}
                onOpen={onOpen}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
