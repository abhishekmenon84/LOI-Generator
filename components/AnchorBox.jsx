"use client";

const ANCHOR_COLORS = {
  signature: "oklch(58% 0.16 300)",
  date: "oklch(58% 0.13 235)",
  initials: "oklch(55% 0.14 155)",
  text: "oklch(60% 0.01 264)",
  checkbox: "oklch(58% 0.16 40)",
  radio: "oklch(62% 0.15 75)",
};

const LOW_CONFIDENCE_COLOR = "oklch(60% 0.19 45)";
const SELECTED_COLOR = "oklch(45% 0.2 264)";

// Per-class "check this" thresholds, NOT a single global 0.75.
//
// The old global 0.75 cutoff fired on essentially every detected box: Task
// 6's ground-truth measurement (lib/formDetect.js's CONFIDENCE_FLOOR
// comment) found text boxes topped out at 0.76 and checkboxes at 0.412, so
// a 0.75 line put ~all checkboxes and most text boxes below it -- the hint
// carried no signal about which boxes were actually doubtful, and its
// caption text overflowed small checkbox/radio boxes.
//
// Each class already has its own accept floor (CONFIDENCE_FLOOR); the rule
// here is "hint if the score sits in roughly the bottom half of that
// class's floor-to-observed-max range" rather than one number for every
// class:
//   - text:      floor 0.5, observed max 0.76  -> hint below 0.6
//   - checkbox:  floor 0.3, observed max 0.412  -> hint below 0.35
//   - radio:     inherits checkbox's floor/range (groupCheckboxLines only
//                relabels type -- confidence still comes from the
//                checkbox detector), so it uses the same threshold
//   - signature: floor 0.5, no ground-truth signature fields measured yet
//                -- kept at the same conservative 0.6 as text until a page
//                with real signatures gives an observed max to tune against
const LOW_CONFIDENCE_THRESHOLD = {
  text: 0.6,
  checkbox: 0.35,
  radio: 0.35,
  signature: 0.6,
};
const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.6;

// Drag threshold in pixels: movement below this is treated as a click
// (select only), so a mouse that jitters a pixel or two while clicking
// doesn't drag the anchor by a hair -- and, crucially, so a plain click
// still opens the toolbar instead of always being swallowed as a drag.
const DRAG_THRESHOLD_PX = 3;

export default function AnchorBox({ anchor, onSelect, onDelete, onMove, onResize, readOnly, selected }) {
  // Hand-placed anchors never carry a `confidence` (it's `null`/`undefined`
  // for anything the user drew themselves in AnchorEditor's click-to-place
  // flow), so `!= null` here must stay -- there is no "quality" signal to
  // second-guess for those.
  const threshold = LOW_CONFIDENCE_THRESHOLD[anchor.type] ?? DEFAULT_LOW_CONFIDENCE_THRESHOLD;
  const lowConfidence = anchor.confidence != null && anchor.confidence < threshold;
  const baseColor = ANCHOR_COLORS[anchor.type] || ANCHOR_COLORS.text;

  function handleMoveMouseDown(e) {
    if (readOnly || !onMove) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startXPct = anchor.xPct;
    const startYPct = anchor.yPct;
    // The page container is this box's offsetParent (AnchorEditor renders
    // the page image + anchors inside one `position: relative` div).
    const containerRect = e.currentTarget.parentElement.getBoundingClientRect();
    let dragged = false;

    function onMouseMove(moveEvent) {
      const dxPct = ((moveEvent.clientX - startX) / containerRect.width) * 100;
      const dyPct = ((moveEvent.clientY - startY) / containerRect.height) * 100;
      if (!dragged && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > DRAG_THRESHOLD_PX) {
        dragged = true;
      }
      if (dragged) {
        onMove(anchor, startXPct + dxPct, startYPct + dyPct);
      }
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (!dragged && onSelect) onSelect(anchor);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function handleResizeMouseDown(e) {
    if (readOnly || !onResize) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidthPct = anchor.widthPct;
    const startHeightPct = anchor.heightPct;
    const containerRect = e.currentTarget.closest('[data-anchor-page="true"]').getBoundingClientRect();

    function onMouseMove(moveEvent) {
      const dxPct = ((moveEvent.clientX - startX) / containerRect.width) * 100;
      const dyPct = ((moveEvent.clientY - startY) / containerRect.height) * 100;
      onResize(anchor, startWidthPct + dxPct, startHeightPct + dyPct);
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      onMouseDown={handleMoveMouseDown}
      onClick={(e) => {
        if (readOnly) return;
        // Always stop the click from bubbling to the page container's
        // "place a new anchor" handler -- otherwise every click on an
        // existing anchor would also drop a brand new one underneath it.
        e.stopPropagation();
        // Selection itself is handled by handleMoveMouseDown's mouseup (it
        // only fires onSelect when no drag happened), so a real drag never
        // also re-fires a click-driven select. When there's no onMove
        // (e.g. a future read-only usage), fall back to firing here.
        if (onSelect && !onMove) onSelect(anchor);
      }}
      style={{
        position: "absolute",
        left: `${anchor.xPct}%`,
        top: `${anchor.yPct}%`,
        width: `${anchor.widthPct}%`,
        height: `${anchor.heightPct}%`,
        border: lowConfidence
          ? `2px dashed ${LOW_CONFIDENCE_COLOR}`
          : `2px solid ${selected ? SELECTED_COLOR : baseColor}`,
        boxShadow: selected ? `0 0 0 2px ${SELECTED_COLOR}55` : "none",
        background: `${baseColor}22`,
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
        fontWeight: 600,
        color: lowConfidence ? LOW_CONFIDENCE_COLOR : baseColor,
        cursor: readOnly ? "default" : "move",
        pointerEvents: readOnly ? "none" : "auto",
      }}
      title={`${anchor.type}: ${anchor.label}${lowConfidence ? " (low confidence — check this)" : ""}`}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>
        {anchor.label}
      </span>
      {lowConfidence && (
        <span style={{ fontSize: "8px", fontWeight: 700, whiteSpace: "nowrap", padding: "0 4px" }}>
          low confidence — check this
        </span>
      )}
      {!readOnly && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(anchor);
          }}
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "none",
            background: "oklch(50% 0.17 25)",
            color: "white",
            fontSize: "10px",
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      )}
      {!readOnly && selected && onResize && (
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: "absolute",
            bottom: -5,
            right: -5,
            width: 10,
            height: 10,
            borderRadius: "50%",
            border: `2px solid ${SELECTED_COLOR}`,
            background: "white",
            cursor: "nwse-resize",
          }}
        />
      )}
    </div>
  );
}
