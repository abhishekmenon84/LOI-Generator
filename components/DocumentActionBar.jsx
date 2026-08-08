"use client";

import ExportButton from "./ExportButton";

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function SignatureIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17s1.5-1 3-1 2.5 1.5 4 1.5S12 16 12 16s1.5 2 3.5 2 4-2.5 4-2.5" />
      <path d="M15 4l4 4L9 18l-4 1 1-4z" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
    </svg>
  );
}

// Shared "Reset / Share / Send for Signature / Audit Trail / Export"
// action row for the document builder pages. `onExport`/`exportState`/
// `onResetDraft` are optional -- omit them to get the original
// Share/Send/Audit-only bar (still used by pages that render export
// separately in their own form-panel header, e.g.
// app/ledgerboard/document/[ledgerId]/page.js); pass them to also render
// Reset/Export here instead (the folder workspace page does this,
// consolidating every document action into one row next to its
// Tasks/Comments/Activity buttons rather than splitting them between the
// top bar and the form panel).
export default function DocumentActionBar({ readOnly, onShare, onSendForSignature, onAudit, onExport, exportState, onResetDraft }) {
  return (
    <div className="document-action-bar" role="group" aria-label="Document actions">
      {!readOnly && onResetDraft && (
        <button type="button" className="btn-doc-action" onClick={onResetDraft} title="Reset this deal to a blank form">
          <ResetIcon />
          Reset
        </button>
      )}
      {!readOnly && onShare && (
        <button type="button" className="btn-doc-action" onClick={onShare} title="Share this deal">
          <ShareIcon />
          Share
        </button>
      )}
      {!readOnly && onSendForSignature && (
        <button type="button" className="btn-doc-action" onClick={onSendForSignature} title="Send for signature">
          <SignatureIcon />
          Send for Signature
        </button>
      )}
      <button type="button" className="btn-doc-action" onClick={onAudit} title="View signature audit trail">
        <AuditIcon />
        Audit Trail
      </button>
      {onExport && <ExportButton onExport={onExport} exportState={exportState} />}
    </div>
  );
}
