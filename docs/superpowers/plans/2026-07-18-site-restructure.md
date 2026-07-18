# Site Restructure: Marketing Pages + Builder Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove two confusing UI elements from the LOI Builder tool, move the builder from `/` to `/app`, and add 8 marketing/info pages (Home, About, v1, v2, Donate, Support, Legal, Changelog) with shared header/footer.

**Architecture:** Next.js 14 App Router. New routes are plain folders under `loi-generator/app/`, each with a `page.js`. A new `components/SiteHeader.jsx` + `components/SiteFooter.jsx` pair is shared by all marketing pages via a nested layout at `loi-generator/app/(marketing)/layout.js` (route group — doesn't affect URLs). The builder at `/app` keeps the existing `Navbar` component, trimmed down, and is NOT part of the marketing route group (it has its own minimal chrome). No new dependencies, no test framework (project has none) — verification is manual via `npm run dev`.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18.3.1, plain CSS in `app/globals.css` (CSS custom properties for theming — dark/light/dusk).

## Global Constraints

- No new npm dependencies.
- Follow existing CSS custom-property theming system (`--bg-*`, `--text-*`, `--accent*`, `--border`, `--radius-*`, `--shadow-*` tokens defined in `app/globals.css:8-94`) — new components must work in all three themes (dark/light/dusk) without hardcoded colors.
- Follow existing component conventions: `"use client"` directive only where interactivity (state/effects) is needed; plain server components otherwise.
- No backend/payment integration for Donate — placeholder `href="#"` link, clearly commented as a placeholder.
- No backend contact form for Support — `mailto:` link only.
- Legal disclaimer text must appear in the `SiteFooter` on every marketing page and in full on `/legal`.
- This is not a git repository — skip all `git add`/`git commit` steps; instead each task ends with a manual verification step.

---

### Task 1: Remove the preview footer CTA panel (red-highlighted element)

**Files:**
- Modify: `loi-generator/components/LOIPreview.jsx:153-157`
- Modify: `loi-generator/app/globals.css:815-830`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new (pure removal)

- [ ] **Step 1: Remove the footer CTA JSX block**

In `loi-generator/components/LOIPreview.jsx`, delete lines 153-157:

```jsx
      {/* ── Footer CTA ───────────────────────────────────── */}
      <div className="preview-footer-cta" role="complementary">
        <span aria-hidden="true">✨</span>
        Preview is live — export your final document using the buttons at the top
      </div>
```

The component's closing structure becomes:

```jsx
        </div>
      </div>
    </div>
  );
}
```

(i.e. the `document-paper` div and `preview-panel` div close immediately after the document content, with no footer element between them.)

- [ ] **Step 2: Remove the associated CSS rule**

In `loi-generator/app/globals.css`, delete the `/* ── Preview Footer CTA ── */` comment and `.preview-footer-cta` rule at lines 815-830:

```css
/* ── Preview Footer CTA ──────────────────────────────────── */
.preview-footer-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
  padding: 12px 16px;
  background: var(--accent-subtle);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  color: var(--accent-light);
  font-weight: 500;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify manually**

Run: `cd loi-generator && npm run dev`

Visit `http://localhost:3000` (still root at this point, since Task 4 hasn't moved it yet). Confirm the bordered "Preview is live — export your final document..." panel below the document preview is gone, and the preview panel now ends cleanly after the signature table.

---

### Task 2: Remove the step indicator from the Navbar

**Files:**
- Modify: `loi-generator/components/Navbar.jsx`
- Modify: `loi-generator/app/globals.css:156-179` and `:865`
- Modify: `loi-generator/app/page.js`

**Interfaces:**
- Consumes: nothing new
- Produces: `Navbar` component with no `step` prop (signature becomes `export default function Navbar()`)

- [ ] **Step 1: Remove the `step` prop and step-progress JSX from Navbar**

In `loi-generator/components/Navbar.jsx`, change line 5 from:

```jsx
export default function Navbar({ step = 1 }) {
```

to:

```jsx
export default function Navbar() {
```

Delete lines 41-48 (the entire "Step progress" block):

```jsx
        {/* Step progress */}
        <div className="navbar-steps" aria-label="Progress steps">
          <span className={`navbar-step ${step >= 1 ? 'active' : ''}`}>Fill Form</span>
          <span className="navbar-step-sep">→</span>
          <span className={`navbar-step ${step >= 2 ? 'active' : ''}`}>Preview</span>
          <span className="navbar-step-sep">→</span>
          <span className={`navbar-step ${step >= 3 ? 'active' : ''}`}>Export</span>
        </div>
```

- [ ] **Step 2: Remove the now-unused CSS rules**

In `loi-generator/app/globals.css`, delete lines 156-179 (`.navbar-steps`, `.navbar-step`, `.navbar-step.active`, `.navbar-step-sep` rules):

```css
.navbar-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-muted);
}

.navbar-step {
  padding: 4px 10px;
  border-radius: 999px;
  transition: all var(--dur) var(--ease);
}

.navbar-step.active {
  background: var(--accent-subtle);
  color: var(--accent-light);
}

.navbar-step-sep {
  color: var(--text-muted);
  opacity: 0.4;
}
```

Then find the mobile-hide rule (originally at line 865, `.navbar-steps { display: none; }` inside a media query) and delete that line too — search for `.navbar-steps` to confirm no references remain:

Run: `grep -n "navbar-steps\|navbar-step " loi-generator/app/globals.css`
Expected: no output (empty)

- [ ] **Step 3: Remove `step`/`navStep` plumbing from the builder page**

This will be superseded by Task 4 (which moves this file to `app/app/page.js` and removes the About-modal Navbar usage entirely in favor of the trimmed Navbar). Skip editing `app/page.js` here — Task 4 handles it in place as part of the move.

- [ ] **Step 4: Verify manually**

Run: `cd loi-generator && npm run dev`

Visit `http://localhost:3000`. Confirm the navbar no longer shows "Fill Form → Preview → Export" between the logo and the About button.

---

### Task 3: Build shared SiteHeader and SiteFooter components

**Files:**
- Create: `loi-generator/components/SiteHeader.jsx`
- Create: `loi-generator/components/SiteFooter.jsx`
- Modify: `loi-generator/app/globals.css` (append new rules at end of file)

**Interfaces:**
- Consumes: existing CSS tokens (`--bg-surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-light`, `--accent-subtle`, `--border`, `--radius-md`, `--dur`, `--ease`)
- Produces: `<SiteHeader />` (client component, has theme switcher state), `<SiteFooter />` (server component, static). Both take no props.

- [ ] **Step 1: Create `SiteHeader.jsx`**

```jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SiteHeader() {
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
        <Link href="/about">About</Link>
        <Link href="/v1">What&apos;s in v1</Link>
        <Link href="/v2">What&apos;s coming in v2</Link>
        <Link href="/donate">Donate</Link>
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
        <Link className="site-header-cta" href="/app">Launch Builder</Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create `SiteFooter.jsx`**

```jsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-disclaimer">
        LOI Builder generates non-binding letters of intent and does not provide legal advice.{" "}
        <Link href="/legal">See Terms &amp; Disclaimer</Link>.
      </p>
      <div className="site-footer-links">
        <Link href="/changelog">Changelog</Link>
        <span aria-hidden="true">·</span>
        <Link href="/support">Support</Link>
        <span aria-hidden="true">·</span>
        <Link href="/legal">Legal</Link>
      </div>
      <p className="site-footer-copyright">© {new Date().getFullYear()} LOI Builder. Created by Abhishek Menon.</p>
    </footer>
  );
}
```

- [ ] **Step 3: Add CSS for the new components**

Append to the end of `loi-generator/app/globals.css`:

```css
/* ── Site Header (marketing pages) ─────────────────────────── */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 28px;
  height: 60px;
  background: rgba(7,8,15,0.85);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.site-header-links {
  display: flex;
  align-items: center;
  gap: 22px;
  font-size: 0.85rem;
  font-weight: 500;
}

