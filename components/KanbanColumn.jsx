"use client";

import KanbanCard from "./KanbanCard";

const STAGE_ACCENTS = {
  draft: "var(--text-muted)",
  active: "var(--accent)",
  pending: "#f59e0b",
  closed: "#10b981",
};

export default function KanbanColumn({ stage, label, deals, onDragStart, onDrop, onStageChangeDropdown }) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, stage)}
      style={{
        flex: 1,
        minWidth: 260,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_ACCENTS[stage] }} />
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{label}</h2>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>{deals.length}</span>
      </div>
      <div style={{ flex: 1, minHeight: 40 }}>
        {deals.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No deals here yet.</p>
        ) : (
          deals.map((deal) => (
            <div key={deal.id}>
              <KanbanCardWithDropdown deal={deal} onDragStart={onDragStart} onStageChangeDropdown={onStageChangeDropdown} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCardWithDropdown({ deal, onDragStart, onStageChangeDropdown }) {
  const stageControl = deal.writeAccess ? (
    <select
      value={deal.stage}
      onChange={(e) => onStageChangeDropdown(deal.id, e.target.value)}
      onClick={(e) => e.preventDefault()}
      aria-label={`Change stage for ${deal.name}`}
      style={{
        fontSize: "0.68rem",
        padding: "3px 6px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--bg-base)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <option value="draft">Draft</option>
      <option value="active">Active</option>
      <option value="pending">Pending</option>
      <option value="closed">Closed</option>
    </select>
  ) : null;

  return <KanbanCard deal={deal} onDragStart={onDragStart} stageControl={stageControl} />;
}
