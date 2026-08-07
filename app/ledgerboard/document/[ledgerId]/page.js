"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import LOIForm from "../../../../components/LOIForm";
import LOIPreview from "../../../../components/LOIPreview";
import ResizableSplitPane from "../../../../components/ResizableSplitPane";
import DocumentActionBar from "../../../../components/DocumentActionBar";
import DocumentAuditPanel from "../../../../components/DocumentAuditPanel";
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

// Same documentType -> {Form, Preview, defaults, buildModel} mapping as
// app/ledgerboard/folder/[folderId]/page.js -- reused verbatim.
const DOC_TYPE_CONFIG = {
  purchase_loi: { Form: LOIForm, Preview: LOIPreview, defaultData: DEFAULT_FORM_DATA, buildModel: buildLOIModel },
  commercial_lease: { Form: LeaseForm, Preview: LeasePreview, defaultData: DEFAULT_LEASE_DATA, buildModel: buildLeaseModel },
  residential_lease: { Form: ResidentialLeaseForm, Preview: ResidentialLeasePreview, defaultData: DEFAULT_RESIDENTIAL_LEASE_DATA, buildModel: buildResidentialLeaseModel },
};

const noopExportState = { loading: false, format: null, error: null, success: null };

// A dedicated single-document view for users who only have a
// LedgerParticipant grant on this one Ledger (no FolderParticipant/org
// access to the containing folder). GET /api/folders/[folderId] 404s for
// these users, so the folder tree workspace is unreachable -- this route
// bypasses the folder entirely and talks only to GET/PATCH
// /api/ledgers/[id], which lib/ledgerAccess.js already grants on a pure
// document-level share.
export default function SharedDocumentPage() {
  const params = useParams();
  const ledgerId = params.ledgerId;

  const [ledger, setLedger] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [exportState, setExportState] = useState(noopExportState);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

  useEffect(() => {
    if (!ledgerId) return;
    let cancelled = false;
    fetch(`/api/ledgers/${ledgerId}`)
      .then((res) => {
        if (!res.ok) throw new Error("You don't have access to this document, or it doesn't exist.");
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
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [ledgerId]);

  const config = ledger ? DOC_TYPE_CONFIG[ledger.documentType] : null;
  const model = useMemo(() => {
    if (!config || !ledgerData) return null;
    return config.buildModel(ledgerData);
  }, [config, ledgerData]);

  const readOnly = !!(ledger && (ledger.readOnly || ledger.locked));

  useEffect(() => {
    if (!ledgerData || !ledgerId || readOnly || !config) return;
    const timeout = setTimeout(() => {
      fetch(`/api/ledgers/${ledgerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: ledgerData }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timeout);
  }, [ledgerData, ledgerId, readOnly, config]);

  async function handleExport(format) {
    setExportState({ loading: true, format, error: null, success: null });
    try {
      const res = await fetch(`/api/ledgers/${ledgerId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(ledger?.name || "document").replace(/[^a-z0-9]+/gi, "_")}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportState({ loading: false, format: null, error: null, success: "Your document has been downloaded." });
    } catch (err) {
      setExportState({ loading: false, format: null, error: err.message, success: null });
    }
  }

  if (loadError) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        <div style={{ color: "oklch(45% 0.18 25)" }}>⚠️ {loadError}</div>
      </div>
    );
  }

  if (!ledger || !ledgerData) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>Loading…</div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
        color: "oklch(24% 0.015 264)",
        background: "oklch(97% 0.006 60)",
      }}
    >
      <ResizableSplitPane
        storageKey={`panel-width:${ledger.documentType || "document"}`}
        left={
          <div style={{ height: "100%", overflowY: "auto", padding: "26px 28px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "oklch(48% 0.01 264)", marginBottom: 10 }}>
              {ledger.name} {ledger.viewOnly ? "· Shared with you (view only)" : "· Shared with you"}
            </div>
            {!config ? (
              <div style={{ padding: "40px", color: "oklch(45% 0.01 264)" }}>
                No editor is available for this document type yet ({ledger.documentType}).
              </div>
            ) : (
              <config.Form
                data={ledgerData}
                onChange={setLedgerData}
                onExport={handleExport}
                onClearDraft={() => setLedgerData({ ...config.defaultData, currentDate: todayLabel() })}
                exportState={exportState}
                readOnly={readOnly}
                actionBar={<DocumentActionBar readOnly={readOnly} onAudit={() => setAuditPanelOpen(true)} />}
              />
            )}
          </div>
        }
        right={
          // Preview itself renders .preview-panel/.document-paper (the same
          // "paper" look every other preview uses) -- this used to also be
          // wrapped in a second, duplicate white/padded box here, which is
          // exactly the 3-places-set-padding duplication this feature's
          // design flagged; dropped in favor of the one shared style.
          model && config ? <config.Preview model={model} data={ledgerData} onEdit={setLedgerData} readOnly={readOnly} /> : null
        }
      />

      <DocumentAuditPanel ledgerId={ledger.id} isOpen={auditPanelOpen} onClose={() => setAuditPanelOpen(false)} />
    </div>
  );
}
