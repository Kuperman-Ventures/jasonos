import Link from "next/link";
import { getOutreachFirms } from "@/lib/outreach/data";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";

export const metadata = { title: "Outreach · Firms" };
export const dynamic = "force-dynamic";

export default async function OutreachFirmsPage() {
  const firms = await getOutreachFirms();

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Firms</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Contacts grouped by firm. Average strategic score is from the
          recruiter pipeline where available.
        </p>
      </header>

      {firms.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-5 w-5 opacity-50" />
          No firms yet. Add contacts with a firm to see them grouped here.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {firms.map((firm) => (
            <article
              key={firm.firm_normalized}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold tracking-tight">
                    {firm.firm}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {firm.count} contact{firm.count === 1 ? "" : "s"}
                  </p>
                </div>
                {firm.avg_strategic_score !== null ? (
                  <div className="font-mono shrink-0 rounded-md border px-2 py-1 text-sm">
                    {firm.avg_strategic_score}
                  </div>
                ) : null}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Top contact:{" "}
                <span className="text-foreground">{firm.top_person.name}</span>
              </p>

              <div className="mt-3 space-y-1.5">
                {firm.people.slice(0, 5).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background/40 px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {person.name}
                      </div>
                      {person.title ? (
                        <div className="truncate text-[10px] text-muted-foreground">
                          {person.title}
                        </div>
                      ) : null}
                    </div>
                    <RelationshipBadge type={person.relationship_type} />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href={`/outreach/people?firm=${encodeURIComponent(firm.firm)}`}
                    />
                  }
                >
                  Open firm contacts
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
