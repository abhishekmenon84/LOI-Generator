import test from "node:test";
import assert from "node:assert/strict";
import { __testing } from "../lib/formDetect.js";

const {
  TARGET_SIZE,
  CONFIDENCE_FLOOR,
  computeLetterboxTransform,
  decodeDetections,
  nonMaxSuppression,
  iou,
} = __testing;

// --- Output decode: hand-built [1, 7, N] channel-first output0 ---
// Layout per spike/README-detection.md section 3: flat offsets
// data[c*N + i] for channel c in [0..6], anchor i in [0..N).
// c=0..3: cx, cy, w, h (absolute 1216-space pixels).
// c=4..6: TextBox, ChoiceButton, Signature scores.

test("decodeDetections reads box + class values at the correct flat offsets", () => {
  const n = 3;
  const data = new Float32Array(7 * n);

  // Anchor 0: a TextBox at (100, 200) with w=40, h=10, score 0.9 (clears
  // the 0.5 text floor).
  data[0 * n + 0] = 100; // cx
  data[1 * n + 0] = 200; // cy
  data[2 * n + 0] = 40; // w
  data[3 * n + 0] = 10; // h
  data[4 * n + 0] = 0.9; // TextBox score
  data[5 * n + 0] = 0.1; // ChoiceButton score
  data[6 * n + 0] = 0.05; // Signature score

  // Anchor 1: a ChoiceButton at (500, 600) with w=20, h=20, score 0.35
  // (clears the 0.3 checkbox floor but would NOT clear a 0.5 floor --
  // this is the exact scenario that motivated per-class floors).
  data[0 * n + 1] = 500;
  data[1 * n + 1] = 600;
  data[2 * n + 1] = 20;
  data[3 * n + 1] = 20;
  data[4 * n + 1] = 0.1;
  data[5 * n + 1] = 0.35;
  data[6 * n + 1] = 0.02;

  // Anchor 2: best class is TextBox but score 0.4, below the 0.5 text
  // floor -- should be dropped entirely.
  data[0 * n + 2] = 900;
  data[1 * n + 2] = 300;
  data[2 * n + 2] = 15;
  data[3 * n + 2] = 15;
  data[4 * n + 2] = 0.4;
  data[5 * n + 2] = 0.05;
  data[6 * n + 2] = 0.01;

  const { boxes, looksLikeLogits } = decodeDetections(data, n);

  assert.equal(looksLikeLogits, false, "scores are in [0,1], should not be treated as logits");
  assert.equal(boxes.length, 2, "anchor 2 should be dropped by its class-specific floor");

  const textBox = boxes.find((b) => b.classId === 0);
  const choiceBox = boxes.find((b) => b.classId === 1);
  assert.ok(textBox, "expected a decoded TextBox");
  assert.ok(choiceBox, "expected a decoded ChoiceButton");

  // cx-w/2, cy-h/2, cx+w/2, cy+h/2 for anchor 0.
  assert.equal(textBox.x1, 80);
  assert.equal(textBox.y1, 195);
  assert.equal(textBox.x2, 120);
  assert.equal(textBox.y2, 205);
  assert.ok(Math.abs(textBox.score - 0.9) < 1e-6);

  assert.equal(choiceBox.x1, 490);
  assert.equal(choiceBox.y1, 590);
  assert.equal(choiceBox.x2, 510);
  assert.equal(choiceBox.y2, 610);
  assert.ok(Math.abs(choiceBox.score - 0.35) < 1e-6);
});

test("decodeDetections applies sigmoid when scores look like raw logits", () => {
  const n = 1;
  const data = new Float32Array(7 * n);
  data[0] = 50;
  data[n] = 50;
  data[2 * n] = 10;
  data[3 * n] = 10;
  // A score of 5 is impossible for an already-activated probability but a
  // very plausible positive logit -- this should trip looksLikeLogits.
  data[4 * n] = 5;
  data[5 * n] = -3;
  data[6 * n] = -3;

  const { boxes, looksLikeLogits } = decodeDetections(data, n);
  assert.equal(looksLikeLogits, true);
  assert.equal(boxes.length, 1);
  // sigmoid(5) ~= 0.9933
  assert.ok(Math.abs(boxes[0].score - 1 / (1 + Math.exp(-5))) < 1e-6);
});

test("per-class confidence floors: checkbox floor is intentionally lower than text", () => {
  // Locks in the fix from code review: FFDNet-S's real observed checkbox
  // scores on the ground-truth page topped out at 0.412, so a single
  // global 0.5 floor missed the entire class (0/10). This test pins the
  // shape of the fix, not just its current numeric values.
  assert.ok(CONFIDENCE_FLOOR.ChoiceButton < CONFIDENCE_FLOOR.TextBox);
});

// --- NMS: class-aware, greedy, IoU-threshold suppression ---

test("nonMaxSuppression suppresses a lower-confidence same-class box with high overlap", () => {
  const boxes = [
    { x1: 0, y1: 0, x2: 100, y2: 20, score: 0.9, classId: 0 },
    // Nearly identical box, same class, lower score -- should be suppressed.
    { x1: 2, y1: 1, x2: 98, y2: 19, score: 0.6, classId: 0 },
  ];
  const kept = nonMaxSuppression(boxes);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].score, 0.9);
});

