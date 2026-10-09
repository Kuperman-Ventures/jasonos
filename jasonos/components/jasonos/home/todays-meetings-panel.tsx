"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown } from "lucide-react";
import { StatusBand, StatusPill, type StatusRung } from "@/components/jasonos/brand/status";
import { meetingContextLine } from "@/lib/meeting-prep/context-model";
import type { MeetingPrepSummary } from "@/lib/server-actions/meeting-prep";

const STORAGE_KEY = "jasonos.todays-meetings.collapsed";

function easternTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function attendeeLabel(attendee: MeetingPrepSummary["attendees"][number]): string {
  return attendee.name || attendee.email.split("@")[0] || attendee.email;
}

function attendeeLine(attendees: MeetingPrepSummary["attendees"]): string {
  const labels = attendees.map(attendeeLabel);
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

function prepPill(row: MeetingPrepSummary): { label: string; rung: StatusRung } | null {
  if (row.status === "ready") return { label: "Brief ready", rung: "ok" };
  if (row.status === "gathering" || row.status === "building") {
    return { label: "Building", rung: 3 };
  }
  if (row.status === "error") return { label: "Error", rung: 1 };
  return null;
}

export function TodaysMeetingsPanel({
  rows,
  warnings,
  nowIso,
}: {
  rows: MeetingPrepSummary[];
  warnings: string[];
  nowIso: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // private mode / quota
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section className="overflow-hidden">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand Today's Meetings" : "Collapse Today's Meetings"}
        className="w-full text-left"
      >
        <StatusBand rung={3}>
          <Calendar className="h-5 w-5" />
          <h2 className="text-[17px] font-bold tracking-tight">Today&apos;s Meetings</h2>
          <StatusPill rung={4} className="ml-auto">
            {rows.length}
          </StatusPill>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </StatusBand>
      </button>

      {warnings.length > 0 ? (
        <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
          {warnings.join(" · ")}
        </p>
      ) : null}

      {!collapsed ? (
        rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No meetings with other people today.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const ended = Date.parse(row.endsAt) < Date.parse(nowIso);
              const pill = prepPill(row);
              return (
                <li key={row.id} className={ended ? "opacity-60" : undefined}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Link href={`/meetings/${row.id}`} className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          <span className="mr-2 font-normal text-muted-foreground">
                            {easternTime(row.startsAt)}
                          </span>
                          {row.title}
                        </p>
                        {pill ? (
                          <StatusPill rung={pill.rung} className="shrink-0">
                            {pill.label}
                          </StatusPill>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {meetingContextLine(row.home, nowIso)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {attendeeLine(row.attendees)}
                      </p>
                    </Link>
                    {row.conferenceUrl ? (
                      <a
                        href={row.conferenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 pt-0.5 text-[11px] font-medium text-rung-ink hover:underline"
                      >
                        Join
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}
