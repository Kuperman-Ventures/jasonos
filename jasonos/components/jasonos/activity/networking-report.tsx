import React from "react";
import { ReportPrintButton } from "@/components/jasonos/activity/report-print-button";
import { ReportWeekNav } from "@/components/jasonos/activity/report-week-nav";
import type {
  NetworkingReport,
  ReportOutreach,
  ReportMeeting,
  ReportUpcomingMeeting,
  ReportReferral,
  ReportAddedContact,
  ReportApplication,
} from "@/lib/server-actions/networking-status";

// Networking Activity Report — the single-week, print-ready "paper" document.
// A faithful, data-wired build of the reference layout (networking-report.html):
// one typeface (Source Serif 4), a masthead, a three-figure band, and two
// columns of ruled-row lists. No cards, no boxes, no dark surfaces — grouping
// comes from whitespace and section rules only. 816px content width; prints to
// Letter by only dropping the shadow and desk background.

// CSS variables lifted verbatim from the reference file's :root. Every colour in
// the report is taken from these — no hard-coded hexes below this object.
const vars = {
  "--color-bg": "#f3f2f2",
  "--color-text": "#201e1d",
  "--color-divider": "color-mix(in srgb, #201e1d 16%, transparent)",
  "--color-neutral-300": "#d7d3d3",
  "--color-neutral-600": "#7d7979",
  "--color-neutral-700": "#605d5d",
  "--color-neutral-800": "#444141",
  "--color-accent": "#0088b0",
  "--color-accent-300": "#99e0ff",
  "--color-accent-700": "#006786",
  "--color-accent-2-700": "#aa0b56",
  "--font-heading": '"Source Serif 4", Georgia, serif',
  "--font-body": '"Source Serif 4", Georgia, serif',
  "--shadow-md": "0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent)",
  fontFamily: "var(--font-body)",
  color: "var(--color-text)",
  lineHeight: 1.55,
  fontSize: 15,
} as React.CSSProperties;

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
  lineHeight: 1.12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 600,
  borderBottom: "2px solid var(--color-text)",
  paddingBottom: 6,
};

