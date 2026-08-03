// Locates each signature-line placeholder ("___________________________")
// in a rendered built-in document's PDF by scanning its actual text content
// via pdf.js -- the 3 built-in documents (LOI, commercial lease,
// residential lease) are laid out with @react-pdf/renderer, a flowing
// layout where a signature line's Y-position depends on how much content
// came before it, so there's no fixed coordinate to hardcode per document
// type the way TemplateAnchor/FormField have for uploaded PDFs. This is
// the alternative: render first, then find out where things actually
// landed, then burn signatures there.
//
// Server-side only (Node), matching lib/pdfNormalize.js's identical
// dynamic-import pattern for pdfjs-dist's legacy build.
const SIGNATURE_LINE_RE = /_{10,}/;

async function getPdfjs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

// Returns an array of { page (0-based), x, y, width, height, pageHeight,
// nearbyText } in PDF point space (bottom-left origin, matching pdf-lib's
// own coordinate convention), one entry per signature-line match found, in
// document order (top of page 1 first). `x`/`y` mark the placeholder's own
// bounding box; callers draw the signature image just above the line, not
// on top of it. `nearbyText` concatenates this item with the next couple
// of text items on the same page (covers both markup patterns used across
// the 3 built-in documents: LOI/commercial lease put the signer's name on
// the NEXT line below the signature line, residential lease puts it
// inline in the SAME line as the signature line) -- callers match a
// signer's name against this to figure out which line is whose.
export async function findSignatureLines(pdfBuffer) {
  const pdfjsLib = await getPdfjs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;
  const results = [];

  try {
    for (let pageIndex = 0; pageIndex < pdfDoc.numPages; pageIndex++) {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const items = textContent.items;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.str || !SIGNATURE_LINE_RE.test(item.str)) continue;
        // item.transform is [scaleX, skewX, skewY, scaleY, x, y] in PDF
        // user space already (pdf.js applies the viewport's own transform
        // internally for getTextContent -- x/y here are already in the
        // page's native point coordinates, unaffected by our scale: 1
        // viewport, which exists only to read page height for completeness).
        const [, , , , x, y] = item.transform;
        const nearbyText = [item.str, items[i + 1]?.str, items[i + 2]?.str].filter(Boolean).join(" ");
        results.push({
          page: pageIndex,
          x,
          y,
          width: item.width,
          height: item.height || 10,
          pageHeight: viewport.height,
          nearbyText,
        });
      }
    }
  } finally {
    if (typeof pdfDoc.destroy === "function") await pdfDoc.destroy();
  }

  return results;
}
