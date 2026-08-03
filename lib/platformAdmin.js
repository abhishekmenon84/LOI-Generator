// Platform-level admin (distinct from Organization/Membership.role admin,
// which is scoped to one org and would let an org admin approve their own
// business verification submission -- not appropriate here). No such
// concept existed anywhere in this app before; the simplest correct gate
// for a single new admin-only surface (the verification queue) is an
// env-var allowlist rather than inventing a whole new role/permission
// system for one feature.
export function isPlatformAdmin(email) {
  if (!email) return false;
  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
