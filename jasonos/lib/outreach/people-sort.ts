export type PeopleSortKey = "relevance" | "closeness" | "name" | "added";

export const PEOPLE_SORT_OPTIONS: { value: PeopleSortKey; label: string }[] = [
  { value: "relevance", label: "Relevance (A→C)" },
  { value: "closeness", label: "Closeness (1→3)" },
  { value: "name", label: "Name (A→Z)" },
  { value: "added", label: "Most recently added" },
];

type SortablePerson = {
  name: string;
  relevance_tier: "A" | "B" | "C" | null;
  network_degree: 1 | 2 | 3 | null;
  created_at: string | null;
};

function tierRank(t: SortablePerson["relevance_tier"]): number {
  return t === "A" ? 0 : t === "B" ? 1 : t === "C" ? 2 : 9;
}

function degreeRank(d: SortablePerson["network_degree"]): number {
  return d ?? 9;
}

export function comparePeople(
  a: SortablePerson,
  b: SortablePerson,
  sort: PeopleSortKey
): number {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "added") {
    const ac = a.created_at ?? "";
    const bc = b.created_at ?? "";
    if (!ac && !bc) return a.name.localeCompare(b.name);
    if (!ac) return 1;
    if (!bc) return -1;
    return bc.localeCompare(ac) || a.name.localeCompare(b.name);
  }
  const at = tierRank(a.relevance_tier);
  const bt = tierRank(b.relevance_tier);
  const ad = degreeRank(a.network_degree);
  const bd = degreeRank(b.network_degree);
  if (sort === "relevance") {
    return at - bt || ad - bd || a.name.localeCompare(b.name);
  }
  return ad - bd || at - bt || a.name.localeCompare(b.name);
}
