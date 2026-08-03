import { prisma } from "./prisma";

// Resolves the {brandName, brandLogoUrl} pair renderEmail() accepts for
// white-labeling, given an orgId. Returns brandName: null for a personal
// org (no white-labeling context makes sense for an individual's own
// account) so renderEmail() falls back to Ledgerlot's own branding.
export async function getEmailBranding(orgId) {
  if (!orgId) return { brandName: null, brandLogoUrl: null };
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, logoUrl: true, isPersonal: true } });
  if (!org || org.isPersonal) return { brandName: null, brandLogoUrl: null };
  return { brandName: org.name, brandLogoUrl: org.logoUrl || null };
}
