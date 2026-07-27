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

// Drop any detection below this score. Starting point per the brief; not
// tuned against the ground-truth page beyond what's reported in
// task-6-report.md.
const CONFIDENCE_FLOOR = 0.5;

// Greedy class-aware NMS threshold. NMS is not baked into the ONNX graph
// (spike section 3) -- this module implements it itself, mirroring
// commonforms-web's `applyNonMaximumSuppression`.
const NMS_IOU_THRESHOLD = 0.45;

// Selectable model variants. Tensor contract is identical between them; only
// the weight file and accuracy/size trade-off differ (spike section 2 and
// section 6). FFDNet-S is the default per the spike's recommendation.
//
// Hosting note: the spike's plan was to host these on Vercel Blob and set
// NEXT_PUBLIC_FFDNET_S_URL / NEXT_PUBLIC_FFDNET_L_URL to the resulting blob
// URLs. This environment has no BLOB_READ_WRITE_TOKEN configured, so the
// weights were not uploaded to Blob as part of this task -- see
// task-6-report.md for details. The fallback below fetches directly from
// HuggingFace, which was independently confirmed to serve permissive CORS
// headers for a browser fetch (both the huggingface.co redirect and the
// resolved CDN response send `access-control-allow-origin`), and is exactly
// the pattern the upstream reference implementation itself uses (it fetches
// FFDNet-S from a DigitalOcean Spaces mirror and FFDNet-L directly from
// huggingface.co). Once weights are uploaded to Blob, set the env vars and
// this module picks them up with no code change.
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
    ortModulePromise = import("onnxruntime-web/wasm").then((mod) => {
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

// Renders `sourceCanvas` (already-rendered PDF page, any resolution) onto a
// separate 1216x1216 canvas: scaled so its longer side is exactly 1216px,
// then centered on white padding. Returns the planar RGB float32 tensor data
// plus the scale/offset needed to map model-space boxes back to
// `sourceCanvas` pixel space.
function letterboxToTensor(sourceCanvas) {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  if (!srcW || !srcH) {
    throw new Error("detectFields: source canvas has zero width/height.");
  }

  const scale = Math.min(TARGET_SIZE / srcW, TARGET_SIZE / srcH);
  const renderedW = Math.round(srcW * scale);
  const renderedH = Math.round(srcH * scale);
  const offsetX = Math.round((TARGET_SIZE - renderedW) / 2);
  const offsetY = Math.round((TARGET_SIZE - renderedH) / 2);

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
    if (bestScore < CONFIDENCE_FLOOR) continue;

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
  letterboxToTensor,
  decodeDetections,
  nonMaxSuppression,
  iou,
};
