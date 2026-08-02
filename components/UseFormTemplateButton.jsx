"use client";

import { useState } from "react";
import AddTemplateToFolderModal from "./AddTemplateToFolderModal";

// A small explicit action (distinct from the row's own link to the admin
// edit screen at /templates/[id]) that opens the same "view + add to
// folder" modal built-in/custom_template rows use, so a FormTemplate can
// actually be sent for signature -- not just edited.
export default function UseFormTemplateButton({ template }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setModalOpen(true);
        }}
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 999,
          background: "oklch(24% 0.015 264)",
          color: "white",
          border: "none",
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        Use template
      </button>
      {modalOpen && (
        <AddTemplateToFolderModal template={template} kind="form_template" onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
