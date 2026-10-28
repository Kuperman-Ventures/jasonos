export const BROWNING_FIRST_CALL = "Net 102 First Call";
export const BROWNING_SECOND_CALL = "Net 102 Second Call";

export function chooseBrowningStrategyName(hasPriorHeldMeeting: boolean): string {
  return hasPriorHeldMeeting ? BROWNING_SECOND_CALL : BROWNING_FIRST_CALL;
}

export function shouldSkipPlanBuild(input: {
  planBuiltAt: string | null | undefined;
  force?: boolean;
}): boolean {
  if (input.force) return false;
  return Boolean(input.planBuiltAt);
}
