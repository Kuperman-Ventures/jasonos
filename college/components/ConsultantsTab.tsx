"use client";

import { useState } from "react";
import { createConsultant, SUPPORT_CHOICES, supportLabel } from "@/lib/consultants";
import { clampScore, weightedTotal } from "@/lib/scores";
import type { ConsultantSupport, Criterion, Firm, Scores } from "@/lib/types";

export function ConsultantsTab({
  firms,
  criteria,
  questions,
  scores,
  onScore,
  onFirms,
  dateline,
}: {
  firms: Firm[];
  criteria: Criterion[];
  questions: string[];
  scores: Scores;
  onScore: (firmId: string, criterionId: string, value: number) => void;
  onFirms: (firms: Firm[]) => void;
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
      <AddConsultant
        onAdd={(firm) => {
          onFirms([...firms, firm]);
        }}
        taken={firms.map((firm) => firm.id)}
      />
      <div className="firm-grid">
        {firms.map((firm) => {
          const total = weightedTotal(scores[firm.id], criteria);
          return (
            <div key={firm.id} className="firm-card">
              <h3>{firm.name}</h3>
              <span className={`firm-support is-${firm.support || "unset"}`}>{supportLabel(firm.support)}</span>
              {firm.url ? (
                <a href={firm.url} target="_blank" rel="noopener noreferrer">
                  {firm.url.replace("https://", "")}
                </a>
              ) : null}
              <label className="firm-field">
                Price
                <input
                  value={firm.price}
                  aria-label={`${firm.name} price`}
                  onChange={(event) =>
                    onFirms(firms.map((row) => (row.id === firm.id ? { ...row, price: event.target.value } : row)))
                  }
                />
              </label>
              <label className="firm-field">
                Support
                <select
                  value={firm.support}
                  aria-label={`${firm.name} support`}
                  onChange={(event) => {
                    const support = event.target.value as ConsultantSupport | "";
                    onFirms(firms.map((row) => (row.id === firm.id ? { ...row, support } : row)));
                  }}
                >
                  <option value="">Choose support</option>
                  {SUPPORT_CHOICES.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              {firm.location ? (
                <div className="firm-fact">
                  <b>Location: </b>
                  {firm.location}
                </div>
              ) : null}
              {firm.people ? (
                <div className="firm-fact">
                  <b>Who: </b>
                  {firm.people}
                </div>
              ) : null}
              {firm.pricing && firm.pricing !== firm.price ? (
                <div className="firm-fact">
                  <b>Pricing note: </b>
                  {firm.pricing}
                </div>
              ) : null}
              {firm.model ? (
                <div className="firm-fact">
                  <b>Model: </b>
                  {firm.model}
                </div>
              ) : null}
              <div className="firm-score">
                <span className="label">Weighted Score</span>
                <span className={firm.id === leaderId ? "val accent" : "val"}>{total.toFixed(2)}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost firm-remove"
                onClick={() => onFirms(firms.filter((row) => row.id !== firm.id))}
              >
                Remove
              </button>
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

function AddConsultant({
  taken,
  onAdd,
}: {
  taken: string[];
  onAdd: (firm: Firm) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [support, setSupport] = useState<ConsultantSupport | "">("");

  return (
    <form
      className="firm-add"
      onSubmit={(event) => {
        event.preventDefault();
        const firm = createConsultant({ name, url, location, price, support }, taken);
        if (!firm) return;
        onAdd(firm);
        setName("");
        setUrl("");
        setLocation("");
        setPrice("");
        setSupport("");
      }}
    >
      <h3>Add a consultant</h3>
      <label className="firm-field">
        Name
        <input value={name} aria-label="New consultant name" onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="firm-field">
        Website
        <input value={url} aria-label="New consultant website" onChange={(event) => setUrl(event.target.value)} />
      </label>
      <label className="firm-field">
        Location
        <input value={location} aria-label="New consultant location" onChange={(event) => setLocation(event.target.value)} />
      </label>
      <label className="firm-field">
        Price
        <input value={price} aria-label="New consultant price" onChange={(event) => setPrice(event.target.value)} />
      </label>
      <label className="firm-field">
        Support
        <select
          value={support}
          aria-label="New consultant support"
          onChange={(event) => setSupport(event.target.value as ConsultantSupport | "")}
        >
          <option value="">Choose support</option>
          {SUPPORT_CHOICES.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn-primary">
        Add consultant
      </button>
    </form>
  );
}
