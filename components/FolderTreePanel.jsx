"use client";

import { useState } from "react";

// Matches the design handoff's isWorkspace left panel
// (Design/real-estate-deal-kanban-board/project/Ledgerlot App.dc.html, ~L159-214)
// and its buildAncestorItems() / buildSubfolderItems() logic (~L689-724).
//
// Phase 7b Task 4: now that there are THREE choices ("New Ledger", "New
// Ledger from template", "Upload file"), this reverts to the handoff's
// original "+ Add" DROPDOWN treatment (previously simplified to two adjacent
// buttons per Phase 7a Task 6, when there were only two choices) rather than
// letting the footer grow into an ever-widening button row. The menu itself
// is a plain absolutely-positioned list -- no new UI library -- matching
// FolderReasonModal.jsx's plain-inline-style overlay convention.

const DOC_ICONS = { ledger: "📝", file: "📎" };

// Shared Ledger-row rendering, used both for the current folder's own
// Ledgers and for each subfolder's nested Ledgers (Fix round 1, Important
// #1) -- kept as one component so both call sites stay visually identical
// rather than inventing a second treatment.
function LedgerRow({ doc, isSelected, onSelectLedger }) {
  return (
    <div
      onClick={() => onSelectLedger?.(doc.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "7px",
        padding: "6px 8px",
        borderRadius: "7px",
        cursor: "pointer",
        background: isSelected ? "oklch(93% 0.03 300)" : "transparent",
      }}
    >
      <span style={{ fontSize: "12px", flex: "0 0 auto" }}>{DOC_ICONS.ledger}</span>
      <span
        style={{
          fontSize: "12.5px",
          fontWeight: isSelected ? 700 : 500,
          color: isSelected ? "oklch(45% 0.15 300)" : "oklch(35% 0.01 264)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {doc.name}
      </span>
    </div>
  );
}

// Shared FolderFile-row rendering, parallel to LedgerRow immediately above --
// same treatment (icon, selection highlight, single click handler), just a
// distinct 📎 icon and a separate onSelectFile callback/selectedFileId so a
// FolderFile selection is tracked independently of a Ledger selection.
function FileRow({ doc, isSelected, onSelectFile }) {
  return (
    <div
      onClick={() => onSelectFile?.(doc.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "7px",
        padding: "6px 8px",
        borderRadius: "7px",
        cursor: "pointer",
        background: isSelected ? "oklch(93% 0.03 300)" : "transparent",
      }}
    >
      <span style={{ fontSize: "12px", flex: "0 0 auto" }}>{DOC_ICONS.file}</span>
      <span
        style={{
          fontSize: "12.5px",
          fontWeight: isSelected ? 700 : 500,
          color: isSelected ? "oklch(45% 0.15 300)" : "oklch(35% 0.01 264)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {doc.name}
      </span>
    </div>
  );
}

function FolderRow({ folder, isEditing, editValue, onStartEdit, onEditChange, onCommitEdit, onCancelEdit, onClick, icon, fontSize, fontWeight }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "7px 8px",
        borderRadius: "8px",
      }}
    >
      <span style={{ fontSize: "13px", flex: "0 0 auto" }}>{icon}</span>
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          style={{
            fontSize: fontSize,
            fontWeight,
            border: "1px solid oklch(80% 0.02 300)",
            borderRadius: "5px",
            padding: "2px 6px",
            outline: "none",
            flex: 1,
            minWidth: 0,
          }}
        />
      ) : (
        <>
          <span
            onClick={onClick}
            style={{
              fontSize,
              fontWeight,
              color: "oklch(30% 0.01 264)",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {folder.name}
          </span>
          <button
            type="button"
            onClick={onStartEdit}
            title="Rename"
            style={{
              border: "none",
              background: "transparent",
              color: "oklch(60% 0.01 264)",
              cursor: "pointer",
              fontSize: "11px",
              padding: "2px",
              flex: "0 0 auto",
            }}
          >
            ✎
          </button>
        </>
      )}
    </div>
  );
}

export default function FolderTreePanel({
  folder,
  folderLedgers = [],
  files = [],
  ancestors = [],
  subfolders = [],
  collapsed,
  onToggleCollapse,
  selectedLedgerId,
  onSelectLedger,
  selectedFileId,
  onSelectFile,
  onNavigateFolder,
  onRenameFolder,
  onAddLedger,
  onAddFromTemplate,
  onUploadFile,
}) {
  // editingId shape: "ancestor:<id>" | "subfolder:<id>" -- mirrors the
  // handoff's editingId convention (~L692, ~L707) so rename state is scoped
  // per-row without needing a separate boolean per folder.
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  // Per-subfolder expand/collapse for the nested Ledgers list. Defaults to
  // expanded, matching the handoff's `expanded ?? true` fallback (~L709).
  const [expandedSubfolders, setExpandedSubfolders] = useState({});
  // Whether the "+ Add" dropdown menu is open. Closed on any option click.
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  function startEdit(id, currentName) {
    setEditingId(id);
    setEditingValue(currentName);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValue("");
  }

  function commitEdit(folderId) {
    const val = editingValue.trim();
    setEditingId(null);
    if (!val) return;
    onRenameFolder?.(folderId, val);
  }

  function toggleSubfolder(id) {
    setExpandedSubfolders((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }

  // Collapsed: narrow icon rail, toggle only. The toggle button is ALWAYS
  // rendered (both branches below) so the panel can never collapse to a
  // dead end with no way back.
  if (collapsed) {
    return (
      <div
        style={{
          flex: "0 0 46px",
          background: "oklch(98.5% 0.004 60)",
          borderRight: "1px solid oklch(91% 0.006 60)",
          overflowY: "auto",
          transition: "flex-basis .15s",
        }}
      >
        <div style={{ padding: "10px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand folders panel"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "14px",
              color: "oklch(50% 0.01 264)",
              padding: "2px 4px",
              flex: "0 0 auto",
            }}
          >
            »
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: "0 0 19%",
        background: "oklch(98.5% 0.004 60)",
        borderRight: "1px solid oklch(91% 0.006 60)",
        overflowY: "auto",
        transition: "flex-basis .15s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "oklch(50% 0.01 264)",
          }}
        >
          Folders
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse folders panel"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "14px",
            color: "oklch(50% 0.01 264)",
            padding: "2px 4px",
            flex: "0 0 auto",
          }}
        >
          «
        </button>
      </div>

      <div style={{ padding: "0 10px 16px", flex: "1 1 auto" }}>
        {ancestors.map((ancestor) => {
          const editId = `ancestor:${ancestor.id}`;
          return (
            <FolderRow
              key={ancestor.id}
              folder={ancestor}
              isEditing={editingId === editId}
              editValue={editingValue}
              onStartEdit={() => startEdit(editId, ancestor.name)}
              onEditChange={setEditingValue}
              onCommitEdit={() => commitEdit(ancestor.id)}
              onCancelEdit={cancelEdit}
              onClick={() => onNavigateFolder?.(ancestor.id)}
              icon="📁"
              fontSize="13.5px"
              fontWeight={700}
            />
          );
        })}

        {/* Current folder row, so the tree also shows "you are here" alongside
            ancestors. Fix round 1 (Minor #3): uses its own "current:" editingId
            prefix rather than reusing "ancestor:", since this is conceptually a
            distinct row (even though a folder can never literally be its own
            ancestor, so there was no live collision bug today). */}
        {folder ? (
          <div style={{ marginBottom: "4px" }}>
            <FolderRow
              folder={folder}
              isEditing={editingId === `current:${folder.id}`}
              editValue={editingValue}
              onStartEdit={() => startEdit(`current:${folder.id}`, folder.name)}
              onEditChange={setEditingValue}
              onCommitEdit={() => commitEdit(folder.id)}
              onCancelEdit={cancelEdit}
              onClick={() => {}}
              icon="📁"
              fontSize="13.5px"
              fontWeight={700}
            />
            {/* Fix round 1 (Important #1): the current folder's OWN Ledgers
                (documents created directly here, not in a subfolder) render
                right under this row, reusing the same LedgerRow used for
                subfolder Ledgers so a new Ledger is always reachable in the
                tree, not just briefly visible via auto-selection. */}
            {folderLedgers.length > 0 || files.length > 0 ? (
              <div style={{ paddingLeft: "28px" }}>
                {folderLedgers.map((doc) => (
                  <LedgerRow
                    key={doc.id}
                    doc={doc}
                    isSelected={selectedLedgerId === doc.id}
                    onSelectLedger={onSelectLedger}
                  />
                ))}
                {files.map((doc) => (
                  <FileRow
                    key={doc.id}
                    doc={doc}
                    isSelected={selectedFileId === doc.id}
                    onSelectFile={onSelectFile}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            color: "oklch(58% 0.01 264)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: "4px 4px 6px",
          }}
        >
          Subfolders
        </div>

        {subfolders.map((sf) => {
          const editId = `subfolder:${sf.id}`;
          const isEditing = editingId === editId;
          const expanded = expandedSubfolders[sf.id] ?? true;
          const ledgers = sf.ledgers || [];
          const sfFiles = sf.files || [];
          return (
            <div key={sf.id} style={{ marginBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 8px", borderRadius: "8px" }}>
                <span
                  onClick={() => toggleSubfolder(sf.id)}
                  style={{ fontSize: "11px", cursor: "pointer", color: "oklch(55% 0.01 264)", flex: "0 0 auto" }}
                >
                  {expanded ? "▾" : "▸"}
                </span>
                <span style={{ fontSize: "13px", flex: "0 0 auto" }}>🗂</span>
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => commitEdit(sf.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(sf.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    style={{
                      fontSize: "13px",
                      fontWeight: 650,
                      border: "1px solid oklch(80% 0.02 300)",
                      borderRadius: "5px",
                      padding: "2px 6px",
                      outline: "none",
                      flex: 1,
                      minWidth: 0,
                    }}
                  />
                ) : (
                  <>
                    <span
                      onClick={() => toggleSubfolder(sf.id)}
                      style={{
                        fontSize: "13px",
                        fontWeight: 650,
                        color: "oklch(32% 0.01 264)",
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {sf.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(editId, sf.name)}
                      title="Rename"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "oklch(60% 0.01 264)",
                        cursor: "pointer",
                        fontSize: "11px",
                        padding: "2px",
                        flex: "0 0 auto",
                      }}
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
              {expanded ? (
                <div style={{ paddingLeft: "28px" }}>
                  {ledgers.map((doc) => (
                    <LedgerRow
                      key={doc.id}
                      doc={doc}
                      isSelected={selectedLedgerId === doc.id}
                      onSelectLedger={onSelectLedger}
                    />
                  ))}
                  {sfFiles.map((doc) => (
                    <FileRow
                      key={doc.id}
                      doc={doc}
                      isSelected={selectedFileId === doc.id}
                      onSelectFile={onSelectFile}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* "+ Add" affordance -- a single button that opens a small inline
          dropdown menu with the three add-options, per this component's
          top-of-file comment. */}
      <div style={{ padding: "10px", borderTop: "1px solid oklch(93% 0.006 60)", position: "relative" }}>
        {addMenuOpen ? (
          // Click-outside-to-close backdrop, same overlay convention as
          // FolderReasonModal.jsx (a full-bleed transparent layer whose
          // onClick closes the menu; the menu itself stops propagation).
          <div
            onClick={() => setAddMenuOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setAddMenuOpen((v) => !v)}
          style={{
            width: "100%",
            padding: "9px 10px",
            borderRadius: "8px",
            border: "none",
            background: "oklch(45% 0.15 300)",
            color: "white",
            fontWeight: 600,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          + Add
        </button>
        {addMenuOpen ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: "10px",
              right: "10px",
              background: "white",
              borderRadius: "9px",
              border: "1px solid oklch(88% 0.008 60)",
              boxShadow: "0 10px 30px rgba(30,25,15,.18)",
              overflow: "hidden",
              zIndex: 41,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                onAddLedger?.();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: "white",
                color: "oklch(30% 0.01 264)",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + New Ledger
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                onAddFromTemplate?.();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderTop: "1px solid oklch(93% 0.006 60)",
                background: "white",
                color: "oklch(30% 0.01 264)",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + New Ledger from template
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                onUploadFile?.();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderTop: "1px solid oklch(93% 0.006 60)",
                background: "white",
                color: "oklch(30% 0.01 264)",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Upload file
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
