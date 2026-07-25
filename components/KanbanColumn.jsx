"use client";

import { useState } from "react";
import KanbanCard from "./KanbanCard";

const STAGE_DOTS = {
  draft: "var(--text-muted)",
  active: "var(--accent)",
  pending: "#f59e0b",
  closed: "#10b981",
  archive: "var(--text-muted)",
  trash: "#ef4444",
};

export default function KanbanColumn({
  stage,
  label,
  deals,
  onDragStart,
  onDrop,
  onStageChangeDropdown,
  onArchive,
  onTrash,
  onRestore,
  onPermanentDelete,
  side = false,
  childrenByParent,
  onUnlinkChild,
  onSetChildPriority,
  onAddOffer,
  onLinkChild,
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
      className={`kanban-column${side ? " kanban-column-side" : ""}${dragOver ? " kanban-column-dragover" : ""}`}
    >
      <div className="kanban-column-header">
        <div className="kanban-column-title">
          <span className="kanban-column-dot" style={{ background: STAGE_DOTS[stage] }} />
          <span className="kanban-column-label">{label}</span>
        </div>
        <span className="kanban-column-count">{deals.length}</span>
      </div>
      <div className="kanban-column-body">
        {deals.length === 0 ? (
          <p className="kanban-column-empty">{side ? "Empty" : "No deals here yet."}</p>
        ) : (
          deals.map((deal) =>
            side ? (
              <KanbanCard
                key={deal.id}
                deal={deal}
                onDragStart={onDragStart}
                compact
                onRestore={onRestore ? () => onRestore(deal.id, stage) : undefined}
                onPermanentDelete={stage === "trash" && onPermanentDelete ? () => onPermanentDelete(deal.id) : undefined}
              />
            ) : (
              <KanbanCard
                key={deal.id}
                deal={deal}
                onDragStart={onDragStart}
                onArchive={deal.writeAccess ? onArchive : undefined}
                onTrash={deal.writeAccess ? onTrash : undefined}
                childThreads={childrenByParent?.get(deal.id) || []}
                onUnlinkChild={onUnlinkChild}
                onSetChildPriority={onSetChildPriority}
                onAddOffer={onAddOffer}
                onLinkChild={onLinkChild}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
