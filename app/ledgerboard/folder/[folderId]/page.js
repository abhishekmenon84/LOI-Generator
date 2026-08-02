"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import FolderBreadcrumb from "../../../../components/FolderBreadcrumb";
import FolderTreePanel from "../../../../components/FolderTreePanel";
import ResizeHandle from "../../../../components/ResizeHandle";
import FolderFileViewer from "../../../../components/FolderFileViewer";
import AnchorEditor from "../../../../components/AnchorEditor";
import LOIForm from "../../../../components/LOIForm";
import LOIPreview from "../../../../components/LOIPreview";
import DocumentActionBar from "../../../../components/DocumentActionBar";
import SendForSignatureModal from "../../../../components/SendForSignatureModal";
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

// Fix round 1 (Important #2): Ledger-scoped export doesn't exist yet (no
// /api/export/... route accepts a ledgerId), so exporting here can't work.
// Rather than a silent no-op, surface an honest, visible message via the
// same exportState contract app/app/page.js uses ({loading, format, error,
// success}) so the Form components' existing error-banner rendering picks
// it up -- a disclosed limitation instead of dead silence.
const EXPORT_UNAVAILABLE_MESSAGE = "Export isn't available in this workspace yet.";

export default function FolderWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.folderId;

  const [folder, setFolder] = useState(null);
  const [ancestors, setAncestors] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [folderLedgers, setFolderLedgers] = useState([]);
  const [folderFiles, setFolderFiles] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // Percentage-based panel widths (10 / 40 / 50), dragged via ResizeHandle.
  // The middle panel takes whatever is left, so only these two are state.
  // Only meaningful when the respective panel isn't collapsed -- see
  // rightPanelFlex/middlePanelFlex below for how collapse state overrides
  // these.
  const [leftPct, setLeftPct] = useState(10);
  const [rightPct, setRightPct] = useState(50);
  // Measured to translate a drag's pixel delta into a percentage delta.
  const panelsRef = useRef(null);

  const [selectedLedgerId, setSelectedLedgerId] = useState(null);
  const [ledger, setLedger] = useState(null); // {id, folderId, name, documentType, formData, locked, readOnly}
  const [ledgerData, setLedgerData] = useState(null); // just the formData, edited locally
  const [ledgerLoadError, setLedgerLoadError] = useState(null);
  const [exportState, setExportState] = useState(noopExportState);
  const saveTimeoutRef = useRef(null);

  // Phase 7 Task 6: selectedFileId/fileData mirror selectedLedgerId/ledger.
  // A tree row click sets exactly ONE of {selectedLedgerId, selectedFileId}
  // and clears the other (see handleSelectLedger/handleSelectFile below),
  // so "which one is active" is always derivable from which id is non-null
  // -- there is never a state where both are set.
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [fileData, setFileData] = useState(null); // full GET /api/folders/files/[fileId] response
  const [fileLoadError, setFileLoadError] = useState(null);
  const fileSaveTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);

  // Reuses AnchorEditor (built for CustomTemplate/FormTemplate anchor
  // placement) for a plain FolderFile upload too -- the editor's props are
  // already generic ({fileUrl, pageCount, anchors, onSave, onCancel}) and
  // PATCH /api/folders/files/[fileId] already accepts and persists an
  // `anchors` array, setting fieldTier: "manual"; only the UI entry point
  // was missing.
  const [editingFileFields, setEditingFileFields] = useState(false);
  const [fileFieldsError, setFileFieldsError] = useState(null);

  // "Built-in document" used to hardcode documentType: "purchase_loi" with
  // no choice at all -- this state backs a small picker (same shape as the
  // template picker below) so the other two built-in types are actually
  // reachable instead of every "+ Built-in document" click silently
  // creating a Purchase LOI.
  const [builtInPickerOpen, setBuiltInPickerOpen] = useState(false);

  // Phase 7b Task 4: "New Ledger from template" picker state. `folder.orgId`
  // is already present in GET /api/folders/[id]'s response (confirmed at
  // app/api/folders/[id]/route.js line 56), so no new route/field is needed
  // -- this page just fetches the org's templates on open.
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);
  const [creatingFromTemplateId, setCreatingFromTemplateId] = useState(null);

  // Task 7: send-for-signature / audit-trail modal open state for the
  // currently selected Ledger, mirroring app/app/page.js's equivalent state.
  // No shareModalOpen here -- Deal-level sharing is explicitly out of scope
  // for this workspace (Folder-level FolderParticipant sharing covers it).
  const [sendForSignatureOpen, setSendForSignatureOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

  // Load the current folder (server resolves its own ancestor chain -- see
  // app/api/folders/[id]/route.js's added `ancestors` field, Task 3 Step 3's
  // preferred approach over N+1 client fetches) and its direct subfolders.
  //
  // Fix round 1 (Important #1): GET /api/folders/[id] now also returns this
  // folder's OWN `ledgers` array (documents created directly in this folder,
  // not in a subfolder). Previously only subfolder Ledgers were fetched
  // (via GET /api/folders?parentFolderId=), so Ledgers created directly in
  // the current folder never appeared anywhere in the tree after creation.
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
        setFolderLedgers(data.ledgers || []);
        // Phase 7 Task 6: GET /api/folders/[id] now also returns this
        // folder's own `files` array (FolderFiles uploaded directly here),
        // mirroring `ledgers` immediately above.
        setFolderFiles(data.files || []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });

    fetch(`/api/folders?parentFolderId=${folderId}`)
      .then((res) => (res.ok ? res.json() : { folders: [] }))
      .then((data) => {
        if (cancelled) return;
        // GET /api/folders now returns each folder's own `ledgers` and
        // `files` arrays (Phase 5 Task 3 / Phase 7 Task 6 enrichments,
        // matching the existing `participantNames` pattern) so the tree
        // panel can render nested Ledgers and FolderFiles without a
        // separate new API route.
        const children = (data.folders || []).map((sf) => ({
          id: sf.id,
          name: sf.name,
          ledgers: sf.ledgers || [],
          files: sf.files || [],
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
    setExportState(noopExportState);
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

  // Load the selected FolderFile whenever selection changes -- mirrors the
  // Ledger-detail-loading useEffect immediately above.
  useEffect(() => {
    if (!selectedFileId) {
      setFileData(null);
      return;
    }
    let cancelled = false;
    setFileLoadError(null);
    fetch(`/api/folders/files/${selectedFileId}`)
      .then((res) => {
        if (!res.ok) throw new Error("File not found.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setFileData(data);
      })
      .catch((err) => {
        if (!cancelled) setFileLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFileId]);

  const config = ledger ? DOC_TYPE_CONFIG[ledger.documentType] : null;
  const model = useMemo(() => {
    if (!config || !ledgerData) return null;
    return config.buildModel(ledgerData);
  }, [config, ledgerData]);

  const ledgerReadOnly = !!(ledger && (ledger.readOnly || ledger.locked));

  // Debounced autosave -- identical shape to app/app/page.js's autosave
  // useEffect, just pointed at PATCH /api/ledgers/[id] instead of
  // PATCH /api/deals/[id].
  //
  // Final whole-branch review (Critical/Important #1 defense-in-depth): also
  // require `config` to be present, i.e. never autosave when there's no
  // DOC_TYPE_CONFIG entry for the selected Ledger's documentType (this is
  // the case for "custom_template" Ledgers, which have their own dedicated
  // screen and must never be loaded into this generic state in the first
  // place -- see handleSelectLedger below, which is the primary fix. This
  // guard is cheap insurance in case some other path still selects one).
  useEffect(() => {
    if (!ledgerData || !selectedLedgerId || ledgerReadOnly || !config) return;
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
  }, [ledgerData, selectedLedgerId, ledgerReadOnly, config]);

  const fileReadOnly = !!(fileData && fileData.readOnly);

  // Debounced autosave for a selected FolderFile's formValues -- identical
  // 1-second-debounce shape to the Ledger autosave useEffect immediately
  // above, just retargeted to PATCH /api/folders/files/[fileId].
  useEffect(() => {
    if (!fileData || !selectedFileId || fileReadOnly) return;
    if (fileSaveTimeoutRef.current) clearTimeout(fileSaveTimeoutRef.current);
    fileSaveTimeoutRef.current = setTimeout(() => {
      fetch(`/api/folders/files/${selectedFileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formValues: fileData.formValues || {} }),
      }).catch(() => {
        // Best-effort autosave, matching the Ledger autosave precedent.
      });
    }, 1000);
    return () => clearTimeout(fileSaveTimeoutRef.current);
  }, [fileData, selectedFileId, fileReadOnly]);

  // onSelectLedger/onSelectFile must clear each other -- selecting one
  // always deselects the other, so the middle/right panel conditional never
  // has to consider "both selected" as a possible state.
  //
  // Final whole-branch review (Critical + Important #1): a "custom_template"
  // Ledger has no entry in DOC_TYPE_CONFIG -- there is no dynamic form/editor
  // for it, and it's handled entirely by the dedicated
  // /ledgerboard/custom-template/[ledgerId] screen (signer-role assignment
  // over a fixed PDF). Previously, clicking one here still loaded it into
  // this page's generic selectedLedgerId/ledgerData state: the middle panel
  // correctly showed a "no editor" message, but the autosave useEffect above
  // wasn't gated on `config` and could PATCH {formData: ledgerData} back to
  // the server, wholesale-replacing (not merging) the Ledger's
  // templateId/signerRoleAssignments -- the only data that makes it
  // meaningful. It also meant the dedicated screen was unreachable except via
  // the one-shot redirect right after creation. Routing away here instead
  // means a custom_template Ledger is never actually selected into this
  // page's state at all, so the autosave effect never fires for it, and the
  // Ledger stays reachable by clicking it in the tree at any time.
  // Fix round 2 (Critical/Important, task-7-review.md): switching the
  // selected Ledger (or File) must always close any open
  // signature/audit-trail UI rather than let it silently follow the switch.
  // Without this, sendForSignatureOpen/auditPanelOpen stay true across the
  // switch, and the modals' ledgerId props swap out from under the user once
  // the new Ledger's data loads -- for SendForSignatureModal this can result
  // in a still-filled-in participants form POSTing to the WRONG Ledger's
  // /signature-request endpoint if the user doesn't notice. Closing both
  // modals here is the primary fix; see also the key={ledger?.id} props
  // below, which are defense-in-depth for the (rare) case a modal is opened
  // again for a new Ledger before this component fully re-renders.
  function closeSignatureModals() {
    setSendForSignatureOpen(false);
    setAuditPanelOpen(false);
  }

  function handleSelectLedger(id, documentType) {
    if (documentType === "custom_template") {
      router.push(`/ledgerboard/custom-template/${id}`);
      return;
    }
    closeSignatureModals();
    setSelectedFileId(null);
    setSelectedLedgerId(id);
  }

  function handleSelectFile(id) {
    closeSignatureModals();
    setSelectedLedgerId(null);
    setSelectedFileId(id);
    setEditingFileFields(false);
  }

  // Document-level archive/restore (Ledger.archivedAt) -- distinct from
  // Folder-level archive, which has its own reason-modal flow elsewhere.
  // Updates folderLedgers optimistically so the tree's Active/Archived
  // split reflects the change immediately; reverts on failure.
  async function handleToggleLedgerArchive(ledgerId, archived) {
    const prev = folderLedgers;
    setFolderLedgers((cur) => cur.map((l) => (l.id === ledgerId ? { ...l, archivedAt: archived ? new Date().toISOString() : null } : l)));
    const res = await fetch(`/api/ledgers/${ledgerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setFolderLedgers(prev);
    }
  }

  async function handleToggleFileArchive(fileId, archived) {
    const prev = folderFiles;
    setFolderFiles((cur) => cur.map((f) => (f.id === fileId ? { ...f, archivedAt: archived ? new Date().toISOString() : null } : f)));
    const res = await fetch(`/api/folders/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setFolderFiles(prev);
    }
  }

  function handleFieldChange(anchorId, value) {
    setFileData((prev) => (prev ? { ...prev, formValues: { ...(prev.formValues || {}), [anchorId]: value } } : prev));
  }

  async function handleSaveFileFields(anchors) {
    setFileFieldsError(null);
    const fileIdBeingEdited = selectedFileId;
    const res = await fetch(`/api/folders/files/${fileIdBeingEdited}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchors }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setFileFieldsError("Could not save fields. Please try again.");
      return;
    }
    // Use the PATCH response directly -- it now returns the full file
    // (including the freshly-saved anchors) from the same update() call
    // that wrote them, per app/api/folders/files/[fileId]/route.js's
    // comment. A separate follow-up GET was NOT guaranteed to observe
    // this same write immediately on Neon's serverless Postgres (a
    // different request can land on a different pooled connection),
    // which was the actual cause of "I saved anchors and they vanished."
    const updated = await res.json().catch(() => null);
    // Guards against the user having since clicked to a different
    // file/ledger in the tree while this save was in flight -- applying a
    // stale response to whatever is now selected would show the wrong
    // file's fields.
    if (updated && fileIdBeingEdited === selectedFileId) {
      setFileData(updated);
    }
    setEditingFileFields(false);
  }

  async function handleUploadFile(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    setUploadError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/folders/${folderId}/files`, {
      method: "POST",
      body,
    }).catch(() => null);
    if (!res || !res.ok) {
      const errBody = await res?.json().catch(() => ({})) ?? {};
      setUploadError(errBody.error || "Upload failed. Please try again.");
      return;
    }
    const created = await res.json().catch(() => null);
    if (!created) {
      setUploadError("Upload failed. Please try again.");
      return;
    }
    // Mirrors handleAddLedger's existing refresh-after-create pattern: reflect
    // the newly uploaded FolderFile in the current folder's own files list
    // immediately, so it shows up in the tree right away.
    setFolderFiles((prev) => [
      ...prev,
      { id: created.id, name: created.name, mimeType: created.mimeType, fieldTier: created.fieldTier },
    ]);
    handleSelectFile(created.id);
  }

  function handleNavigateFolder(id) {
    // Fix round 1 (Minor #7): use next/navigation's client-side router
    // instead of a full page reload, matching FolderBreadcrumb's next/link.
    router.push(`/ledgerboard/folder/${id}`);
  }

  async function handleRenameFolder(id, name) {
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => {});
    // Fix round 1 (Minor #4): compare against the fetched folder object's own
    // `.id`, not the raw `folderId` route param, for correctness/clarity.
    if (folder && id === folder.id) {
      setFolder((f) => (f ? { ...f, name } : f));
    } else {
      setAncestors((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
      setSubfolders((prev) => prev.map((sf) => (sf.id === id ? { ...sf, name } : sf)));
    }
  }

  async function handleAddLedger(documentType) {
    setBuiltInPickerOpen(false);
    const res = await fetch("/api/ledgers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, documentType }),
    }).catch(() => null);
    if (!res || !res.ok) return;
    const created = await res.json().catch(() => null);
    if (!created) return;
    // Fix round 1 (Important #1): reflect the newly created Ledger in the
    // current folder's own ledgers list immediately, so it shows up in the
    // tree right away rather than only after a reload.
    setFolderLedgers((prev) => [
      ...prev,
      { id: created.id, name: created.name, documentType: created.documentType },
    ]);
    handleSelectLedger(created.id);
  }

  // Phase 7b Task 4: opens the template picker and fetches the org's
  // templates. `folder.orgId` comes straight from the already-loaded folder
  // state (see the GET /api/folders/[folderId] effect above) -- no extra
  // folder fetch needed here.
  function handleAddFromTemplate() {
    setTemplatePickerOpen(true);
    setTemplatesError(null);
    if (!folder?.orgId) return;
    setTemplatesLoading(true);
    fetch(`/api/orgs/${folder.orgId}/templates`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load templates.");
        return res.json();
      })
      .then((data) => {
        setTemplates(data.templates || []);
      })
      .catch((err) => {
        setTemplatesError(err.message);
      })
      .finally(() => {
        setTemplatesLoading(false);
      });
  }

  function closeTemplatePicker() {
    setTemplatePickerOpen(false);
    setTemplatesError(null);
    setCreatingFromTemplateId(null);
  }

  // On picking a template: POST /api/ledgers with documentType:
  // "custom_template" (per app/api/ledgers/route.js's VALID_DOC_TYPES) and
  // the template's own name as the new Ledger's name, then navigate to the
  // dedicated signer-assignment screen instead of selecting it into the
  // normal three-panel view -- a custom_template Ledger has no dynamic-form
  // editor in DOC_TYPE_CONFIG above.
  async function handlePickTemplate(template) {
    setCreatingFromTemplateId(template.id);
    setTemplatesError(null);
    const res = await fetch("/api/ledgers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, documentType: "custom_template", name: template.name }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setTemplatesError("Could not create a Ledger from that template. Please try again.");
      setCreatingFromTemplateId(null);
      return;
    }
    const created = await res.json().catch(() => null);
    if (!created) {
      setTemplatesError("Could not create a Ledger from that template. Please try again.");
      setCreatingFromTemplateId(null);
      return;
    }
    // Stash the templateId on the new Ledger so the signer-assignment screen
    // can resolve the template without re-picking it. PATCH /api/ledgers/[id]
    // replaces `formData` wholesale, so this must happen before navigating.
    //
    // Final whole-branch review (Important #2): previously this PATCH's
    // failure was swallowed with a bare `.catch(() => {})` and `res.ok` was
    // never checked, so a failed PATCH still navigated into the
    // signer-assignment screen, which would immediately show "This Ledger
    // has no associated template." with no explanation, leaving an orphaned
    // empty Ledger behind. Now check res.ok and surface a clear error via
    // the same templatesError state this create-flow already uses for its
    // other failure cases, instead of navigating.
    const patchRes = await fetch(`/api/ledgers/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData: { templateId: template.id } }),
    }).catch(() => null);
    if (!patchRes || !patchRes.ok) {
      setTemplatesError("Could not set up that template. Please try again.");
      setCreatingFromTemplateId(null);
      return;
    }
    router.push(`/ledgerboard/custom-template/${created.id}`);
  }

  function handleExport() {
    setExportState({
      loading: false,
      format: null,
      error: EXPORT_UNAVAILABLE_MESSAGE,
      success: null,
    });
  }

  const hasActiveLedger = !!selectedLedgerId;
  const hasActiveFile = !!selectedFileId;
  const docSelected = !!selectedLedgerId;

  // Task 4: when the left (folder tree) panel is collapsed, the middle and
  // right panels split the freed space equally instead of the right panel
  // staying pinned to its fixed configured width -- "1 1 0" on both gives
  // them equal flex-grow shares. Otherwise, today's existing behavior is
  // preserved: middle grows to fill remaining space, right panel keeps its
  // configured share of the container width.
  const rightPanelFlex = rightCollapsed
    ? "0 0 46px"
    : leftCollapsed
    ? "1 1 0" // equal split with the middle panel when the left panel is hidden
    : `0 0 ${rightPct}%`;
  const middlePanelFlex = leftCollapsed && !rightCollapsed ? "1 1 0" : "1 1 auto";

  // A ResizeHandle reports a pixel delta; panels are sized in percent, so
  // convert against the live container width before clamping.
  function dragPct(dx) {
    const w = panelsRef.current?.clientWidth || 0;
    return w ? (dx / w) * 100 : 0;
  }

  if (loadError) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        <div style={{ color: "oklch(45% 0.18 25)", marginBottom: "12px" }}>⚠️ {loadError}</div>
        <a href="/documents">Back to Ledgerboard</a>
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

      {uploadError ? (
        <div
          style={{
            color: "oklch(45% 0.18 25)",
            padding: "10px 20px",
            background: "oklch(96% 0.03 25)",
            borderBottom: "1px solid oklch(85% 0.05 25)",
            fontSize: "13px",
          }}
        >
          ⚠️ {uploadError}
        </div>
      ) : null}

      <div ref={panelsRef} style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            handleUploadFile(e.target.files);
            e.target.value = "";
          }}
        />
        <FolderTreePanel
          folder={folder}
          folderLedgers={folderLedgers}
          files={folderFiles}
          ancestors={ancestors}
          subfolders={subfolders}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed((c) => !c)}
          selectedLedgerId={selectedLedgerId}
          onSelectLedger={handleSelectLedger}
          selectedFileId={selectedFileId}
          onSelectFile={handleSelectFile}
          onNavigateFolder={handleNavigateFolder}
          onRenameFolder={handleRenameFolder}
          onAddLedger={() => setBuiltInPickerOpen(true)}
          onAddFromTemplate={handleAddFromTemplate}
          onUploadFile={() => fileInputRef.current?.click()}
          onToggleLedgerArchive={handleToggleLedgerArchive}
          onToggleFileArchive={handleToggleFileArchive}
          width={`${leftPct}%`}
        />

        {!leftCollapsed && (
          <ResizeHandle
            onDrag={(dx) =>
              setLeftPct((p) => Math.min(30, Math.max(8, p + dragPct(dx))))
            }
          />
        )}

        <div
          style={{
            flex: middlePanelFlex,
            minWidth: 0,
            overflowY: "auto",
            padding: "26px 28px",
            background: "oklch(97% 0.006 60)",
          }}
        >
          {hasActiveFile ? (
            fileLoadError ? (
              <div style={{ color: "oklch(45% 0.18 25)" }}>⚠️ {fileLoadError}</div>
            ) : !fileData ? (
              <div style={{ padding: "40px", color: "oklch(45% 0.01 264)" }}>Loading…</div>
            ) : editingFileFields ? (
              <div>
                {fileFieldsError && <div style={{ color: "oklch(45% 0.18 25)", marginBottom: 12 }}>⚠️ {fileFieldsError}</div>}
                <AnchorEditor
                  fileUrl={fileData.fileUrl}
                  pageCount={fileData.pageCount || 1}
                  anchors={(fileData.anchors || []).map((a) => ({ ...a }))}
                  onSave={handleSaveFileFields}
                  onCancel={() => setEditingFileFields(false)}
                />
              </div>
            ) : (
              <FolderFileViewer file={fileData} onFieldChange={handleFieldChange} readOnly={fileReadOnly} onEditFields={() => setEditingFileFields(true)} />
            )
          ) : hasActiveLedger ? (
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
                onExport={handleExport}
                onClearDraft={() =>
                  setLedgerData({ ...config.defaultData, currentDate: todayLabel() })
                }
                exportState={exportState}
                readOnly={ledgerReadOnly}
                actionBar={
                  <DocumentActionBar
                    readOnly={ledgerReadOnly}
                    hideShare
                    onSendForSignature={() => setSendForSignatureOpen(true)}
                    onAudit={() => setAuditPanelOpen(true)}
                  />
                }
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
              <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>What would you like to add?</div>
              <div style={{ fontSize: "13px", marginBottom: "18px", maxWidth: "260px" }}>
                Select a document from the left panel, or add a new one to this ledger.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: "260px" }}>
                <button
                  type="button"
                  onClick={() => setBuiltInPickerOpen(true)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "9px",
                    border: "none",
                    background: "oklch(24% 0.015 264)",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  + Built-in document
                </button>
                <button
                  type="button"
                  onClick={handleAddFromTemplate}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "9px",
                    border: "1px solid oklch(88% 0.008 60)",
                    background: "white",
                    color: "oklch(30% 0.01 264)",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  + Document from template
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "9px",
                    border: "1px solid oklch(88% 0.008 60)",
                    background: "white",
                    color: "oklch(30% 0.01 264)",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  + Upload file
                </button>
              </div>
            </div>
          )}
        </div>

        {/* The right handle only makes sense when the right panel has a
            fixed pixel width to drag (i.e. NOT the equal-split state, which
            only occurs when leftCollapsed && !rightCollapsed -- see
            rightPanelFlex above). Dragging a flex-based equal-split panel by
            pixel delta doesn't map cleanly onto that layout, so this task
            intentionally doesn't attempt to make the equal-split state also
            draggable; that's a deliberate scope boundary, not an oversight. */}
        {!rightCollapsed && !leftCollapsed && (
          <ResizeHandle
            onDrag={(dx) =>
              setRightPct((p) => Math.min(70, Math.max(30, p - dragPct(dx))))
            }
          />
        )}

        <div
          style={{
            flex: rightPanelFlex,
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
            <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 6px 16px" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: "760px",
                  background: "white",
                  padding: "32px 28px",
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
              {hasActiveFile
                ? "This file's preview is shown inline in the main panel."
                : "Select a document to preview it here."}
            </div>
          ) : null}
        </div>
      </div>

      {/* Task 7: send-for-signature / audit-trail modals for the currently
          selected Ledger. Only reachable via the actionBar buttons rendered
          inside the hasActiveLedger && config branch above, so ledger.id is
          always non-null whenever these could actually be opened.

          Fix round 2 (Critical/Important, task-7-review.md): key={ledger?.id}
          on both forces React to fully unmount/remount them whenever the
          selected Ledger changes, resetting SendForSignatureModal's internal
          participants useState (which has no effect tied to ledgerId
          changing) and DocumentAuditPanel's stale data/error state, instead
          of letting the same component instance's state silently carry over
          to a new ledgerId prop. This is defense-in-depth alongside
          closeSignatureModals() in handleSelectLedger/handleSelectFile
          above, which is the primary fix (it closes the modal outright on
          switch, so the remount-with-fresh-state behavior here mostly
          matters for the brief window before that state update commits). */}
      {hasActiveLedger && config ? (
        <>
          <SendForSignatureModal
            key={ledger?.id}
            ledgerId={ledger?.id}
            documentType={ledger?.documentType}
            isOpen={sendForSignatureOpen}
            onClose={() => setSendForSignatureOpen(false)}
            onSent={() => setSendForSignatureOpen(false)}
          />
          <DocumentAuditPanel
            key={ledger?.id}
            ledgerId={ledger?.id}
            isOpen={auditPanelOpen}
            onClose={() => setAuditPanelOpen(false)}
          />
        </>
      ) : null}

      {/* Built-in document type picker -- same plain overlay/modal
          convention as the template picker below (fixed full-bleed
          backdrop, click-outside to close, centered white card). */}
      {builtInPickerOpen ? (
        <div
          onClick={() => setBuiltInPickerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(30,25,20,.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 16, padding: "26px 26px 22px", width: 360, boxShadow: "0 20px 60px rgba(30,25,15,.25)" }}
          >
            <div style={{ fontWeight: 750, fontSize: 17, marginBottom: 14 }}>New built-in document</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
              {Object.entries(DOC_TYPE_CONFIG)
                .filter(([type]) => type !== "custom_template")
                .map(([type, config]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAddLedger(type)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "9px",
                      border: "1px solid oklch(88% 0.008 60)",
                      background: "white",
                      color: "oklch(30% 0.01 264)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {config.label}
                  </button>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setBuiltInPickerOpen(false)}
                style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: "oklch(94% 0.005 60)", color: "oklch(35% 0.01 264)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Template picker -- same plain overlay/modal convention as
          FolderReasonModal.jsx (fixed full-bleed backdrop, click-outside to
          close, centered white card). */}
      {templatePickerOpen ? (
        <div
          onClick={closeTemplatePicker}
          style={{ position: "fixed", inset: 0, background: "rgba(30,25,20,.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 16, padding: "26px 26px 22px", width: 420, maxHeight: "70vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(30,25,15,.25)" }}
          >
            <div style={{ fontWeight: 750, fontSize: 17, marginBottom: 14 }}>New Ledger from template</div>

            {templatesError ? (
              <div style={{ color: "oklch(45% 0.18 25)", fontSize: "13px", marginBottom: "12px" }}>⚠️ {templatesError}</div>
            ) : null}

            {templatesLoading ? (
              <div style={{ padding: "24px 0", color: "oklch(50% 0.01 264)", fontSize: "13px" }}>Loading templates…</div>
            ) : templates.length === 0 ? (
              <div style={{ padding: "24px 0", color: "oklch(50% 0.01 264)", fontSize: "13px" }}>
                This organization has no custom templates yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handlePickTemplate(t)}
                    disabled={!!creatingFromTemplateId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "9px",
                      border: "1px solid oklch(88% 0.008 60)",
                      background: creatingFromTemplateId === t.id ? "oklch(93% 0.012 60)" : "white",
                      color: "oklch(30% 0.01 264)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: creatingFromTemplateId ? "not-allowed" : "pointer",
                    }}
                  >
                    <span>{t.name}</span>
                    <span style={{ fontSize: "11px", color: "oklch(55% 0.01 264)", fontWeight: 500 }}>
                      {creatingFromTemplateId === t.id ? "Creating…" : `${t.pageCount} pg`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeTemplatePicker}
                style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: "oklch(94% 0.005 60)", color: "oklch(35% 0.01 264)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
