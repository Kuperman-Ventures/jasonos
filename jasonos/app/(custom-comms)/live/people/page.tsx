import type { Metadata } from "next";
import { PeopleIndexClient } from "@/components/jasonos/people/people-index-client";
import { etToday, mondayStartOfWeekYmd } from "@/lib/dates";
import { listPeople } from "@/lib/server-actions/person";

export const metadata: Metadata = { title: "People · Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LivePeoplePage() {
  const result = await listPeople();
  return (
    <PeopleIndexClient
      people={result.ok ? result.people : []}
      error={result.ok ? null : result.error}
      weekStart={mondayStartOfWeekYmd(etToday())}
    />
  );
}
