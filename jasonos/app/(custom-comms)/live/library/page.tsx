import type { Metadata } from "next";
import { LiveLibraryClient } from "@/components/jasonos/meeting-prep/live-library-client";
import {
  getLibraryRelationship,
  listLibraryFacets,
  listLiveMeetings,
  type LibraryMark,
} from "@/lib/server-actions/live-library";

export const metadata: Metadata = { title: "Library · Live · JasonOS" };
export const dynamic = "force-dynamic";

const MARKS = new Set<LibraryMark>(["hit", "partial", "missed", "unmarked"]);

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LiveLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mark = one(query.mark);
  const person = one(query.person);
  const filters = {
    person,
    strategy: one(query.strategy),
    mark: MARKS.has(mark as LibraryMark) ? (mark as LibraryMark) : null,
    from: one(query.from),
    to: one(query.to),
    q: one(query.q),
  };
  const [meetingsResult, facetsResult, relationshipResult] = await Promise.all([
    listLiveMeetings(filters),
    listLibraryFacets(),
    person ? getLibraryRelationship(person) : Promise.resolve(null),
  ]);
  const error = !meetingsResult.ok
    ? meetingsResult.error
    : !facetsResult.ok
      ? facetsResult.error
      : relationshipResult && !relationshipResult.ok
        ? relationshipResult.error
        : null;
  return (
    <LiveLibraryClient
      meetings={meetingsResult.ok ? meetingsResult.meetings : []}
      facets={
        facetsResult.ok
          ? facetsResult.facets
          : { people: [], strategies: [], marks: { all: 0, hit: 0, partial: 0, missed: 0, unmarked: 0 } }
      }
      relationship={relationshipResult && relationshipResult.ok ? relationshipResult.relationship : null}
      error={error}
    />
  );
}
