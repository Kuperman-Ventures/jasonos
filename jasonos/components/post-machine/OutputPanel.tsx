"use client";

import { useState } from "react";

type OutputPanelProps = {
  linkedin: string;
  blog: string;
  onBack: () => void;
  onStartOver: () => void;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function OutputColumn({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const words = countWords(text);
  const chars = text.length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pm-output-col">
      <div className="pm-output-head">
        <h3 className="pm-output-title">{title}</h3>
        <button type="button" className="pm-btn pm-btn-ghost" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="pm-counts">
        {words} words · {chars} chars
      </div>
      <div className="pm-output-body" style={{ marginTop: "0.85rem" }}>
        {text}
      </div>
    </div>
  );
}

export function OutputPanel({
  linkedin,
  blog,
  onBack,
  onStartOver,
}: OutputPanelProps) {
  return (
    <section className="pm-panel">
      <h2 className="pm-section-title">Drafts</h2>
      <p className="pm-section-sub">
        Copy what you want. No save history in v1 — clipboard is the handoff.
      </p>

      <div className="pm-output-grid">
        <OutputColumn title="LinkedIn" text={linkedin} />
        <OutputColumn title="Blog" text={blog} />
      </div>

      <div className="pm-actions">
        <button type="button" className="pm-btn pm-btn-ghost" onClick={onBack}>
          Back to hooks
        </button>
        <button type="button" className="pm-btn" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </section>
  );
}
