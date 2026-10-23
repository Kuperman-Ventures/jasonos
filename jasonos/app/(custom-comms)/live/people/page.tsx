import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People · Live · JasonOS" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  referral: "Referral",
  first_contacted: "First contacted",
  call_1: "Call 1",
  call_2: "Call 2",
  call_3: "Call 3",
  ongoing: "Ongoing",
  closed: "Closed",
};

interface PersonRow {
  id: string;
  name: string | null;
  title: string | null;
  networking_status: string | null;
  touch_count: number | null;
  to_discuss_next: string | null;
  next_touch_date: string | null;
}

async function loadPeople(): Promise<{ people: PersonRow[]; error: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { people: [], error: "Not configured" };
  }
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("id, name, title, networking_status, touch_count, to_discuss_next, next_touch_date")
    .or("networking_status.not.is.null,touch_count.gt.0")
    .order("next_touch_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(200);
  if (error) return { people: [], error: error.message };
  return { people: (data ?? []) as PersonRow[], error: null };
}

export default async function LivePeoplePage() {
  const { people, error } = await loadPeople();
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 min-[900px]:px-10">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]">People</h1>
        <p className="mt-1 text-[14px] text-[var(--jos-muted)]">
          Everyone in the networking pipeline, with held calls and what to bring up next.
        </p>
      </header>
      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {people.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No one in the pipeline yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
          {people.map((person) => {
            const touches = person.touch_count ?? 0;
            return (
              <li key={person.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-[var(--jos-ink)]">
                    {person.name?.trim() || "Unnamed"}
                  </p>
                  {person.title ? (
                    <p className="mt-0.5 truncate text-[14px] text-[var(--jos-muted)]">{person.title}</p>
                  ) : null}
                  {person.to_discuss_next ? (
                    <p className="mt-0.5 text-[14px] text-[var(--jos-ink)]">Next: {person.to_discuss_next}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-right text-[13px] tabular-nums text-[var(--jos-muted)]">
                  {person.networking_status ? STATUS_LABELS[person.networking_status] ?? person.networking_status : "No status"}
                  {" · "}
                  {touches === 1 ? "1 call" : `${touches} calls`}
                  {person.next_touch_date ? ` · next ${person.next_touch_date}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
