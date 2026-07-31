"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";

export default function AppShell({ org, userInitial, children }) {
  return (
    <div style={{ display: "flex", height: "100vh", background: "oklch(97% 0.006 60)", overflow: "hidden" }}>
      <Sidebar org={org} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <TopBar userInitial={userInitial} />
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      </div>
      <CommandPalette />
    </div>
  );
}
