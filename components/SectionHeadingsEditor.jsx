"use client";

// Shared "customize headings" editor, used by LOIForm/LeaseForm/
// ResidentialLeaseForm alike -- each passes its own document type's fixed
// ordered sectionDefs (see lib/loiEngine.js's LOI_SECTION_DEFS and its
// lease/residential-lease equivalents) plus the current documentTitle/
// sectionOverrides form values. Renaming/disabling here only affects the
// heading text and whether a section renders at all -- the body content
// of each section is unchanged and not editable here (see
// lib/sectionHeadings.js's own comment on why this doesn't let a user add
// a brand-new section).
export default function SectionHeadingsEditor({ sectionDefs, documentTitle, sectionOverrides, onDocumentTitleChange, onSectionOverridesChange }) {
  function updateSection(key, patch) {
    const current = sectionOverrides?.[key] || {};
    onSectionOverridesChange({
      ...(sectionOverrides || {}),
      [key]: { ...current, ...patch },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary, #666)" }}>Document title</span>
        <input
          type="text"
          value={documentTitle}
          onChange={(e) => onDocumentTitleChange(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border, #ccc)" }}
        />
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
        {sectionDefs.map((def, i) => {
          const ov = sectionOverrides?.[def.key] || {};
          const enabled = ov.enabled !== false;
          return (
            <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => updateSection(def.key, { enabled: e.target.checked })}
                title={enabled ? "Included in document" : "Hidden from document"}
              />
              <input
                type="text"
                disabled={!enabled}
                value={ov.title || ""}
                placeholder={def.defaultTitle}
                onChange={(e) => updateSection(def.key, { title: e.target.value })}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--border, #ccc)",
                  fontSize: 12.5,
                  opacity: enabled ? 1 : 0.5,
                }}
              />
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted, #888)", margin: "2px 0 0" }}>
        Uncheck a section to remove it from the document entirely. Section numbers adjust
        automatically. Leave a title blank to keep the default wording.
      </p>
    </div>
  );
}
