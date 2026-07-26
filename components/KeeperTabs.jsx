"use client";

import { useState } from "react";

const TABS = [
  { id: "members", label: "Members" },
  { id: "templates", label: "Templates" },
  { id: "branding", label: "Branding" },
  { id: "billing", label: "Billing" },
  { id: "receipts", label: "Receipts" },
];

export default function KeeperTabs({ panels }) {
  const [activeTab, setActiveTab] = useState("members");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: activeTab === t.id ? 700 : 500,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{panels[activeTab]}</div>
    </div>
  );
}
