"use client";

import type { ResearchFindings as Findings } from "@/lib/post-master/types";

type ResearchFindingsProps = {
  findings: Findings;
  onBack: () => void;
  onContinue: () => void;
};

function SourceList({
  sources,
}: {
  sources: { title: string | null; url: string }[];
}) {
  if (sources.length === 0) return null;
  return (
    <ul className="pm-source-list">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.title || s.url}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ResearchFindingsPanel({
  findings,
  onBack,
  onContinue,
}: ResearchFindingsProps) {
  return (
    <section className="pm-panel">
      <h2 className="pm-section-title">Research findings</h2>
      <p className="pm-section-sub">
        Review what turned up before you commit to hooks. This brief becomes the
        “idea” input for the rest of the flow.
      </p>

      <div className="pm-research-meta">
        <div>
          <span className="pm-label">Topic</span>
          <p className="pm-research-meta-value">{findings.topic}</p>
        </div>
        {findings.guidance ? (
          <div>
            <span className="pm-label">Guidance</span>
            <p className="pm-research-meta-value">{findings.guidance}</p>
          </div>
        ) : null}
        {!findings.searched ? (
          <p className="pm-error" style={{ marginTop: 0 }}>
            Warning: no web sources were attached. Treat findings cautiously.
          </p>
        ) : null}
      </div>

      <div className="pm-research-grid">
        <div className="pm-research-block">
          <h3 className="pm-research-heading">Whitespace / under-discussed</h3>
          {findings.whitespace.length === 0 ? (
            <p className="pm-muted-copy">None found.</p>
          ) : (
            findings.whitespace.map((item) => (
              <article key={item.title} className="pm-research-card">
                <h4>{item.title}</h4>
                <p>{item.summary}</p>
                <SourceList sources={item.sources} />
              </article>
            ))
          )}
        </div>

        <div className="pm-research-block">
          <h3 className="pm-research-heading">Contradictions</h3>
          {findings.contradictions.length === 0 ? (
            <p className="pm-muted-copy">None found.</p>
          ) : (
            findings.contradictions.map((item) => (
              <article key={item.topic} className="pm-research-card">
                <h4>{item.topic}</h4>
                <p>
                  <span className="pm-mono pm-side-label">A</span> {item.sideA}
                </p>
                <p>
                  <span className="pm-mono pm-side-label">B</span> {item.sideB}
                </p>
                <SourceList sources={item.sources} />
              </article>
            ))
          )}
        </div>
      </div>

      {findings.sources.length > 0 ? (
        <div className="pm-research-block" style={{ marginTop: "1.25rem" }}>
          <h3 className="pm-research-heading">All sources</h3>
          <SourceList sources={findings.sources} />
        </div>
      ) : null}

      <div className="pm-actions">
        <button type="button" className="pm-btn pm-btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="pm-btn" onClick={onContinue}>
          Continue to voice dials
        </button>
      </div>
    </section>
  );
}
