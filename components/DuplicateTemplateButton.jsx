"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Clones a CustomTemplate or FormTemplate's structure (same underlying
// PDF, same anchors/fields) into a new template named "<name> (copy)".
export default function DuplicateTemplateButton({ orgId, templateId }) {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);

  async function handleDuplicate(e) {
    e.preventDefault();
    e.stopPropagation();
    setDuplicating(true);
    const res = await fetch(`/api/orgs/${orgId}/templates/${templateId}/duplicate`, { method: "POST" }).catch(() => null);
    setDuplicating(false);
    if (res && res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={duplicating}
      title="Duplicate"
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 999,
        background: "none",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
        cursor: duplicating ? "not-allowed" : "pointer",
      }}
    >
      {duplicating ? "…" : "⧉ Duplicate"}
    </button>
  );
}
