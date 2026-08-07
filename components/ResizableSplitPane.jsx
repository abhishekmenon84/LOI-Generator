"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_LEFT_WIDTH = 450;
const MIN_LEFT_WIDTH = 320;
const MAX_LEFT_WIDTH = 900;

// Hand-rolled (no resizable-panel library in this repo, and one vertical
// divider between two panes doesn't need one). Drags a pixel width for the
// left panel via pointer events; the right panel is always the remainder
// (flex: 1). Persisted to localStorage per `storageKey` so a user's
// preferred split survives navigation/reload -- read once on mount only,
// same pattern as this app's other localStorage reads (see the theme
// picker), not re-synced across tabs.
export default function ResizableSplitPane({ storageKey, left, right, defaultLeftWidth = DEFAULT_LEFT_WIDTH }) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const containerRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!storageKey) return;
    const stored = Number(window.localStorage.getItem(storageKey));
    if (stored && stored >= MIN_LEFT_WIDTH && stored <= MAX_LEFT_WIDTH) {
      setLeftWidth(stored);
    }
  }, [storageKey]);

  function handlePointerDown(e) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onPointerMove(moveEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const containerLeft = containerRef.current.getBoundingClientRect().left;
      const next = Math.min(Math.max(moveEvent.clientX - containerLeft, MIN_LEFT_WIDTH), MAX_LEFT_WIDTH);
      setLeftWidth(next);
    }
    function onPointerUp() {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    }
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  // Persist on every change (cheap -- localStorage, not a network call),
  // rather than only reading a possibly-stale ref in onPointerUp.
  useEffect(() => {
    if (storageKey) window.localStorage.setItem(storageKey, String(leftWidth));
  }, [storageKey, leftWidth]);

  return (
    <div
      ref={containerRef}
      className="resizable-split-pane"
      style={{ display: "flex", width: "100%", height: "100%", minHeight: 0 }}
    >
      <div className="resizable-split-pane-left" style={{ width: leftWidth, flexShrink: 0, minWidth: 0, height: "100%", overflow: "auto" }}>{left}</div>
      <div
        onPointerDown={handlePointerDown}
        role="separator"
        aria-orientation="vertical"
        className="resizable-split-pane-handle"
        style={{
          width: 6,
          flexShrink: 0,
          cursor: "col-resize",
          background: "var(--border)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 3,
            height: 36,
            borderRadius: 2,
            background: "var(--text-secondary)",
            opacity: 0.5,
          }}
        />
      </div>
      <div className="resizable-split-pane-right" style={{ flex: 1, minWidth: 0, height: "100%", overflow: "auto" }}>{right}</div>
    </div>
  );
}
