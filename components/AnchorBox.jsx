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

export default function AnchorBox({ anchor, onSelect, onDelete, readOnly, selected }) {
  const lowConfidence = anchor.confidence != null && anchor.confidence < 0.75;
  const baseColor = ANCHOR_COLORS[anchor.type] || ANCHOR_COLORS.text;

  return (
    <div
      onClick={(e) => {
        if (!readOnly && onSelect) {
          e.stopPropagation();
          onSelect(anchor);
        }
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
        cursor: readOnly ? "default" : "pointer",
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
    </div>
  );
}
