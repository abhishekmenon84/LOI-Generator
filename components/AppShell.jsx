"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";

// Below the CSS breakpoint in globals.css (.app-shell-sidebar's @media
// max-width: 860px rule), Sidebar becomes a slide-in overlay instead of a
// permanent 240px column -- otherwise it eats most of a phone's width.
// mobileSidebarOpen/the overlay only render/matter below that breakpoint;
// above it Sidebar is always visible via the CSS class alone, independent
// of this state.
export default function AppShell({ org, userInitial, children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", height: "100vh", background: "oklch(97% 0.006 60)", overflow: "hidden" }}>
      <Sidebar org={org} mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <TopBar userInitial={userInitial} onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      </div>
      <CommandPalette />
    </div>
  );
}
