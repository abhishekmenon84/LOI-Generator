"use client";

import { useEffect, useState } from "react";

const EVENT_TYPES = [
  { value: "document.signed", label: "Document signed (per signer)" },
  { value: "document.fully_signed", label: "Document fully signed" },
  { value: "document.declined", label: "Signature declined" },
  { value: "folder.archived", label: "Folder archived" },
];

export default function KeeperApiSettings({ orgId }) {
  const [keys, setKeys] = useState(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState(null);
  const [webhooks, setWebhooks] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [error, setError] = useState(null);

  function loadKeys() {
    fetch(`/api/orgs/${orgId}/api-keys`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setKeys(data.keys || []))
      .catch(() => {});
  }
  function loadWebhooks() {
    fetch(`/api/orgs/${orgId}/webhooks`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setWebhooks(data.webhooks || []))
      .catch(() => {});
  }

  useEffect(() => {
    loadKeys();
    loadWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function handleCreateKey(e) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() || "API key" }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({})) ?? {};
    if (!res || !res.ok) {
      setError(body.error || "Could not create API key.");
      return;
    }
    setRevealedKey(body.key);
    setNewKeyName("");
    loadKeys();
  }

  async function handleRevokeKey(keyId) {
    const res = await fetch(`/api/orgs/${orgId}/api-keys/${keyId}`, { method: "DELETE" }).catch(() => null);
    if (res && res.ok) loadKeys();
  }

  function toggleEvent(value) {
    setSelectedEvents((cur) => (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));
  }

  async function handleCreateWebhook(e) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl.trim(), eventTypes: selectedEvents }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({})) ?? {};
    if (!res || !res.ok) {
      setError(body.error || "Could not create webhook.");
      return;
    }
    setRevealedSecret(body.secret);
    setWebhookUrl("");
    setSelectedEvents([]);
    loadWebhooks();
  }

  async function handleDeleteWebhook(webhookId) {
    const res = await fetch(`/api/orgs/${orgId}/webhooks/${webhookId}`, { method: "DELETE" }).catch(() => null);
    if (res && res.ok) loadWebhooks();
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, marginBottom: 8 }}>API keys</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 12 }}>
        Use an API key to read/create documents programmatically via <code>/api/v1/*</code>.
      </p>

      {revealedKey && (
        <div className="status-banner" role="status" style={{ marginBottom: 12, fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all" }}>
          Save this key now -- it won&apos;t be shown again: <strong>{revealedKey}</strong>
        </div>
      )}

      <form onSubmit={handleCreateKey} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Key name (e.g. CRM integration)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
        />
        <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, cursor: "pointer" }}>
          Create key
        </button>
      </form>

      {keys && keys.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No API keys yet.</p>}
      {keys && keys.map((k) => (
        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
          <div>
            <strong>{k.name}</strong> — <code>{k.keyPrefix}…</code>
            {k.lastUsedAt && <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>Last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
          </div>
          <button type="button" onClick={() => handleRevokeKey(k.id)} style={{ background: "none", border: "none", color: "oklch(50% 0.17 25)", cursor: "pointer", fontSize: 12 }}>
            Revoke
          </button>
        </div>
      ))}

      <h3 style={{ fontSize: 15, margin: "28px 0 8px" }}>Webhooks</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 12 }}>
        Get notified at your own endpoint when key events happen. Each delivery is signed with the webhook&apos;s secret via an
        <code> X-Ledgerlot-Signature</code> header (HMAC-SHA256).
      </p>

      {revealedSecret && (
        <div className="status-banner" role="status" style={{ marginBottom: 12, fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all" }}>
          Save this secret now -- it won&apos;t be shown again: <strong>{revealedSecret}</strong>
        </div>
      )}

      <form onSubmit={handleCreateWebhook} style={{ marginBottom: 16 }}>
        <input
          type="url"
          required
          placeholder="https://your-endpoint.example.com/webhook"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8 }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          {EVENT_TYPES.map((e) => (
            <label key={e.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              <input type="checkbox" checked={selectedEvents.includes(e.value)} onChange={() => toggleEvent(e.value)} />
              {e.label}
            </label>
          ))}
        </div>
        <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, cursor: "pointer" }}>
          Add webhook
        </button>
      </form>

      {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      {webhooks && webhooks.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No webhooks yet.</p>}
      {webhooks && webhooks.map((w) => (
        <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
          <div>
            <strong>{w.url}</strong>
            <div style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{w.eventTypes.join(", ")}</div>
          </div>
          <button type="button" onClick={() => handleDeleteWebhook(w.id)} style={{ background: "none", border: "none", color: "oklch(50% 0.17 25)", cursor: "pointer", fontSize: 12 }}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
