"use client";

// Template creation flow (Task 9): upload -> normalize -> (AcroForm | ML
// detect) -> label -> refine in AnchorEditor -> save.
//
// Two things this file is deliberately careful about, per the task brief:
//
// 1. Detection gets its OWN rendered canvas, separate from AnchorEditor's
//    on-screen editing canvas (that one renders at scale 1.4 for display;
//    this one renders at scale 2 purely so formDetect.js has good pixel
//    resolution to work with -- formDetect.js does its own internal
//    1216x1216 letterboxing on whatever canvas it's given, so this file
//    does not need to letterbox anything itself).
// 2. AcroForm PDFs skip ML detection entirely -- exact widget geometry
//    beats a model's guess. That decision is made server-side in
//    /api/templates/normalize (see that route for the extraction logic)
//    and reported back here as `sourceTier`.
import { useState } from "react";
import { useRouter } from "next/navigation";
import AnchorEditor from "../../../components/AnchorEditor";
import { labelForBox } from "../../../lib/formFieldKeys.mjs";

// Vertical tolerance, in percent of page height, for treating two detected
// checkboxes as sitting on the same visual line -- mirrors the tolerance
// formFieldKeys.mjs uses internally for matching a text label to a box.
const LINE_TOLERANCE_PCT = 1.5;

// Render scale for the detection-only canvas. Print-resolution-ish, matching
// the scale used for the ground-truth measurement in task-6-report.md.
const DETECTION_SCALE = 2;

