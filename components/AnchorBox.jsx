"use client";

const ANCHOR_COLORS = {
  signature: "oklch(58% 0.16 300)",
  date: "oklch(58% 0.13 235)",
  initials: "oklch(55% 0.14 155)",
  text: "oklch(60% 0.01 264)",
  checkbox: "oklch(58% 0.16 40)",
  radio: "oklch(62% 0.15 75)",
};

export default function AnchorBox({ anchor, onUpdate, onDelete, readOnly }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${anchor.xPct}%`,
        top: `${anchor.yPct}%`,
        width: `${anchor.widthPct}%`,
        height: `${anchor.heightPct}%`,
        border: `2px solid ${ANCHOR_COLORS[anchor.type] || ANCHOR_COLORS.text}`,
        background: `${ANCHOR_COLORS[anchor.type] || ANCHOR_COLORS.text}22`,
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
        fontWeight: 600,
        color: ANCHOR_COLORS[anchor.type] || ANCHOR_COLORS.text,
        cursor: readOnly ? "default" : "pointer",
        pointerEvents: readOnly ? "none" : "auto",
      }}
      title={`${anchor.type}: ${anchor.label}`}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>
        {anchor.label}
      </span>
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
