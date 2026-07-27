// In-browser fillable-region detection for flat (non-AcroForm) PDF pages,
// using the FFDNet ONNX object detector via onnxruntime-web.
//
// Tensor contract, class mapping, letterbox strategy, and NMS parameters are
// all transcribed from `spikes/README-detection.md` (Task 2), which itself
// verified them against the shipped `SimplePDF/commonforms-web` browser
// implementation -- not against docs or memory. Do not change any of the
// constants below without re-checking that spike.
//
// This module never touches pdf.js directly: callers render a page to a
// <canvas> (at whatever scale is convenient for them -- percentages are
// scale-invariant) and pass that canvas in. This module renders its own
// second, separate 1216x1216 letterboxed canvas for the model; it never
// reuses a caller's on-screen editing canvas.

// --- Named constants (see spike sections 2-3 for provenance) ---

// Fixed by the ONNX export itself, not a tunable. Both FFDNet-S and
// FFDNet-L expect a square 1216x1216 input.
const TARGET_SIZE = 1216;

// Class index -> model label -> this app's field type. Confirmed identical
// across FFDNet-S and FFDNet-L, and identical between the Python and JS
// reference implementations (spike section 3).
const CLASS_LABELS = ["TextBox", "ChoiceButton", "Signature"];
const CLASS_TO_TYPE = {
  TextBox: "text",
  ChoiceButton: "checkbox",
  Signature: "signature",
};

// Per-class confidence floors. A single global floor was tried first
// (0.5, per the brief's starting point) and measured against the
// ground-truth page in task-6-report.md: it missed the ENTIRE checkbox
// class (0/10 detected). What matters is the *observed score distribution*
// per class, not just the published AP figures: on the real ground-truth
// page, the highest ChoiceButton score anywhere was 0.412, so no single
// global floor above ~0.41 could ever surface a checkbox, no matter how
// text boxes behaved. FFDNet-S's published AP does differ meaningfully by
// class (Text 61.5, Choice 71.3, Signature 84.2), which is the underlying
// reason a single global number is the wrong shape for this model -- each
// class has its own precision/recall trade-off curve.
//
// Per-class floors chosen from that empirical sweep (task-6-report.md
// "fix" section has the re-measurement):
// - text: 0.5 -- keeps the original floor; text boxes cleared 0.5 easily
//   (scores observed up to 0.76) and lowering it further risks new false
//   positives on a class that's already well past its own floor.
// - checkbox: 0.3 -- observed checkbox scores clustered 0.31-0.41; 0.3
//   recovers all 10 ground-truth checkboxes with no observed false
//   positives in the sweep.
// - signature: 0.5 -- no signature fields exist on the ground-truth page
//   (page 1 has none), so there is no empirical signal to tune against.
//   Signature AP (84.2) is the highest of the three classes in FFDNet-S's
//   published numbers, meaning the model is most confident/precise on this
//   class when it does fire -- kept at the same floor as text as the
//   conservative default until a page with real signature fields is used
//   to measure it directly.
const CONFIDENCE_FLOOR = {
  TextBox: 0.5,
  ChoiceButton: 0.3,
  Signature: 0.5,
};

// Greedy class-aware NMS threshold. NMS is not baked into the ONNX graph
// (spike section 3) -- this module implements it itself, mirroring
// commonforms-web's `applyNonMaximumSuppression`.
const NMS_IOU_THRESHOLD = 0.45;

