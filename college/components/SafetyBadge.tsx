import { isSafetySchool, type InterestLevel, type SelectivityTier } from "@/lib/types";

export function SafetyBadge({
  school,
}: {
  school: { selectivityTier: SelectivityTier; interestLevel: InterestLevel };
}) {
  if (!isSafetySchool(school)) return null;
  return <small className="safety-badge">Safety</small>;
}
