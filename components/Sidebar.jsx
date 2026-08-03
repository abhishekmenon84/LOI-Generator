"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", glyph: "▦" },
  { href: "/documents", label: "Documents", glyph: "▤" },
  { href: "/templates", label: "Templates", glyph: "▥" },
  { href: "/contacts", label: "Contacts", glyph: "●" },
  { href: "/keeper", label: "Organizations", glyph: "◈" },
  { href: "/inbox", label: "Inbox", glyph: "▧" },
  { href: "/documents?view=favorites", label: "Favorites", glyph: "★" },
  { href: "/archive", label: "Archive", glyph: "□" },
  { href: "/settings", label: "Settings", glyph: "⚙" },
];

function isActive(href, pathname) {
  const path = href.split("?")[0];
  if (path === "/dashboard" || path === "/documents") return pathname === path && !href.includes("?");
  if (path === "/keeper") return pathname.startsWith("/keeper");
  return pathname.startsWith(path);
}

export default function Sidebar({ org, mobileOpen, onClose }) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          className="app-shell-sidebar-scrim"
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(20,18,15,0.4)", zIndex: 90 }}
        />
      )}
      <div
        className={`app-shell-sidebar${mobileOpen ? " app-shell-sidebar-open" : ""}`}
        style={{
          width: 240,
          flex: "0 0 auto",
          background: "oklch(99% 0.003 60)",
          borderRight: "1px solid oklch(88% 0.008 60)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 14px",
          height: "100vh",
          position: "sticky",
          top: 0,
        }}
      >
      <Link
        href="/dashboard"
        onClick={onClose}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 22px", textDecoration: "none", color: "inherit" }}
      >
        <div style={{ width: 30, height: 30, position: "relative", flex: "0 0 auto" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 9, background: "oklch(24% 0.015 264)" }} />
          <div style={{ position: "absolute", left: 8, top: 9, width: 14, height: 2.5, borderRadius: 2, background: "white" }} />
          <div style={{ position: "absolute", left: 8, top: 14, width: 14, height: 2.5, borderRadius: 2, background: "white" }} />
          <div style={{ position: "absolute", left: 8, top: 19, width: 9, height: 2.5, borderRadius: 2, background: "white" }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: "-0.01em" }}>Ledgerlot</span>
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 10,
                textDecoration: "none",
                background: active ? "oklch(93% 0.012 60)" : "transparent",
                color: active ? "oklch(24% 0.015 264)" : "oklch(50% 0.012 264)",
                fontWeight: active ? 700 : 500,
                fontSize: 13.5,
                transition: "background 0.2s",
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.glyph}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ background: "oklch(93% 0.012 60)", borderRadius: 16, padding: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "oklch(50% 0.012 264)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Workspace
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: "oklch(24% 0.015 264)", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
            {org?.isPersonal === false ? "B" : "P"}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Org: {org?.isPersonal === false ? "Business" : "Personal"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, background: "white", border: "1px solid oklch(88% 0.008 60)", padding: "3px 9px", borderRadius: 20 }}>
            {org?.planTier || "Free"}
          </span>
          <Link
            href="/settings"
            onClick={onClose}
            style={{ border: "none", background: "oklch(24% 0.015 264)", color: "white", fontSize: 11.5, fontWeight: 600, padding: "5px 11px", borderRadius: 8, textDecoration: "none" }}
          >
            Change tier
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
