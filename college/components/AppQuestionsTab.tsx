"use client";

import { useMemo, useState } from "react";
import {
  APP_QUESTION_SOURCES,
  WORD_AXIS_MAX,
  appQuestions,
  barLayout,
  formatQuestionNum,
  sourceCounts,
  sourceDotStrength,
  wordPct,
  type AppQuestion,
  type AppQuestionSourceId,
  type QuestionGroupId,
  type WordBar,
} from "@/lib/app-questions";

function barClass(kind: WordBar["kind"]): string {
  if (kind === "accent") return "appq-bar is-accent";
  if (kind === "optional") return "appq-bar is-optional";
  return "appq-bar";
}

function Dot({
  on,
  strength,
}: {
  on: boolean;
  strength: "strong" | "soft";
}) {
  if (!on) return <span className="appq-dot" aria-hidden />;
  return (
    <span
      className={strength === "strong" ? "appq-dot on" : "appq-dot on-soft"}
      aria-hidden
    />
  );
}

function QuestionRow({
  item,
  group,
  open,
  onToggle,
}: {
  item: AppQuestion;
  group: QuestionGroupId;
  open: boolean;
  onToggle: () => void;
}) {
  const strength = sourceDotStrength(group);
  const evidenceLabel =
    group === "core"
      ? "Verified examples of the theme"
      : group === "additional"
        ? "Where it appears"
        : "Evidence and qualification";
  const detailId = `appq-q-${item.n}-detail`;

  return (
    <div className={open ? "appq-q is-open" : "appq-q"}>
      <button
        type="button"
        className="appq-q-row"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="appq-q-num">{formatQuestionNum(item.n)}</span>
        <span className="appq-q-title">{item.question}</span>
        {APP_QUESTION_SOURCES.map((source) => (
          <span key={source.id} className="appq-dot-cell">
            <Dot on={item.sources.includes(source.id)} strength={strength} />
          </span>
        ))}
      </button>
      <div className="appq-q-detail" id={detailId} hidden={!open}>
        <span />
        <div className="appq-q-body">
          <div className="appq-q-ex">
            <span className="appq-label">{evidenceLabel}</span>
            <span>{item.evidence}</span>
          </div>
          {item.preparation ? (
            <div className="appq-q-prep">
              <span className="appq-label is-accent">{appQuestions.questions.preparationLabel}</span>
              <span>{item.preparation}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppQuestionsTab() {
  const data = appQuestions;
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());
  const counts = useMemo(() => sourceCounts([...data.questions.items]), [data.questions.items]);
  const essayFillLeft = wordPct(data.essay.minWords);

  function toggle(n: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  return (
    <div className="appq-page">
      <header className="appq-head">
        <p className="appq-intro">{data.intro}</p>
        <nav className="appq-toc" aria-label="On this page">
          {data.toc.map((item) => (
            <a
              key={`${item.num}-${item.name}`}
              className="appq-toc-item"
              href={`#appq-${item.id}`}
            >
              <span className={item.accent ? "appq-toc-num is-accent" : "appq-toc-num"}>
                {item.num}
              </span>
              <span className="appq-toc-name">{item.name}</span>
              <span className="appq-toc-meta">{item.meta}</span>
            </a>
          ))}
        </nav>
      </header>

      <section id="appq-core" className="appq-section">
        <div className="appq-sec-head">
          <span className="appq-label">{data.core.label}</span>
          <h2>{data.core.title}</h2>
        </div>
        <div className="appq-tiles appq-tiles-core">
          {data.core.tiles.map((tile) => (
            <article key={tile.name} className="appq-tile">
              <div className="appq-tile-top">
                <h3>{tile.name}</h3>
                {tile.tag ? (
                  <span className={tile.accent ? "appq-tag is-accent" : "appq-tag"}>{tile.tag}</span>
                ) : null}
              </div>
              <p>{tile.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="appq-essay" className="appq-section">
        <div className="appq-sec-head">
          <span className="appq-label">{data.essay.label}</span>
          <div className="appq-essay-head">
            <h2>{data.essay.title}</h2>
            <div
              className="appq-range"
              aria-label={`${data.essay.minWords} to ${data.essay.maxWords} words`}
            >
              <div className="appq-range-track">
                <div
                  className="appq-range-fill"
                  style={{ left: `${essayFillLeft}%`, right: 0 }}
                />
              </div>
              <div className="appq-range-scale">
                <span style={{ left: 0 }}>0</span>
                <span
                  className="appq-range-min"
                  style={{ left: `${essayFillLeft}%` }}
                >
                  {data.essay.minWords} min
                </span>
                <span style={{ right: 0 }}>{data.essay.maxWords} max</span>
              </div>
            </div>
          </div>
        </div>
        <ol className="appq-prompts">
          {data.essay.prompts.map((prompt) => (
            <li key={prompt.n} className="appq-prompt">
              <div className="appq-prompt-top">
                <span className="appq-prompt-n">{prompt.n}</span>
                <span className="appq-prompt-label">{prompt.label}</span>
              </div>
              <p>{prompt.text}</p>
            </li>
          ))}
        </ol>
        <p className="appq-note">{data.essay.note}</p>
      </section>

      <section id="appq-other" className="appq-pair">
        <div>
          <span className="appq-label">{data.otherWriting.label}</span>
          {data.otherWriting.entries.map((entry) => {
            const width = wordPct(entry.maxWords);
            return (
              <div key={entry.name} className="appq-entry">
                <div className="appq-entry-top">
                  <h3>{entry.name}</h3>
                  <span className="appq-entry-meta">
                    ≤ {entry.maxWords} words{entry.optional ? " · optional" : ""}
                  </span>
                </div>
                <div className="appq-limit">
                  <div style={{ width: `${width}%` }} />
                </div>
                <p>{entry.description}</p>
              </div>
            );
          })}
        </div>
        <div>
          <span className="appq-label">{data.demographics.label}</span>
          {data.demographics.entries.map((entry) => (
            <div key={entry.name} className="appq-entry">
              <div className="appq-entry-top">
                <h3>{entry.name}</h3>
                <span className={entry.metaAccent ? "appq-entry-meta is-accent" : "appq-entry-meta"}>
                  {entry.meta}
                </span>
              </div>
              <p>{entry.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="appq-schools" className="appq-section appq-section-schools">
        <div className="appq-sec-head">
          <span className="appq-label">{data.schools.label}</span>
          <h2>{data.schools.title}</h2>
          <p className="appq-sec-lede">{data.schools.lede}</p>
        </div>
        <div
          className="appq-ruler"
          role="img"
          aria-label={`Word limits by school on a 0 to ${WORD_AXIS_MAX} word scale`}
        >
          <div className="appq-ruler-axis">
            <span />
            <div className="appq-ticks">
              {data.schools.axisTicks.map((tick) => (
                <span
                  key={tick}
                  style={{
                    left: `${wordPct(tick)}%`,
                    transform: tick === 0 ? undefined : tick === WORD_AXIS_MAX ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >
                  {tick}
                </span>
              ))}
            </div>
          </div>
          {data.schools.ruler.map((row) => (
            <div key={row.name} className="appq-ruler-row">
              <span className={row.strong ? "appq-ruler-school is-strong" : "appq-ruler-school"}>
                {row.name}
              </span>
              <div className="appq-lanes">
                {row.bars.map((bar) => {
                  const layout = barLayout(bar.minWords, bar.maxWords);
                  const labelLeft = layout.labelInside ? layout.leftPct : layout.leftPct + layout.widthPct;
                  return (
                    <div key={bar.label} className="appq-lane">
                      <div
                        className={barClass(bar.kind)}
                        style={{ left: `${layout.leftPct}%`, width: `${layout.widthPct}%` }}
                      />
                      <span
                        className={layout.labelInside ? "appq-bar-label is-inside" : "appq-bar-label"}
                        style={{ left: `${labelLeft}%` }}
                      >
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="appq-ruler-key">
            <span />
            <span>{data.schools.rulerKey}</span>
          </div>
        </div>

        <ul className="appq-formats">
          {data.schools.formats.map((item) => (
            <li key={item.name}>
              <span className="appq-formats-name">{item.name}</span>
              <span className="appq-formats-text">{item.format}</span>
            </li>
          ))}
        </ul>

        <div className="appq-tiles appq-tiles-supps">
          {data.schools.themes.map((theme) => (
            <article key={theme.name} className="appq-tile appq-supp">
              <h3>{theme.name}</h3>
              <span className="appq-supp-ex">{theme.example}</span>
              <span className="appq-supp-src">{theme.sourceLine}</span>
              {theme.wants ? <p className="appq-supp-wants">{theme.wants}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section id="appq-questions" className="appq-section appq-section-questions">
        <div className="appq-sec-head">
          <span className="appq-label">{data.questions.label}</span>
          <h2>{data.questions.title}</h2>
          <p className="appq-sec-lede">{data.questions.lede}</p>
        </div>
        <div className="appq-matrix">
          <div className="appq-matrix-head">
            <span />
            <span />
            {data.questions.sources.map((source) => (
              <span key={source.id}>{source.label}</span>
            ))}
          </div>
          {data.questions.groups.map((group) => {
            const items = data.questions.items.filter((q) => q.group === group.id);
            return (
              <div key={group.id} className="appq-q-group">
                <div className="appq-q-group-head">
                  <span>{group.name}</span>
                  <span className="appq-q-range">{group.rangeLabel}</span>
                </div>
                {items.map((item) => (
                  <QuestionRow
                    key={item.n}
                    item={item}
                    group={group.id}
                    open={openIds.has(item.n)}
                    onToggle={() => toggle(item.n)}
                  />
                ))}
              </div>
            );
          })}
          <div className="appq-matrix-foot">
            <span />
            <span>{data.questions.footerLabel}</span>
            {data.questions.sources.map((source) => (
              <span key={source.id}>{counts[source.id as AppQuestionSourceId]}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="appq-prep" className="appq-section">
        <div className="appq-sec-head">
          <span className="appq-label">{data.prep.label}</span>
          <h2>{data.prep.title}</h2>
          <p className="appq-sec-lede">{data.prep.lede}</p>
        </div>
        <div className="appq-tiles appq-tiles-banks">
          {data.prep.banks.map((bank) => (
            <div key={bank.title} className="appq-tile appq-bank">
              <h3>{bank.title}</h3>
              <p>{bank.text}</p>
            </div>
          ))}
        </div>
        <p className="appq-note">{data.prep.closing}</p>
      </section>
    </div>
  );
}
