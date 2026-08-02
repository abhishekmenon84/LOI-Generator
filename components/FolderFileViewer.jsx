"use client";

// Renders a FolderFile for VIEWING + FILLING IN, not for placing anchors --
// that's AnchorEditor's job (Task 5). This is the plain-embed viewer plus a
// simple fill-in form, per the design spec's distinction between the two UIs.
//
// Simplification (documented per Task 6 Step 1): radio-group consolidation
// (multiple `radio`-type anchors sharing one logical AcroForm field/choice)
// is out of scope for this first cut. Each `radio`-type anchor renders as
// its own standalone text input alongside every other non-checkbox anchor
// type, rather than being grouped into a real radio-button set keyed by a
// shared field name -- true AcroForm radio-group semantics (one field name,
// multiple On/Off widget states) add real complexity better deferred. A
// real signature-pad integration is likewise out of scope; `signature` /
// `date` / `initials` / `text` anchors all get a plain text acknowledgment
// input here.

export default function FolderFileViewer({ file, onFieldChange, readOnly, onEditFields }) {
  const isPdf = file.mimeType === "application/pdf";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "19px", fontWeight: 800, marginBottom: "4px" }}>{file.name}</div>
          <div style={{ fontSize: "12.5px", color: "oklch(50% 0.01 264)" }}>
            {file.fieldTier === "plain" ? "Plain attachment" : file.fieldTier === "auto_detected" ? "Auto-detected form fields" : "Manually placed anchors"}
          </div>
        </div>
        {isPdf && !readOnly && onEditFields && (
          <button
            type="button"
            onClick={onEditFields}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid oklch(88% 0.008 60)", background: "white", color: "oklch(30% 0.01 264)", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {file.anchors && file.anchors.length > 0 ? "Edit fields" : "+ Add fields"}
          </button>
        )}
      </div>

      {isPdf ? (
        <embed src={file.fileUrl} type="application/pdf" style={{ width: "100%", height: "500px", borderRadius: "8px", border: "1px solid var(--border)" }} />
      ) : (
        <img src={file.fileUrl} alt={file.name} style={{ maxWidth: "100%", borderRadius: "8px" }} />
      )}

      {file.anchors && file.anchors.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "oklch(50% 0.01 264)" }}>
            Fields
          </div>
          {file.anchors.map((a) => (
            <label key={a.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>{a.label}</span>
              {a.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={!!(file.formValues || {})[a.id]}
                  disabled={readOnly}
                  onChange={(e) => onFieldChange(a.id, e.target.checked)}
                />
              ) : (
                <input
                  type="text"
                  value={(file.formValues || {})[a.id] || ""}
                  disabled={readOnly}
                  onChange={(e) => onFieldChange(a.id, e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
