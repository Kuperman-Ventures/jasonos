import { RankScreen } from "@/components/rank/RankScreen";
import { todayInNewYork } from "@/lib/scoring/calendar";
import { loadRank } from "@/lib/scoring/loadRank";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mountain Rank · JasonOS",
};

export default async function RankPage() {
  const initial = await loadRank(todayInNewYork());
  return <RankScreen initial={initial} />;
}
