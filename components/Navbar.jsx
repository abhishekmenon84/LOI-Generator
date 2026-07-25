"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function Navbar() {
  const [theme, setTheme] = useState("dark");
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("app-theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  useEffect(() => {
    fetch("/api/orgs/mine/logo")
      .then((res) => (res.ok ? res.json() : { logoUrl: null }))
      .then((data) => setLogoUrl(data.logoUrl))
      .catch(() => {});
  }, []);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <nav className="navbar">
      {/* Logo and Version */}
      <div className="navbar-brand">
        <a className="navbar-logo" href="/" aria-label="LOI Builder home">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="navbar-logo-icon-img" aria-hidden="true" />
          ) : (
            <div className="navbar-logo-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
          )}
          <span className="navbar-wordmark">LOI<span>Builder</span></span>
        </a>
        <span className="navbar-version-badge">v1.0.0</span>
        <div className="navbar-badge navbar-badge-inline" role="status" aria-live="polite">
          <span className="navbar-badge-dot" aria-hidden="true" />
          Free Document Generator
        </div>
      </div>

      {/* Controls */}
      <div className="navbar-controls">
        <Link href="/dashboard" className="navbar-dashboard-link">
          Dashboard
        </Link>

        <select
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value)}
          className="navbar-theme-select"
          aria-label="Color theme"
        >
          <option value="light">Light Mode</option>
          <option value="dark">Dark Mode</option>
          <option value="dusk">Dusk Mode</option>
        </select>

        <SignOutButton />
      </div>
    </nav>
  );
}
