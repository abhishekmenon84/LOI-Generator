"use client";

import { useRouter } from "next/navigation";

// The "+" button triggers the exact same "New Ledger" flow as the dashboard's
// own button: it just navigates to the dashboard with a query param that
// DealList.jsx's create-flow reads to open its (name-only) create-folder
// form immediately, rather than duplicating DealList.jsx's folder-creation
// logic here -- keeps creation logic in exactly one place. What document to
// add inside the new folder is decided afterwards, inside the Folder
// workspace's own "+ Add" menu.
export default function TopBar({ onOpenSearch, userInitial = "?" }) {
  const router = useRouter();

  function startQuickCreate() {
    router.push("/dashboard?quickCreate=1");
  }

  return (
    <div
      style={{
        height: 64,
        flex: "0 0 auto",
        background: "white",
        borderBottom: "1px solid oklch(88% 0.008 60)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
      }}
    >
      <div
        onClick={onOpenSearch}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          width: 340,
          padding: "9px 13px",
          borderRadius: 10,
          border: "1px solid oklch(88% 0.008 60)",
          background: "oklch(97% 0.006 60)",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, color: "oklch(60% 0.01 264)" }}>⌕</span>
        <span style={{ fontSize: 13.5, color: "oklch(60% 0.01 264)", flex: 1 }}>Search documents...</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(50% 0.012 264)", background: "white", border: "1px solid oklch(88% 0.008 60)", padding: "2px 6px", borderRadius: 6 }}>
          ⌘K
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        <button
          type="button"
          title="New Ledger"
          onClick={startQuickCreate}
          style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontSize: 17, cursor: "pointer", lineHeight: 1 }}
        >
          +
        </button>
        <button
          type="button"
          style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid oklch(88% 0.008 60)", background: "white", cursor: "pointer", fontSize: 14, color: "oklch(50% 0.012 264)" }}
        >
          ◔
        </button>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "oklch(24% 0.015 264)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {userInitial}
        </div>
      </div>
    </div>
  );
}
