import { EntryCard } from "@/components/jasonos/fuck-you-batman/entry-card";
import { ENTRY_CARD_FIELDS, type FybEntry, type FybEntryKind } from "@/lib/fuck-you-batman/types";
import { loadFybEntries } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Story Bible · Fuck You Batman · JasonOS",
  description: "Characters, world, rules and timeline for Fuck You Batman.",
};

export const dynamic = "force-dynamic";

const SECTIONS: { title: string; kind: FybEntryKind }[] = [
  { title: "Characters", kind: "bible_character" },
  { title: "World", kind: "bible_world" },
  { title: "Rules", kind: "bible_rule" },
  { title: "Timeline", kind: "bible_timeline" },
];

function Section({ title, kind, entries }: { title: string; kind: FybEntryKind; entries: FybEntry[] }) {
  const rows = entries.filter((e) => e.kind === kind);
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-foreground/80">None yet</p>
        </div>
      ) : (
        rows.map((entry) => (
          <EntryCard key={entry.id} entry={entry} fields={ENTRY_CARD_FIELDS[kind] ?? []} />
        ))
      )}
    </section>
  );
}

export default async function FuckYouBatmanBiblePage() {
  const entries = await loadFybEntries();
  const bible = entries.filter((e) => SECTIONS.some((s) => s.kind === e.kind));

  return (
    <>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fuck You Batman
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Story Bible</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Characters, world, rules, timeline. Claude publishes; you approve or send back.
        </p>
      </header>
      {SECTIONS.map((section) => (
        <Section key={section.kind} title={section.title} kind={section.kind} entries={bible} />
      ))}
    </>
  );
}
