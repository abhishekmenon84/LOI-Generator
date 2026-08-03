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

const LOGO_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="2" stroke="white" stroke-width="1.8"/><line x1="7.5" y1="9" x2="16.5" y2="9" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="7.5" y1="12.5" x2="16.5" y2="12.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="7.5" y1="16" x2="13" y2="16" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>`;

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
    : `<div style="width: 36px; height: 36px; background: #16161a; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center;">${LOGO_SVG}</div>`;

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
