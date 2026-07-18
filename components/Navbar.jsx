"use client";

import { useState, useEffect } from "react";

export default function Navbar() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("app-theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <>
      <nav className="navbar">
        {/* Logo and Version */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          <span style={{ fontSize: "0.65rem", padding: "2px 6px", background: "var(--accent-subtle)", color: "var(--accent)", borderRadius: "4px", fontWeight: "bold" }}>v1.0.0</span>
        </div>

        {/* Badge & Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button 
            onClick={() => setIsAboutOpen(true)}
            style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "0.8rem", cursor: "pointer", fontWeight: "500" }}
          >
            About
          </button>
          
          <select 
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value)}
            style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", cursor: "pointer", outline: "none" }}
          >
            <option value="light">Light Mode</option>
            <option value="dark">Dark Mode</option>
            <option value="dusk">Dusk Mode</option>
          </select>

          <div className="navbar-badge" role="status" aria-live="polite">
            <span className="navbar-badge-dot" aria-hidden="true" />
            Free Document Generator
          </div>
        </div>
      </nav>

      {/* About Modal */}
      {isAboutOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "var(--bg-surface)", padding: "30px", borderRadius: "12px", 
            maxWidth: "400px", border: "1px solid var(--border)", boxShadow: "var(--shadow-xl)"
          }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--text-primary)" }}>About LOI Builder</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              The LOI Builder is a free, modern tool for generating non-binding Letters of Intent for business and real estate acquisitions.<br /><br />
              <strong>Created by Abhishek Menon</strong>
            </p>
            <button 
              onClick={() => setIsAboutOpen(false)}
              style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