// Selectable model variants. Tensor contract is identical between them; only
// the weight file and accuracy/size trade-off differ (spike section 2 and
// section 6). FFDNet-S is the default per the spike's recommendation.
//
// Hosting decision: fetch weights directly from HuggingFace in the
// browser -- deliberately, not as a stopgap. The spike's original plan was
// to rehost on Vercel Blob, but Task 6 could not confirm the CC-BY 4.0
// license the spike assumed: neither the HuggingFace model repos
// (jbarrow/FFDNet-S-cpu, jbarrow/FFDNet-L-cpu) nor the GitHub source
// (jbarrow/commonforms) carry any license file or license tag at all (the
// dataset the models were trained on is separately tagged apache-2.0, and
// the arXiv preprint carries its own CC-BY 4.0 badge -- neither of those
// governs the model weight files, and the spike's claim was most likely a
// conflation of the two). Redistributing unlicensed third-party weights
// from our own Blob storage would mean OUR CDN is the one serving them to
// end users; fetching straight from HuggingFace instead means every
// browser downloads directly from the source with no redistribution step
// on our part, which sidesteps the unresolved license question rather than
// resting on it. CORS was independently confirmed to work end-to-end for a
// direct cross-origin browser fetch (both the huggingface.co redirect and
// the resolved CDN response send `access-control-allow-origin`), and this
// is exactly the pattern the upstream reference implementation itself uses
// (it fetches FFDNet-S from a DigitalOcean Spaces mirror and FFDNet-L
// directly from huggingface.co) -- serving large ONNX weights from
// someone else's object storage, not the app's own bundle or CDN, is
// already the proven-in-production shape here.
//
// The env-var seam below is kept specifically so this can be switched to
// self-hosted Blob storage later without a code change, if the license is
// ever clarified in writing.
const MODEL_VARIANTS = {
  S: {
    label: "FFDNet-S",
    url:
      process.env.NEXT_PUBLIC_FFDNET_S_URL ||
      "https://huggingface.co/jbarrow/FFDNet-S-cpu/resolve/main/FFDNet-S.onnx",
  },
  L: {
    label: "FFDNet-L",
    url:
      process.env.NEXT_PUBLIC_FFDNET_L_URL ||
      "https://huggingface.co/jbarrow/FFDNet-L-cpu/resolve/main/FFDNet-L.onnx",
  },
};
const DEFAULT_VARIANT = "S";

// --- ONNX Runtime Web bootstrap (lazy, memoized) ---

let ortModulePromise = null;

// Loads the wasm-only onnxruntime-web bundle (no webgl/webgpu backends we
// don't use) and points it at the self-hosted runtime file instead of a CDN.
// `public/ort/ort-wasm-simd-threaded.wasm` was copied verbatim from
// `node_modules/onnxruntime-web/dist/` -- see task-6-report.md for why this
// is the only wasm file that needed self-hosting (the JS glue is inlined by
// the "bundle" import Next's webpack picks up automatically).
function getOrt() {
  if (typeof window === "undefined") {
    throw new Error("formDetect.detectFields() must run in the browser.");
  }
  if (!ortModulePromise) {
    // Bare `import("onnxruntime-web/wasm")` was tried first (per the
    // original plan: "the JS glue is inlined ... webpack picks up
    // automatically, so no separate .mjs needed self-hosting" -- see
    // task-6-report.md). That claim did not survive an actual `next build`
    // (Task 9's first end-to-end verification of this module): with no
    // special resolve condition set, that bare specifier resolves to the
    // package's "default" export target, `ort.wasm.bundle.min.mjs` -- the
    // self-contained variant that inlines its own base64 WASM copy and
    // uses `import.meta` in a way Next's production Terser pass chokes on
    // ("'import.meta' cannot be used outside of module code"). It also
    // silently defeats the whole point of self-hosting
    // `ort-wasm-simd-threaded.wasm` in public/ort/, since the bundle
    // variant never fetches an external .wasm file at all.
    //
    // Fix: self-host the *non-bundle* `ort.wasm.min.mjs` (copied verbatim
    // from node_modules/onnxruntime-web/dist/, same as the .wasm file
    // already there) alongside it in public/ort/, and import it with a
    // root-relative URL under `webpackIgnore: true`. That magic comment
    // tells webpack to leave this dynamic import alone entirely -- no
    // bundling, no minification, no resolution attempt -- so it's resolved
    // by the browser's native ESM loader at runtime instead, exactly like
    // any other public static asset. This is also the *correct* variant to
    // use given `wasmPaths` is set below: `ort.wasm.min.mjs` is the build
    // that actually fetches an external .wasm file rather than embedding
    // its own.
    ortModulePromise = import(/* webpackIgnore: true */ "/ort/ort.wasm.min.mjs").then((mod) => {
      mod.env.wasm.wasmPaths = "/ort/";
      // Forced to 1: this app does not set COOP/COEP headers, so
      // cross-origin isolation is unavailable and onnxruntime-web would
      // fall back to 1 thread anyway (it checks `self.crossOriginIsolated`
      // internally) -- setting it explicitly makes that fallback a
      // deliberate decision here rather than an implicit one.
      mod.env.wasm.numThreads = 1;
      return mod;
    });
  }
  return ortModulePromise;
}

