"use client";

export default function LoginChooser({ onChoose }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
        How are you using LOI Builder?
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <button
          type="button"
          onClick={() => onChoose("personal")}
          style={{
            padding: "24px 20px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            textAlign: "left",
            cursor: "pointer",
            transition: "border-color 150ms ease, background 150ms ease",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 6 }}>Personal</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Build and download documents for your own deals.
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChoose("business")}
          style={{
            padding: "24px 20px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            textAlign: "left",
            cursor: "pointer",
            transition: "border-color 150ms ease, background 150ms ease",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 6 }}>Business</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Manage your team&apos;s deal pipeline in one place.
          </div>
        </button>
      </div>
    </div>
  );
}
