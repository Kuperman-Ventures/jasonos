import "server-only";

import { OUTLOOK_WRAP_EMAIL } from "@/lib/integrations/unwrap-forwarded-mail";
import {
  OUTLOOK_MAX_PAGES,
  OUTLOOK_PAGE_SIZE,
  dedupeOutlookMessages,
  graphSinceTimestamp,
  mapGraphMessage,
  rankOutlookFolders,
  type GraphMessage,
  type OutlookFolderRef,
  type OutlookMessage,
} from "@/lib/integrations/outlook-mail";

export interface OutlookMailFetch {
  messages: OutlookMessage[];
  warnings: string[];
}

const FALLBACK_FOLDERS: OutlookFolderRef[] = [
  { id: "sentitems", displayName: "Sent Items", wellKnownName: "sentitems" },
  { id: "inbox", displayName: "Inbox", wellKnownName: "inbox" },
  { id: "archive", displayName: "Archive", wellKnownName: "archive" },
];

interface GraphList<T> {
  value?: T[];
  "@odata.nextLink"?: string;
  error?: { code?: string; message?: string };
}

function graphErrorMessage(status: number, body: GraphList<unknown> | null): string {
  const detail = body?.error?.message ?? body?.error?.code ?? "";
  return `Outlook Graph ${status}${detail ? `: ${detail.slice(0, 180)}` : ""}`;
}

async function graphGet(
  token: string,
  url: string
): Promise<{ status: number; body: GraphList<never> | null }> {
  const full = url.startsWith("http") ? url : `https://graph.microsoft.com/v1.0${url}`;
  const res = await fetch(full, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let body: GraphList<never> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as GraphList<never>;
    } catch {
      body = { error: { message: text.slice(0, 180) } };
    }
  }
  if (res.status === 401) {
    throw new Error(
      `${OUTLOOK_WRAP_EMAIL}: sign-in expired. Reconnect Outlook in Settings.`
    );
  }
  return { status: res.status, body };
}

async function listChildFolders(
  token: string,
  parentId: string
): Promise<OutlookFolderRef[]> {
  const { status, body } = await graphGet(
    token,
    `/me/mailFolders/${encodeURIComponent(parentId)}/childFolders?$top=40&$select=id,displayName`
  );
  if (status === 404) return [];
  if (status < 200 || status >= 300) {
    throw new Error(graphErrorMessage(status, body));
  }
  return ((body?.value ?? []) as Array<{ id?: string; displayName?: string }>)
    .filter((folder) => folder.id)
    .map((folder) => ({
      id: folder.id as string,
      displayName: folder.displayName?.trim() || "Folder",
    }));
}

async function listFolders(token: string): Promise<{
  folders: OutlookFolderRef[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const { status, body } = await graphGet(
    token,
    "/me/mailFolders?$top=50&$select=id,displayName,wellKnownName"
  );
  if (status < 200 || status >= 300) {
    warnings.push(
      `Could not list Outlook folders (${graphErrorMessage(status, body)}). Scanned Sent, Inbox, and Archive only.`
    );
    return { folders: FALLBACK_FOLDERS, warnings };
  }

  const top = ((body?.value ?? []) as Array<{
    id?: string;
    displayName?: string;
    wellKnownName?: string | null;
  }>)
    .filter((folder) => folder.id)
    .map((folder) => ({
      id: folder.id as string,
      displayName: folder.displayName?.trim() || "Folder",
      wellKnownName: folder.wellKnownName ?? null,
    }));

  const parents = top.filter((folder) => {
    const well = (folder.wellKnownName ?? "").toLowerCase();
    const name = folder.displayName.toLowerCase();
    return well === "inbox" || well === "archive" || name === "inbox" || name === "archive";
  });

  const children: OutlookFolderRef[] = [];
  for (const parent of parents) {
    try {
      children.push(...(await listChildFolders(token, parent.id)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`${parent.displayName} subfolders: ${msg}`);
    }
  }

  return { folders: [...top, ...children], warnings };
}

function messagesPath(folderId: string, sinceIso: string, useFilter: boolean): string {
  const params = new URLSearchParams({
    $top: String(OUTLOOK_PAGE_SIZE),
    $select:
      "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,isDraft",
    $orderby: "receivedDateTime desc",
  });
  if (useFilter) {
    params.set("$filter", `receivedDateTime ge ${graphSinceTimestamp(sinceIso)}`);
  }
  return `/me/mailFolders/${encodeURIComponent(folderId)}/messages?${params}`;
}

async function listFolderMessages(
  token: string,
  folder: OutlookFolderRef,
  sinceIso: string
): Promise<GraphMessage[]> {
  const sinceMs = new Date(sinceIso).getTime();
  let url = messagesPath(folder.id, sinceIso, true);
  let allowFilterRetry = true;
  const out: GraphMessage[] = [];

  for (let page = 0; page < OUTLOOK_MAX_PAGES; page += 1) {
    const { status, body } = await graphGet(token, url);
    if ((status === 400 || status === 404) && allowFilterRetry) {
      allowFilterRetry = false;
      if (status === 404) return [];
      url = messagesPath(folder.id, sinceIso, false);
      page -= 1;
      continue;
    }
    if (status === 404) return out;
    if (status < 200 || status >= 300) {
      throw new Error(graphErrorMessage(status, body));
    }
    const batch = (body?.value ?? []) as GraphMessage[];
    out.push(...batch);
    const oldest = batch.reduce((min, message) => {
      const raw = message.receivedDateTime || message.sentDateTime;
      const ms = raw ? new Date(raw).getTime() : Number.NaN;
      return Number.isFinite(ms) ? Math.min(min, ms) : min;
    }, Number.POSITIVE_INFINITY);
    const next = body?.["@odata.nextLink"];
    if (!next || batch.length === 0) break;
    if (Number.isFinite(oldest) && oldest < sinceMs) break;
    url = next;
  }

  return out;
}

/**
 * Recent mail from Sent, Inbox, Archive, and other non-junk folders.
 * Calendar scope is requested at consent; this pass is mail only.
 */
export async function listOutlookMessages(
  accessToken: string,
  sinceIso: string
): Promise<OutlookMailFetch> {
  const listed = await listFolders(accessToken);
  const folders = rankOutlookFolders(listed.folders);
  const warnings = [...listed.warnings];
  const collected: OutlookMessage[] = [];
  const sinceMs = new Date(sinceIso).getTime();

  for (const folder of folders) {
    try {
      const raw = await listFolderMessages(accessToken, folder, sinceIso);
      for (const message of raw) {
        const mapped = mapGraphMessage(message);
        if (!mapped) continue;
        if (new Date(mapped.date).getTime() < sinceMs) continue;
        collected.push(mapped);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/sign-in expired/i.test(msg)) throw err;
      warnings.push(`${folder.displayName}: ${msg}`);
    }
  }

  return { messages: dedupeOutlookMessages(collected), warnings };
}