// Groups detected checkboxes that share a line into a `radioGroup`, but only
// when 2+ appear on that line -- a lone checkbox stays type "checkbox" per
// the brief. Mutates nothing; returns a new array.
function groupCheckboxLines(anchors) {
  const result = anchors.map((a) => ({ ...a }));
  const byPage = new Map();
  result.forEach((a, idx) => {
    if (a.type !== "checkbox") return;
    const list = byPage.get(a.page) || [];
    list.push(idx);
    byPage.set(a.page, list);
  });

  for (const [page, indices] of byPage) {
    const sorted = [...indices].sort((a, b) => result[a].yPct - result[b].yPct);
    let cluster = [];
    let clusterY = null;
    let lineIndex = 0;

    const flush = () => {
      if (cluster.length >= 2) {
        const groupName = `checkbox_group_p${page}_${lineIndex}`;
        for (const idx of cluster) {
          result[idx].type = "radio";
          result[idx].radioGroup = groupName;
        }
        lineIndex += 1;
      }
      cluster = [];
      clusterY = null;
    };

    for (const idx of sorted) {
      const y = result[idx].yPct;
      if (clusterY === null || Math.abs(y - clusterY) <= LINE_TOLERANCE_PCT) {
        cluster.push(idx);
        if (clusterY === null) clusterY = y;
      } else {
        flush();
        cluster.push(idx);
        clusterY = y;
      }
    }
    flush();
  }

  return result;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [stage, setStage] = useState("idle"); // idle | normalizing | detecting | ready
  const [pageProgress, setPageProgress] = useState(null); // { current, total }
  const [error, setError] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null); // { pdfUrl, pageCount, strategy, sourceTier }
  const [anchors, setAnchors] = useState(null);

  async function handleFile(file) {
    if (!name.trim()) {
      setError("Enter a template name first.");
      return;
    }
    setError(null);
    setPageProgress(null);
    setStage("normalizing");

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/templates/normalize", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not normalize the PDF.");

      const { pdfUrl, pageCount, strategy, sourceTier, acroFields } = data;
      setPdfInfo({ pdfUrl, pageCount, strategy, sourceTier });

      if (sourceTier === "acroform") {
        setAnchors(
          (acroFields || []).map((f) => ({
            ...f,
            required: !!f.required,
            radioGroup: f.radioGroup || "",
            signerRole: f.signerRole || "",
          }))
        );
        setStage("ready");
        return;
      }

      // No AcroForm fields -- run client-side ML detection page by page.
      setStage("detecting");
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      // pdfjs-dist 6.x's getDocument() reads `src.url` directly, same
      // gotcha AnchorEditor.jsx documents -- must pass { url: pdfUrl }.
      const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
      const { detectFields } = await import("../../../lib/formDetect.js");

      const derivedAnchors = [];
      let fieldCounter = 0;

      for (let i = 1; i <= doc.numPages; i++) {
        setPageProgress({ current: i, total: doc.numPages });
        const page = await doc.getPage(i);

        // Separate detection-only render, per the brief's warning: this is
        // NOT AnchorEditor's scale:1.4 editing canvas.
        const viewport = page.getViewport({ scale: DETECTION_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const boxes = await detectFields(canvas, i - 1);

        // Convert this page's text layer into the same percentage
        // coordinate space as the boxes (top-left origin), by mapping each
        // item's PDF-space transform through the SAME viewport used to
        // render the canvas above -- so both are consistent regardless of
        // page rotation or the scale chosen.
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item) => {
          const [x0, y0] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          const [x1, y1] = viewport.convertToViewportPoint(
            item.transform[4] + item.width,
            item.transform[5] + item.height
          );
          const left = Math.min(x0, x1);
          const right = Math.max(x0, x1);
          const top = Math.min(y0, y1);
          return {
            str: item.str,
            xPct: (left / canvas.width) * 100,
            yPct: (top / canvas.height) * 100,
            widthPct: ((right - left) / canvas.width) * 100,
          };
        });

        for (const box of boxes) {
          let label = labelForBox(box, textItems);
          if (!label) {
            fieldCounter += 1;
            label = `Field ${fieldCounter}`;
          }
          derivedAnchors.push({
            type: box.type,
            label,
            page: box.page,
            xPct: box.xPct,
            yPct: box.yPct,
            widthPct: box.widthPct,
            heightPct: box.heightPct,
            confidence: box.confidence,
            required: false,
            radioGroup: "",
            signerRole: "",
          });
        }
      }

      setAnchors(groupCheckboxLines(derivedAnchors));
      setStage("ready");
    } catch (err) {
      setError(err.message);
      setStage("idle");
    }
  }

  async function handleSaveTemplate(finalAnchors) {
    const fields = finalAnchors.map((a, index) => ({
      label: a.label,
      type: a.type,
      page: a.page,
      xPct: a.xPct,
      yPct: a.yPct,
      widthPct: a.widthPct,
      heightPct: a.heightPct,
      required: !!a.required,
      radioGroup: a.radioGroup || undefined,
      signerRole: a.signerRole || undefined,
      confidence: typeof a.confidence === "number" ? a.confidence : undefined,
      order: index,
    }));

    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        pdfUrl: pdfInfo.pdfUrl,
        pageCount: pdfInfo.pageCount,
        sourceTier: pdfInfo.sourceTier,
        fields,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save the template.");
      return;
    }
    router.push("/templates");
  }

  const busy = stage === "normalizing" || stage === "detecting";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px" }}>
      <h1 style={{ marginBottom: 4 }}>New template</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        Upload a PDF form. Fields with real AcroForm widgets are used directly; everything else is detected automatically.
      </p>

      {stage !== "ready" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Template name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </label>

          <label
            className="marketing-cta-button"
            style={{
              display: "inline-block",
              width: "fit-content",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Processing…" : "Choose PDF"}
            <input
              type="file"
              accept="application/pdf"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleFile(file);
              }}
              style={{ display: "none" }}
            />
          </label>

          {busy && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {stage === "normalizing" && "Normalizing the PDF…"}
              {stage === "detecting" && (
                <>
                  Downloading the field-detection model and scanning pages
                  {pageProgress ? ` — page ${pageProgress.current} of ${pageProgress.total}…` : "…"}
                </>
              )}
            </div>
          )}

          {error && (
            <div style={{ color: "oklch(45% 0.18 25)", fontSize: 13 }}>⚠️ {error}</div>
          )}
        </div>
      )}

      {stage === "ready" && pdfInfo && anchors && (
        <>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
            {pdfInfo.pageCount} page{pdfInfo.pageCount === 1 ? "" : "s"} · source: {pdfInfo.sourceTier} · normalization: {pdfInfo.strategy}
          </p>
          {error && (
            <div style={{ color: "oklch(45% 0.18 25)", fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>
          )}
          <AnchorEditor
            fileUrl={pdfInfo.pdfUrl}
            pageCount={pdfInfo.pageCount}
            anchors={anchors}
            onSave={handleSaveTemplate}
            onCancel={() => router.push("/templates")}
          />
        </>
      )}
    </div>
  );
}
