import test from "node:test";
import assert from "node:assert/strict";
import { isOpenShortcut } from "../lib/commandPaletteShortcut.mjs";

test("isOpenShortcut: matches Cmd+K on Mac (metaKey)", () => {
  assert.equal(isOpenShortcut({ key: "k", metaKey: true, ctrlKey: false }), true);
});

test("isOpenShortcut: matches Ctrl+K on other platforms", () => {
  assert.equal(isOpenShortcut({ key: "k", metaKey: false, ctrlKey: true }), true);
});

test("isOpenShortcut: case-insensitive on the key", () => {
  assert.equal(isOpenShortcut({ key: "K", metaKey: true, ctrlKey: false }), true);
});

test("isOpenShortcut: does not match K without a modifier", () => {
  assert.equal(isOpenShortcut({ key: "k", metaKey: false, ctrlKey: false }), false);
});

test("isOpenShortcut: does not match a different key with a modifier", () => {
  assert.equal(isOpenShortcut({ key: "j", metaKey: true, ctrlKey: false }), false);
});