const sessionPromises = new Map();

// Memoized per variant: the ~38MB (or ~97MB) weights download and WASM
// session init happen once per browser session, not once per page/call.
function loadSession(variant) {
  if (!sessionPromises.has(variant)) {
    sessionPromises.set(
      variant,
      (async () => {
        const ort = await getOrt();
        const source = MODEL_VARIANTS[variant];
        if (!source) {
          throw new Error(`Unknown FFDNet variant: ${variant}`);
        }
        const session = await ort.InferenceSession.create(source.url, {
          executionProviders: ["wasm"],
        });
        return session;
      })()
    );
  }
  return sessionPromises.get(variant);
}

// --- Preprocessing: letterbox a source canvas onto a solid-white 1216x1216 square ---

// Pure scale/offset arithmetic for the letterbox transform -- factored out
// of letterboxToTensor() so it can be unit-tested without a real DOM
// canvas (see test/formDetect.test.mjs). Scale so the longer side hits
// exactly TARGET_SIZE, then center the result on the square.
//
// Rounding note (flagged in code review): offsetX/offsetY are rounded to
// whole pixels here because they're used to place an actual drawImage()
// call, which needs integer coordinates. The reverse un-letterbox math in
// detectFields() below divides by the unrounded `scale` again, so forward
// and reverse are not perfectly bit-exact inverses -- there's a sub-pixel
// mismatch on the order of <1px at TARGET_SIZE=1216 resolution, which
// becomes a fraction of a percent once converted to xPct/yPct. This is
// negligible for placing an editable field box (the whole point of the
// editor in Task 8 is that a human nudges/resizes these anyway), but it's
// exactly why the round-trip test below asserts an epsilon rather than
// exact equality.
function computeLetterboxTransform(srcW, srcH) {
  if (!srcW || !srcH) {
    throw new Error("detectFields: source canvas has zero width/height.");
  }
  const scale = Math.min(TARGET_SIZE / srcW, TARGET_SIZE / srcH);
  const renderedW = Math.round(srcW * scale);
  const renderedH = Math.round(srcH * scale);
  const offsetX = Math.round((TARGET_SIZE - renderedW) / 2);
  const offsetY = Math.round((TARGET_SIZE - renderedH) / 2);
  return { scale, renderedW, renderedH, offsetX, offsetY };
}

// Renders `sourceCanvas` (already-rendered PDF page, any resolution) onto a
// separate 1216x1216 canvas: scaled so its longer side is exactly 1216px,
// then centered on white padding. Returns the planar RGB float32 tensor data
// plus the scale/offset needed to map model-space boxes back to
// `sourceCanvas` pixel space.
function letterboxToTensor(sourceCanvas) {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const { scale, renderedW, renderedH, offsetX, offsetY } =
    computeLetterboxTransform(srcW, srcH);

  const letterboxCanvas = document.createElement("canvas");
  letterboxCanvas.width = TARGET_SIZE;
  letterboxCanvas.height = TARGET_SIZE;
  const ctx = letterboxCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
  ctx.drawImage(sourceCanvas, offsetX, offsetY, renderedW, renderedH);

  const { data: rgba } = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  const pixelCount = TARGET_SIZE * TARGET_SIZE;
  const planar = new Float32Array(3 * pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const base = i * 4;
    planar[i] = rgba[base] / 255; // R plane
    planar[pixelCount + i] = rgba[base + 1] / 255; // G plane
    planar[2 * pixelCount + i] = rgba[base + 2] / 255; // B plane
  }

  return { data: planar, scale, offsetX, offsetY, srcW, srcH };
}

