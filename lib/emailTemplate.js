// Shared branded HTML wrapper for every transactional email this app
// sends -- matches the existing Ledgerlot look (dark rounded logomark,
// black pill-shaped CTA button, light-gray card on an off-white
// background, muted gray secondary text, a divider before a closing note,
// and a small centered footer) so signature-flow emails (send, reminder,
// decline, completion) look like the same product as the magic-link
// sign-in email instead of plain unstyled text.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Ledgerlot's own mark (dark rounded square + white document glyph),
// baked to a PNG data URI at 2x (72px) resolution. Inline <svg> is NOT
// reliably rendered by email clients (Gmail in particular drops it
// outright, leaving just the surrounding dark square with no glyph) --
// a raster data URI has none of that risk, since it's a plain <img src>,
// not a markup element clients may choose not to support. Regenerate with
// gen-email-logo-tmp.mjs (kept out of the repo -- delete after use) if
// this mark ever changes; it must stay pixel-matched to the SVG icon in
// components/SiteHeader.jsx.
const LOGO_PNG_BASE64 =
  "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";

// `body` is raw HTML (already trusted/escaped by the caller for any
// interpolated values) rendered inside the card, below the title.
// `ctaLabel`/`ctaUrl` render the black pill button; both optional.
// `footerNote` is the muted note below the divider (e.g. "Didn't request
// this? ..."); optional. `brandName`/`brandLogoUrl` white-label the
// header for a Business org with a logo set (Organization.logoUrl,
// already settable via Keeper's OrgLogoSettings) -- falls back to
// Ledgerlot's own mark when unset, since most emails (personal-org
// signers, magic-link sign-in) have no org-branding context at all. This
// does NOT change the sending domain/address (still Ledgerlot's own) --
// that requires real per-customer DNS verification, out of scope here.
export function renderEmail({ title, body, ctaLabel, ctaUrl, footerNote, brandName, brandLogoUrl }) {
  const name = brandName || "Ledgerlot";
  const logoBlock = brandLogoUrl
    ? `<img src="${brandLogoUrl}" alt="${name}" style="width: 36px; height: 36px; border-radius: 9px; object-fit: cover;" />`
    : `<img src="data:image/png;base64,${LOGO_PNG_BASE64}" width="36" height="36" alt="${name}" style="width: 36px; height: 36px; border-radius: 9px; display: block;" />`;

  return `
<div style="background:#f7f7f5; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; border: 1px solid #ececec;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 28px;">
      ${logoBlock}
      <span style="font-size: 18px; font-weight: 800; color: #16161a;">${name}</span>
    </div>

    <h1 style="font-size: 22px; font-weight: 800; color: #16161a; margin: 0 0 12px;">${title}</h1>
    <div style="font-size: 15px; line-height: 1.55; color: #56565c; margin-bottom: 24px;">
      ${body}
    </div>

    ${ctaLabel && ctaUrl
      ? `<a href="${ctaUrl}" style="display: inline-block; background: #16161a; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 26px; border-radius: 10px; text-decoration: none;">${ctaLabel} &rarr;</a>`
      : ""}

    ${footerNote
      ? `<div style="border-top: 1px solid #ececec; margin-top: 32px; padding-top: 20px; font-size: 13px; color: #8a8a90;">${footerNote}</div>`
      : ""}
  </div>
  <div style="text-align: center; margin-top: 24px; font-size: 12.5px; color: #9a9aa0;">
    ${brandName ? `${name} · powered by Ledgerlot` : "Ledgerlot, Inc."}
  </div>
</div>`;
}

export { escapeHtml };
