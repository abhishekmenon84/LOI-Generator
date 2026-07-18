# LOI Builder — Feature Roadmap & Market Analysis

### Version 1: 
1. **Combo real-estate + business-operations deals in one document**
2. **Live, itemized purchase-price allocation with calculated totals and dollars-in-words**
3. **True pay-per-use, no account, no subscription**
4. **E-signature integration** lightweight built-in signature-capture flow so both parties can sign the LOI immediately after it's generated.
5. **Email delivery** option to email the finished PDF directly to buyer and seller instead of just downloading, with the transaction handled server-side right after payment.
6. **Save/resume a draft** a shareable link (no login) that lets someone come back and finish the form later, since real estate/M&A deals often involve back-and-forth over days.
7. **Multiple pricing tiers** e.g. $1 for a single export, $5 for unlimited edits/re-exports of the same deal for 30 days (useful since terms get renegotiated), $15 for a bundle that includes a matching NDA or a follow-on Purchase & Sale Agreement template.
8. **Basic analytics dashboard** (even just a simple admin view) — track exports, revenue, and abandoned-checkout rate so you know if pricing/positioning is working.
9. **Additional LOI templates** — residential real estate purchase, commercial lease LOI, franchise acquisition, employment/job offer LOI, asset-only (no real estate) purchase — each as a separate guided flow reusing the same payment/export infrastructure.
10. **State/jurisdiction-aware clauses** flag or auto-include clauses relevant to specific US states or Canadian provinces (e.g. specific licensing or environmental disclosure language), which is a real gap in generic templates.
12. **White-label / broker version** real estate and business brokers generate many LOIs; a subscription tier that removes the per-document fee in exchange for a monthly fee, with the brokerage's own branding on the letterhead, is a natural B2B expansion.
13. **Version history / redline comparison** since LOIs go through negotiation rounds, letting a user regenerate with tracked changes against the prior version would be a strong differentiator versus static template sites.

### Version 2: 
14. **Optional attorney review add-on** partner with a flat-fee legal review service (similar to LegalZoom's model) as a premium upsell after the $1 document is generated.
15. **API access** — let other platforms (deal marketplaces, brokerage CRMs, accounting firms) generate LOIs programmatically for a per-call fee.
16. **AI-assisted clause suggestions** — given the deal type and a couple of inputs, suggest which risk-protection clauses (environmental, licensing, financing contingencies) are typically included for that industry.
17. **Full deal-progression suite** — extend from "LOI" into "LOI → Purchase Agreement → Closing Checklist," turning this into a lightweight deal-management tool rather than a single-document generator (this is essentially what acquire.com does, so it's a proven direction, but a much bigger build).

## Add Legal/compliance note

This tool generates non-binding letters of intent, not final legal contracts, and that's clearly stated in the document itself (Section 6). Worth keeping visible in the product UI too — a disclaimer that this isn't a substitute for legal advice and doesn't constitute legal services (important for a product that could otherwise be seen as unauthorized practice of law, a real regulatory concern in this space — it's part of why LegalZoom structures itself carefully around "self-help" document generation rather than legal advice).