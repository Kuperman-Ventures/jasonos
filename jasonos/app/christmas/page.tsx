import { EPIC_LOCAL_BLACKOUT_RANGES, EPIC_LOCAL_BLACKOUT_SOURCE } from "@/config/christmas";
import { plainDate } from "@/lib/christmas/dates";
import { loadChristmasPlan, type ChristmasRow } from "@/lib/christmas/loadChristmas";
import { formatInches } from "@/lib/christmas/summarize";
import { formatDriveSpaced } from "@/lib/scoring/score";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Christmas · JasonOS",
  description: "Christmas break ski trips, Epic Local blackouts, and historical snow.",
};

function monthDay(iso: string): string {
  return plainDate(iso).split(" ").slice(1).join(" ");
}

function rangeText(start: string, end: string): string {
  if (start === end) return monthDay(start);
  const [startMonth, startDay] = monthDay(start).split(" ");
  const [endMonth, endDay] = monthDay(end).split(" ");
  if (startMonth === endMonth) return `${startMonth} ${startDay}-${endDay}`;
  return `${monthDay(start)} to ${monthDay(end)}`;
}

function inches(value: number | null | undefined): string {
  if (value == null) return "n/a";
  return `${formatInches(value)} in`;
}

function degrees(value: number | null | undefined): string {
  if (value == null) return "n/a";
  return `${Math.round(value)}°F`;
}

function place(row: ChristmasRow): string {
  const drive =
    row.mountain.driveMinutes == null ? null : formatDriveSpaced(row.mountain.driveMinutes);
  const where = `${row.mountain.town}, ${row.mountain.state}`;
  return drive ? `${where} · ${drive}` : where;
}

export default async function ChristmasPage() {
  const plan = await loadChristmasPlan();
  const outsideBreak = EPIC_LOCAL_BLACKOUT_RANGES.filter((range) => range.label !== "Christmas week");

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 py-8">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Christmas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Break is Thu Dec 24 through Sat Jan 2. Planned from Maplewood. This is Epic Local, not the
          Northeast Value Pass. Northeast Value does black out Hunter, Okemo, and Mount Snow on Dec 26-31.
          Epic Local does not.
        </p>
        {plan.headline ? <p className="mt-4 text-base leading-relaxed">{plan.headline}</p> : null}
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Epic Local blackouts during this break</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Dec 26-31 the pass does not work at Stowe, Vail, Beaver Creek, Whistler Blackcomb, Park City,
          Heavenly, Northstar, or Kirkwood. Dec 24, Dec 25, Jan 1, and Jan 2 are not blacked out.
          Hunter, Jack Frost, Big Boulder, Mount Snow, Okemo, and Mount Sunapee are on the pass all 10 days.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.days.map((day) => (
            <div
              key={day.date}
              className={`min-w-24 rounded-lg border px-3 py-2 text-sm ${
                day.blackout ? "border-red-200 bg-red-50 text-red-950" : "bg-card"
              }`}
            >
              <div>{day.label}</div>
              <div className="mt-1 text-xs">{day.blackout ? "Blocked" : "Pass works"}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Other Epic Local blackouts this season, at the same restricted resorts:{" "}
          {outsideBreak.map((range) => `${range.label}, ${rangeText(range.start, range.end)}`).join("; ")}
          .{" "}
          <a className="underline" href={EPIC_LOCAL_BLACKOUT_SOURCE} target="_blank" rel="noopener noreferrer">
            Epic restricted dates
          </a>
        </p>
      </section>

      {plan.groups.map((group) => (
        <section key={group.id} className="mt-10">
          <h2 className="text-sm font-semibold">{group.title}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Mountain</th>
                  <th className="py-2 pr-4 font-medium">Epic Local</th>
                  <th className="py-2 pr-4 font-medium">Median snow</th>
                  <th className="py-2 pr-4 font-medium">Years with 6 in+</th>
                  <th className="py-2 pr-4 font-medium">Avg high</th>
                  <th className="py-2 pr-4 font-medium">Projected snow</th>
                  <th className="py-2 font-medium">Projected high</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.mountain.id} className="border-b align-top">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{row.mountain.name}</div>
                      <div className="text-xs text-muted-foreground">{place(row)}</div>
                      {row.mountain.limitNote ? (
                        <div className="mt-1 text-xs text-red-900">{row.mountain.limitNote}</div>
                      ) : null}
                    </td>
                    <td className={`py-3 pr-4 ${row.standing === "open" ? "" : "text-red-900"}`}>{row.pass}</td>
                    <td className="py-3 pr-4 tabular-nums">{inches(row.history?.medianSnowIn)}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {row.history ? `${row.history.seasonsAtLeast6In} of ${row.history.seasons}` : "n/a"}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{degrees(row.history?.meanHighF)}</td>
                    <td className="py-3 pr-4 tabular-nums">{inches(row.projection?.snowIn)}</td>
                    <td className="py-3 tabular-nums">{degrees(row.projection?.meanHighF)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {group.id === "blackout" ? (
            <ul className="mt-4 max-w-3xl space-y-1 text-sm text-muted-foreground">
              {plan.otherLimits.map((item) => (
                <li key={item.name}>
                  <span className="text-foreground">{item.name}.</span> {item.limit}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      {plan.groups.some((group) => group.rows.some((row) => row.historyError || row.projectionError)) ? (
        <ul className="mt-8 space-y-1 text-sm text-muted-foreground">
          {plan.groups.flatMap((group) =>
            group.rows.flatMap((row) => {
              const lines = [row.historyError, row.projectionError].filter((line): line is string => Boolean(line));
              return lines.map((line) => (
                <li key={`${row.mountain.id}-${line}`}>
                  {row.mountain.name}: {line}
                </li>
              ));
            })
          )}
        </ul>
      ) : null}

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        History is recorded weather at each mountain&apos;s coordinates for Dec 24 through Jan 2, ten breaks
        from 2016-17 through 2025-26. Median snow is the middle year. The projection is the ECMWF seasonal
        ensemble mean for this break. That forecast covers a wide area, about 20 miles across, and it is not
        a resort snow report. Open-Meteo supplies both.
      </p>
    </div>
  );
}
