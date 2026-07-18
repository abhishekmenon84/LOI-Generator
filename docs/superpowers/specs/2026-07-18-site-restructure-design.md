# Site Restructure: Marketing Pages + Builder Cleanup — Design

## Context

The LOI Builder app currently lives entirely at `/` as a single-page tool (form + live preview + export). The navbar has a confusing "Fill Form → Preview → Export" step indicator that doesn't reflect how the tool actually works (there's no real multi-step wizard — everything happens on one screen). The preview panel also has a distracting bordered footer CTA ("Preview is live — export your final document using the buttons at the top") that's redundant with the toolbar above it.

The user wants to:
1. Remove the confusing/redundant UI chrome (step indicator, preview footer CTA)
2. Turn the site into a proper multi-page product site: Home, About, What's in v1, What's coming in v2, Donate, Support — with the actual builder tool moved off the root path

## Goals

- Clean up two pieces of confusing UI in the existing builder.
- Restructure the app so `/` is a marketing landing page, and the builder tool lives at `/app`.
- Add informational/marketing pages: About, What's in v1, What's coming in v2, Donate, Support, Legal/Disclaimer, Changelog.
- Surface the non-binding/not-legal-advice disclaimer sitewide via a footer, with full text on a dedicated Legal page.

## Non-goals

- No backend/payment integration for Donate (placeholder link only).
- No real contact form backend for Support (mailto link + FAQ only).
- No Blog/Guides content section (deferred).
- No changes to the export functionality (Word/PDF/GDoc) or LOI form logic itself.

## Page Map

| Route | Purpose |
|---|---|
| `/` | Home — marketing landing page, hero + CTA into `/app` |
| `/app` | Builder — existing form + live preview + export tool (moved from `/`) |
| `/about` | About — what LOI Builder is, who built it |
| `/v1` | What's in v1 — current feature set |
| `/v2` | What's coming in v2 — roadmap teaser |
| `/donate` | Donate — short pitch + placeholder donate button |
| `/support` | Support — FAQ + mailto contact link |
| `/legal` | Terms & Disclaimer — full non-binding/not-legal-advice text |
| `/changelog` | Changelog — running log of shipped changes, starting with v1.0.0 |

## Fix 1: Remove the red-highlighted preview footer panel

Delete the "Preview Footer CTA" block in `components/LOIPreview.jsx` (the `<div className="preview-footer-cta">...</div>` at the end of the component) and its corresponding `.preview-footer-cta` CSS rule in `app/globals.css`. It's redundant with the "Live Preview" badge already shown in the toolbar at the top of the same panel.

## Fix 2: Remove the step indicator from the Navbar

Remove the `navbar-steps` block (`Fill Form → Preview → Export`) from `components/Navbar.jsx`, including the `step` prop plumbing from `app/page.js` (the `navStep` variable and `<Navbar step={navStep} />` usage collapse to a plain `<Navbar />`). Remove the now-unused `.navbar-steps`, `.navbar-step`, `.navbar-step.active`, `.navbar-step-sep` CSS rules (and the related mobile-hide rule) from `globals.css`.

## Site Structure

**Two layout contexts:**

1. **Marketing pages** (`/`, `/about`, `/v1`, `/v2`, `/donate`, `/support`, `/legal`, `/changelog`) share a new `SiteHeader` and `SiteFooter`.
   - `SiteHeader`: logo/wordmark (links to `/`), nav links (About, What's in v1, What's coming in v2, Donate, Support), theme switcher, and a prominent "Launch Builder" button linking to `/app`.
   - `SiteFooter`: short disclaimer line ("LOI Builder generates non-binding letters of intent and does not provide legal advice. See Terms & Disclaimer.") linking to `/legal`, plus copyright and Changelog/Support links.

2. **Builder page** (`/app`) keeps a minimal version of the current `Navbar` — logo/wordmark linking back to `/`, theme switcher, and the existing "Free Document Generator" badge — but without the step indicator and without the About modal (About becomes a real page at `/about`, so the navbar's About button becomes a link there instead of opening a modal).

Both header variants reuse the same visual language (existing CSS custom properties for colors/spacing) so the site feels consistent between marketing and app.

## Page Content

- **Home (`/`)**: Hero with headline "The fastest way to draft a combined business + real estate Letter of Intent," subhead emphasizing credibility for brokers/dealmakers, CTA button → `/app`, and a short feature strip (no signup, no subscription, export to Word/PDF/Google Doc).
- **About (`/about`)**: Repurposes the current About-modal copy (what LOI Builder is, "Created by Abhishek Menon") as a full page.
- **What's in v1 (`/v1`)**: Presents roadmap doc items 1–13 as readable cards/list (combo deals, live allocation math, pay-per-use, e-signature, email delivery, save/resume draft, pricing tiers, analytics, additional templates, jurisdiction-aware clauses, white-label, version history) — written in user-facing language, not raw roadmap bullet text.
- **What's coming in v2 (`/v2`)**: Presents roadmap doc items 14–17 (attorney review add-on, API access, AI-assisted clause suggestions, full deal-progression suite) as a "coming soon" teaser.
- **Donate (`/donate`)**: Short blurb on why donations help keep the tool free, with a donate button linking to a placeholder URL (to be swapped for a real Buy Me a Coffee/Stripe link later).
- **Support (`/support`)**: A short FAQ (3-5 common questions) plus a "Contact us" mailto link.
- **Legal (`/legal`)**: Full disclaimer text — non-binding LOI, not a substitute for legal advice, does not constitute legal services — expanding on the note already in Section 6 of the generated document.
- **Changelog (`/changelog`)**: Starts with a single v1.0.0 entry describing the initial release.

## Testing

Manual verification only (no test suite in this project): visit each new route, confirm nav/footer render and links resolve, confirm `/app` still generates/exports documents correctly after the Navbar/page.js changes, confirm the preview panel and navbar no longer show the removed elements.
