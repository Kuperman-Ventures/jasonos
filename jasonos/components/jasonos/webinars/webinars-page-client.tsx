"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rescanNow } from "@/lib/server-actions/webinars";
import type { WebinarsPageWeek } from "@/lib/webinars/store";
import { WeekSection } from "./week-section";

export function WebinarsPageClient({ weeks }: { weeks: WebinarsPageWeek[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  const onRescan = () => {
    setScanning(true);
    startTransition(async () => {
      const result = await rescanNow();
      setScanning(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const errNote =
        result.errors.length > 0
          ? ` (${result.errors.slice(0, 2).join("; ")})`
          : "";
      toast.success(
        `Rescan done — ${result.new_or_updated} session${
          result.new_or_updated === 1 ? "" : "s"
        } touched${errNote}`
      );
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-[880px] space-y-10 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Webinars
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detected sessions and published takeaways. Claude summarizes; this
            page stores and shows the result.
          </p>
        </div>
        <button
          type="button"
          disabled={pending || scanning}
          onClick={onRescan}
          className="rounded border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          {scanning || pending ? "Scanning…" : "Rescan"}
        </button>
      </header>

      {weeks.map((week) => (
        <WeekSection key={week.week_start} week={week} />
      ))}
    </div>
  );
}
