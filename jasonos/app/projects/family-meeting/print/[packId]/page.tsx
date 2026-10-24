import Link from "next/link";
import { notFound } from "next/navigation";
import { FamilyMeetingPrintButton } from "@/components/jasonos/family-meeting/print-button";
import type { PrintSheet } from "@/lib/family-meeting/print-pack";
import { getPrintPackById } from "@/lib/family-meeting/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Family Meeting Print Pack · JasonOS",
};

function Sheet({ sheet }: { sheet: PrintSheet }) {
  return (
    <article className="fmp-sheet">
      <header className="fmp-sheet-head">
        <p className="fmp-eyebrow">Family Meeting · print sheet</p>
        <h1>{sheet.label}</h1>
      </header>

      {sheet.headsUps.length ? (
        <section className="fmp-section">
          <h2>Long Term Heads Up</h2>
          <ul className="fmp-heads">
            {sheet.headsUps.map((h) => (
              <li key={h.id}>
                <strong>{h.title}</strong>
                <span>
                  {h.sourceLabel}
                  {h.timeLabel ? ` · ${h.timeLabel}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet.days.length === 0 && sheet.rhythm.length === 0 ? (
        <p className="fmp-empty">Nothing in this print window.</p>
      ) : null}

      {sheet.days.map((day) => (
        <section key={day.key} className="fmp-day">
          <h2>
            <span className="fmp-dow">{day.weekday}</span> {day.date}
          </h2>
          <ul>
            {day.events.map((ev) => (
              <li key={ev.id}>
                <span className="fmp-time">{ev.timeLabel}</span>
                <span className="fmp-title">
                  {ev.title}
                  {ev.sourceGroupId !== "family" &&
                  sheet.id !== ev.sourceGroupId ? (
                    <em className="fmp-source"> · {ev.sourceLabel}</em>
                  ) : null}
                </span>
                {ev.location ? (
                  <span className="fmp-loc">{ev.location}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {sheet.rhythm.length ? (
        <section className="fmp-section fmp-rhythm">
          <h2>Weekly rhythm</h2>
          <ul>
            {sheet.rhythm.map((r) => (
              <li key={`${r.title}-${r.meta}`}>
                <strong>{r.title}</strong>
                <span>{r.meta}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export default async function FamilyMeetingPrintPackPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const { packId } = await params;
  const pack = await getPrintPackById(packId);
  if (!pack) notFound();

  return (
    <div className="fmp-root">
      <style>{`
        .fmp-root {
          --ink: #1c1917;
          --muted: #57534e;
          --line: #d6d3d1;
          --band: #f5f5f4;
          --paper: #ffffff;
          color: var(--ink);
          background: #e7e5e4;
          min-height: 100dvh;
          font-family: "IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
        }
        .fmp-toolbar {
          max-width: 8.5in;
          margin: 0 auto;
          padding: 16px 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          align-items: center;
          justify-content: space-between;
        }
        .fmp-toolbar p { margin: 0; color: var(--muted); max-width: 36rem; }
        .fmp-toolbar strong { color: var(--ink); }
        .fmp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .fmp-actions a, .fmp-actions button {
          appearance: none; border: 1px solid var(--ink); background: var(--paper);
          color: var(--ink); padding: 8px 12px; font-size: 12px; font-weight: 600;
          text-decoration: none; cursor: pointer; border-radius: 4px;
        }
        .fmp-actions button.primary { background: var(--ink); color: #fff; }
        .fmp-sheet {
          width: 8.5in;
          min-height: 11in;
          margin: 0 auto 24px;
          background: var(--paper);
          color: var(--ink);
          padding: 0.55in 0.6in 0.65in;
          box-shadow: 0 4px 24px rgba(28,25,23,.08);
          page-break-after: always;
          break-after: page;
        }
        .fmp-sheet:last-child { page-break-after: auto; break-after: auto; }
        .fmp-eyebrow {
          margin: 0 0 4px; font-size: 10px; letter-spacing: .14em;
          text-transform: uppercase; color: var(--muted); font-weight: 600;
        }
        .fmp-sheet-head h1 {
          margin: 0 0 14px; font-family: Georgia, "Times New Roman", serif;
          font-size: 26px; font-weight: 600; letter-spacing: -0.01em;
          border-bottom: 2px solid var(--ink); padding-bottom: 10px;
        }
        .fmp-section { margin: 14px 0 18px; }
        .fmp-section h2, .fmp-day h2 {
          margin: 0 0 8px; font-size: 11px; letter-spacing: .1em;
          text-transform: uppercase; color: var(--muted); font-weight: 700;
        }
        .fmp-day h2 { color: var(--ink); font-size: 13px; letter-spacing: .04em;
          border-bottom: 1px solid var(--line); padding-bottom: 4px; }
        .fmp-dow { color: #9a3412; margin-right: 6px; }
        .fmp-day { margin: 0 0 14px; }
        .fmp-day ul, .fmp-section ul { list-style: none; margin: 0; padding: 0; }
        .fmp-day li {
          display: grid; grid-template-columns: 4.5rem minmax(0,1fr);
          gap: 2px 10px; padding: 5px 0; border-bottom: 1px solid #f0efee;
        }
        .fmp-time { font-variant-numeric: tabular-nums; color: var(--muted); font-weight: 600; }
        .fmp-title { font-weight: 600; color: var(--ink); }
        .fmp-source { font-style: normal; font-weight: 500; color: var(--muted); }
        .fmp-loc { grid-column: 2; color: var(--muted); font-size: 11px; }
        .fmp-heads li, .fmp-rhythm li {
          display: flex; flex-direction: column; gap: 2px;
          padding: 6px 8px; margin-bottom: 4px; background: var(--band);
          border: 1px solid var(--line);
        }
        .fmp-heads span, .fmp-rhythm span { color: var(--muted); font-size: 11px; }
        .fmp-empty { color: var(--muted); }
        @media print {
          .fmp-root { background: #fff; }
          .fmp-toolbar { display: none !important; }
          .fmp-sheet {
            box-shadow: none; margin: 0; width: auto; min-height: auto;
            padding: 0.4in 0.45in;
          }
          @page { size: letter; margin: 0.4in; }
        }
      `}</style>

      <div className="fmp-toolbar">
        <p>
          Print pack for <strong>{pack.label}</strong> (frozen Fri{" "}
          {pack.freeze_friday}). Four letter pages — Print / Save as PDF.
        </p>
        <div className="fmp-actions">
          <Link href="/projects/family-meeting">Back to editor</Link>
          <FamilyMeetingPrintButton />
        </div>
      </div>

      {pack.payload.sheets.map((sheet) => (
        <Sheet key={sheet.id} sheet={sheet} />
      ))}
    </div>
  );
}
