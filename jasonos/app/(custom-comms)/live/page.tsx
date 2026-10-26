import type { Metadata } from "next";
import Link from "next/link";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";

export const metadata: Metadata = { title: "Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveMeetingsPage() {
  const result = await getUpcomingMeetingPreps(14);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Live</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Slides and playbooks UI is rebuilding. Calendar meetings still sync below.
      </p>
      {result.warnings.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{result.warnings.join(" · ")}</p>
      ) : null}
      <ul className="mt-6 divide-y divide-border rounded-lg border">
        {result.meetings.map((meeting) => (
          <li key={meeting.id} className="px-4 py-3">
            <Link href={`/meetings/${meeting.id}`} className="text-sm font-medium hover:underline">
              {meeting.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {new Date(meeting.startsAt).toLocaleString("en-US", {
                timeZone: "America/New_York",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