.site-header-links a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--dur) var(--ease);
}

.site-header-links a:hover {
  color: var(--text-primary);
}

.site-header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.site-header-cta {
  padding: 8px 16px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  transition: background var(--dur) var(--ease);
}

.site-header-cta:hover {
  background: var(--accent-light);
}

@media (max-width: 860px) {
  .site-header-links { display: none; }
}

/* ── Site Footer (marketing pages) ─────────────────────────── */
.site-footer {
  padding: 32px 28px;
  border-top: 1px solid var(--border);
  text-align: center;
  color: var(--text-muted);
}

.site-footer-disclaimer {
  font-size: 0.8rem;
  color: var(--text-secondary);
  max-width: 640px;
  margin: 0 auto 14px;
  line-height: 1.6;
}

.site-footer-disclaimer a {
  color: var(--accent-light);
}

.site-footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 0.8rem;
  margin-bottom: 10px;
}

.site-footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
}

.site-footer-links a:hover {
  color: var(--text-primary);
}

.site-footer-copyright {
  font-size: 0.75rem;
}

/* ── Marketing page shared layout ──────────────────────────── */
.marketing-page {
  max-width: 780px;
  margin: 0 auto;
  padding: 64px 28px;
}

.marketing-page h1 {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.marketing-page h2 {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 32px 0 12px;
  color: var(--text-primary);
}

.marketing-page p {
  font-size: 1rem;
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.marketing-page ul {
  padding-left: 22px;
  margin-bottom: 16px;
}

.marketing-page li {
  font-size: 1rem;
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.marketing-cta-button {
  display: inline-block;
  padding: 14px 28px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
  box-shadow: var(--shadow-md);
  transition: background var(--dur) var(--ease), transform var(--dur) var(--ease);
}

.marketing-cta-button:hover {
  background: var(--accent-light);
  transform: translateY(-1px);
}

/* ── Home hero ──────────────────────────────────────────────── */
.home-hero {
  max-width: 780px;
  margin: 0 auto;
  padding: 96px 28px 64px;
  text-align: center;
}

.home-hero h1 {
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-bottom: 18px;
  color: var(--text-primary);
}

.home-hero p {
  font-size: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 32px;
}

.home-feature-strip {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 20px;
  font-size: 0.85rem;
  color: var(--text-muted);
}
```

- [ ] **Step 4: Verify manually**

These components aren't wired into any route yet, so there's nothing to load in-browser. Instead, sanity-check syntax:

Run: `cd loi-generator && node --experimental-vm-modules -e "require('@babel/core')" 2>/dev/null; npx next build --no-lint 2>&1 | tail -30 || true`

(This will report JSX/syntax errors from the two new files even though they aren't yet imported anywhere, since Next.js's build step type-checks all files under `app/` and `components/` — actually since they're unused they won't be checked. Skip this step's automated check; proceed to Task 4, whose manual verification will exercise these files directly.)

---

### Task 4: Move builder tool from `/` to `/app`, trim its Navbar usage

**Files:**
- Create: `loi-generator/app/app/page.js` (new builder route — content is the current `loi-generator/app/page.js` with Navbar usage simplified)
- Delete: `loi-generator/app/page.js` (superseded by Task 5's new Home page)

**Interfaces:**
- Consumes: `Navbar` (from Task 2, now prop-less), `LOIForm`, `LOIPreview`, `DEFAULT_FORM_DATA`, `buildLOIModel` (unchanged)
- Produces: builder tool live at `/app`

- [ ] **Step 1: Read the current builder page to copy forward**

Already read at conversation start — current `loi-generator/app/page.js` is 85 lines, `"use client"`, imports `Navbar`, `LOIForm`, `LOIPreview`, `DEFAULT_FORM_DATA`, `buildLOIModel`.

- [ ] **Step 2: Create `loi-generator/app/app/page.js`**

```jsx
"use client";

import { useMemo, useState } from "react";
import Navbar from "../../components/Navbar";
import LOIForm from "../../components/LOIForm";
import LOIPreview from "../../components/LOIPreview";
import { DEFAULT_FORM_DATA, buildLOIModel } from "../../lib/loiEngine";

const STORAGE_KEY = "loi_form_data_v1";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [data, setData] = useState(() => ({
    ...DEFAULT_FORM_DATA,
    currentDate: todayLabel(),
  }));
  const [exportState, setExportState] = useState({
    loading: false,
    format: null,
    error: null,
    success: null,
  });

  const model = useMemo(() => buildLOIModel(data), [data]);

  async function handleExport(format) {
    setExportState({ loading: true, format, error: null, success: null });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Export failed.");
      }
      const blob = await res.blob();
      const filename = format === "docx" ? "Letter_of_Intent.docx"
        : format === "pdf" ? "Letter_of_Intent.pdf"
        : "Letter_of_Intent.doc";
      downloadBlob(blob, filename);
      setExportState({
        loading: false,
        format: null,
        error: null,
        success: "Your document has been downloaded.",
      });
    } catch (err) {
      setExportState({ loading: false, format: null, error: err.message, success: null });
    }
  }

  return (
    <>
      <Navbar />
      <div className="dashboard-layout">
        <LOIForm
          data={data}
          onChange={setData}
          onExport={handleExport}
          exportState={exportState}
        />
        <LOIPreview model={model} />
      </div>
    </>
  );
}
```

Note: `navStep`/`step` prop is gone (Navbar no longer accepts it, per Task 2).

- [ ] **Step 3: Delete the old root `page.js`**

Run: `rm loi-generator/app/page.js`

(It will be replaced by the new Home page in Task 5. The API routes under `app/api/export/*` are untouched and continue to work since they're routed independently of `app/page.js`.)

- [ ] **Step 4: Verify manually**

Run: `cd loi-generator && npm run dev`

Visit `http://localhost:3000/app`. Confirm the builder tool loads (form on left, live preview on right), fill in a couple of fields and confirm the preview updates, and click one export button (e.g. PDF) to confirm a file downloads without error. Visit `http://localhost:3000/` — expect a 404 at this point (Home page isn't created until Task 5).

---

### Task 5: About page

**Files:**
- Create: `loi-generator/app/about/page.js`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/about` route

- [ ] **Step 1: Create the page**

```jsx
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "About — LOI Builder",
  description: "What LOI Builder is and who built it.",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>About LOI Builder</h1>
        <p>
          LOI Builder is a free, modern tool for generating non-binding Letters of Intent for
          combined business and real estate acquisitions. It handles the parts that are tedious
          to write by hand — itemized purchase-price allocation with calculated totals, dollars-in-words
          conversion, and consistent legal structure — so you can produce a polished, professional
          document in minutes instead of starting from a blank page.
        </p>
        <p>
          There&apos;s no account, no subscription, and no signup wall. Fill out the form, preview
          the document live, and export straight to Word, PDF, or Google Doc.
        </p>
        <p>
          <strong>Created by Abhishek Menon.</strong>
        </p>
        <a className="marketing-cta-button" href="/app">Start Building</a>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `cd loi-generator && npm run dev` (if not already running)

Visit `http://localhost:3000/about`. Confirm the header, page content, and footer render, the "Start Building" button links to `/app`, and nav links in the header are present (About/v1/v2/Donate/Support/Launch Builder).

---

### Task 6: What's in v1 page

**Files:**
- Create: `loi-generator/app/v1/page.js`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/v1` route

- [ ] **Step 1: Create the page**

Content is adapted from `loi-generator/26-07-16-loi-builder-roadmap-and-market-analysis.md` items 1-13, written in user-facing language.

```jsx
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "What's in v1 — LOI Builder",
  description: "The current feature set of LOI Builder.",
};

const FEATURES = [
  "Combine real estate and business-operations deals in a single document — no need to draft two separate letters for a mixed acquisition.",
  "Live, itemized purchase-price allocation with calculated totals and dollars-in-words, updated in real time as you fill out the form.",
  "True pay-per-use pricing — no account, no subscription required.",
  "Built-in e-signature flow so both parties can sign the LOI immediately after it's generated.",
  "Email delivery — send the finished document directly to buyer and seller instead of just downloading it.",
  "Save and resume a draft via a shareable link, no login required — useful since these deals often involve back-and-forth over several days.",
  "Multiple pricing tiers, from a single export up to a bundle that includes a matching NDA or Purchase & Sale Agreement template.",
  "Basic usage analytics to track exports and understand how the tool is being used.",
  "Additional guided templates beyond the combo business+real estate flow — residential real estate, commercial lease, franchise acquisition, employment offer, and asset-only purchase.",
  "State and jurisdiction-aware clauses that flag or auto-include language relevant to specific US states or Canadian provinces.",
  "A white-label version for real estate and business brokers who generate many LOIs, with brokerage branding on the letterhead.",
  "Version history and redline comparison, so regenerating a document after a negotiation round shows what changed against the prior version.",
];

export default function V1Page() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>What&apos;s in v1</h1>
        <p>
          The current version of LOI Builder focuses on getting a professional, combined
          business-and-real-estate Letter of Intent into your hands as fast as possible.
        </p>
        <ul>
          {FEATURES.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <a className="marketing-cta-button" href="/app">Try It Now</a>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `http://localhost:3000/v1`. Confirm the 12-item feature list renders and the page matches the site's visual style (header/footer present, correct fonts/colors in all three themes via the theme switcher).

---

### Task 7: What's coming in v2 page

**Files:**
- Create: `loi-generator/app/v2/page.js`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/v2` route

- [ ] **Step 1: Create the page**

Content adapted from roadmap doc items 14-17.

```jsx
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "What's coming in v2 — LOI Builder",
  description: "The roadmap for the next version of LOI Builder.",
};

const UPCOMING = [
  {
    title: "Optional attorney review add-on",
    body: "A flat-fee legal review service as a premium upsell after your document is generated — similar in spirit to LegalZoom's model.",
  },
  {
    title: "API access",
    body: "Let other platforms — deal marketplaces, brokerage CRMs, accounting firms — generate LOIs programmatically for a per-call fee.",
  },
  {
    title: "AI-assisted clause suggestions",
    body: "Given the deal type and a few inputs, get suggestions for the risk-protection clauses (environmental, licensing, financing contingencies) typically included for that industry.",
  },
  {
    title: "Full deal-progression suite",
    body: "Extend from a single LOI into \"LOI → Purchase Agreement → Closing Checklist,\" turning the tool into a lightweight deal-management suite rather than a single-document generator.",
  },
];

export default function V2Page() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>What&apos;s coming in v2</h1>
        <p>
          Here&apos;s what&apos;s on the roadmap after v1. None of this is live yet — this page
          exists so you know what to expect next.
        </p>
        {UPCOMING.map((item, i) => (
          <div key={i}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </div>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `http://localhost:3000/v2`. Confirm all four roadmap items render with headings and body text.

---

### Task 8: Donate page

**Files:**
- Create: `loi-generator/app/donate/page.js`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/donate` route

- [ ] **Step 1: Create the page**

```jsx
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Donate — LOI Builder",
  description: "Support LOI Builder and help keep it free.",
};

export default function DonatePage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Support LOI Builder</h1>
        <p>
          LOI Builder is free to use, with no account and no subscription required. If it saved
          you time on a deal, consider chipping in to help cover hosting costs and fund new
          features like e-signature and additional document templates.
        </p>
        {/* Placeholder link — replace with a real payment provider URL (e.g. Buy Me a Coffee, Stripe) */}
        <a className="marketing-cta-button" href="#" rel="noopener noreferrer">
          Donate
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `http://localhost:3000/donate`. Confirm the page renders with the donate button present (link target is a placeholder `#`, expected at this stage).

