export function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ ok: false, error: message }),
      },
    ],
  };
}

export async function runTool<T>(fn: () => Promise<T>) {
  try {
    return jsonResult(await fn());
  } catch (error) {
    return errorResult(error);
  }
}

/** One open issue, not one row. Product Health used to insert a new alert on every cron. */
export function uniqueIssueCount(
  rows: Array<{ source?: string | null; title?: string | null }> | null | undefined
): number {
  if (!rows?.length) return 0;
  return new Set(rows.map((row) => `${row.source ?? ""}\t${row.title ?? ""}`)).size;
}

/** Strip PostgREST filter metacharacters from a free-text search. */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[%_,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
