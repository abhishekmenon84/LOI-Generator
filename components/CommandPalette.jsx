"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isOpenShortcut } from "../lib/commandPaletteShortcut.mjs";

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (isOpenShortcut(e)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (!open) {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data) => setResults(data.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.32)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120, zIndex: 60 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520, background: "white", borderRadius: 16, boxShadow: "0 24px 60px rgba(17,17,17,0.25)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid oklch(93% 0.006 60)" }}>
          <span style={{ color: "oklch(60% 0.01 264)" }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documents, folders..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: "oklch(24% 0.015 264)" }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(50% 0.012 264)", background: "oklch(93% 0.006 60)", padding: "2px 6px", borderRadius: 6 }}>
            Esc
          </span>
        </div>
        <div style={{ maxHeight: 340, overflowY: "auto", padding: 8 }}>
          {loading && <div style={{ padding: 24, textAlign: "center", color: "oklch(60% 0.01 264)", fontSize: 13 }}>Searching…</div>}
          {!loading && results !== null && results.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "oklch(60% 0.01 264)", fontSize: 13 }}>No results.</div>
          )}
          {!loading &&
            results?.map((r) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => {
                  setOpen(false);
                  router.push(`/ledgerboard/folder/${r.folderId}`);
                }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer" }}
              >
                <span style={{ fontSize: 13, color: "oklch(60% 0.01 264)" }}>{r.type === "ledger" ? "📝" : "📁"}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{r.name}</span>
                <span style={{ fontSize: 11.5, color: "oklch(60% 0.01 264)" }}>{r.type}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
