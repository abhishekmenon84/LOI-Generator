"use client";

import { useCallback, useRef } from "react";

// A thin vertical drag handle sitting between two panels. Reports the
// horizontal pixel delta on every mousemove while dragging via onDrag(dx) --
// the parent decides what "resize" means for whichever panels it sits
// between (e.g. left panel width, or a middle/right split).
export default function ResizeHandle({ onDrag }) {
  const lastXRef = useRef(null);

  const handleMouseMove = useCallback(
    (e) => {
      if (lastXRef.current === null) return;
      const dx = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      onDrag(dx);
    },
    [onDrag]
  );

  const handleMouseUp = useCallback(() => {
    lastXRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      lastXRef.current = e.clientX;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [handleMouseMove, handleMouseUp]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      title="Drag to resize"
      style={{
        flex: "0 0 5px",
        cursor: "col-resize",
        background: "transparent",
        position: "relative",
        zIndex: 5,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "oklch(80% 0.02 300 / 0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    />
  );
}
