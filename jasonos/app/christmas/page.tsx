import { EPIC_LOCAL_BLACKOUT_RANGES, EPIC_LOCAL_BLACKOUT_SOURCE } from "@/config/christmas";
import { HOME } from "@/config/resorts";
import { SkiBadge } from "@/components/ski/SkiBadge";
import { Ridgeline } from "@/components/ski/Ridgeline";
import { loadChristmasPlan, type ChristmasPlan, type ChristmasRow } from "@/lib/christmas/loadChristmas";
import { formatInches } from "@/lib/christmas/summarize";
import { formatDriveSpaced } from "@/lib/scoring/score";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Christmas · JasonOS",
  description: "Christmas break ski trips, Epic Local blackouts, and historical snow.",
};

const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

function countWord(n: number, capital: boolean): string {
  const word = COUNT_WORDS[n] ?? String(n);
  return capital ? word : word.toLowerCase();
}

function heroLine(plan: ChristmasPlan): string {
  const open = plan.groups.find((group) => group.id === "open")?.rows.length ?? 0;
  const blocked = plan.groups.find((group) => group.id === "blackout")?.rows ?? [];
  const preferred = ["Stowe", "Vail", "Park City"];
  const named = preferred.filter(
    (name) =>
      blocked.some((row) => row.mountain.name === name) ||
      plan.otherLimits.some((item) => item.name === name)
  );
  const namedSet = new Set(named);
  const more =
    blocked.filter((row) => !namedSet.has(row.mountain.name)).length +
    plan.otherLimits.filter((item) => !namedSet.has(item.name)).length;
  const moreText = more > 0 ? ` and ${countWord(more, false)} more` : "";
  return `Epic Local does not black out Hunter, Okemo or Mount Snow. Dec 26-31 is blocked at ${named.join(", ")}${moreText}. ${countWord(open, true)} mountains work all ten days.`;
}

function flakes(): { x: string; y: string; s: string; o: number }[] {
  return Array.from({ length: 48 }, (_, i) => {
    const rand = (n: number) => {
      const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      x: `${rand(1) * 100}%`,
      y: `${rand(2) * 380}px`,
      s: `${3 + rand(3) * 6}px`,
      o: 0.25 + rand(4) * 0.6,
    };
  });
}

function axisPercent(inches: number): string {
  return `${Math.max(0, Math.min(100, (inches / 10) * 100))}%`;
}

function place(row: ChristmasRow): string {
  const where = `${row.mountain.town}, ${row.mountain.state}`;
  const drive = row.mountain.driveMinutes == null ? null : formatDriveSpaced(row.mountain.driveMinutes);
  return (drive ? `${where} · ${drive}` : where).toUpperCase();
}

function freezeLine(high: number | null | undefined): { text: string; warm: boolean } | null {
  if (high == null) return null;
  const rounded = Math.round(high);
  if (rounded === 32) return { text: "AT FREEZING", warm: false };
  const delta = Math.abs(rounded - 32);
  return {
    text: `${delta}° ${rounded > 32 ? "ABOVE" : "BELOW"} FREEZING`,
    warm: rounded > 32,
  };
}

function dayFill(row: ChristmasRow, blackout: boolean): { background: string; outline: string; status: string } {
  if (row.standing === "off-pass") {
    return { background: "transparent", outline: "1px dashed #3a566f", status: "Not on the pass" };
  }
  if (row.standing === "blackout" && blackout) {
    return { background: "#ff5a1f", outline: "none", status: "Blocked" };
  }
  return { background: "#2fa876", outline: "none", status: "Pass works" };
}

const GROUP_COLOR: Record<ChristmasRow["standing"], string> = {
  open: "#2fa876",
  blackout: "#ff7a47",
  "off-pass": "#a9cfe8",
};

