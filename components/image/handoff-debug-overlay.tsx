"use client";

import type { CSSProperties } from "react";

const overlayStyle: CSSProperties = {
  position: "fixed",
  bottom: 12,
  right: 12,
  zIndex: 99999,
  background: "rgba(8, 10, 14, 0.96)",
  color: "#86efac",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 11,
  lineHeight: 1.45,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(74, 222, 128, 0.55)",
  maxWidth: 360,
  boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
  pointerEvents: "none",
};

const titleStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#fbbf24",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  fontSize: 10,
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "118px 1fr",
  gap: "2px 8px",
  margin: 0,
};

const labelStyle: CSSProperties = { color: "rgba(180, 190, 200, 0.85)", margin: 0 };
const valueStyle: CSSProperties = { color: "#e2e8f0", margin: 0, wordBreak: "break-word" };

export function HandoffDebugOverlay({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="handoff-debug-overlay" style={overlayStyle} role="status" aria-live="polite">
      <span style={titleStyle}>{title}</span>
      <dl style={rowStyle}>
        {rows.map(({ label, value }) => (
          <div key={label} style={{ display: "contents" }}>
            <dt style={labelStyle}>{label}</dt>
            <dd style={valueStyle}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
