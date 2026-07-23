"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCOUNT_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "real_estate_agency", label: "Real Estate Agency" },
  { value: "company", label: "Company" },
  { value: "corporation", label: "Corporation" },
];

export default function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("real_estate_agency");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), accountType }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create organization.");
      router.push(`/settings/organization?org=${body.id}`);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
      <div className="form-group">
        <label htmlFor="orgName">Organization name</label>
        <input id="orgName" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ABC Realty" />
      </div>
      <div className="form-group">
        <label htmlFor="orgType">Account type</label>
        <select id="orgType" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}
      <button type="submit" className="marketing-cta-button" disabled={creating}>
        {creating ? "Creating…" : "Start 7-day free trial"}
      </button>
    </form>
  );
}