---

### Task 9: Support page

**Files:**
- Create: `loi-generator/app/support/page.js`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/support` route

- [ ] **Step 1: Create the page**

```jsx
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Support — LOI Builder",
  description: "Frequently asked questions and how to get help with LOI Builder.",
};

const FAQS = [
  {
    q: "Is LOI Builder really free?",
    a: "Yes — there's no account and no subscription. Fill out the form and preview the document live for free.",
  },
  {
    q: "Is the document generated by LOI Builder legally binding?",
    a: "No. It's a non-binding Letter of Intent intended to outline preliminary terms. See our Legal & Disclaimer page for details.",
  },
  {
    q: "What export formats are supported?",
    a: "Word (.docx), PDF, and Google Doc.",
  },
  {
    q: "Does LOI Builder save my draft?",
    a: "Not yet — save/resume a draft via a shareable link is planned. See What's in v1 for the current feature set.",
  },
  {
    q: "I found a bug or have a question — how do I reach you?",
    a: "Email us at the address below and we'll get back to you.",
  },
];

export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Support</h1>
        {FAQS.map((item, i) => (
          <div key={i}>
            <h2>{item.q}</h2>
            <p>{item.a}</p>
          </div>
        ))}
        <p>
          <a href="mailto:support@loibuilder.app">Contact us at support@loibuilder.app</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `http://localhost:3000/support`. Confirm all 5 FAQ items render and the mailto link is present (clicking it should open the system mail client).

