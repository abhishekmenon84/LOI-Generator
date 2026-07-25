"use client";
import { useState } from "react";

const ACTION_CONFIG = {
  archive: { icon: "🗄", headline: (name) => `Archive "${name}"?`, confirmLabel: "Archive", confirmBg: "oklch(45% 0.15 300)" },
  trash: { icon: "🗑", headline: (name) => `Move "${name}" to Trash?`, confirmLabel: "Move to Trash", confirmBg: "oklch(50% 0.17 25)" },
  restore: { icon: "↩", headline: (name) => `Restore "${name}"?`, confirmLabel: "Restore", confirmBg: "oklch(45% 0.14 155)" },
};

export default function FolderReasonModal({ action, folderName, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");

  if (!action) return null;
  const config = ACTION_CONFIG[action];
  const disabled = !reason.trim();

  const handleConfirm = () => {
    if (disabled) return;
    onConfirm(reason.trim());
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  return (
    <div
      onClick={handleCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(30,25,20,.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 16, padding: "26px 26px 22px", width: 380, boxShadow: "0 20px 60px rgba(30,25,15,.25)" }}
      >
        <div style={{ fontSize: 26, marginBottom: 10 }}>{config.icon}</div>
        <div style={{ fontWeight: 750, fontSize: 17, marginBottom: 14 }}>{config.headline(folderName)}</div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(42% 0.01 264)" }}>Why? (required)</span>
          <textarea
            rows={3}
            placeholder="A short note for the record..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid oklch(88% 0.008 60)", fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "vertical", color: "inherit" }}
          />
        </label>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={handleCancel}
            style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: "oklch(94% 0.005 60)", color: "oklch(35% 0.01 264)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={disabled}
            style={{
              padding: "9px 18px",
              borderRadius: 9,
              border: "none",
              background: disabled ? "oklch(85% 0.01 60)" : config.confirmBg,
              color: "white",
              fontWeight: 600,
              fontSize: 13,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