// --- Postprocessing: decode raw output0, threshold, NMS, un-letterbox ---

// `data` is the flat Float32Array backing output0, shape [1, 7, N].
// `n` is read from the tensor's own dims at call time -- never hardcoded
// (spike section 3 explicitly flags this as a requirement, since the
// anchor count depends on the export and was never independently confirmed).
function decodeDetections(data, n) {
  // UNVERIFIED-per-spike sanity check: the reference JS implementation
  // applies no sigmoid to the class-score channels, implying the ONNX
  // export already bakes in the activation. Confirm that at runtime rather
  // than trust it: sample scores across all anchors and check they land in
  // a plausible post-sigmoid range. If they don't, apply sigmoid ourselves.
  let minScore = Infinity;
  let maxScore = -Infinity;
  for (let c = 0; c < 3; c++) {
    const base = (4 + c) * n;
    for (let i = 0; i < n; i++) {
      const v = data[base + i];
      if (v < minScore) minScore = v;
      if (v > maxScore) maxScore = v;
    }
  }
  // Raw logits routinely exceed [0,1] in both directions; post-sigmoid
  // scores are mathematically confined to (0,1). If we observe values
  // outside [0,1] (or, as a weaker signal, no positive scores ever exceed
  // 1 but also never approach it in a shape consistent with probabilities),
  // treat them as logits and apply sigmoid before thresholding.
  const looksLikeLogits = minScore < 0 || maxScore > 1;
  const activate = looksLikeLogits
    ? (v) => 1 / (1 + Math.exp(-v))
    : (v) => v;

  const boxes = [];
  for (let i = 0; i < n; i++) {
    let bestClass = -1;
    let bestScore = -Infinity;
    for (let c = 0; c < 3; c++) {
      const score = activate(data[(4 + c) * n + i]);
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    const floor = CONFIDENCE_FLOOR[CLASS_LABELS[bestClass]];
    if (bestScore < floor) continue;

    const cx = data[0 * n + i];
    const cy = data[1 * n + i];
    const w = data[2 * n + i];
    const h = data[3 * n + i];
    boxes.push({
      x1: cx - w / 2,
      y1: cy - h / 2,
      x2: cx + w / 2,
      y2: cy + h / 2,
      score: bestScore,
      classId: bestClass,
    });
  }

  return { boxes, looksLikeLogits, minScore, maxScore };
}

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const inter = interW * interH;
  if (inter <= 0) return 0;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

// Greedy, class-aware NMS: sort by confidence descending, suppress
// lower-confidence boxes of the SAME class whose IoU with a kept box
// exceeds NMS_IOU_THRESHOLD. Boxes of different classes never suppress
// each other (spike section 3).
function nonMaxSuppression(boxes) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const candidate of sorted) {
    const suppressed = kept.some(
      (k) =>
        k.classId === candidate.classId &&
        iou(k, candidate) > NMS_IOU_THRESHOLD
    );
    if (!suppressed) kept.push(candidate);
  }
  return kept;
}

/**
 * Detects fillable regions on a rendered PDF page canvas using FFDNet.
 *
 * @param {HTMLCanvasElement} canvas - a rendered page, at any resolution
 *   (this function letterboxes its own 1216x1216 copy internally; it does
 *   not mutate or reuse the caller's canvas).
 * @param {number} pageIndex - the page number to stamp onto each result
 *   (this module makes no assumption about 0- vs 1-based; it echoes back
 *   whatever the caller passes as `page`).
 * @param {{ variant?: "S" | "L" }} [options]
 * @returns {Promise<Array<{type: string, xPct: number, yPct: number,
 *   widthPct: number, heightPct: number, confidence: number, page: number}>>}
 */
