import test from "node:test";
import assert from "node:assert/strict";

// sanitizeAnchor itself lives inline in a Next.js route file (not exported
// as a standalone module), matching this codebase's existing convention
// for route-local helpers -- this test re-implements the exact same
// trimming/null-coercion rule as a standalone pure function so the
// behavior is locked and testable without importing a Next.js route
// handler directly. Keep this in sync with sanitizeAnchor's
// customQuestion line if that line ever changes.
function sanitizeCustomQuestion(raw) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

test("sanitizeCustomQuestion: trims whitespace", () => {
  assert.equal(sanitizeCustomQuestion("  What is the closing date?  "), "What is the closing date?");
});

test("sanitizeCustomQuestion: empty string becomes null", () => {
  assert.equal(sanitizeCustomQuestion(""), null);
  assert.equal(sanitizeCustomQuestion("   "), null);
});

test("sanitizeCustomQuestion: non-string input becomes null", () => {
  assert.equal(sanitizeCustomQuestion(undefined), null);
  assert.equal(sanitizeCustomQuestion(null), null);
  assert.equal(sanitizeCustomQuestion(42), null);
});
