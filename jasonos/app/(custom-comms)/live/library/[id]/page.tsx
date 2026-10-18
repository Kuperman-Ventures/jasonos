import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRecordClient } from "@/components/jasonos/meeting-prep/live-record-client";
import { getLiveMeetingRecord } from "@/lib/server-actions/live-library";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getLiveMeetingRecord(id);
  const title = result.ok ? result.record.prep.title : "Meeting";
  return { title: `${title} · Library · JasonOS` };
}

export default async function LiveRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getLiveMeetingRecord(id);
  if (!result.ok) {
    if (result.error === "Meeting prep not found." || result.error === "Meeting not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-8">
        <p className="text-[15px] text-[var(--jos-ink)]">{result.error}</p>
        <Link href="/live/library" className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline">
          Back to the library
        </Link>
      </div>
    );
  }
  return <LiveRecordClient record={result.record} />;
}
