"use client";

/**
 * SectionCard — glassmorphism card wrapper for form sections.
 *
 * Props:
 *   icon        — emoji or SVG string
 *   title       — section heading text
 *   accent      — data-accent CSS variant key (dates|type|owners|re|biz|risk)
 *   stepNum     — step number badge shown top-right
 *   children    — form content
 */
export default function SectionCard({ icon, title, accent, stepNum, children }) {
  return (
    <div className="section-card" data-accent={accent}>
      <div className="section-card-header">
        <div
          className="section-card-icon"
          style={{ background: accentBg(accent) }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <span className="section-card-title">{title}</span>
        {stepNum && (
          <span className="section-card-num" aria-label={`Section ${stepNum}`}>
            §{stepNum}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function accentBg(accent) {
  const map = {
    dates:  'rgba(99,102,241,0.15)',
    type:   'rgba(167,139,250,0.15)',
    owners: 'rgba(96,165,250,0.15)',
    re:     'rgba(52,211,153,0.15)',
    biz:    'rgba(251,191,36,0.15)',
    risk:   'rgba(248,113,113,0.15)',
  };
  return map[accent] || 'rgba(255,255,255,0.06)';
}
