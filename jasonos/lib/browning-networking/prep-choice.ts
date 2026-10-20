export const BROWNING_FIRST_CALL = "Browning Networking - First Call";
export const BROWNING_SECOND_CALL = "Browning Networking - Second Call";

export function chooseBrowningStrategyName(hasPriorHeldMeeting: boolean): string {
  return hasPriorHeldMeeting ? BROWNING_SECOND_CALL : BROWNING_FIRST_CALL;
}

export function shouldSkipPlanBuild(input: {
  planBuiltAt: string | null | undefined;
  pointCount: number;
  force?: boolean;
}): boolean {
  if (input.force) return false;
  if (input.planBuiltAt) return true;
  if (input.pointCount > 0) return true;
  return false;
}
