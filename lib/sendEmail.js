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
export async function sendEmail(resend, payload) {
  try {
    const result = await resend.emails.send(payload);
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
