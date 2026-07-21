"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../../components/Navbar";
import LeaseForm from "../../../components/LeaseForm";
import LeasePreview from "../../../components/LeasePreview";
import { DEFAULT_LEASE_DATA, buildLeaseModel } from "../../../lib/leaseEngine";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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

function LeasePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dealId = searchParams.get("deal");

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [exportState, setExportState] = useState({
    loading: false,
    format: null,
    error: null,
    success: null,
  });
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!dealId) {
      router.replace("/dashboard");
      return;
    }
    let cancelled = false;
    fetch(`/api/deals/${dealId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Deal not found.");
        return res.json();
      })
      .then((deal) => {
        if (cancelled) return;
        if (deal.documentType && deal.documentType !== "commercial_lease_loi") {
          router.replace(`/app?deal=${dealId}`);
          return;
        }
        setData({
          ...DEFAULT_LEASE_DATA,
          currentDate: todayLabel(),
          ...deal.formData,
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, router]);

  const model = useMemo(() => (data ? buildLeaseModel(data) : null), [data]);

  useEffect(() => {
    if (!data || !dealId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      }).catch(() => {
        // Best-effort autosave; export still saves synchronously before download.
      });
    }, 1000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [data, dealId]);

  function handleResetDeal() {
    if (!window.confirm("Reset this deal to a blank form? This can't be undone.")) return;
    setData({
      ...DEFAULT_LEASE_DATA,
      currentDate: todayLabel(),
    });
  }

  async function handleExport(format) {
    setExportState({ loading: true, format, error: null, success: null });
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      });
      const res = await fetch(`/api/export/lease/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Export failed.");
      }
      const blob = await res.blob();
      const filename = format === "pdf" ? "Letter_of_Intent_to_Lease.pdf" : "Letter_of_Intent_to_Lease.docx";
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

  if (loadError) {
    return (
      <>
        <Navbar />
        <div className="dashboard-layout">
          <div className="form-panel">
            <div className="status-banner status-error" role="alert">⚠️ {loadError}</div>
            <a className="marketing-cta-button" href="/dashboard">Back to Dashboard</a>
          </div>
        </div>
      </>
    );
  }

  if (!data || !model) {
    return (
      <>
        <Navbar />
        <div className="dashboard-layout">
          <div className="form-panel">Loading…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dashboard-layout">
        <LeaseForm
          data={data}
          onChange={setData}
          onExport={handleExport}
          onClearDraft={handleResetDeal}
          exportState={exportState}
        />
        <LeasePreview model={model} />
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <div className="dashboard-layout">
            <div className="form-panel">Loading…</div>
          </div>
        </>
      }
    >
      <LeasePageInner />
    </Suspense>
  );
}