test("nonMaxSuppression does not suppress across different classes even with full overlap", () => {
  const boxes = [
    { x1: 0, y1: 0, x2: 100, y2: 20, score: 0.9, classId: 0 }, // TextBox
    { x1: 0, y1: 0, x2: 100, y2: 20, score: 0.4, classId: 1 }, // ChoiceButton, identical box
  ];
  const kept = nonMaxSuppression(boxes);
  assert.equal(kept.length, 2, "class-aware NMS must not suppress a different class");
});

test("nonMaxSuppression keeps both boxes when IoU is just under the 0.45 threshold", () => {
  // Two same-class boxes arranged so their IoU is provably < 0.45.
  // Box A: [0,0]-[100,100] (area 10000). Box B: [70,0]-[170,100] (area
  // 10000), same class. Intersection is [70,0]-[100,100] = 30*100 = 3000.
  // Union = 10000+10000-3000 = 17000. IoU = 3000/17000 ~= 0.176, well
  // under 0.45.
  const a = { x1: 0, y1: 0, x2: 100, y2: 100, score: 0.9, classId: 0 };
  const b = { x1: 70, y1: 0, x2: 170, y2: 100, score: 0.8, classId: 0 };
  assert.ok(iou(a, b) < 0.45);
  const kept = nonMaxSuppression([a, b]);
  assert.equal(kept.length, 2);
});

test("iou returns 0 for non-overlapping boxes and 1 for identical boxes", () => {
  const a = { x1: 0, y1: 0, x2: 10, y2: 10 };
  const b = { x1: 100, y1: 100, x2: 110, y2: 110 };
  assert.equal(iou(a, b), 0);
  assert.equal(iou(a, a), 1);
});

// --- Letterbox round-trip: forward-map into 1216-space, reverse-map back ---

// Reverse math mirrors detectFields()'s un-letterbox step: subtract offset,
// divide by scale.
function unletterbox(modelSpaceBox, transform) {
  return {
    x1: (modelSpaceBox.x1 - transform.offsetX) / transform.scale,
    y1: (modelSpaceBox.y1 - transform.offsetY) / transform.scale,
    x2: (modelSpaceBox.x2 - transform.offsetX) / transform.scale,
    y2: (modelSpaceBox.y2 - transform.offsetY) / transform.scale,
  };
}

test("letterbox round-trip returns to original page coordinates within a small epsilon (non-square page)", () => {
  // A non-square US-Letter-like page at a representative render
  // resolution, deliberately NOT square, to genuinely exercise the
  // aspect-ratio/offset handling (portrait: height is the longer side, so
  // padding lands on the X axis).
  const srcW = 1224;
  const srcH = 1584;
  const transform = computeLetterboxTransform(srcW, srcH);

  assert.equal(transform.scale, TARGET_SIZE / srcH, "height is the longer side, so it should drive the scale");
  assert.ok(transform.offsetX > 0, "portrait page should be padded on X");
  assert.equal(transform.offsetY, 0, "the longer side should touch both edges with no Y padding");

  // A field box in original page pixel space (e.g. a text input near the
  // top-left of the page).
  const originalBox = { x1: 100, y1: 200, x2: 500, y2: 240 };

  // Forward: page-space -> model-space (mirrors letterboxToTensor's own
  // drawImage placement math: scale then offset).
  const modelBox = {
    x1: originalBox.x1 * transform.scale + transform.offsetX,
    y1: originalBox.y1 * transform.scale + transform.offsetY,
    x2: originalBox.x2 * transform.scale + transform.offsetX,
    y2: originalBox.y2 * transform.scale + transform.offsetY,
  };

  // Reverse: model-space -> page-space (mirrors detectFields()'s
  // un-letterbox step).
  const roundTripped = unletterbox(modelBox, transform);

  // Epsilon rationale: offsetX/offsetY are rounded to whole model-space
  // pixels (drawImage needs integer placement), but the reverse divides by
  // the unrounded scale -- so forward and reverse are not bit-exact
  // inverses. At TARGET_SIZE=1216, the rounding error in offset is at most
  // 0.5px in model space, which after dividing by `scale` (>= ~0.77 for
  // this page) is at most ~0.65px in page space. 1px of page-space
  // tolerance is a safe, generous bound that would catch a real bug (e.g.
  // an axis swap or a missing division) while tolerating the known,
  // harmless sub-pixel rounding mismatch the reviewer flagged.
  const EPSILON_PX = 1;
  assert.ok(Math.abs(roundTripped.x1 - originalBox.x1) < EPSILON_PX, `x1: ${roundTripped.x1} vs ${originalBox.x1}`);
  assert.ok(Math.abs(roundTripped.y1 - originalBox.y1) < EPSILON_PX, `y1: ${roundTripped.y1} vs ${originalBox.y1}`);
  assert.ok(Math.abs(roundTripped.x2 - originalBox.x2) < EPSILON_PX, `x2: ${roundTripped.x2} vs ${originalBox.x2}`);
  assert.ok(Math.abs(roundTripped.y2 - originalBox.y2) < EPSILON_PX, `y2: ${roundTripped.y2} vs ${originalBox.y2}`);
});

test("letterbox transform pads on Y for a landscape (wide) page", () => {
  const srcW = 1600;
  const srcH = 1000;
  const transform = computeLetterboxTransform(srcW, srcH);
  assert.equal(transform.scale, TARGET_SIZE / srcW);
  assert.equal(transform.offsetY > 0, true, "landscape page should be padded on Y");
  assert.equal(transform.offsetX, 0);
});

test("computeLetterboxTransform throws on a zero-dimension canvas", () => {
  assert.throws(() => computeLetterboxTransform(0, 100));
  assert.throws(() => computeLetterboxTransform(100, 0));
});
