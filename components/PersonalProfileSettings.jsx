"use client";

import { useState } from "react";
import SignaturePad from "./SignaturePad";

export default function PersonalProfileSettings({ initialUser }) {
  const [name, setName] = useState(initialUser.name || "");
  const [phone, setPhone] = useState(initialUser.phone || "");
  const [licenseNumber, setLicenseNumber] = useState(initialUser.licenseNumber || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [image, setImage] = useState(initialUser.image || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  const [signatureImageUrl, setSignatureImageUrl] = useState(initialUser.signatureImageUrl || null);
  const [drawingSignature, setDrawingSignature] = useState(!initialUser.signatureImageUrl);
  const [pendingSignatureDataUrl, setPendingSignatureDataUrl] = useState(null);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState(null);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          phone: phone.trim() || null,
          licenseNumber: licenseNumber.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save profile.");
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/users/me/avatar", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not upload profile picture.");
      setImage(data.imageUrl);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const res = await fetch("/api/users/me/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove profile picture.");
      setImage(null);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveSignature() {
    if (!pendingSignatureDataUrl) return;
    setSavingSignature(true);
    setSignatureError(null);
    try {
      const res = await fetch("/api/users/me/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImageDataUrl: pendingSignatureDataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save signature.");
      setSignatureImageUrl(data.signatureImageUrl);
      setDrawingSignature(false);
      setPendingSignatureDataUrl(null);
    } catch (err) {
      setSignatureError(err.message);
    } finally {
      setSavingSignature(false);
    }
  }

  async function handleRemoveSignature() {
    setSavingSignature(true);
    setSignatureError(null);
    try {
      const res = await fetch("/api/users/me/signature", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove signature.");
      setSignatureImageUrl(null);
      setDrawingSignature(true);
    } catch (err) {
      setSignatureError(err.message);
    } finally {
      setSavingSignature(false);
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h2>Profile</h2>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        {image ? (
          <img src={image} alt="Profile" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg-panel)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>
            {(name || initialUser.email || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <label className="marketing-cta-button" style={{ cursor: uploadingAvatar ? "not-allowed" : "pointer", display: "inline-block" }}>
            {uploadingAvatar ? "Uploading…" : "Change picture"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} disabled={uploadingAvatar} style={{ display: "none" }} />
          </label>
          {image && (
            <button type="button" onClick={handleRemoveAvatar} disabled={uploadingAvatar} className="deal-list-item-delete" style={{ marginLeft: 8 }}>
              Remove
            </button>
          )}
        </div>
      </div>
      {avatarError && <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>⚠️ {avatarError}</div>}

      <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420, marginBottom: 24 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Phone</span>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>License number</span>
          <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }} />
        </label>
        {profileError && <div className="status-banner status-error" role="alert">⚠️ {profileError}</div>}
        {profileSaved && <div style={{ color: "oklch(45% 0.14 155)", fontSize: 12.5 }}>Saved.</div>}
        <button type="submit" className="marketing-cta-button" disabled={savingProfile} style={{ width: "fit-content" }}>
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </form>

      <div>
        <h3 style={{ marginBottom: 8 }}>Signature</h3>
        {signatureImageUrl && !drawingSignature ? (
          <div>
            <img src={signatureImageUrl} alt="Saved signature" style={{ height: 80, border: "1px solid var(--border)", borderRadius: 8, background: "#fff", padding: 8, display: "block", marginBottom: 8 }} />
            <button type="button" onClick={() => setDrawingSignature(true)} style={{ background: "none", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", marginRight: 8 }}>
              Draw a new one
            </button>
            <button type="button" onClick={handleRemoveSignature} disabled={savingSignature} className="deal-list-item-delete">
              Remove
            </button>
          </div>
        ) : (
          <div>
            <SignaturePad onChange={setPendingSignatureDataUrl} />
            <button
              type="button"
              onClick={handleSaveSignature}
              disabled={!pendingSignatureDataUrl || savingSignature}
              className="marketing-cta-button"
              style={{ marginTop: 8 }}
            >
              {savingSignature ? "Saving…" : "Save signature"}
            </button>
          </div>
        )}
        {signatureError && <div className="status-banner status-error" role="alert" style={{ marginTop: 8 }}>⚠️ {signatureError}</div>}
      </div>
    </div>
  );
}
