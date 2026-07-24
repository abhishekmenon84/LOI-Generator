"use client";

const DOCUMENT_TYPES = [
  { value: "purchase_loi", badge: "Purchase LOI", buildPath: "/app", bg: "rgba(79,70,229,0.12)", fg: "#4f46e5" },
  { value: "commercial_lease_loi", badge: "Lease LOI", buildPath: "/app/lease", bg: "rgba(59,130,246,0.12)", fg: "#2563eb" },
  { value: "residential_lease", badge: "Residential Lease", buildPath: "/app/residential-lease", bg: "rgba(16,185,129,0.12)", fg: "#059669" },
];

function typeMeta(documentType) {
  return DOCUMENT_TYPES.find((t) => t.value === documentType) || DOCUMENT_TYPES[0];
}

export default function KanbanCard({ deal, onDragStart, compact = false, stageControl }) {
  const meta = typeMeta(deal.documentType);
  return (
    <a
      href={`${meta.buildPath}?deal=${deal.id}`}
      className={`kanban-card${compact ? " kanban-card-compact" : ""}`}
      draggable={deal.writeAccess}
      onDragStart={(e) => onDragStart(e, deal.id)}
      style={{ borderLeftColor: meta.fg }}
      title={deal.name}
    >
      <div className="kanban-card-name">{deal.name}</div>
      {compact ? (
        <span className="kanban-card-compact-type">{meta.badge}</span>
      ) : (
        <div className="kanban-card-footer">
          <div className="kanban-card-tags">
            <span className="kanban-type-badge" style={{ background: meta.bg, color: meta.fg }}>
              {meta.badge}
            </span>
            {deal.isShared && (
              <span className="kanban-card-shared">
                {deal.writeAccess ? "Shared · can edit" : "Shared · view only"}
              </span>
            )}
          </div>
          {stageControl}
        </div>
      )}
    </a>
  );
}
