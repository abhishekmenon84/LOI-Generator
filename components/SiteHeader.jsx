"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SiteHeader({ isLoggedIn = false }) {
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
    <nav className="site-header">
      <Link className="navbar-logo" href="/" aria-label="LOI Builder home">
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
      </Link>

      <div className="site-header-links">
        {isLoggedIn && <Link href="/dashboard">Dashboard</Link>}
        <Link href="/about">About</Link>
        <Link href="/v1">What&apos;s in v1</Link>
        <Link href="/support">Support</Link>
      </div>

      <div className="site-header-actions">
        <select
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value)}
          style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", cursor: "pointer", outline: "none" }}
        >
          <option value="light">Light Mode</option>
          <option value="dark">Dark Mode</option>
          <option value="dusk">Dusk Mode</option>
        </select>
        <Link className="site-header-cta" href={isLoggedIn ? "/dashboard" : "/login"}>
          {isLoggedIn ? "Dashboard" : "Sign In"}
        </Link>
      </div>
    </nav>
  );
}
