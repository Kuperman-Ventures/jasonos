"use client";

import { useEffect, useId, useState } from "react";
import {
  FEEDBACK_KINDS,
  feedbackKindLabel,
  feedbackStatusLabel,
  formatFeedbackWhen,
  type FeedbackKind,
  type SiteFeedback,
} from "@/lib/site-feedback";

export type FeedbackPageContext = {
  tab: string;
  schoolId?: string | null;
  schoolName?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  page: FeedbackPageContext;
};

export function FeedbackDialog({ open, onClose, page }: Props) {
  const titleId = useId();
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<SiteFeedback[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setNotice("");
    setLoadingMine(true);
    void fetch("/api/feedback")
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          items?: SiteFeedback[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Could not load feedback");
        setItems(body.items ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load feedback");
      })
      .finally(() => setLoadingMine(false));
  }, [open]);

  if (!open) return null;

  const contextBits = [
    page.tab ? `Tab: ${page.tab}` : null,
    page.schoolName ? `School: ${page.schoolName}` : null,
  ].filter(Boolean);

  async function submit() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          body: message,
          pageTab: page.tab,
          schoolId: page.schoolId ?? null,
          schoolName: page.schoolName ?? null,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        item?: SiteFeedback;
        error?: string;
      };
      if (!response.ok || !body.item) {
        throw new Error(body.error || "Could not send feedback");
      }
      setItems((current) => [body.item!, ...current].slice(0, 20));
      setMessage("");
      setKind("idea");
      setNotice("Sent. Jason will see it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="tl-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="tl-dialog feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tl-dlg-head">
          <div>
            <div className="tl-kicker mono">Household</div>
            <h2 id={titleId}>Feedback</h2>
            <p className="section-sub">
              Bugs, ideas, or questions about this site. Jason reviews them on Admin.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <fieldset className="feedback-kind" aria-label="Kind">
          <legend className="label">Kind</legend>
          <div className="rail-seg" role="group">
            {FEEDBACK_KINDS.map((row) => (
              <button
                key={row}
                type="button"
                aria-pressed={kind === row}
                onClick={() => setKind(row)}
              >
                {feedbackKindLabel(row)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="stack-field">
          <span className="label">Message</span>
          <textarea
            className="field feedback-message"
            rows={4}
            value={message}
            maxLength={2000}
            placeholder="What should change, or what broke?"
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>

        {contextBits.length ? (
          <p className="feedback-context muted mono">{contextBits.join(" · ")}</p>
        ) : null}

        <div className="feedback-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !message.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>

        {notice ? <p className="login-message">{notice}</p> : null}
        {error ? <p className="ingest-error">{error}</p> : null}

        <section className="feedback-mine" aria-labelledby="feedback-mine-h">
          <h3 id="feedback-mine-h">Your recent</h3>
          {loadingMine ? <p className="section-sub">Loading…</p> : null}
          {!loadingMine && items.length === 0 ? (
            <p className="section-sub">Nothing sent yet.</p>
          ) : null}
          {items.length ? (
            <ul className="feedback-list">
              {items.map((item) => (
                <li key={item.id}>
                  <div className="feedback-list-meta">
                    <span className="feedback-pill">{feedbackKindLabel(item.kind)}</span>
                    <span className={`feedback-status status-${item.status}`}>
                      {feedbackStatusLabel(item.status)}
                    </span>
                    <span className="muted mono">{formatFeedbackWhen(item.createdAt)}</span>
                  </div>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
