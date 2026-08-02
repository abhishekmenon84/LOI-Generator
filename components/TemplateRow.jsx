"use client";

import { useState } from "react";
import AddTemplateToFolderModal from "./AddTemplateToFolderModal";

// Wraps a single template's row with click-to-open behavior for the
// "view + add to folder" modal -- extracted from app/templates/page.js
// (a server component) since opening a modal needs client state.
export default function TemplateRow({ template, kind, children }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          flexWrap: "wrap",
          cursor: "pointer",
        }}
      >
        {children}
      </div>
      {modalOpen && (
        <AddTemplateToFolderModal template={template} kind={kind} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
