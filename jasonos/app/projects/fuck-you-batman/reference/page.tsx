import { EntryCard } from "@/components/jasonos/fuck-you-batman/entry-card";
import { loadFybEntries } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Reference · Fuck You Batman · JasonOS",
  description: "Approved and draft reference notes for Fuck You Batman.",
};

export const dynamic = "force-dynamic";

export default async function FuckYouBatmanReferencePage() {
  const entries = await loadFybEntries("reference");

  return (
    <>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fuck You Batman
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Reference</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Style Profile, AI Tells Checklist and other reference.
        </p>
      </header>

      {entries.length === 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="text-sm text-foreground/80">No reference entries yet.</p>
        </section>
      ) : (
        entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
      )}
    </>
  );
}
