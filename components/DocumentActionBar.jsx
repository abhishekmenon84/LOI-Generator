"use client";

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

// Shared "Share / Send for Signature / Audit Trail" action row for the three
// document builder pages. Renders inline in the form-panel header instead of
// as separately-positioned fixed buttons, which is what previously caused
// them to overlap each other and the preview panel at narrower widths.
export default function DocumentActionBar({ readOnly, onShare, onSendForSignature, onAudit }) {
  return (
    <div className="document-action-bar" role="group" aria-label="Document actions">
      {!readOnly && (
        <button type="button" className="btn-doc-action" onClick={onShare} title="Share this deal">
          <ShareIcon />
          Share
        </button>
      )}
      {!readOnly && (
        <button type="button" className="btn-doc-action" onClick={onSendForSignature} title="Send for signature">
          <SignatureIcon />
          Send for Signature
        </button>
      )}
      <button type="button" className="btn-doc-action" onClick={onAudit} title="View signature audit trail">
        <AuditIcon />
        Audit Trail
      </button>
    </div>
  );
}