export default async function ChristmasPage() {
  const plan = await loadChristmasPlan();
  const outsideBreak = EPIC_LOCAL_BLACKOUT_RANGES.filter((range) => range.label !== "Christmas week");
  const first = plan.days[0];
  const last = plan.days[plan.days.length - 1];
  const kicker = `SKI / BREAK · ${first ? first.label.toUpperCase() : "DEC 24"} – ${last ? last.label.toUpperCase() : "JAN 2"} · FROM ${HOME.label.toUpperCase()}`;

  return (
    <div className="relative min-w-[1100px] overflow-hidden px-16 py-16">
      <p className="ski-mono mb-6 text-xs tracking-[0.1em] text-[#a9cfe8] min-[1100px]:hidden">
        BEST VIEWED ON DESKTOP
      </p>
      <Ridgeline tone="dark" />
      {flakes().map((flake, index) => (
        <span
          key={index}
          className="pointer-events-none absolute rounded-full bg-[#f4f8fb]"
          style={{ left: flake.x, top: flake.y, width: flake.s, height: flake.s, opacity: flake.o }}
        />
      ))}
      <svg viewBox="0 0 260 20" className="pointer-events-none absolute -right-5 top-[70px] w-[420px] -rotate-[22deg]" aria-hidden>
        <path d="M2 10 H214 C230 10 240 6 246 0 C246 8 240 14 218 14 H2 Z" fill="#ff5a1f" />
      </svg>
      <svg viewBox="0 0 260 20" className="pointer-events-none absolute right-[30px] top-[120px] w-[420px] -rotate-[22deg]" aria-hidden>
        <path d="M2 10 H214 C230 10 240 6 246 0 C246 8 240 14 218 14 H2 Z" fill="#f4f8fb" />
      </svg>

      <header className="relative flex flex-col gap-3.5 pt-6">
        <div className="ski-mono flex items-center gap-3 text-sm tracking-[0.1em] text-[#a9cfe8]">
          <SkiBadge ground="dark" className="size-9 shrink-0" />
          <span>{kicker}</span>
        </div>
        <h1 className="ski-title">Christmas</h1>
        <p className="max-w-[600px] text-[19px] leading-[1.45] text-[#d6eaf7]">{heroLine(plan)}</p>
      </header>

      <div className="relative mt-14 grid grid-cols-[230px_360px_1fr_150px] items-end gap-7">
        <span className="ski-mono text-xs tracking-[0.06em] text-[#a9cfe8]">MOUNTAIN</span>
        <div className="ski-mono text-xs tracking-[0.06em] text-[#a9cfe8]">
          <div className="mb-1.5">DEC 24 → JAN 2</div>
          <div className="grid grid-cols-10 gap-1 text-center">
            {plan.days.map((day) => (
              <span key={day.date}>{Number(day.date.slice(8))}</span>
            ))}
          </div>
        </div>
        <div className="ski-mono text-xs tracking-[0.06em] text-[#a9cfe8]">
          <div className="mb-1.5 flex justify-between">
            <span>SNOWFALL · MEDIAN BAR, PROJECTED MARK</span>
            <span>IN</span>
          </div>
          <div className="relative h-3.5">
            {["0", "2", "4", "6", "8"].map((tick, index) => (
              <span key={tick} className="absolute" style={{ left: `${index * 20}%` }}>
                {tick}
              </span>
            ))}
          </div>
        </div>
        <span className="ski-mono text-xs tracking-[0.06em] text-[#a9cfe8]">AVG HIGH</span>
      </div>

      {plan.groups.map((group) => (
        <section key={group.id} className="relative mt-3.5 flex flex-col gap-[26px]">
          <h2 className="ski-mono mt-3.5 text-[13px] tracking-[0.1em]" style={{ color: GROUP_COLOR[group.id] }}>
            ● {group.title.toUpperCase()}
          </h2>
          {group.rows.map((row) => {
            const median = row.history?.medianSnowIn ?? null;
            const projected = row.projection?.snowIn ?? null;
            const freeze = freezeLine(row.history?.meanHighF);
            const years = row.history?.seasonsAtLeast6In ?? 0;
            const yearDots = row.history?.seasons ?? 10;
            return (
              <div key={row.mountain.id} className="grid grid-cols-[230px_360px_1fr_150px] items-center gap-7">
                <div>
                  <div className="ski-name text-2xl">{row.mountain.name}</div>
                  <div className="ski-mono mt-1 text-[11px] text-[#a9cfe8]">{place(row)}</div>
                  {row.mountain.limitNote ? (
                    <div className="ski-mono mt-1 text-[11px] text-[#ffb199]">{row.mountain.limitNote}</div>
                  ) : null}
                  <div className="mt-2 flex gap-[3px]" aria-label={`${years} of ${yearDots} years with 6 inches or more`}>
                    {Array.from({ length: yearDots }, (_, index) => (
                      <span
                        key={index}
                        className="size-[9px] rounded-full outline outline-1 outline-[#6fb3f0] -outline-offset-1"
                        style={{ background: index < years ? "#f4f8fb" : "transparent" }}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {plan.days.map((day) => {
                    const cell = dayFill(row, day.blackout);
                    return (
                      <span
                        key={day.date}
                        title={`${day.label} · ${cell.status}`}
                        className="h-[30px] rounded-[6px]"
                        style={{ background: cell.background, outline: cell.outline, outlineOffset: "-1px" }}
                      />
                    );
                  })}
                </div>
                <div className="relative h-[72px]">
                  <div className="absolute top-3.5 right-0 left-0 h-[22px] rounded-[11px] bg-[#12304f]" />
                  {median != null ? (
                    <div
                      className="ski-snowbar absolute top-3.5 left-0 h-[22px] rounded-[11px]"
                      style={{ width: axisPercent(median) }}
                    />
                  ) : null}
                  {projected != null ? (
                    <div
                      className="absolute top-1.5 h-[38px] border-l-[3px] border-[#ffb199]"
                      style={{ left: axisPercent(projected) }}
                    />
                  ) : null}
                  <div
                    className="ski-mono absolute -top-1 text-[13px] font-semibold whitespace-nowrap"
                    style={{ left: median == null ? "0" : axisPercent(median), marginLeft: median == null ? 0 : 8 }}
                  >
                    {median == null ? "n/a" : `${formatInches(median)} in`}
                  </div>
                  {projected != null ? (
                    <div
                      className="ski-mono absolute top-10 text-[11px] whitespace-nowrap text-[#ffb199]"
                      style={{ left: axisPercent(projected), marginLeft: 6 }}
                    >
                      {formatInches(projected)} in proj
                    </div>
                  ) : null}
                </div>
                <div>
                  {freeze ? (
                    <>
                      <div className="ski-score text-[34px]" style={{ color: freeze.warm ? "#ff7a47" : "#d6eaf7" }}>
                        {Math.round(row.history?.meanHighF ?? 0)}
                        <span className="text-base font-semibold">F</span>
                      </div>
                      <div className="ski-mono text-xs" style={{ color: freeze.warm ? "#ff7a47" : "#d6eaf7" }}>
                        {freeze.text}
                      </div>
                    </>
                  ) : (
                    <div className="ski-mono text-sm text-[#a9cfe8]">n/a</div>
                  )}
                </div>
              </div>
            );
          })}
          {group.id === "blackout" ? (
            <p className="ski-mono max-w-5xl text-xs leading-relaxed text-[#a9cfe8]">
              {plan.otherLimits.map((item) => `${item.name}. ${item.limit}`).join(" ")}{" "}
              Other Epic Local blackouts this season, at the same restricted resorts:{" "}
              {outsideBreak
                .map((range) =>
                  range.start === range.end ? `${range.label} ${range.start.slice(5)}` : `${range.label} ${range.start.slice(5)} to ${range.end.slice(5)}`
                )
                .join("; ")}
              .{" "}
              <a className="text-[#d6eaf7] underline hover:text-[#ff5a1f]" href={EPIC_LOCAL_BLACKOUT_SOURCE} target="_blank" rel="noopener noreferrer">
                Epic restricted dates
              </a>
            </p>
          ) : null}
        </section>
      ))}

      <div className="ski-mono relative mt-8 flex flex-wrap gap-x-7 gap-y-2 pb-2 text-xs text-[#d6eaf7]">
        <span><span className="mr-1.5 inline-block size-3.5 rounded-[3px] bg-[#2fa876] align-[-2px]" /> PASS WORKS</span>
        <span><span className="mr-1.5 inline-block size-3.5 rounded-[3px] bg-[#ff5a1f] align-[-2px]" /> BLOCKED</span>
        <span><span className="mr-1.5 inline-block size-3.5 rounded-full bg-[#f4f8fb] align-[-2px]" /> YEAR WITH 6 IN+ (OF 10)</span>
        <span><span className="mr-1.5 inline-block size-3.5 rounded-full bg-[#ff7a47] align-[-2px]" /> AVG HIGH ABOVE 32°F (NO SNOW BASE)</span>
        <span>HISTORY: OPEN-METEO, 2016-17 TO 2025-26 · PROJECTION: ECMWF SEASONAL MEAN, ~20 MI AREA, NOT A RESORT REPORT</span>
      </div>
    </div>
  );
}
