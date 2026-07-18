"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "../../components/Navbar";
import LOIForm from "../../components/LOIForm";
import LOIPreview from "../../components/LOIPreview";
import { DEFAULT_FORM_DATA, buildLOIModel } from "../../lib/loiEngine";

const STORAGE_KEY = "loi_form_data_v1";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function loadDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [data, setData] = useState(() => {
    const draft = loadDraft();
    if (draft) return draft;
    return {
      ...DEFAULT_FORM_DATA,
      currentDate: todayLabel(),
    };
  });
  const [exportState, setExportState] = useState({
    loading: false,
    format: null,
    error: null,
    success: null,
  });

  const model = useMemo(() => buildLOIModel(data), [data]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  function handleClearDraft() {
    sessionStorage.removeItem(STORAGE_KEY);
    setData({
      ...DEFAULT_FORM_DATA,
      currentDate: todayLabel(),
    });
  }

  async function handleExport(format) {
    setExportState({ loading: true, format, error: null, success: null });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Export failed.");
      }
      const blob = await res.blob();
      const filename = format === "pdf" ? "Letter_of_Intent.pdf" : "Letter_of_Intent.docx";
      downloadBlob(blob, filename);
      setExportState({
        loading: false,
        format: null,
        error: null,
        success: "Your document has been downloaded.",
      });
    } catch (err) {
      setExportState({ loading: false, format: null, error: err.message, success: null });
    }
  }

  return (
    <>
      <Navbar />
      <div className="dashboard-layout">
        <LOIForm
          data={data}
          onChange={setData}
          onExport={handleExport}
          onClearDraft={handleClearDraft}
          exportState={exportState}
        />
        <LOIPreview model={model} />
      </div>
    </>
  );
}