---

### Task 10: Legal & Disclaimer page

**Files:**
- Create: `loi-generator/app/legal/page.js`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/legal` route

- [ ] **Step 1: Create the page**

Content expands on the note in `26-07-16-loi-builder-roadmap-and-market-analysis.md` under "Add Legal/compliance note".

```jsx
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Legal & Disclaimer — LOI Builder",
  description: "Terms and legal disclaimer for LOI Builder.",
};

export default function LegalPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Legal &amp; Disclaimer</h1>
        <h2>Non-binding document</h2>
        <p>
          Every Letter of Intent generated by LOI Builder is explicitly non-binding. It outlines
          preliminary terms and conditions for a proposed transaction only. Except for any
          confidentiality provisions stated within the document itself, it does not create
          enforceable obligations for either party. Legally binding commitments arise only from a
          finalized, formal Purchase and Sale Agreement executed separately by both parties.
        </p>
        <h2>Not legal advice</h2>
        <p>
          LOI Builder is a self-help document generation tool. It does not provide legal advice
          and does not constitute the practice of law. The documents it produces are templates
          based on the information you provide, and are not a substitute for review by a
          licensed attorney in your jurisdiction. If your transaction involves significant value,
          complex terms, or jurisdiction-specific requirements, you should have the resulting
          document reviewed by qualified legal counsel before relying on it.
        </p>
        <h2>No attorney-client relationship</h2>
        <p>
          Using LOI Builder does not create an attorney-client relationship between you and LOI
          Builder or its creator. No communication through this site should be treated as legal
          counsel.
        </p>
        <h2>Your data</h2>
        <p>
          Form data you enter is used only to generate your document and is not sold to third
          parties.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `http://localhost:3000/legal`. Confirm all four sections render, and confirm the "See Terms & Disclaimer" link in the `SiteFooter` (visible on every marketing page) correctly navigates here.

