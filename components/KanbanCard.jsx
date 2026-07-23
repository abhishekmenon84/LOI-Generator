"use client";

const DOCUMENT_TYPES = [
  { value: "purchase_loi", badge: "Purchase LOI", buildPath: "/app" },
  { value: "commercial_lease_loi", badge: "Lease LOI", buildPath: "/app/lease" },
  { value: "residential_lease", badge: "Residential Lease", buildPath: "/app/residential-lease" },
];

function typeMeta(documentType) {
  return DOCUMENT_TYPES.find((t) => t.value === documentType) || DOCUMENT_TYPES[0];
}

export default function KanbanCard({ deal, onDragStart, stageControl }) {
  const meta = typeMeta(deal.documentType);
  return (
    <a
      href={`${meta.buildPath}?deal=${deal.id}`}
      className="kanban-card"
      draggable={deal.writeAccess}
      onDragStart={(e) => onDragStart(e, deal.id)}
      style={{
        display: "block",
        padding: "14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
        color: "var(--text-primary)",
        textDecoration: "none",
        marginBottom: 10,
        cursor: deal.writeAccess ? "grab" : "pointer",
        transition: "background 150ms ease, border-color 150ms ease",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: "0.88rem",
          marginBottom: 10,
          lineHeight: 1.35,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
        title={deal.name}
      >
        {deal.name}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.68rem",
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--accent-subtle)",
              color: "var(--accent-light)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {meta.badge}
          </span>
          {deal.isShared && (
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {deal.writeAccess ? "Shared · can edit" : "Shared · view only"}
            </span>
          )}
        </div>
        {stageControl}
      </div>
    </a>
  );
}
