"use client";

export default function Navbar({ step = 1 }) {
  return (
    <nav className="navbar">
      {/* Logo */}
      <a className="navbar-logo" href="/" aria-label="LOI Builder home">
        <div className="navbar-logo-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <span className="navbar-wordmark">LOI<span>Builder</span></span>
      </a>

      {/* Step progress */}
      <div className="navbar-steps" aria-label="Progress steps">
        <span className={`navbar-step ${step >= 1 ? 'active' : ''}`}>Fill Form</span>
        <span className="navbar-step-sep">→</span>
        <span className={`navbar-step ${step >= 2 ? 'active' : ''}`}>Preview</span>
        <span className="navbar-step-sep">→</span>
        <span className={`navbar-step ${step >= 3 ? 'active' : ''}`}>Export</span>
      </div>

      {/* Badge */}
      <div className="navbar-badge" role="status" aria-live="polite">
        <span className="navbar-badge-dot" aria-hidden="true" />
        Free Document Generator
      </div>
    </nav>
  );
}
