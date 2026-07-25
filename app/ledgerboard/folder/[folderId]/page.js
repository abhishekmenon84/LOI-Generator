"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import FolderBreadcrumb from "../../../../components/FolderBreadcrumb";
import FolderTreePanel from "../../../../components/FolderTreePanel";
import LOIForm from "../../../../components/LOIForm";
import LOIPreview from "../../../../components/LOIPreview";
import LeaseForm from "../../../../components/LeaseForm";
import LeasePreview from "../../../../components/LeasePreview";
import ResidentialLeaseForm from "../../../../components/ResidentialLeaseForm";
import ResidentialLeasePreview from "../../../../components/ResidentialLeasePreview";
import { DEFAULT_FORM_DATA, buildLOIModel } from "../../../../lib/loiEngine";
import { DEFAULT_LEASE_DATA, buildLeaseModel } from "../../../../lib/leaseEngine";
import { DEFAULT_RESIDENTIAL_LEASE_DATA, buildResidentialLeaseModel } from "../../../../lib/residentialLeaseEngine";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Same documentType -> {Form, Preview, defaults, buildModel} mapping already
// established by app/app/page.js, app/app/lease/page.js, and
// app/app/residential-lease/page.js -- reused verbatim rather than reinvented.
// NOTE: the old Deal-era lease page checked the string "commercial_lease_loi";
// the real Ledger.documentType value (per app/api/ledgers/route.js's
// VALID_DOC_TYPES) is "commercial_lease" (no "_loi" suffix). Using the wrong
// string here would silently fall through to the "no editor" state below.
const DOC_TYPE_CONFIG = {
  purchase_loi: {
    Form: LOIForm,
    Preview: LOIPreview,
    defaultData: DEFAULT_FORM_DATA,
    buildModel: buildLOIModel,
    label: "Purchase LOI",
  },
  commercial_lease: {
    Form: LeaseForm,
    Preview: LeasePreview,
    defaultData: DEFAULT_LEASE_DATA,
    buildModel: buildLeaseModel,
    label: "Commercial Lease",
  },
  residential_lease: {
    Form: ResidentialLeaseForm,
    Preview: ResidentialLeasePreview,
    defaultData: DEFAULT_RESIDENTIAL_LEASE_DATA,
    buildModel: buildResidentialLeaseModel,
    label: "Residential Lease",
  },
  // "custom_template" intentionally has no Form/Preview pairing yet -- there
  // is no existing editor for it in this codebase (app/app/page.js and its
  // siblings only cover the three types above). Selecting a custom_template
  // Ledger falls through to a "no editor available" message rather than
  // crashing on an undefined Form component.
};

const noopExportState = { loading: false, format: null, error: null, success: null };

