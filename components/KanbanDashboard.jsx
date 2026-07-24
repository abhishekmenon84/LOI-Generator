"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import KanbanColumn from "./KanbanColumn";

const STAGES = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active Deals" },
  { key: "pending", label: "Pending Deals" },
  { key: "closed", label: "Closed Deals" },
];

const DOCUMENT_TYPES = [
  { value: "purchase_loi", label: "Business + Real Estate Purchase LOI", buildPath: "/app" },
  { value: "commercial_lease_loi", label: "Commercial Lease LOI", buildPath: "/app/lease" },
  { value: "residential_lease", label: "Residential Lease (New Brunswick)", buildPath: "/app/residential-lease" },
];

export default function KanbanDashboard({ initialDeals, initialArchived = [], initialTrashed = [], userOrgs = [] }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [archivedDeals, setArchivedDeals] = useState(initialArchived);
  const [trashedDeals, setTrashedDeals] = useState(initialTrashed);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [newDealName, setNewDealName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

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

  async function handleCreate(e) {
    e.preventDefault();
    const name = newDealName.trim();
    if (!name || !selectedType) return;
    setCreateBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, documentType: selectedType, ...(selectedOrgId ? { orgId: selectedOrgId } : {}) }),
      });
      if (!res.ok) throw new Error("Could not create deal.");
      const { id } = await res.json();
      const meta = DOCUMENT_TYPES.find((t) => t.value === selectedType);
      router.push(`${meta.buildPath}?deal=${id}`);
    } catch (err) {
      setError(err.message);
      setCreateBusy(false);
    }
  }

  async function handleArchive(dealId) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    setDeals((cur) => cur.filter((d) => d.id !== dealId));
    setArchivedDeals((cur) => [...cur, { ...deal }]);
    try {
      const res = await fetch(`/api/deals/${dealId}/archive`, { method: "POST" });
      if (!res.ok) throw new Error("Could not archive deal.");
    } catch (err) {
      setDeals((cur) => [...cur, deal]);
      setArchivedDeals((cur) => cur.filter((d) => d.id !== dealId));
      setError(err.message);
    }
  }

  async function handleRestore(dealId, from) {
    const source = from === "trash" ? trashedDeals : archivedDeals;
    const deal = source.find((d) => d.id === dealId);
    if (!deal) return;
    if (from === "trash") setTrashedDeals((cur) => cur.filter((d) => d.id !== dealId));
    else setArchivedDeals((cur) => cur.filter((d) => d.id !== dealId));
    setDeals((cur) => [...cur, { ...deal, stage: deal.stage || "draft" }]);
    try {
      const res = await fetch(`/api/deals/${dealId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Could not restore deal.");
    } catch (err) {
      setError(err.message);
      // Not reverting optimistic state on restore failure — a failed restore
      // leaving the deal visually "restored" but still archived server-side
      // is a smaller UX issue than a full state-thrash; the next page load
      // will reconcile from the server's actual state either way.
    }
  }

  async function handleTrash(dealId) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    setDeals((cur) => cur.filter((d) => d.id !== dealId));
    setTrashedDeals((cur) => [...cur, { ...deal }]);
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not move deal to trash.");
    } catch (err) {
      setDeals((cur) => [...cur, deal]);
      setTrashedDeals((cur) => cur.filter((d) => d.id !== dealId));
      setError(err.message);
    }
  }

  async function handlePermanentDelete(dealId) {
    if (!window.confirm("Permanently delete this deal? This cannot be undone.")) return;
    setTrashedDeals((cur) => cur.filter((d) => d.id !== dealId));
    try {
      const res = await fetch(`/api/deals/${dealId}/permanent`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not permanently delete deal.");
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (typeFilter !== "all" && d.documentType !== typeFilter) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [deals, search, typeFilter]);

  return (
    <div>
      <div className="kanban-toolbar">
        <input
          type="text"
          placeholder="Search deals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="kanban-search-input"
          aria-label="Search deals"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="kanban-type-filter"
          aria-label="Filter by document type"
        >
          <option value="all">All types</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="marketing-cta-button"
          onClick={() => setCreating(true)}
          style={{ marginLeft: "auto" }}
        >
          + Add Deal
        </button>
      </div>

      {creating && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-panel)" }}>
          {!selectedType ? (
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 10 }}>What kind of document?</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DOCUMENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className="marketing-cta-button"
                    onClick={() => setSelectedType(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : userOrgs.length > 1 && !selectedOrgId ? (
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 10 }}>Which organization?</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {userOrgs.map((o) => (
                  <button key={o.orgId} type="button" className="marketing-cta-button" onClick={() => setSelectedOrgId(o.orgId)}>
                    {o.isPersonal ? "Personal" : o.orgName}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setSelectedType(null);
                  }}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                autoFocus
                placeholder="Deal name, e.g. 123 Main St Acquisition"
                value={newDealName}
                onChange={(e) => setNewDealName(e.target.value)}
                className="kanban-search-input"
                style={{ width: 280 }}
              />
              <button type="submit" className="marketing-cta-button" disabled={createBusy || !newDealName.trim()}>
                {createBusy ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setSelectedType(null);
                  setSelectedOrgId(null);
                  setNewDealName("");
                }}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 14px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      <div className="kanban-board">
        {STAGES.map((s) => (
          <KanbanColumn
            key={s.key}
            stage={s.key}
            label={s.label}
            deals={filteredDeals.filter((d) => d.stage === s.key)}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onStageChangeDropdown={updateStage}
            onArchive={handleArchive}
            onTrash={handleTrash}
          />
        ))}

        <div className="kanban-board-divider" aria-hidden="true" />

        <KanbanColumn stage="archive" label="Archive" deals={archivedDeals} onDragStart={handleDragStart} onDrop={() => {}} side onRestore={handleRestore} />
        <KanbanColumn stage="trash" label="Trash" deals={trashedDeals} onDragStart={handleDragStart} onDrop={() => {}} side onRestore={handleRestore} onPermanentDelete={handlePermanentDelete} />
      </div>
    </div>
  );
}
