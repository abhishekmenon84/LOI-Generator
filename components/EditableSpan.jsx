"use client";

import { useLayoutEffect, useRef } from "react";

// contentEditable wrapper for the preview canvas. Every field this is used
// for (see LOIPreview.jsx etc.) maps to a single-line <input type="text">
// in the corresponding form -- there is no multi-line field anywhere in
// this app's forms today -- so Enter always commits/blurs rather than
// inserting a line break, matching that convention exactly.
//
// Does NOT re-render its own text content on every keystroke (a plain
// controlled `children={value}` would reset the cursor to the start on
// each render) -- the DOM text node is only touched when `value` changes
// from OUTSIDE (e.g. the form editing the same field) and the element
// doesn't currently have focus, so typing in the canvas itself never
// fights its own re-render. useLayoutEffect (not useEffect) so the initial
// text is written before paint -- no flash of an empty span on mount.
export default function EditableSpan({ value, onCommit, className, placeholder }) {
  const ref = useRef(null);
  const lastCommitted = useRef(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== (value || "")) {
      el.textContent = value || "";
    }
    lastCommitted.current = value;
  }, [value]);

  function handleBlur() {
    const next = ref.current?.textContent ?? "";
    if (next !== lastCommitted.current) {
      lastCommitted.current = next;
      onCommit(next);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`editable-field${className ? ` ${className}` : ""}`}
      data-placeholder={placeholder}
    />
  );
}
