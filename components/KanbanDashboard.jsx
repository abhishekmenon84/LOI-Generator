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
  const [parentDealIdForCreate, setParentDealIdForCreate] = useState(null);

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
        body: JSON.stringify({
          name,
          documentType: selectedType,
          ...(selectedOrgId ? { orgId: selectedOrgId } : {}),
          ...(parentDealIdForCreate ? { parentDealId: parentDealIdForCreate } : {}),
        }),
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

  async function handleUnlinkChild(childId) {
    const prevDeals = deals;
    setDeals((cur) => cur.map((d) => (d.id === childId ? { ...d, parentDealId: null, priority: null } : d)));
    try {
      const res = await fetch(`/api/deals/${childId}/unlink`, { method: "POST" });
      if (!res.ok) throw new Error("Could not unlink deal.");
    } catch (err) {
      setDeals(prevDeals);
      setError(err.message);
    }
  }

  async function handleSetChildPriority(childId, priority) {
    const prevDeals = deals;
    setDeals((cur) => cur.map((d) => (d.id === childId ? { ...d, priority } : d)));
    try {
      const res = await fetch(`/api/deals/${childId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error("Could not set priority.");
    } catch (err) {
      setDeals(prevDeals);
      setError(err.message);
    }
  }

  async function handleLinkChild(childId, parentId) {
    if (childId === parentId) return;
    const prevDeals = deals;
    setDeals((cur) => cur.map((d) => (d.id === childId ? { ...d, parentDealId: parentId } : d)));
    try {
      const res = await fetch(`/api/deals/${parentId}/link-child`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childDealId: childId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not link deal.");
      }
    } catch (err) {
      setDeals(prevDeals);
      setError(err.message);
    }
  }

  async function handleArchive(dealId) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const children = deals.filter((d) => d.parentDealId === dealId);
    let alsoArchiveChildren = false;
    if (children.length > 0) {
      alsoArchiveChildren = window.confirm(
        `"${deal.name}" has ${children.length} linked offer${children.length === 1 ? "" : "s"}. Also archive ${children.length === 1 ? "it" : "them"}? (Cancel archives only the parent.)`
      );
    }
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
    if (alsoArchiveChildren) {
      for (const child of children) {
        setDeals((cur) => cur.filter((d) => d.id !== child.id));
        setArchivedDeals((cur) => [...cur, { ...child }]);
        try {
          const res = await fetch(`/api/deals/${child.id}/archive`, { method: "POST" });
          if (!res.ok) throw new Error("Could not archive deal.");
        } catch (err) {
          setDeals((cur) => [...cur, child]);
          setArchivedDeals((cur) => cur.filter((d) => d.id !== child.id));
          setError(err.message);
        }
      }
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
      setDeals((cur) => cur.filter((d) => d.id !== dealId));
      if (from === "trash") setTrashedDeals((cur) => [...cur, deal]);
      else setArchivedDeals((cur) => [...cur, deal]);
      setError(err.message);
    }
  }

  async function handleTrash(dealId) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const children = deals.filter((d) => d.parentDealId === dealId);
    let alsoTrashChildren = false;
    if (children.length > 0) {
      alsoTrashChildren = window.confirm(
        `"${deal.name}" has ${children.length} linked offer${children.length === 1 ? "" : "s"}. Also move ${children.length === 1 ? "it" : "them"} to trash? (Cancel trashes only the parent.)`
      );
    }
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
    if (alsoTrashChildren) {
      for (const child of children) {
        setDeals((cur) => cur.filter((d) => d.id !== child.id));
        setTrashedDeals((cur) => [...cur, { ...child }]);
        try {
          const res = await fetch(`/api/deals/${child.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Could not move deal to trash.");
        } catch (err) {
          setDeals((cur) => [...cur, child]);
          setTrashedDeals((cur) => cur.filter((d) => d.id !== child.id));
          setError(err.message);
        }
      }
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

  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const d of filteredDeals) {
      if (d.parentDealId) {
        if (!map.has(d.parentDealId)) map.set(d.parentDealId, []);
        map.get(d.parentDealId).push(d);
      }
    }
    return map;
  }, [filteredDeals]);

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
          {!selectedType && !parentDealIdForCreate ? (
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
                  onClick={() => {
                    setCreating(false);
                    setParentDealIdForCreate(null);
                  }}
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
                    setParentDealIdForCreate(null);
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
                  setParentDealIdForCreate(null);
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
            deals={filteredDeals.filter((d) => d.stage === s.key && !d.parentDealId)}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onStageChangeDropdown={updateStage}
            onArchive={handleArchive}
            onTrash={handleTrash}
            childrenByParent={childrenByParent}
            onUnlinkChild={handleUnlinkChild}
            onSetChildPriority={handleSetChildPriority}
            onAddOffer={(parent) => {
              setSelectedType(parent.documentType);
              setParentDealIdForCreate(parent.id);
              setCreating(true);
            }}
            onLinkChild={handleLinkChild}
          />
        ))}

        <div className="kanban-board-divider" aria-hidden="true" />

        <KanbanColumn stage="archive" label="Archive" deals={archivedDeals} onDragStart={handleDragStart} onDrop={() => {}} side onRestore={handleRestore} />
        <KanbanColumn stage="trash" label="Trash" deals={trashedDeals} onDragStart={handleDragStart} onDrop={() => {}} side onRestore={handleRestore} onPermanentDelete={handlePermanentDelete} />
      </div>
    </div>
  );
}
