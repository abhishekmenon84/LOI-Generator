"use client";

function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 6 6 6 20 6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12z" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

const DOCUMENT_TYPES = [
  { value: "purchase_loi", badge: "Purchase LOI", buildPath: "/app", bg: "rgba(79,70,229,0.12)", fg: "#4f46e5" },
  { value: "commercial_lease_loi", badge: "Lease LOI", buildPath: "/app/lease", bg: "rgba(59,130,246,0.12)", fg: "#2563eb" },
  { value: "residential_lease", badge: "Residential Lease", buildPath: "/app/residential-lease", bg: "rgba(16,185,129,0.12)", fg: "#059669" },
];

function typeMeta(documentType) {
  return DOCUMENT_TYPES.find((t) => t.value === documentType) || DOCUMENT_TYPES[0];
}

export default function KanbanCard({ deal, onDragStart, compact = false, stageControl, onArchive, onTrash, onRestore, onPermanentDelete }) {
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
        <div className="kanban-card-footer">
          <span className="kanban-card-compact-type">{meta.badge}</span>
          {(onRestore || onPermanentDelete) && (
            <div style={{ display: "flex", gap: 4 }}>
              {onRestore && (
                <button type="button" onClick={(e) => { e.preventDefault(); onRestore(); }} className="kanban-card-overflow-btn" title="Restore">
                  <RestoreIcon />
                </button>
              )}
              {onPermanentDelete && (
                <button type="button" onClick={(e) => { e.preventDefault(); onPermanentDelete(); }} className="kanban-card-overflow-btn" title="Delete permanently">
                  <TrashIcon />
                </button>
              )}
            </div>
          )}
        </div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {stageControl}
            {(onArchive || onTrash) && (
              <div style={{ display: "flex", gap: 4 }}>
                {onArchive && (
                  <button type="button" onClick={(e) => { e.preventDefault(); onArchive(deal.id); }} className="kanban-card-overflow-btn" title="Archive">
                    <ArchiveIcon />
                  </button>
                )}
                {onTrash && (
                  <button type="button" onClick={(e) => { e.preventDefault(); onTrash(deal.id); }} className="kanban-card-overflow-btn" title="Move to Trash">
                    <TrashIcon />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </a>
  );
}
