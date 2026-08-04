// Single source of truth for password rules, shared by the server-side
// set-password API route and the client-side strength meter, so the two
// can never silently drift out of sync.
const MIN_LENGTH = 8;

// "Alphanumeric" per the product requirement means at least one letter AND
// at least one digit -- not "only letters and digits" (that would forbid
// symbols, which only makes a password weaker to require).
export function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_LENGTH} characters.` };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "Password must include at least one letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must include at least one number." };
  }
  return { valid: true, error: null };
}

// A simple, deterministic 0-4 strength score (no external entropy library)
// -- rewards length and character-class variety, not just "has a symbol."
// Mirrors the common zxcvbn-style bucket labels without the dependency.
export function scorePasswordStrength(password) {
  if (!password) return { score: 0, label: "Too short" };

  let score = 0;
  if (password.length >= MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  const capped = Math.min(score, 4);
  const labels = ["Too short", "Weak", "Fair", "Strong", "Very strong"];
  return { score: capped, label: labels[capped] };
}

export const PASSWORD_MIN_LENGTH = MIN_LENGTH;
