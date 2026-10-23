import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonClient } from "@/components/jasonos/people/person-client";
import { getPerson } from "@/lib/server-actions/person";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getPerson(id);
  return { title: `${result.ok ? result.person.name : "Person"} · People · JasonOS` };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPerson(id);
  if (!result.ok) {
    if (result.error === "Person not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-8">
        <p className="text-[15px] text-[var(--jos-ink)]">{result.error}</p>
        <Link href="/live/people" className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline">
          Back to People
        </Link>
      </div>
    );
  }
  return <PersonClient person={result.person} nowIso={new Date().toISOString()} />;
}
