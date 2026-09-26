"use client";

import { clampScore, weightedTotal } from "@/lib/scores";
import type { Criterion, Firm, Scores } from "@/lib/types";

export function ConsultantsTab({
  firms,
  criteria,
  questions,
  scores,
  onScore,
  dateline,
}: {
  firms: Firm[];
  criteria: Criterion[];
  questions: string[];
  scores: Scores;
  onScore: (firmId: string, criterionId: string, value: number) => void;
  dateline: string;
}) {
  const totals = firms.map((firm) => ({ id: firm.id, total: weightedTotal(scores[firm.id], criteria) }));
  const max = Math.max(...totals.map((item) => item.total));
  const leaderId = totals.filter((item) => item.total === max).length === 1 ? totals.find((item) => item.total === max)?.id : null;

  return (
    <section>
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Consultant Evaluation</h2>
        </div>
        <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
          Save as PDF
        </button>
      </header>
      <p className="section-sub">
        Firms you&apos;re considering, scored against one rubric. Scores below are a first-pass read from each
        firm&apos;s own website and public listings only — nobody has been called yet. Treat every number as a
        starting point to argue with, not a verdict.
      </p>
      <div className="firm-grid">
        {firms.map((firm) => {
          const total = weightedTotal(scores[firm.id], criteria);
          return (
            <div key={firm.id} className="firm-card">
              <h3>{firm.name}</h3>
              <a href={firm.url} target="_blank" rel="noopener noreferrer">
                {firm.url.replace("https://", "")}
              </a>
              <div className="firm-fact">
                <b>Location: </b>
                {firm.location}
              </div>
              <div className="firm-fact">
                <b>Who: </b>
                {firm.people}
              </div>
              <div className="firm-fact">
                <b>Pricing: </b>
                {firm.pricing}
              </div>
              <div className="firm-fact">
                <b>Model: </b>
                {firm.model}
              </div>
              <div className="firm-score">
                <span className="label">Weighted Score</span>
                <span className={firm.id === leaderId ? "val accent" : "val"}>{total.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="table-wrap">
        <table className="rubric">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Criterion</th>
              <th>Weight</th>
              {firms.map((firm) => (
                <th key={firm.id}>{firm.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion.id}>
                <td className="crit">
                  <div className="name">{criterion.name}</div>
                  <div className="desc">{criterion.desc}</div>
                </td>
                <td className="weight mono">{Math.round(criterion.weight * 100)}%</td>
                {firms.map((firm) => (
                  <td key={firm.id} className="score">
                    <input
                      className="score-in"
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={scores[firm.id]?.[criterion.id] ?? 1}
                      aria-label={`${firm.name} ${criterion.name}`}
                      onChange={(event) => onScore(firm.id, criterion.id, clampScore(Number(event.target.value)))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total">
              <td>Weighted Total</td>
              <td className="mono">100%</td>
              {firms.map((firm) => (
                <td key={firm.id} className={firm.id === leaderId ? "score accent" : "score"}>
                  {weightedTotal(scores[firm.id], criteria).toFixed(2)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="rubric-note">
        Scoring: 1 (weak) to 5 (strong) on each criterion, weighted and totaled out of 5. Edit any score after a call
        or a reference check — the sheet recalculates and saves automatically.
      </p>
      <div className="callprep">
        <h3>Questions To Ask Before Signing With Anyone</h3>
        <ol>
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
