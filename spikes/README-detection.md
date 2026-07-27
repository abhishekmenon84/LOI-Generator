# Detection spike: FFDNet in-browser form-field detection

Research-only spike for Task 2 of the universal PDF form framework. No code was
written or executed; this documents the tensor contract, class mapping, model
variant choice, and hosting plan that Task 6 (the detection module) must be
implemented against. Primary sources are cited inline; anything not directly
confirmed from a source is marked **UNVERIFIED**.

Sources consulted (fetched directly, 2026-07-27):
- `github.com/jbarrow/commonforms` — `commonforms/inference.py` (Python reference implementation)
- `github.com/SimplePDF/commonforms-web` — `src/workers/inference.worker.ts`, `src/lib/formFieldDetection.ts`, `src/lib/utils.ts`, `src/FormFieldsDetection.tsx`, `package.json`, `vite.config.ts` (the ONNX Runtime Web port — this is the ground truth for the browser tensor contract, since it is a working, shipped implementation, not just docs)
- HuggingFace API (`huggingface.co/api/models/jbarrow/FFDNet-S-cpu`, `.../FFDNet-L-cpu`) and their model card READMEs
- Direct HTTP HEAD/GET against the HF `resolve/main/*.onnx` URLs for exact byte sizes
- Paper abstract: `arxiv.org/abs/2509.16506` (title/abstract only, referenced for the class taxonomy and AP figures already surfaced in the model cards)

## 1. Ground truth: manual field count

**File:** `Design/forms/Agreement of Purchase and Sale.pdf`, page 1 (visually rendered and inspected by hand).

**Counting rule used:** each contiguous fillable blank (an underscore run, or a boxed area meant to receive one piece of information) counts as one field, regardless of how long the ruled line is or whether it runs to the margin. A single checkbox glyph (☐) counts as one choice-button field. Where a label groups multiple small boxes for one semantic entry drawn as separate squares (e.g. "Buyer's Initials" rendered as two adjacent small boxes), the **group** counts as one field, not one field per box — because a person's initials are one logical answer, and this is the granularity a detector is realistically expected to produce (it will draw one bounding box around the initial-boxes cluster, not one per square). This rule is stated explicitly because Task 6 needs to know what "correct" means when scoring detector output against this yardstick.

**Checkboxes: 10**
1–4. Schedule row: Vacant Land, Mini/Mobile Home, Condominium, Multi-Use Residential Income Properties
5–6. HST section: "IS included in the purchase price" / "IS NOT included in the purchase price"
7–8. Clause 3(a): "This offer ☐IS or ☐IS NOT subject to the sale of the Buyer's Property"
9–10. Clause 3(c): "The Buyer ☐IS or ☐IS NOT required to meet or exceed..."

This matches the brief's own reference note ("4 schedule checkboxes, HST 2 checkboxes, and the clause-3 toggles" = 4 more) exactly: 4 + 2 + 4 = 10.

**Text inputs: 26**
Buyer name; Seller name; Seller's Agent (Company); Buyer's Agent (Company); civic address; PID(s); PAN#; purchase price (words); purchase price ($ figure); Closing Date sentence 1 — day, month, year (3 blanks); Closing Date sentence 2 — A.M./P.M. time, day, month, year (4 blanks); clause 3(a) Buyer's Property address; clause 3(a) date — day, month, year (3 blanks); clause 3(b) hours; clause 3(d) days-before-closing; HST section Buyer's Initials (grouped box pair); HST section Seller's Initials (grouped box pair); page-bottom acknowledgement Buyer's Initials (grouped); page-bottom acknowledgement Seller's Initials (grouped).

Count: 1(buyer)+1(seller)+1(seller's agent)+1(buyer's agent)+1(address)+1(PID)+1(PAN)+1(price words)+1(price $)+3(closing date 1)+4(closing date 2)+1(3a address)+3(3a date)+1(3b hours)+1(3d days)+1(HST buyer initials)+1(HST seller initials)+1(bottom buyer initials)+1(bottom seller initials) = **26**.