---

### Task 11: Changelog page

**Files:**
- Create: `loi-generator/app/changelog/page.js`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/changelog` route

- [ ] **Step 1: Create the page**

```jsx
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Changelog — LOI Builder",
  description: "A running log of what's shipped in LOI Builder.",
};

const ENTRIES = [
  {
    version: "1.0.0",
    date: "2026-07-18",
    notes: [
      "Initial release: combined business + real estate Letter of Intent generator.",
      "Live document preview with itemized purchase-price allocation and dollars-in-words.",
      "Export to Word, PDF, and Google Doc.",
      "Dark, light, and dusk themes.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Changelog</h1>
        {ENTRIES.map((entry) => (
          <div key={entry.version}>
            <h2>v{entry.version} — {entry.date}</h2>
            <ul>
              {entry.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `http://localhost:3000/changelog`. Confirm the v1.0.0 entry renders with its 4 bullet notes.

---

### Task 12: Home landing page

**Files:**
- Create: `loi-generator/app/page.js` (new Home page at root — this path was freed up by Task 4's deletion)

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (Task 3)
- Produces: `/` route

- [ ] **Step 1: Create the page**

```jsx
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <div className="home-hero">
          <h1>The fastest way to draft a combined business + real estate Letter of Intent.</h1>
          <p>
            Trusted structure for brokers, buyers, and sellers. Build a professional,
            non-binding LOI in minutes — itemized price allocation, dollars-in-words, and
            export-ready formatting handled for you.
          </p>
          <a className="marketing-cta-button" href="/app">Start Building →</a>
          <div className="home-feature-strip">
            <span>No signup</span>
            <span>·</span>
            <span>No subscription</span>
            <span>·</span>
            <span>Export to Word, PDF, or Google Doc</span>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `cd loi-generator && npm run dev`

Visit `http://localhost:3000/`. Confirm the hero renders, "Start Building →" links to `/app`, and the header nav links (About, What's in v1, What's coming in v2, Donate, Support, Launch Builder) are all present and navigate correctly. Click through every nav link and the footer's Changelog/Support/Legal links to confirm no 404s. Toggle the theme switcher in the header and confirm colors update correctly across dark/light/dusk on the Home page.

---

### Task 13: Update root layout metadata for the new site structure

**Files:**
- Modify: `loi-generator/app/layout.js:3-13`

**Interfaces:**
- Consumes: nothing new
- Produces: updated `metadata` export (title/description now describe the site generally rather than assuming the builder is at `/`)

- [ ] **Step 1: Update the metadata block**

In `loi-generator/app/layout.js`, replace lines 3-13:

```js
export const metadata = {
  title: "LOI Builder — Letter of Intent Generator for Business & Real Estate Deals",
  description:
    "Build a professional Letter of Intent for a business and real estate acquisition. Preview free, export a polished Word or PDF document.",
  keywords: "letter of intent, LOI generator, business acquisition, real estate LOI, purchase agreement",
  openGraph: {
    title: "LOI Builder — Professional Letter of Intent Generator",
    description: "Preview free. Export a polished Word, PDF, or Google Doc.",
    type: "website",
  },
};
```

with:

```js
export const metadata = {
  title: "LOI Builder — Letter of Intent Generator for Business & Real Estate Deals",
  description:
    "The fastest way to draft a combined business and real estate Letter of Intent. Free, no signup — export a polished Word, PDF, or Google Doc.",
  keywords: "letter of intent, LOI generator, business acquisition, real estate LOI, purchase agreement",
  openGraph: {
    title: "LOI Builder — Professional Letter of Intent Generator",
    description: "The fastest way to draft a combined business and real estate Letter of Intent. Free, no signup.",
    type: "website",
  },
};
```

(Per-page `metadata` exports added in Tasks 5-11 override this default title/description on their respective routes; this default now applies to `/` and `/app`, both reasonable given the new copy.)

- [ ] **Step 2: Verify manually**

Run: `cd loi-generator && npm run dev`

Visit `http://localhost:3000/` and check the browser tab title matches "LOI Builder — Letter of Intent Generator for Business & Real Estate Deals". View page source (or browser devtools) and confirm the `<meta name="description">` tag contains the updated copy.

---

### Task 14: Full end-to-end verification pass

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Run a production build to catch any errors the dev server tolerates**

Run: `cd loi-generator && npm run build`

Expected: build completes successfully, listing all routes (`/`, `/app`, `/about`, `/v1`, `/v2`, `/donate`, `/support`, `/legal`, `/changelog`, plus the existing `/api/export/*` routes) with no errors.

- [ ] **Step 2: Start the production server and click through every route**

Run: `cd loi-generator && npm run start`

Visit and confirm each of: `/`, `/app`, `/about`, `/v1`, `/v2`, `/donate`, `/support`, `/legal`, `/changelog`. For each marketing page, confirm `SiteHeader` and `SiteFooter` render correctly. For `/app`, confirm the builder tool works end-to-end: fill out the form, see the live preview update, and successfully export at least one format (PDF, DOCX, or GDoc).

- [ ] **Step 3: Confirm the two original UI fixes are in place**

On `/app`: confirm no "Fill Form → Preview → Export" step indicator appears in the navbar, and confirm no bordered "Preview is live..." panel appears below the document preview.

- [ ] **Step 4: Cross-theme check**

On any marketing page, use the theme switcher in `SiteHeader` to cycle through Light, Dark, and Dusk modes. Confirm text remains readable (no white-on-white or dark-on-dark) in all three, on both marketing pages and `/app`.
