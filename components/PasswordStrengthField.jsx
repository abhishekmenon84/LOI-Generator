"use client";

import { scorePasswordStrength } from "../lib/passwordPolicy";

const BAR_COLORS = ["oklch(85% 0.01 60)", "oklch(60% 0.19 25)", "oklch(70% 0.16 75)", "oklch(60% 0.14 145)", "oklch(52% 0.14 155)"];

// A labeled password input + 4-segment strength bar, sharing its scoring
// logic with the server (lib/passwordPolicy.js) so the bar never disagrees
// with what the API will actually accept.
export default function PasswordStrengthField({ value, onChange, id = "password", label = "Password", autoComplete = "new-password" }) {
  const { score, label: strengthLabel } = scorePasswordStrength(value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
      />
      {value && (
        <>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: 2,
                  background: i < score ? BAR_COLORS[score] : "var(--border)",
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{strengthLabel}</span>
        </>
      )}
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        At least 8 characters, with at least one letter and one number.
      </span>
    </div>
  );
}
