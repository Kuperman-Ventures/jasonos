import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * After a redeploy, an open tab can still call Server Action IDs from the
 * previous build. Next.js then throws UnrecognizedActionError. Reloading
 * picks up the current deployment's client + action map.
 *
 * Returns true when the error was handled (caller should stop).
 */
export function recoverFromStaleServerAction(error: unknown): boolean {
  if (!unstable_isUnrecognizedActionError(error)) return false;
  if (typeof window !== "undefined") {
    window.alert(
      "JasonOS was updated while this page was open. Reloading so your next action uses the new version."
    );
    window.location.reload();
  }
  return true;
}
