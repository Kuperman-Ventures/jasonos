"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportActivityLog } from "@/lib/server-actions/activity-log";
import { shortDay } from "./people-pills";

const WEEKS_BACK = 8;

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekLabel(monday: string, index: number): string {
  if (index === 0) return `This week (${shortDay(monday)})`;
  if (index === 1) return `Last week (${shortDay(monday)})`;
  return `Week of ${shortDay(monday)}`;
}

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Download a week's held calls as the Browning tracking sheet. `pickWeek` adds the last eight weeks. */
export function ExportLog({
  weekStart,
  pickWeek = true,
  label = "Export activity log",
}: {
  weekStart: string;
  pickWeek?: boolean;
  label?: string;
}) {
  const weeks = Array.from({ length: WEEKS_BACK }, (_, index) => addDays(weekStart, -7 * index));
  const [week, setWeek] = useState(weekStart);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const result = await exportActivityLog({ weekStart: pickWeek ? week : weekStart });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    downloadCsv(result.filename, result.csv);
    toast.success(result.rows === 1 ? "Exported 1 call" : `Exported ${result.rows} calls`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pickWeek ? (
        <>
          <label className="sr-only" htmlFor="activity-log-week">
            Week
          </label>
          <select
            id="activity-log-week"
            value={week}
            onChange={(event) => setWeek(event.target.value)}
            className="h-9 border border-[var(--jos-line)] bg-[var(--jos-bg)] px-2 text-[14px] text-[var(--jos-ink)]"
          >
            {weeks.map((monday, index) => (
              <option key={monday} value={monday}>
                {weekLabel(monday, index)}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run()}>
        <DownloadSimple size={16} weight="bold" aria-hidden />
        {busy ? "Exporting…" : label}
      </Button>
    </div>
  );
}