**Total fillable regions on page 1: 36** (26 text inputs + 10 checkboxes). This is the number Task 6's detector output should be compared against (with the same counting rule applied to detector boxes — merge/cluster adjacent tiny boxes that clearly belong to one grouped initials pair before comparing, or explicitly report them as split if the detector doesn't cluster).

## 2. Model identity, sizes, and licensing

Both variants are **YOLO-family object detectors** (Ultralytics `YOLO(..., task="detect")` in the Python reference — confirmed directly from `commonforms/inference.py`), not a bespoke architecture, exported to ONNX for CPU inference. Released **CC-BY 4.0** (per brief; not independently re-verified in this spike but not contradicted by anything found).

| Variant | Params | HF repo (ONNX) | File | Exact size (bytes, confirmed via `curl -sL -o /dev/null -w %{size_download}`) |
|---|---|---|---|---|
| FFDNet-S | 6M | `jbarrow/FFDNet-S-cpu` | `FFDNet-S.onnx` | **38,370,092** (≈36.6 MiB) |
| FFDNet-L | 25M | `jbarrow/FFDNet-L-cpu` | `FFDNet-L.onnx` | **101,944,542** (≈97.2 MiB) |

Published AP (from both models' HF model cards, evaluated at 1216px):

| Model | Text AP | Choice AP | Signature AP | Overall AP |
|---|---|---|---|---|
| FFDNet-S | 61.5 | 71.3 | 84.2 | 72.3 |
| FFDNet-L | 71.4 | 78.1 | 93.5 | 81.0 |

Non-ONNX variants also exist (`.pt` for PyTorch/Ultralytics, at `jbarrow/FFDNet-S` / `jbarrow/FFDNet-L` without the `-cpu` suffix) — not relevant to a browser deployment.

There is also a third architecture, `FFDetr` (`jbarrow/FFDetr`, RF-DETR-Medium based, `.pth` only, no ONNX export found) — **not usable in-browser as-is** (no ONNX artifact), excluded from consideration.

## 3. Tensor contract (confirmed from `commonforms-web`'s working ONNX Runtime Web code)

This section is the load-bearing part of this spike. Everything below is transcribed directly from `src/workers/inference.worker.ts` in `SimplePDF/commonforms-web` (a real, shipped implementation — not documentation prose), because that is the only source found that actually shows a working browser tensor contract for these models. The Python `inference.py` does NOT show this — it routes through Ultralytics' `YOLO.predict()`, which hides the raw tensor decode inside the library.

### Input

- **Tensor name:** `"images"` (i.e. `session.run({ images: tensor })`)
- **Shape:** `[1, 3, imageWidth, imageHeight]` where in practice `imageWidth === imageHeight === 1216` (see resize strategy below) — i.e. effectively `[1, 3, 1216, 1216]`, NCHW, planar (not interleaved) channel layout.
  - **UNVERIFIED / flag for Task 6:** the reference code literally writes the shape as `[1, 3, imageWidth, imageHeight]`, which — if the two dimensions were ever unequal — would be `[N, C, W, H]` rather than the conventional `[N, C, H, W]`. Because the reference implementation always feeds a square 1216×1216 tensor, this ambiguity never manifests in practice and the reference code is silent on which axis is "really" height vs. width. **Task 6 should keep the input square** (matching the reference's own letterbox-to-square approach below) to sidestep this ambiguity entirely, rather than trying to resolve which axis is which.
- **dtype:** `float32`
- **Normalization:** divide raw 0–255 pixel value by `255.0`. No mean/std subtraction, no `[-1,1]` rescaling.
- **Channel order:** RGB (source is a canvas `ImageData`, so R/G/B taken directly from bytes 0/1/2 of each RGBA pixel; alpha byte discarded).
- **Channel layout in the flat buffer:** planar — all R values first (`rgbData[i]`), then all G values (`rgbData[W*H + i]`), then all B values (`rgbData[2*W*H + i]`).
- **Target size:** `TARGET_SIZE = 1216` px (square), for **both** FFDNet-S and FFDNet-L in this browser port. This matches the Python side's `--fast`/ONNX note: *"overrides the image size to 1216, since that's all ONNX supports"* (verbatim comment in `commonforms/inference.py`) — i.e. 1216 is not an arbitrary web-port choice, it's a constraint of the ONNX export itself (the non-ONNX `.pt` path defaults to 1600px and is resizable; the ONNX path is fixed at 1216).
- **Resize/letterbox strategy (exact, from `renderPdfPageToImageData`):**
  1. Render the PDF page at `scale = min(1216 / pageWidthAt1x, 1216 / pageHeightAt1x)` — i.e. scale so the **longer** side fits exactly 1216px, preserving aspect ratio.
  2. Create a 1216×1216 canvas, fill it solid white.
  3. Draw the scaled render centered in that square canvas (`offsetX = (1216 - renderedWidth)/2`, same for Y) — a **letterbox pad**, not a stretch/squash resize.
  4. Feed the full 1216×1216 canvas as the tensor.
  - **Implication for Task 6:** because the detector always sees this centered-on-white-square layout, box coordinates coming back from the model are in this padded 1216×1216 space and must be un-letterboxed (subtract offsetX/offsetY, then divide by the render scale) to map back to PDF page coordinates. The reference code stores `originalWidth`, `originalHeight`, `canvasSize`, `offsetX`, `offsetY` in `pdfMetadata` specifically to support this reverse mapping later.

### Output

- **Tensor name:** `"output0"` (`output["output0"]`)
- **Shape:** `[1, 7, numPredictions]` — this is the standard **Ultralytics YOLOv8/v11 anchor-free detection head** export layout: `7 = 4 (box) + 3 (classes)`, transposed so the 7-channel axis is the *second* dimension and the per-anchor predictions are the *third* dimension (i.e. NOT the `[1, numPredictions, 7]` layout some other YOLO ONNX exports use — this one is channel-first).
  - `numPredictions` is read at runtime from `outputDims[2]` in the reference code — it is **not hardcoded**, and this spike does not hardcode it either. For a 1216×1216 input with the standard YOLO strides (8/16/32), the arithmetic works out to 152²+76²+38² = 30,324 anchors, but **this figure is UNVERIFIED against the actual model file** (no ONNX file was downloaded/inspected in this spike — see §5 for why). Task 6 should read `session.outputNames` and `outputTensor.dims` at runtime rather than trust this number.
- **Box format:** per-anchor `(cx, cy, w, h)` at flat offsets `data[0*N+i], data[1*N+i], data[2*N+i], data[3*N+i]` — **center-x, center-y, width, height**, in **absolute pixel units of the 1216×1216 input** (the reference code divides by `TARGET_SIZE` itself to normalize to 0–1 before using the values downstream).
- **Class scores:** flat offsets `data[4*N+i]`, `data[5*N+i]`, `data[6*N+i]` for class 0/1/2 respectively. The reference code takes these values directly as probabilities (`Math.max(...scores)` compared against a 0.1–1.0 confidence slider) with **no sigmoid applied in JS** — meaning the ONNX export already bakes in the class-score activation (standard for Ultralytics ONNX export). There is no separate "objectness" channel — this is the anchor-free YOLOv8-style head where class score doubles as the confidence.
- **Post-processing required client-side (confirmed absent from the raw ONNX graph, since both the Python and JS reference implementations do it themselves):**
  - Confidence thresholding (arbitrary threshold, UI default not preserved as constant in the reference — a slider 0.1–1.0).
  - **NMS is NOT baked into the ONNX graph** — `commonforms-web` implements `applyNonMaximumSuppression` itself in `src/lib/utils.ts` (standard greedy IoU-based NMS, **class-aware** — only suppresses same-`classId` boxes against each other), with **IOU_THRESHOLD = 0.45**. Task 6 will need an equivalent NMS pass; the reference implementation is a usable template (center-format IoU, sort by confidence descending, greedy suppress).
  - Box coordinates need un-letterboxing (see above) after NMS.

### Class index → label mapping (confirmed from BOTH the Python and JS reference implementations — they agree)

| Index | commonforms-web (JS) label | commonforms (Python) internal label | Meaning |
|---|---|---|---|
| 0 | `"TextBox"` | `"TextBox"` | Text Input field |
| 1 | `"ChoiceButton"` | `"ChoiceButton"` | Choice Button (includes checkboxes and radio-style toggles) |
| 2 | `"Signature"` | `"Signature"` | Signature field |

This mapping is identical across both variants (FFDNet-S and FFDNet-L) and both the Python (`id_to_cls = {0: "TextBox", 1: "ChoiceButton", 2: "Signature"}`, in `FFDNetDetector.__init__`) and JS (`CLASS_NAMES: readonly FieldType[] = ["TextBox", "ChoiceButton", "Signature"]`) implementations. High confidence this is stable and correct.

## 4. `onnxruntime-web` version and runtime file resolution

- **Version used by the reference implementation:** `onnxruntime-web@^1.23.0` (from `commonforms-web`'s `package.json` `dependencies`).
- **`.wasm` runtime file resolution:** the reference implementation does **not** serve these files itself — it points `ort.env.wasm.wasmPaths` at a CDN: `ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/"` (set identically in both `formFieldDetection.ts`/`FormFieldsDetection.tsx` and `inference.worker.ts`). Execution provider used: `executionProviders: ["wasm"]` only (no WebGL/WebGPU attempted).
  - **For this app:** relying on a third-party CDN for a required runtime dependency is a availability/CSP risk worth avoiding. **Recommendation: copy `node_modules/onnxruntime-web/dist/*.wasm` (and the matching `.mjs`/`.js` glue files onnxruntime-web expects alongside them) into `public/ort/` in the Next.js app, and set `ort.env.wasm.wasmPaths` to `/ort/`** — this is the standard self-hosting pattern for `onnxruntime-web` and avoids a hard runtime dependency on jsdelivr.
  - **UNVERIFIED:** the exact filenames onnxruntime-web 1.23.0 expects to find at that path (e.g. whether it needs the SIMD+threaded variant, which requires cross-origin-isolation headers (COOP/COEP) to use `SharedArrayBuffer`, vs. the simpler non-threaded single-file wasm that needs no special headers). This spike did not download the npm package to inspect `dist/` contents. **Task 6 should run `ls node_modules/onnxruntime-web/dist/` once the package is actually installed, and explicitly choose the non-threaded/no-COOP-COEP variant unless the app is prepared to set those headers** (Next.js can set them via `next.config.js` headers, but that has app-wide implications worth a deliberate decision, not a default).

## 5. What was NOT verified, and why

No `.onnx` file was downloaded or executed in this spike (research/documentation only, per the task brief — "no application code"). As a result, the following are inferred from the reference implementation's *code that consumes the model* rather than from inspecting the model's own embedded metadata (ONNX graphs carry input/output names and shapes in their protobuf structure, which `onnxruntime-web`'s `session.inputNames`/`outputNames`/`.dims` will report at runtime and Task 6 should trust over this document if they ever disagree):

- Exact `numPredictions` (anchor count) for the 1216px input — arithmetic estimate given (30,324) but not confirmed against the file.
- Whether FFDNet-S and FFDNet-L share an identical output tensor name/shape convention (very likely, since both are exported the same way from the same Ultralytics pipeline per `commonforms/inference.py`'s shared `FFDNetDetector` class, but not independently confirmed per-variant).
- Whether class scores are truly post-sigmoid in the graph (inferred from the JS code's lack of its own sigmoid call, not from disassembling the ONNX graph).

Task 6 should treat this document as the contract to *code against*, but verify tensor names/shapes/dims defensively at runtime (`session.inputNames`, `session.outputNames`, `tensor.dims`) rather than hardcoding blind — the reference implementation itself does this for `outputDims[2]`.

## 6. Recommendation

### Variant: **FFDNet-S** for the default/first-run path

- 36.6 MB vs. 97.2 MB is a meaningfully different one-time download for a browser flow, especially on the mobile/slow-connection tail of users.
- The reference implementation (`commonforms-web`) itself defaults to FFDNet-S in its UI (`selectedModel: "FFDNet-S"` initial state) and only offers FFDNet-L as an opt-in "more accurate" choice — this is a real-world precedent for the same trade-off this app faces.
- AP loss going S→L is real but not catastrophic for the Choice/Signature classes (71.3→78.1, 84.2→93.5) and more pronounced for Text (61.5→71.4). Given this app's forms are dense with text-input blanks (26 of 36 fields on the ground-truth page), the accuracy gap is not negligible — **if Task 6's own evaluation against the ground-truth count in §1 shows FFDNet-S materially under-detecting text inputs, upgrading to FFDNet-L should be revisited**, but S is the right starting point given load-cost asymmetry.
- Recommend keeping both variants selectable (mirroring `commonforms-web`'s own UX), rather than hard-committing to one — the choice is cheap to leave open at the UI layer once the tensor contract (identical across variants) is implemented once.

### Hosting: **Vercel Blob**, not `public/`

- `public/` bundles into the Next.js build/deploy artifact and, depending on hosting target, may count against function/edge bundle size limits or slow cold starts; a 36–97 MB static binary sitting in `public/` also bloats every deploy and `git`-tracked build output.
- The reference implementation itself does **not** self-host its own model weights in its repo — `FormFieldsDetection.tsx` fetches FFDNet-S from the maintainer's own DigitalOcean Spaces CDN mirror and FFDNet-L directly from `huggingface.co/jbarrow/FFDNet-L-cpu/resolve/main/FFDNet-L.onnx` — i.e. serving large ONNX weights from object storage rather than the app's own static bundle is exactly the pattern already proven in production by the people who built this model port. Vercel Blob is this project's equivalent of that pattern.
- Note this app already runs everything client-side per the browser-detection design decision, so the Blob URL is fetched directly by the browser (same cross-origin-fetch shape as the reference implementation's HF/DigitalOcean URLs) — CORS must be permitted on the Blob object (Vercel Blob serves public blobs with permissive CORS by default; confirm at Task 6 implementation time).
- `.wasm` runtime files are a separate, much smaller concern (see §4) — self-host those in `public/ort/` regardless of where the model weights live; they're part of the app's runtime bootstrap, not user-uploaded-scale data, and self-hosting avoids the jsdelivr dependency the reference implementation accepted.

### Render scale note (this app vs. the reference implementation)

This app renders at `scale: 1.4` via `pdfjs-dist` 6.x today (`components/AnchorEditor.jsx`, confirmed: `pdfjsLib` imported dynamically, `page.getViewport({ scale: 1.4 })`). The reference implementation renders at a **variable scale chosen specifically to hit exactly 1216px on the longer side**, then pads to a 1216×1216 square (§3). These are different goals: 1.4 is tuned for on-screen editing legibility, not for feeding a fixed-input-size detector. **Task 6 should render a second, separate canvas at the detector's required scale/letterbox (not reuse the 1.4-scale editing canvas) — the two rendering paths should not be conflated.** Also note the version gap: this app is on `pdfjs-dist@6.1.200`; the reference implementation is pinned to `pdfjs-dist@^5.4.296`. No incompatibility is known or expected (viewport/canvas rendering APIs used here are stable across that range), but this is worth a smoke test in Task 6 rather than an assumption.