export default function FolderWorkspacePage() {
  const params = useParams();
  const folderId = params.folderId;

  const [folder, setFolder] = useState(null);
  const [ancestors, setAncestors] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const [selectedLedgerId, setSelectedLedgerId] = useState(null);
  const [ledger, setLedger] = useState(null); // {id, folderId, name, documentType, formData, locked, readOnly}
  const [ledgerData, setLedgerData] = useState(null); // just the formData, edited locally
  const [ledgerLoadError, setLedgerLoadError] = useState(null);
  const saveTimeoutRef = useRef(null);

  // Load the current folder (server resolves its own ancestor chain -- see
  // app/api/folders/[id]/route.js's added `ancestors` field, Task 3 Step 3's
  // preferred approach over N+1 client fetches) and its direct subfolders.
  useEffect(() => {
    if (!folderId) return;
    let cancelled = false;

    fetch(`/api/folders/${folderId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Folder not found.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setFolder(data);
        setAncestors(data.ancestors || []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });

    fetch(`/api/folders?parentFolderId=${folderId}`)
      .then((res) => (res.ok ? res.json() : { folders: [] }))
      .then((data) => {
        if (cancelled) return;
        // GET /api/folders now returns each folder's own `ledgers` array
        // (Phase 5 Task 3 enrichment, matching the existing `participantNames`
        // pattern) so the tree panel can render nested Ledgers without a
        // separate new API route.
        const children = (data.folders || []).map((sf) => ({
          id: sf.id,
          name: sf.name,
          ledgers: sf.ledgers || [],
        }));
        setSubfolders(children);
      })
      .catch(() => {
        if (!cancelled) setSubfolders([]);
      });

    return () => {
      cancelled = true;
    };
  }, [folderId]);

  // Load the selected Ledger whenever selection changes.
  useEffect(() => {
    if (!selectedLedgerId) {
      setLedger(null);
      setLedgerData(null);
      return;
    }
    let cancelled = false;
    setLedgerLoadError(null);
    fetch(`/api/ledgers/${selectedLedgerId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Ledger not found.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setLedger(data);
        const config = DOC_TYPE_CONFIG[data.documentType];
        setLedgerData({
          ...(config ? config.defaultData : {}),
          currentDate: todayLabel(),
          ...(data.formData || {}),
        });
      })
      .catch((err) => {
        if (!cancelled) setLedgerLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLedgerId]);

  const config = ledger ? DOC_TYPE_CONFIG[ledger.documentType] : null;
  const model = useMemo(() => {
    if (!config || !ledgerData) return null;
    return config.buildModel(ledgerData);
  }, [config, ledgerData]);

  const ledgerReadOnly = !!(ledger && (ledger.readOnly || ledger.locked));

  // Debounced autosave -- identical shape to app/app/page.js's autosave
  // useEffect, just pointed at PATCH /api/ledgers/[id] instead of
  // PATCH /api/deals/[id].
  useEffect(() => {
    if (!ledgerData || !selectedLedgerId || ledgerReadOnly) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch(`/api/ledgers/${selectedLedgerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: ledgerData }),
      }).catch(() => {
        // Best-effort autosave, matching app/app/page.js's precedent.
      });
    }, 1000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [ledgerData, selectedLedgerId, ledgerReadOnly]);

  function handleNavigateFolder(id) {
    window.location.href = `/ledgerboard/folder/${id}`;
  }

  async function handleRenameFolder(id, name) {
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => {});
    if (id === folderId) {
      setFolder((f) => (f ? { ...f, name } : f));
    } else {
      setAncestors((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
      setSubfolders((prev) => prev.map((sf) => (sf.id === id ? { ...sf, name } : sf)));
    }
  }

  async function handleAddLedger() {
    const res = await fetch("/api/ledgers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, documentType: "purchase_loi" }),
    }).catch(() => null);
    if (!res || !res.ok) return;
    const created = await res.json().catch(() => null);
    if (!created) return;
    setSelectedLedgerId(created.id);
  }

  const hasNoActiveLedger = !selectedLedgerId;
  const hasActiveLedger = !!selectedLedgerId;
  const docSelected = !!selectedLedgerId;

  if (loadError) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        <div style={{ color: "oklch(45% 0.18 25)", marginBottom: "12px" }}>⚠️ {loadError}</div>
        <a href="/dashboard">Back to Ledgerboard</a>
      </div>
    );
  }

  if (!folder) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
        color: "oklch(24% 0.015 264)",
        background: "oklch(97% 0.006 60)",
      }}
    >
      <FolderBreadcrumb
        ancestors={ancestors}
        current={{ name: folder.name }}
        selectedDocName={ledger ? ledger.name : undefined}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <FolderTreePanel
          folder={folder}
          ancestors={ancestors}
          subfolders={subfolders}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed((c) => !c)}
          selectedLedgerId={selectedLedgerId}
          onSelectLedger={setSelectedLedgerId}
          onNavigateFolder={handleNavigateFolder}
          onRenameFolder={handleRenameFolder}
          onAddLedger={handleAddLedger}
        />

        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            overflowY: "auto",
            padding: "26px 28px",
            background: "oklch(97% 0.006 60)",
          }}
        >
          {hasActiveLedger ? (
            ledgerLoadError ? (
              <div style={{ color: "oklch(45% 0.18 25)" }}>⚠️ {ledgerLoadError}</div>
            ) : !ledgerData || !config ? (
              ledger && !config ? (
                <div style={{ padding: "40px", color: "oklch(45% 0.01 264)" }}>
                  No editor is available for this document type yet ({ledger.documentType}).
                </div>
              ) : (
                <div style={{ padding: "40px", color: "oklch(45% 0.01 264)" }}>Loading…</div>
              )
            ) : (
              <config.Form
                data={ledgerData}
                onChange={setLedgerData}
                onExport={() => {}}
                onClearDraft={() =>
                  setLedgerData({ ...config.defaultData, currentDate: todayLabel() })
                }
                exportState={noopExportState}
                readOnly={ledgerReadOnly}
              />
            )
          ) : (
            // Middle-panel big empty-state call-to-action, per the handoff's
            // hasNoActiveLedger block (~L243-250) -- rendered ONLY in the
            // middle panel. The right panel gets its own smaller, separate
            // empty state below (showPreviewEmpty), not a merged block.
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "80px 20px",
                color: "oklch(45% 0.01 264)",
              }}
            >
              <div style={{ fontSize: "34px", marginBottom: "10px" }}>📄</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>No document open</div>
              <div style={{ fontSize: "13px", marginBottom: "18px", maxWidth: "260px" }}>
                Select a document from the left panel, or start a new one.
              </div>
              <button
                type="button"
                onClick={handleAddLedger}
                style={{
                  padding: "10px 18px",
                  borderRadius: "9px",
                  border: "none",
                  background: "oklch(45% 0.15 300)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "13.5px",
                  cursor: "pointer",
                }}
              >
                + New Ledger
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            flex: rightCollapsed ? "0 0 46px" : "0 0 38%",
            overflowY: "auto",
            background: "oklch(93% 0.012 60)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            transition: "flex-basis .15s",
          }}
        >
          <div
            style={{
              padding: rightCollapsed ? "10px 4px" : "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: rightCollapsed ? "center" : "space-between",
            }}
          >
            {!rightCollapsed ? (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "oklch(48% 0.01 264)",
                }}
              >
                Preview
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setRightCollapsed((c) => !c)}
              title={rightCollapsed ? "Expand preview panel" : "Collapse preview panel"}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "14px",
                color: "oklch(48% 0.01 264)",
                padding: "2px 4px",
                flex: "0 0 auto",
              }}
            >
              {rightCollapsed ? "«" : "»"}
            </button>
          </div>

          {/* Right panel's own empty/content state, independent of the middle
              panel's empty state (handoff's showPreviewContent / showPreviewEmpty,
              ~L260-271). Only rendered when the panel itself isn't collapsed. */}
          {!rightCollapsed && docSelected && model ? (
            <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 24px 40px" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: "480px",
                  background: "white",
                  boxShadow: "0 8px 30px rgba(30,25,15,.14)",
                  padding: "48px 44px",
                  fontFamily: "'Source Serif 4',Georgia,serif",
                  color: "oklch(20% 0.01 264)",
                  minHeight: "600px",
                }}
              >
                <config.Preview model={model} />
              </div>
            </div>
          ) : null}
          {!rightCollapsed && !docSelected ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "40px",
                color: "oklch(48% 0.01 264)",
                fontSize: "13px",
              }}
            >
              Select a document to preview it here.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
