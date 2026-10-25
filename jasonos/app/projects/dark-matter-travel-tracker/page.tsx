import { DarkMatterBoard } from "@/components/dark-matter/board";
import { getTravelTracker } from "@/lib/dark-matter-travel-tracker/store";

export const dynamic = "force-dynamic";

export default async function DarkMatterTravelTrackerPage() {
  const payload = await getTravelTracker();
  return <DarkMatterBoard trips={payload.trips} />;
}
