// Resend's SDK does NOT reject/throw on a send failure (invalid recipient,
// unverified domain, rate limit, etc) -- it resolves normally with
// { data: null, error: {...} }. Every call site in this codebase that did
// `await resend.emails.send(...)` directly (or wrapped only in a bare
// try/catch) was therefore blind to real failures: the most common one in
// practice is Resend's sandbox sender (onboarding@resend.dev) being
// restricted to only the account owner's own verified email until a real
// domain is verified -- every other recipient gets a 403 that silently
// vanished, while the surrounding code (and the end user) saw "sent
// successfully." This wrapper makes that failure visible instead of
// swallowing it, without changing this app's existing "email failure must
// never break the action that already completed" policy -- callers decide
// what to do with a non-ok result (log it, surface it, record it on a row),
// this function only makes the result honest.

// Single source of truth for the sender address -- every call site used to
// hardcode "Ledgerlot <onboarding@resend.dev>" individually (16 copies),
// which is also *why* the 403 above happened: Resend's sandbox sender only
// ever delivers to the account owner's own address. Once RESEND_FROM_EMAIL
// is set to a verified domain's address (see docs/superpowers/specs for the
// verification steps), every call site picks it up automatically -- no
// per-file changes needed. Falls back to the sandbox sender so local/dev
// setups with no domain configured yet don't crash, they just keep hitting
// the same restriction this comment describes.
export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || "Ledgerlot <onboarding@resend.dev>";

// Optional: routes recipient replies to a real monitored inbox instead of
// the (typically no-reply) sending address above. Unset by default -- only
// applied when the caller hasn't already specified its own replyTo.
const EMAIL_REPLY_TO = process.env.RESEND_REPLY_TO || undefined;

export async function sendEmail(resend, payload) {
  const finalPayload = EMAIL_REPLY_TO ? { replyTo: EMAIL_REPLY_TO, ...payload } : payload;
  try {
    const result = await resend.emails.send(finalPayload);
    if (result?.error) {
      console.error(`[sendEmail] Resend rejected send to ${payload.to}:`, result.error);
      return { ok: false, error: result.error.message || String(result.error) };
    }
    return { ok: true, error: null };
  } catch (err) {
    console.error(`[sendEmail] Resend send threw for ${payload.to}:`, err);
    return { ok: false, error: err?.message || String(err) };
  }
}
