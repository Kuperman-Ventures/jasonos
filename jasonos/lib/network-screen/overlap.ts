/** Decide whether an imported capture only shows mutual / 1st-degree people. */
export function isOverlapOnlyImport(input: {
  totalCountLabel: string | null | undefined;
  degrees: Array<string | null | undefined>;
}): boolean {
  const label = input.totalCountLabel?.trim() || null;
  const allFirstDegree =
    input.degrees.length > 0 && input.degrees.every((degree) => degree === "1st");
  return !label || allFirstDegree;
}
