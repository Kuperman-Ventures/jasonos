"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  nudgeSubject,
  nudgeSummary,
  personWillReceive,
  recipientStatus,
  sendButtonLabel,
  type NudgeCatalog,
  type NudgeScheduleChoice,
  type NudgeTodoItem,
} from "@/lib/nudge";

type BlurbTarget = { id: string; title: string; context: string };

export function NudgePanel({ onBack }: { onBack: () => void }) {
  const [catalog, setCatalog] = useState<NudgeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [peopleOn, setPeopleOn] = useState<Record<string, boolean>>({});
  const [stageOn, setStageOn] = useState<Record<string, boolean>>({});
  const [todoOn, setTodoOn] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [active, setActive] = useState("");
  const [when, setWhen] = useState<NudgeScheduleChoice>("now");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [blurbs, setBlurbs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<BlurbTarget | null>(null);
  const [draft, setDraft] = useState("");
  const requested = useRef(new Set<string>());

  const touch = useCallback(() => {
    setSent(false);
    setSendError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/nudge");
        const body = (await response.json()) as NudgeCatalog & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load reminders");
        if (cancelled) return;
        setCatalog(body);
        setPeopleOn(Object.fromEntries(body.people.map((person) => [person.id, person.defaultOn])));
        setStageOn(Object.fromEntries(body.stages.map((stage) => [stage.id, stage.defaultOn])));
        setTodoOn(Object.fromEntries(body.todos.map((todo) => [todo.id, todo.defaultOn])));
        setNote(body.noteDefault);
        setActive(body.people.find((person) => person.defaultOn)?.id ?? body.people[0]?.id ?? "");
        const seeded: Record<string, string> = {};
        for (const stage of body.stages) if (stage.blurb) seeded[stage.id] = stage.blurb;
        for (const todo of body.todos) if (todo.blurb) seeded[todo.id] = todo.blurb;
        setBlurbs(seeded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load reminders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stages = catalog?.stages ?? [];
  const todos = catalog?.todos ?? [];
  const people = catalog?.people ?? [];
  const selectedStages = stages.filter((stage) => stageOn[stage.id]);
  const selectedPeople = people.filter((person) => peopleOn[person.id]);

  function todosFor(ownerId: string): NudgeTodoItem[] {
    return todos.filter((todo) => todo.ownerId === ownerId && todoOn[todo.id]);
  }

  const receiving = selectedPeople.filter((person) =>
    personWillReceive(true, selectedStages.length, todosFor(person.id).length),
  );
  const sentTodoCount = todos.filter((todo) => todoOn[todo.id] && peopleOn[todo.ownerId]).length;
  const uniqueSentTodos = new Set(
    todos.filter((todo) => todoOn[todo.id] && peopleOn[todo.ownerId]).map((todo) => `${todo.ownerId}:${todo.id}`),
  ).size;
  const canSend = receiving.length > 0 && (selectedStages.length > 0 || uniqueSentTodos > 0);

  const previewId = peopleOn[active] ? active : (receiving[0]?.id ?? selectedPeople[0]?.id ?? "");
  const previewPerson = people.find((person) => person.id === previewId) ?? null;
  const previewTodos = previewPerson ? todosFor(previewPerson.id) : [];
  const previewReady = Boolean(previewPerson) && (selectedStages.length > 0 || previewTodos.length > 0);

  const blurbText = useCallback(
    (item: { id: string; blurb?: string }) => blurbs[item.id] ?? item.blurb ?? "",
    [blurbs],
  );

  const blurbQueueKey = [
    ...selectedStages.map((stage) => stage.id),
    ...previewTodos.map((todo) => todo.id),
  ]
    .filter((id) => !blurbs[id])
    .join("|");

  useEffect(() => {
    if (!blurbQueueKey) return;
    const missing: BlurbTarget[] = [
      ...selectedStages.map((stage) => ({ id: stage.id, title: stage.title, context: stage.sub })),
      ...previewTodos.map((todo) => ({ id: todo.id, title: todo.title, context: todo.dueLabel })),
    ].filter((item) => !blurbText(item) && !requested.current.has(item.id));
    for (const item of missing) {
      requested.current.add(item.id);
      void fetch("/api/admin/nudge/blurb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, title: item.title, context: item.context }),
      })
        .then((response) => response.json())
        .then((body: { blurb?: string }) => {
          if (body.blurb) setBlurbs((current) => ({ ...current, [item.id]: body.blurb! }));
        })
        .catch(() => {
          requested.current.delete(item.id);
        });
    }
    // The queue key lists every visible item that still needs a line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blurbQueueKey]);

  async function saveBlurb(target: BlurbTarget, value: string) {
    setBlurbs((current) => ({ ...current, [target.id]: value }));
    setEditing(null);
    touch();
    await fetch("/api/admin/nudge/blurb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, blurb: value }),
    });
  }

  function togglePerson(id: string) {
    touch();
    const nextOn = !peopleOn[id];
    setPeopleOn((current) => ({ ...current, [id]: nextOn }));
    if (!nextOn && active === id) {
      const fallback = people.find((person) => person.id !== id && peopleOn[person.id]);
      if (fallback) setActive(fallback.id);
    }
  }

  async function send() {
    if (!canSend || sending) return;
    setSending(true);
    setSendError("");
    try {
      const response = await fetch("/api/admin/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedPeople.map((person) => person.id),
          stageIds: selectedStages.map((stage) => stage.id),
          todoIds: [...new Set(todos.filter((todo) => todoOn[todo.id]).map((todo) => todo.id))],
          note,
          choice: when,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error || "Could not send");
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  const groups = people
    .map((person) => ({
      person,
      rows: todos.filter((todo) => todo.ownerId === person.id),
    }))
    .filter((group) => group.rows.length > 0);

  const stageCountLabel = `${selectedStages.length} OF ${stages.length} SELECTED`;

  return (
    <section className="nudge">
      <header className="nudge-head">
        <div className="nudge-kicker">Admin · Reminders</div>
        <h2>Send a nudge</h2>
        <p>
          Pick who gets it, then tick the timeline stages and to-dos that matter this week. Anything
          unticked stays out of the email.
        </p>
        <button type="button" className="nudge-back" onClick={onBack}>
          Back to admin
        </button>
      </header>

      {loading ? <p className="todo-empty">Loading reminders…</p> : null}
      {error ? <p className="ingest-error">{error}</p> : null}

      {catalog ? (
        <div className="nudge-grid">
          <div className="nudge-builder">
            <section className="nudge-block">
              <div className="nudge-label">1 · Send to</div>
              <div className="nudge-pills">
                {people.map((person) => {
                  const on = Boolean(peopleOn[person.id]);
                  const count = todosFor(person.id).length;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      className={on ? "nudge-person is-on" : "nudge-person"}
                      aria-pressed={on}
                      onClick={() => togglePerson(person.id)}
                    >
                      <Avatar person={person} dim={!on} />
                      <span>
                        <span className="nudge-person-name">{person.name}</span>
                        <span className="nudge-person-status">{recipientStatus(on, count)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="nudge-block">
              <div className="nudge-label-row">
                <div className="nudge-label">2 · On the timeline</div>
                <span className="nudge-count">{stageCountLabel}</span>
              </div>
              <div>
                {stages.map((stage) => (
                  <SelectRow
                    key={stage.id}
                    on={Boolean(stageOn[stage.id])}
                    title={stage.title}
                    sub={stage.sub}
                    aside={stage.flag}
                    asideHot={stage.hot}
                    onToggle={() => {
                      touch();
                      setStageOn((current) => ({ ...current, [stage.id]: !current[stage.id] }));
                    }}
                  />
                ))}
                {!stages.length ? <p className="nudge-empty">Nothing current on the timeline.</p> : null}
              </div>
            </section>

            <section className="nudge-block">
              <div className="nudge-label-row">
                <div className="nudge-label">3 · To-dos</div>
                <button
                  type="button"
                  className="nudge-helper"
                  onClick={() => {
                    touch();
                    setTodoOn(
                      Object.fromEntries(
                        todos.map((todo) => [todo.id, todo.daysUntil != null && todo.daysUntil <= 7]),
                      ),
                    );
                  }}
                >
                  Select overdue &amp; due this week
                </button>
                <button
                  type="button"
                  className="nudge-helper"
                  onClick={() => {
                    touch();
                    setTodoOn({});
                  }}
                >
                  Clear
                </button>
              </div>
              {groups.map((group) => {
                const off = !peopleOn[group.person.id];
                const selected = group.rows.filter((row) => todoOn[row.id]).length;
                return (
                  <div key={group.person.id} className={off ? "nudge-group is-off" : "nudge-group"}>
                    <div className="nudge-group-head">
                      <Avatar person={group.person} />
                      <span className="nudge-group-name">{group.person.name}</span>
                      <span className="nudge-count">
                        {off ? "NOT RECEIVING" : `${selected} OF ${group.rows.length} SELECTED`}
                      </span>
                    </div>
                    {group.rows.map((row) => (
                      <SelectRow
                        key={`${group.person.id}:${row.id}`}
                        on={Boolean(todoOn[row.id])}
                        title={row.title}
                        sub={row.dueLabel}
                        aside={row.dateLabel}
                        asideTone={row.tone}
                        onToggle={() => {
                          touch();
                          setTodoOn((current) => ({ ...current, [row.id]: !current[row.id] }));
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </section>

            <section className="nudge-block">
              <div className="nudge-label">
                4 · Personal note <span className="nudge-optional">(optional)</span>
              </div>
              <textarea
                className="nudge-note"
                rows={3}
                value={note}
                onChange={(event) => {
                  touch();
                  setNote(event.target.value);
                }}
              />
            </section>
          </div>

          <aside className="nudge-preview">
            <div className="nudge-preview-bar">
              <div className="nudge-label">Preview</div>
              {selectedPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={person.id === previewId ? "nudge-tab is-on" : "nudge-tab"}
                  aria-pressed={person.id === previewId}
                  onClick={() => setActive(person.id)}
                >
                  {person.name}
                </button>
              ))}
            </div>
            <div className="nudge-mail">
              <div className="nudge-mail-head">
                <span>To: {previewPerson?.name ?? "—"}</span>
                <strong>
                  {previewPerson
                    ? nudgeSubject(previewTodos.length, selectedStages.length)
                    : "This week"}
                </strong>
              </div>
              {previewReady && previewPerson ? (
                <div className="nudge-mail-body">
                  <p>Hi {previewPerson.firstName},</p>
                  {note.trim() ? <p className="nudge-mail-note">{note}</p> : null}
                  {selectedStages.length ? (
                    <PreviewList
                      kicker="On the timeline"
                      rows={selectedStages.map((stage) => ({
                        id: stage.id,
                        title: stage.title,
                        sub: stage.sub,
                        blurb: blurbText(stage),
                        context: stage.sub,
                      }))}
                      editing={editing}
                      draft={draft}
                      onDraft={setDraft}
                      onEdit={(row) => {
                        setEditing(row);
                        setDraft(blurbText(row));
                      }}
                      onSave={(row) => void saveBlurb(row, draft)}
                    />
                  ) : null}
                  {previewTodos.length ? (
                    <PreviewList
                      kicker="Your to-dos"
                      rows={previewTodos.map((todo) => ({
                        id: todo.id,
                        title: todo.title,
                        sub: todo.dueLabel,
                        date: todo.dateLabel,
                        tone: todo.tone,
                        blurb: blurbText(todo),
                        context: todo.dueLabel,
                      }))}
                      editing={editing}
                      draft={draft}
                      onDraft={setDraft}
                      onEdit={(row) => {
                        setEditing(row);
                        setDraft(blurbText(row));
                      }}
                      onSave={(row) => void saveBlurb(row, draft)}
                    />
                  ) : null}
                  <div>
                    <span className="nudge-cta">Open the tracker</span>
                  </div>
                </div>
              ) : (
                <p className="nudge-mail-empty">Pick at least one recipient and one item to see the email.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      <div className="nudge-bar">
        <div className="nudge-bar-inner">
          <span className="nudge-summary">
            {nudgeSummary(receiving.length, selectedStages.length, sentTodoCount)}
          </span>
          <div className="nudge-whens">
            {(
              [
                ["now", "Send now"],
                ["fri", "Friday 8 am"],
                ["weekly", "Every Friday"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={when === id ? "nudge-when is-on" : "nudge-when"}
                aria-pressed={when === id}
                onClick={() => {
                  touch();
                  setWhen(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={sent ? "nudge-send is-sent" : "nudge-send"}
            disabled={!canSend || sending}
            onClick={() => void send()}
          >
            {sending ? "Sending…" : sendButtonLabel(when, sent)}
          </button>
          {sendError ? <span className="nudge-send-error">{sendError}</span> : null}
        </div>
      </div>
    </section>
  );
}

function Avatar({
  person,
  dim = false,
}: {
  person: { name: string; initials: string; avatarUrl: string | null };
  dim?: boolean;
}) {
  return (
    <span className={dim ? "nudge-avatar is-dim" : "nudge-avatar"} aria-hidden="true">
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" />
      ) : (
        person.initials
      )}
    </span>
  );
}

function SelectRow({
  on,
  title,
  sub,
  aside,
  asideHot = false,
  asideTone,
  onToggle,
}: {
  on: boolean;
  title: string;
  sub: string;
  aside: string;
  asideHot?: boolean;
  asideTone?: "overdue" | "soon" | "later";
  onToggle: () => void;
}) {
  const asideClass = asideTone ? `nudge-aside tone-${asideTone}` : asideHot ? "nudge-flag is-hot" : "nudge-flag";
  return (
    <button type="button" className={on ? "nudge-row is-on" : "nudge-row"} aria-pressed={on} onClick={onToggle}>
      <span className={on ? "nudge-box is-on" : "nudge-box"}>{on ? "✓" : ""}</span>
      <span className="nudge-row-copy">
        <span className="nudge-title">{title}</span>
        <span className="nudge-sub">{sub}</span>
      </span>
      <span className={asideClass}>{aside}</span>
    </button>
  );
}

function PreviewList({
  kicker,
  rows,
  editing,
  draft,
  onDraft,
  onEdit,
  onSave,
}: {
  kicker: string;
  rows: {
    id: string;
    title: string;
    sub: string;
    blurb: string;
    context: string;
    date?: string;
    tone?: "overdue" | "soon" | "later";
  }[];
  editing: BlurbTarget | null;
  draft: string;
  onDraft: (value: string) => void;
  onEdit: (row: BlurbTarget & { blurb: string }) => void;
  onSave: (row: BlurbTarget) => void;
}) {
  return (
    <div className="nudge-preview-list">
      <div className="nudge-mail-kicker">{kicker}</div>
      {rows.map((row) => {
        const open = editing?.id === row.id;
        return (
          <div key={`${kicker}:${row.id}`} className="nudge-preview-item">
            <div className="nudge-preview-title">
              <span>{row.title}</span>
              {row.date && row.date !== "—" ? (
                <span className={row.tone ? `nudge-aside tone-${row.tone}` : "nudge-aside"}>{row.date}</span>
              ) : null}
            </div>
            <span className="nudge-sub">{row.sub}</span>
            {open ? (
              <textarea
                className="nudge-blurb-edit"
                rows={3}
                value={draft}
                autoFocus
                aria-label={`Explanation for ${row.title}`}
                onChange={(event) => onDraft(event.target.value)}
                onBlur={() => onSave({ id: row.id, title: row.title, context: row.context })}
              />
            ) : (
              <button
                type="button"
                className="nudge-blurb"
                onClick={() => onEdit({ id: row.id, title: row.title, context: row.context, blurb: row.blurb })}
              >
                {row.blurb || "Writing a line…"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
