"use client";

import { useState } from "react";
import KanbanColumn from "./KanbanColumn";

const STAGES = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active Deals" },
  { key: "pending", label: "Pending Deals" },
  { key: "closed", label: "Closed Deals" },
];

export default function KanbanDashboard({ initialDeals }) {
  const [deals, setDeals] = useState(initialDeals);
  const [error, setError] = useState(null);

  async function updateStage(dealId, newStage) {
    const prev = deals;
    setDeals((cur) => cur.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)));
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Could not update stage.");
    } catch (err) {
      setDeals(prev);
      setError(err.message);
    }
  }

  function handleDragStart(e, dealId) {
    e.dataTransfer.setData("text/plain", dealId);
  }

  function handleDrop(e, stage) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain");
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || !deal.writeAccess || deal.stage === stage) return;
    updateStage(dealId, stage);
  }

  return (
    <div>
      {error && (
        <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        {STAGES.map((s) => (
          <KanbanColumn
            key={s.key}
            stage={s.key}
            label={s.label}
            deals={deals.filter((d) => d.stage === s.key)}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onStageChangeDropdown={updateStage}
          />
        ))}
      </div>
    </div>
  );
}
