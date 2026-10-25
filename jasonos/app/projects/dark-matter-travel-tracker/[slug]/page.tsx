import { notFound } from "next/navigation";
import { DarkMatterTripView } from "@/components/dark-matter/trip-view";
import { getTripBySlug } from "@/lib/dark-matter-travel-tracker/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);
  return {
    title: trip ? `${trip.title} · Dark Matter Travel Tracker` : "Trip not found",
  };
}

export default async function DarkMatterTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);
  if (!trip) notFound();
  return <DarkMatterTripView trip={trip} />;
}
