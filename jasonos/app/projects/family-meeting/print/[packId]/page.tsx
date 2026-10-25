import Link from "next/link";
import { notFound } from "next/navigation";
import { FamilyMeetingPrintButton } from "@/components/jasonos/family-meeting/print-button";
import { FamilyMeetingPrintFit } from "@/components/jasonos/family-meeting/print-fit";
import type { PrintSheet } from "@/lib/family-meeting/print-pack";
import { getPrintPackById } from "@/lib/family-meeting/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Family Meeting Print Pack · JasonOS",
};

function Sheet({ sheet }: { sheet: PrintSheet }) {
  return (
    <div className="fmp-sheet-frame">
      <article className="fmp-sheet" data-density="0">
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

        <div className="fmp-days">
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
                      {ev.location ? (
                        <span className="fmp-loc"> · {ev.location}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

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
    </div>
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
      <FamilyMeetingPrintFit />
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
        .fmp-toolbar p { margin: 0; color: var(--muted); max-width: 42rem; font-size: 13px; }
        .fmp-toolbar strong { color: var(--ink); }
        .fmp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .fmp-actions a, .fmp-actions button {
          appearance: none; border: 1px solid var(--ink); background: var(--paper);
          color: var(--ink); padding: 8px 12px; font-size: 12px; font-weight: 600;
          text-decoration: none; cursor: pointer; border-radius: 4px;
        }
        .fmp-actions button.primary { background: var(--ink); color: #fff; }
        .fmp-sheet-frame {
          width: 8.5in;
          min-height: 11in;
          margin: 0 auto 20px;
          background: var(--paper);
          box-shadow: 0 4px 24px rgba(28,25,23,.08);
          page-break-after: always;
          break-after: page;
        }
        .fmp-sheet-frame:last-child { page-break-after: auto; break-after: auto; }

        /* Density 0 = comfortable (default). Higher data-density = tighter. */
        .fmp-sheet {
          --fmp-pad-y: 0.5in;
          --fmp-pad-x: 0.55in;
          --fmp-h1: 26px;
          --fmp-h1-pad: 10px;
          --fmp-h1-margin: 14px;
          --fmp-eyebrow: 10px;
          --fmp-section-margin: 14px;
          --fmp-day-margin: 14px;
          --fmp-day-h2: 13px;
          --fmp-label: 11px;
          --fmp-title: 12.5px;
          --fmp-time: 11px;
          --fmp-meta: 11px;
          --fmp-li-pad: 5px;
          --fmp-time-col: 4.5rem;
          --fmp-line: 1.4;
          --fmp-band-pad: 6px 8px;
          --fmp-band-gap: 4px;
          --fmp-cols: 1;
          --fmp-col-gap: 16px;

          width: 100%;
          background: var(--paper);
          color: var(--ink);
          padding: var(--fmp-pad-y) var(--fmp-pad-x);
          box-sizing: border-box;
          line-height: var(--fmp-line);
          font-size: var(--fmp-title);
        }
        .fmp-sheet[data-density="1"] {
          --fmp-pad-y: 0.42in; --fmp-pad-x: 0.48in;
          --fmp-h1: 23px; --fmp-h1-pad: 8px; --fmp-h1-margin: 11px;
          --fmp-section-margin: 11px; --fmp-day-margin: 11px;
          --fmp-day-h2: 12px; --fmp-title: 12px; --fmp-time: 10.5px;
          --fmp-li-pad: 4px; --fmp-line: 1.32;
        }
        .fmp-sheet[data-density="2"] {
          --fmp-pad-y: 0.35in; --fmp-pad-x: 0.42in;
          --fmp-h1: 21px; --fmp-h1-pad: 7px; --fmp-h1-margin: 9px;
          --fmp-section-margin: 9px; --fmp-day-margin: 9px;
          --fmp-day-h2: 11.5px; --fmp-title: 11.5px; --fmp-time: 10px;
          --fmp-meta: 10px; --fmp-li-pad: 3px; --fmp-line: 1.28;
          --fmp-band-pad: 4px 7px; --fmp-band-gap: 3px;
          --fmp-cols: 2;
        }
        .fmp-sheet[data-density="3"] {
          --fmp-pad-y: 0.28in; --fmp-pad-x: 0.36in;
          --fmp-h1: 19px; --fmp-h1-pad: 6px; --fmp-h1-margin: 8px;
          --fmp-eyebrow: 9px;
          --fmp-section-margin: 8px; --fmp-day-margin: 7px;
          --fmp-day-h2: 11px; --fmp-label: 9.5px;
          --fmp-title: 11px; --fmp-time: 9.5px; --fmp-meta: 9.5px;
          --fmp-li-pad: 2px; --fmp-time-col: 3.8rem; --fmp-line: 1.24;
          --fmp-band-pad: 3px 6px; --fmp-cols: 2;
        }
        .fmp-sheet[data-density="4"] {
          --fmp-pad-y: 0.22in; --fmp-pad-x: 0.3in;
          --fmp-h1: 17px; --fmp-h1-pad: 5px; --fmp-h1-margin: 6px;
          --fmp-eyebrow: 8.5px;
          --fmp-section-margin: 6px; --fmp-day-margin: 6px;
          --fmp-day-h2: 10px; --fmp-label: 9px;
          --fmp-title: 10px; --fmp-time: 9px; --fmp-meta: 9px;
          --fmp-li-pad: 1.5px; --fmp-time-col: 3.5rem; --fmp-line: 1.2;
          --fmp-band-pad: 2px 5px; --fmp-band-gap: 2px; --fmp-cols: 2;
        }
        .fmp-sheet[data-density="5"] {
          --fmp-pad-y: 0.16in; --fmp-pad-x: 0.24in;
          --fmp-h1: 15px; --fmp-h1-pad: 4px; --fmp-h1-margin: 5px;
          --fmp-eyebrow: 8px;
          --fmp-section-margin: 5px; --fmp-day-margin: 5px;
          --fmp-day-h2: 9.5px; --fmp-label: 8.5px;
          --fmp-title: 9.5px; --fmp-time: 8.5px; --fmp-meta: 8.5px;
          --fmp-li-pad: 1px; --fmp-time-col: 3.3rem; --fmp-line: 1.18;
          --fmp-band-pad: 2px 4px; --fmp-cols: 2; --fmp-col-gap: 12px;
        }
        .fmp-sheet[data-density="6"] {
          --fmp-pad-y: 0.12in; --fmp-pad-x: 0.2in;
          --fmp-h1: 14px; --fmp-h1-pad: 3px; --fmp-h1-margin: 4px;
          --fmp-eyebrow: 7.5px;
          --fmp-section-margin: 4px; --fmp-day-margin: 4px;
          --fmp-day-h2: 9px; --fmp-label: 8px;
          --fmp-title: 9px; --fmp-time: 8px; --fmp-meta: 8px;
          --fmp-li-pad: 0.5px; --fmp-time-col: 3.1rem; --fmp-line: 1.15;
          --fmp-band-pad: 1px 4px; --fmp-band-gap: 1px;
          --fmp-cols: 2; --fmp-col-gap: 10px;
        }

        .fmp-eyebrow {
          margin: 0 0 2px; font-size: var(--fmp-eyebrow); letter-spacing: .12em;
          text-transform: uppercase; color: var(--muted); font-weight: 600;
        }
        .fmp-sheet-head h1 {
          margin: 0 0 var(--fmp-h1-margin);
          font-family: Georgia, "Times New Roman", serif;
          font-size: var(--fmp-h1); font-weight: 600; letter-spacing: -0.01em;
          border-bottom: 1.5px solid var(--ink); padding-bottom: var(--fmp-h1-pad);
        }
        .fmp-section { margin: 0 0 var(--fmp-section-margin); }
        .fmp-section h2, .fmp-day h2 {
          margin: 0 0 3px; font-size: var(--fmp-label); letter-spacing: .1em;
          text-transform: uppercase; color: var(--muted); font-weight: 700;
        }
        .fmp-day h2 {
          color: var(--ink); font-size: var(--fmp-day-h2); letter-spacing: .03em;
          border-bottom: 1px solid var(--line); padding-bottom: 2px;
        }
        .fmp-dow { color: #9a3412; margin-right: 5px; }
        .fmp-days {
          columns: var(--fmp-cols);
          column-gap: var(--fmp-col-gap);
        }
        .fmp-day {
          margin: 0 0 var(--fmp-day-margin);
          break-inside: avoid;
          -webkit-column-break-inside: avoid;
          page-break-inside: avoid;
        }
        .fmp-day ul, .fmp-section ul { list-style: none; margin: 0; padding: 0; }
        .fmp-day li {
          display: grid;
          grid-template-columns: var(--fmp-time-col) minmax(0,1fr);
          gap: 0 8px;
          padding: var(--fmp-li-pad) 0;
          border-bottom: 1px solid #f0efee;
          align-items: baseline;
        }
        .fmp-time {
          font-variant-numeric: tabular-nums; color: var(--muted);
          font-weight: 600; font-size: var(--fmp-time);
        }
        .fmp-title { font-weight: 600; color: var(--ink); font-size: var(--fmp-title); }
        .fmp-source { font-style: normal; font-weight: 500; color: var(--muted); }
        .fmp-loc { font-weight: 500; color: var(--muted); font-size: var(--fmp-meta); }
        .fmp-heads li, .fmp-rhythm li {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 2px 10px;
          align-items: baseline;
          padding: var(--fmp-band-pad);
          margin-bottom: var(--fmp-band-gap);
          background: var(--band);
          border: 1px solid var(--line);
        }
        .fmp-heads strong, .fmp-rhythm strong { font-size: var(--fmp-title); }
        .fmp-heads span, .fmp-rhythm span {
          color: var(--muted); font-size: var(--fmp-meta); white-space: nowrap;
        }
        .fmp-empty { color: var(--muted); }

        @media print {
          .fmp-root { background: #fff; }
          .fmp-toolbar { display: none !important; }
          .fmp-sheet-frame {
            box-shadow: none;
            margin: 0;
            width: 100%;
            min-height: 0;
            overflow: visible;
            page-break-after: always;
            break-after: page;
          }
          .fmp-sheet-frame:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .fmp-sheet {
            min-height: 0;
            /* Page margins come from @page; sheet padding is density-controlled. */
            box-shadow: none;
          }
          @page { size: letter; margin: 0.25in; }
        }
      `}</style>

      <div className="fmp-toolbar">
        <p>
          Print pack for <strong>{pack.label}</strong> (frozen Fri{" "}
          {pack.freeze_friday}). Each sheet starts comfortable and only tightens
          spacing/fonts if it would spill past one letter page. Print / Save as
          PDF.
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