export async function detectFields(canvas, pageIndex, options = {}) {
  const variant = options.variant === "L" ? "L" : DEFAULT_VARIANT;

  const [ort, session] = await Promise.all([getOrt(), loadSession(variant)]);

  const { data, scale, offsetX, offsetY, srcW, srcH } = letterboxToTensor(canvas);
  const tensor = new ort.Tensor("float32", data, [1, 3, TARGET_SIZE, TARGET_SIZE]);

  const inputName = session.inputNames.includes("images")
    ? "images"
    : session.inputNames[0];
  if (inputName !== "images") {
    console.warn(
      `formDetect: expected input tensor name "images", session reports "${inputName}". Using the reported name.`
    );
  }

  const outputMap = await session.run({ [inputName]: tensor });
  const outputName = session.outputNames.includes("output0")
    ? "output0"
    : session.outputNames[0];
  if (outputName !== "output0") {
    console.warn(
      `formDetect: expected output tensor name "output0", session reports "${outputName}". Using the reported name.`
    );
  }

  const outputTensor = outputMap[outputName];
  const n = outputTensor.dims[2]; // never hardcoded -- read at runtime per spike
  const { boxes, looksLikeLogits, minScore, maxScore } = decodeDetections(
    outputTensor.data,
    n
  );
  if (looksLikeLogits) {
    console.warn(
      `formDetect: class scores looked like raw logits (observed range [${minScore.toFixed(
        3
      )}, ${maxScore.toFixed(
        3
      )}]), so sigmoid was applied client-side. The spike flagged this as unverified against the ONNX graph -- this confirms the export does NOT bake in the activation for this model file.`
    );
  }

  const kept = nonMaxSuppression(boxes);

  const results = [];
  for (const box of kept) {
    // Un-letterbox: subtract the pad offset, divide by render scale, to get
    // back into `canvas` pixel space.
    const px1 = (box.x1 - offsetX) / scale;
    const py1 = (box.y1 - offsetY) / scale;
    const px2 = (box.x2 - offsetX) / scale;
    const py2 = (box.y2 - offsetY) / scale;

    // Clip to the actual page content (letterbox padding can produce boxes
    // that spill into the white bars, especially for boxes near the pad
    // edge); discard anything that ends up with no area after clipping.
    const cx1 = Math.max(0, Math.min(srcW, px1));
    const cy1 = Math.max(0, Math.min(srcH, py1));
    const cx2 = Math.max(0, Math.min(srcW, px2));
    const cy2 = Math.max(0, Math.min(srcH, py2));
    if (cx2 <= cx1 || cy2 <= cy1) continue;

    const type = CLASS_TO_TYPE[CLASS_LABELS[box.classId]];
    if (!type) continue; // defensive: unknown class id

    results.push({
      type,
      // Percentages of canvas width/height are scale-invariant, so this
      // matches page-space percentages regardless of what resolution the
      // caller rendered `canvas` at. yPct is measured from the top, per
      // this project's coordinate convention.
      xPct: (cx1 / srcW) * 100,
      yPct: (cy1 / srcH) * 100,
      widthPct: ((cx2 - cx1) / srcW) * 100,
      heightPct: ((cy2 - cy1) / srcH) * 100,
      confidence: box.score,
      page: pageIndex,
    });
  }

  return results;
}

export const __testing = {
  TARGET_SIZE,
  CONFIDENCE_FLOOR,
  NMS_IOU_THRESHOLD,
  CLASS_LABELS,
  CLASS_TO_TYPE,
  MODEL_VARIANTS,
  DEFAULT_VARIANT,
  computeLetterboxTransform,
  letterboxToTensor,
  decodeDetections,
  nonMaxSuppression,
  iou,
};