const noneStyle: React.CSSProperties = {
  fontSize: 15,
  fontStyle: "italic",
  color: "var(--color-neutral-700)",
  margin: 0,
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// A three-figure numeral colour: a zero is the story, set in magenta; otherwise
// referrals-given reads as positive (cyan) and the rest are plain ink.
function figureColor(value: number, positive: boolean): string {
  if (value === 0) return "var(--color-accent-2-700)";
  return positive ? "var(--color-accent-700)" : "var(--color-text)";
}

function Figure({
  label,
  value,
  qualifier,
  positive = false,
}: {
  label: string;
  value: number;
  qualifier: string;
  positive?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        padding: "18px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-neutral-700)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 56,
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          lineHeight: 1,
          color: figureColor(value, positive),
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>
        {qualifier}
      </div>
    </div>
  );
}

function OutreachList({ rows }: { rows: ReportOutreach[] }) {
  if (rows.length === 0)
    return <p style={noneStyle}>No outreach logged this week.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((o, i) => (
        <div
          key={`${o.name}-${i}`}
          className="brk rrow"
          style={{
            padding: "10px 0",
            borderTop: "1px solid var(--color-divider)",
            borderBottom:
              i === rows.length - 1 ? "1px solid var(--color-divider)" : undefined,
            display: "grid",
            gridTemplateColumns: "1fr 100px",
            gap: "2px 12px",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>{o.name}</span>
          <span
            style={{
              fontSize: 13,
              color: "var(--color-neutral-600)",
              textAlign: "right",
              whiteSpace: "nowrap",
            }}
          >
            {o.channel} &middot; {o.date}
          </span>
          {o.company || o.role ? (
            <span
              style={{
                fontSize: 14,
                color: "var(--color-neutral-600)",
                gridColumn: 1,
              }}
            >
              {o.company}
              {o.company && o.role ? " \u00b7 " : ""}
              {o.role ? (
                <span style={{ color: "var(--color-accent-700)" }}>{o.role}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MeetingRecord({ m }: { m: ReportMeeting }) {
  return (
    <div
      className="brk"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        paddingLeft: 14,
        borderLeft: "2px solid var(--color-accent-300)",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        {m.name}
        {m.company ? ` \u00b7 ${m.company}` : ""}{" "}
        <span
          style={{
            fontWeight: 400,
            color: "var(--color-neutral-600)",
            fontSize: 14,
          }}
        >
          {m.medium}
        </span>
      </div>
      {m.notes ? (
        <div
          style={{
            fontSize: 14,
            color: "var(--color-neutral-700)",
            lineHeight: 1.5,
          }}
        >
          {m.notes}
        </div>
      ) : null}
      {m.referralsProduced > 0 ? (
        <div style={{ fontSize: 14, color: "var(--color-accent-700)" }}>
          Gave {m.referralsProduced} {plural(m.referralsProduced, "referral", "referrals")}{" "}
          &rarr; listed opposite
        </div>
      ) : null}
    </div>
  );
}

function MeetingsSection({
  meetings,
  threadsOpen,
}: {
  meetings: ReportMeeting[];
  threadsOpen: number;
}) {
  if (meetings.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={sectionHeadStyle}>Meetings</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {meetings.map((m, i) => (
            <MeetingRecord key={`${m.name}-${i}`} m={m} />
          ))}
        </div>
      </div>
    );
  }
  // None logged — state the fact, then show how a logged meeting prints.
  const none =
    threadsOpen > 0
      ? `None. ${threadsOpen} ${plural(threadsOpen, "thread", "threads")} open, no conversation yet.`
      : "None logged this week.";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={sectionHeadStyle}>Meetings</h2>
      <p
        style={{
          fontSize: 15,
          fontStyle: "italic",
          color: "var(--color-neutral-800)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {none}
      </p>
      <div
        style={{
          fontSize: 12,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-neutral-600)",
          paddingTop: 6,
        }}
      >
        A logged meeting prints as
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          paddingLeft: 14,
          borderLeft: "2px solid var(--color-accent-300)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          Name &middot; company{" "}
          <span
            style={{
              fontWeight: 400,
              color: "var(--color-neutral-600)",
              fontSize: 14,
            }}
          >
            30 min, video
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--color-neutral-700)",
            lineHeight: 1.5,
          }}
        >
          Two lines on what was discussed and what they committed to.
        </div>
        <div style={{ fontSize: 14, color: "var(--color-accent-700)" }}>
          Gave 2 referrals &rarr; listed opposite
        </div>
      </div>
    </div>
  );
}

function UpcomingMeetingsSection({
  meetings,
}: {
  meetings: ReportUpcomingMeeting[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={sectionHeadStyle}>Upcoming meetings</h2>
      {meetings.length === 0 ? (
        <p style={noneStyle}>None scheduled.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {meetings.map((m, i) => {
            const detail = [m.company, m.medium, m.time]
              .filter(Boolean)
              .join(" \u00b7 ");
            return (
              <div
                key={`${m.name}-${i}`}
                className="brk rrow"
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--color-divider)",
                  borderBottom:
                    i === meetings.length - 1
                      ? "1px solid var(--color-divider)"
                      : undefined,
                  display: "grid",
                  gridTemplateColumns: "1fr 100px",
                  gap: "2px 12px",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--color-neutral-600)",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.date}
                </span>
                {detail ? (
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--color-neutral-600)",
                      gridColumn: 1,
                    }}
                  >
                    {detail}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddedList({ rows }: { rows: ReportAddedContact[] }) {
  if (rows.length === 0) return <p style={noneStyle}>None this week.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((a, i) => (
        <div
          key={`${a.name}-${i}`}
          className="brk rrow"
          style={{
            padding: "9px 0",
            borderTop: "1px solid var(--color-divider)",
            borderBottom:
              i === rows.length - 1 ? "1px solid var(--color-divider)" : undefined,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>{a.name}</span>
          {a.ranking ? (
            <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
              {a.ranking}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReferralRecord({ r }: { r: ReportReferral }) {
  return (
    <div
      className="brk rrow"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 62px",
        gap: "2px 12px",
        padding: "14px 0",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.3,
        }}
      >
        {r.name}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--color-neutral-600)",
          textAlign: "right",
          whiteSpace: "nowrap",
          paddingTop: 2,
        }}
      >
        {r.date}
      </div>
      {r.company || r.role ? (
        <div
          style={{ gridColumn: 1, fontSize: 14, color: "var(--color-neutral-700)" }}
        >
          {r.company}
          {r.company && r.role ? " \u00b7 " : ""}
          {r.role ? (
            <span style={{ color: "var(--color-accent-700)" }}>{r.role}</span>
          ) : null}
        </div>
      ) : null}
      {r.chain.length > 0 ? (
        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: 14,
            color: "var(--color-neutral-800)",
            paddingTop: 3,
          }}
        >
          via{" "}
          {r.chain.map((n, i) => (
            <React.Fragment key={i}>
              {i > 0 ? " \u2192 " : ""}
              <span style={{ color: "var(--color-text)" }}>{n}</span>
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <div
        style={{
          gridColumn: "1 / -1",
          fontSize: 14,
          color: r.followUpActioned
            ? "var(--color-accent-700)"
            : "var(--color-accent-2-700)",
        }}
      >
        {r.followUpText}
      </div>
    </div>
  );
}

function TallyRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 14,
        color: "var(--color-neutral-700)",
      }}
    >
      <span>{label}</span>
      <span style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}

function ApplicationsList({ rows }: { rows: ReportApplication[] }) {
  if (rows.length === 0) return <p style={noneStyle}>None this week.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((a, i) => (
        <div
          key={`${a.company}-${i}`}
          className="brk rrow"
          style={{
            padding: "9px 0",
            borderTop: "1px solid var(--color-divider)",
            borderBottom:
              i === rows.length - 1 ? "1px solid var(--color-divider)" : undefined,
            display: "grid",
            gridTemplateColumns: "1fr 48px",
            gap: "2px 12px",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>{a.company}</span>
          <span
            style={{
              fontSize: 13,
              color: "var(--color-neutral-600)",
              textAlign: "right",
            }}
          >
            {a.date}
          </span>
          {a.role ? (
            <span
              style={{
                fontSize: 14,
                color: "var(--color-neutral-700)",
                gridColumn: 1,
              }}
            >
              {a.role}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// A section wrapper for the balanced multi-column flow. break-inside: avoid
// keeps each block whole, so the browser evens the two columns by moving whole
// blocks between them rather than splitting one.
function ColBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-block" style={{ breakInside: "avoid", marginBottom: 30 }}>
      {children}
    </div>
  );
}

export function NetworkingReportView({ report }: { report: NetworkingReport }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- the report
          is a standalone, print-first document; the typeface is intentionally
          scoped to this page only. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap"
      />
      <style>{`
.nw-report-sheet, .nw-report-sheet * {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@media print {
  @page { size: Letter; margin: 0; }
  html, body { background: #fff !important; }
  /* Flex ancestors prevent multi-column content from fragmenting across pages
     (which left a blank first page). Force normal block flow for print so the
     two columns paginate. */
  body, main { display: block !important; }
  /* Never print the site's top navigation in the report PDF. */
  .app-top-nav { display: none !important; }
  .nw-report-desk { padding: 0 !important; background: #fff !important; min-height: 0 !important; display: block !important; }
  /* Block flow (not flex) paginates cleanly across pages; tighter margins. */
  .nw-report-sheet { box-shadow: none !important; display: block !important; padding: 28px 44px 34px !important; }
  .nw-report-sheet > * + * { margin-top: 16px; }
  .report-no-print { display: none !important; }
  /* Multi-column can't reliably paginate across printed pages from this
     layout, so print a single column that flows cleanly (no blank page, no
     split rows). Screen keeps the balanced two columns. */
  .report-cols { column-count: 1 !important; }
  .col-block { margin-bottom: 12px !important; }
  .rrow { padding-top: 6px !important; padding-bottom: 6px !important; }
  /* Keep small units whole; let breaks fall between them. */
  .brk { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
}`}</style>

      <ReportWeekNav
        prevWeekStart={report.prevWeekStart}
        nextWeekStart={report.nextWeekStart}
        isCurrentWeek={report.isCurrentWeek}
      />
      <ReportPrintButton />

      <div
        className="nw-report-desk"
        style={{
          ...vars,
          background: "#ddd9d6",
          padding: 48,
          display: "flex",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ width: 816 }}>
          <div
            className="nw-report-sheet"
            style={{
              background: "var(--color-bg)",
              boxShadow: "var(--shadow-md)",
              padding: "56px 64px 64px",
              display: "flex",
              flexDirection: "column",
              gap: 34,
            }}
          >
            {/* Masthead */}
            <div className="brk" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div
                style={{
                  borderBottom: "4px solid var(--color-text)",
                  paddingBottom: 6,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  The Networking Week
                </span>
                <span
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-neutral-700)",
                  }}
                >
                  No. {report.issueNumber}
                </span>
              </div>
              <div
                style={{
                  borderBottom: "1px solid var(--color-text)",
                  padding: "5px 0 0",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-neutral-700)",
                }}
              >
                <span>{report.weekLabel}</span>
                <span>{report.summary}</span>
              </div>
            </div>

            {/* Three-figure band */}
            <div
              className="brk"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 2,
                background: "var(--color-divider)",
              }}
            >
              <Figure
                label="Reached out"
                value={report.reachedOut}
                qualifier={report.reachedQualifier}
              />
              <Figure
                label="Met with"
                value={report.metWith}
                qualifier={report.metQualifier}
              />
              <Figure
                label="Referrals given"
                value={report.referralsGiven}
                qualifier={report.referralsQualifier}
                positive
              />
            </div>

            {/* Balanced columns — whole blocks flow between the two columns so
                their heights come out as even as possible. Collapses to a
                single, cleanly-paginating column when printed to PDF. */}
            <div className="report-cols" style={{ columnCount: 2, columnGap: 44 }}>
              <ColBlock>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <h2 style={sectionHeadStyle}>Outreach</h2>
                  <OutreachList rows={report.outreach} />
                </div>
              </ColBlock>

              <ColBlock>
                <MeetingsSection
                  meetings={report.meetings}
                  threadsOpen={report.reachedOut}
                />
              </ColBlock>

              <ColBlock>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <h2 style={sectionHeadStyle}>Referrals</h2>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 62px",
                        gap: 12,
                        paddingBottom: 6,
                        borderBottom: "1px solid var(--color-text)",
                        fontSize: 11,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--color-neutral-700)",
                      }}
                    >
                      <span>New contact &middot; introduced by</span>
                      <span style={{ textAlign: "right" }}>Date</span>
                    </div>

                    {report.referrals.length > 0 ? (
                      report.referrals.map((r, i) => (
                        <ReferralRecord key={`${r.name}-${i}`} r={r} />
                      ))
                    ) : (
                      <p style={{ ...noneStyle, padding: "14px 0" }}>
                        No referrals need follow-up.
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      paddingTop: 4,
                    }}
                  >
                    <TallyRow
                      label="Introductions all time"
                      value={report.tally.allTime}
                    />
                    <TallyRow label="Of those, met" value={report.tally.ofThoseMet} />
                    {report.tally.topConnectorName ? (
                      <TallyRow
                        label={`Made by ${report.tally.topConnectorName}`}
                        value={report.tally.topConnectorCount}
                      />
                    ) : null}
                  </div>
                </div>
              </ColBlock>

              <ColBlock>
                <UpcomingMeetingsSection meetings={report.upcomingMeetings} />
              </ColBlock>

              <ColBlock>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <h2 style={sectionHeadStyle}>Added without an introduction</h2>
                  <AddedList rows={report.addedWithoutIntro} />
                </div>
              </ColBlock>

              <ColBlock>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <h2 style={sectionHeadStyle}>Applications filed</h2>
                  <ApplicationsList rows={report.applications} />
                </div>
              </ColBlock>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
