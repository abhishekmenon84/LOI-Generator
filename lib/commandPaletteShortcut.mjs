// Matches the Cmd+K (Mac) / Ctrl+K (other platforms) global shortcut for
// opening the command palette. Pulled out as a pure function so the
// matching logic is testable without a DOM/keydown event.
export function isOpenShortcut(event) {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}
