"use server";

import { revalidatePath } from "next/cache";
import {
  BeeperApiError,
  BeeperUnavailableError,
  fetchBeeperTouchCandidatesForContact,
  focusBeeperChatForContact,
  isBeeperConfigured,
} from "@/lib/integrations/beeper";
import { beeperHrefStrings } from "@/lib/integrations/beeper-links";
import { etToday } from "@/lib/dates";
import {
  isUsablePhone,
  looksLikeEmail,
  normalizePhone,
} from "@/lib/outreach/contact-lookup";
import {
  insertContactTouches,
  type ContactTouchInput,
} from "@/lib/outreach/touch-capture";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type OpenBeeperTextResult =
  | {
      ok: true;
      opened: "chat" | "app";
      chatTitle?: string;
      phone?: string | null;
      /** Ordered beeper:// / sms: URLs for this Mac. Browser retries if one fails. */
      hrefs: string[];
      /** New Beeper messages written into contact_touches for this person. */
      touchesLogged: number;
      /** True when last_touch_date is today after this call. */
      clearedOverdue: boolean;
    }
  | { ok: false; error: string; hrefs?: string[] };

export type ConfirmBeeperTextResult =
  | {
      ok: true;
      touchesLogged: number;
      clearedOverdue: boolean;
      source: "beeper" | "manual";
    }
  | { ok: false; error: string };

function oneLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned;
}

function revalidateOutreachPaths() {
  revalidatePath("/");
  revalidatePath("/outreach");
}

async function loadContact(contactId: string) {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("id, name, phone, emails, last_touch_date, next_touch_date")
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    name: string | null;
    phone: string | null;
    emails: string[] | null;
    last_touch_date: string | null;
    next_touch_date: string | null;
  } | null;
}

/**
 * Write a real phone from Beeper onto the contact. Also replaces an email
 * that was mistakenly stored in `phone` (common CRM import mess), moving
 * that address into `emails` so future matching still works.
 */
async function enrichPhoneIfMissing(
  contactId: string,
  existingPhone: string | null,
  foundPhone: string | null | undefined,
  existingEmails: string[] | null = null
) {
  if (!foundPhone || !normalizePhone(foundPhone)) return;
  if (isUsablePhone(existingPhone)) return;
  const sb = createServiceRoleClient();
  const patch: { phone: string; emails?: string[] } = { phone: foundPhone };
  if (looksLikeEmail(existingPhone)) {
    const emails = [...(existingEmails ?? [])];
    const email = existingPhone!.trim();
    if (!emails.some((e) => e.toLowerCase() === email.toLowerCase())) {
      emails.push(email);
    }
    patch.emails = emails;
  }
  await sb.from("contacts").update(patch).eq("id", contactId);
}

function touchesFromBeeperCandidates(
  contactId: string,
  candidates: Awaited<
    ReturnType<typeof fetchBeeperTouchCandidatesForContact>
  > extends infer T
    ? T extends { candidates: infer C }
      ? C
      : never
    : never
): ContactTouchInput[] {
  return candidates.map((c) => {
    const network = c.network ? ` via ${c.network}` : "";
    const preview = oneLine(c.text);
    return {
      contact_id: contactId,
      channel: "text" as const,
      direction: c.direction,
      touched_at: c.timestamp,
      source: "beeper" as const,
      external_id: `beeper:${c.chatId}:${c.messageId}`,
      brief: preview
        ? `${c.direction === "outbound" ? "Sent" : "Received"} text${network}: ${preview}`
        : `${c.direction === "outbound" ? "Sent" : "Received"} message${network}`,
      subject: c.chatTitle || c.peer.name || "Beeper chat",
      thread_url: null,
      objective_achieved: "neutral" as const,
    };
  });
}

async function pullAndInsertBeeperTouches(contact: {
  id: string;
  name: string | null;
  phone: string | null;
  emails?: string[] | null;
}): Promise<{ inserted: number; phone: string | null }> {
  const found = await fetchBeeperTouchCandidatesForContact(
    { name: contact.name, phone: contact.phone, emails: contact.emails },
    { daysBack: 21, includeInbound: true, maxMessagesPerChat: 30 }
  );
  if (!found?.candidates.length) {
    return { inserted: 0, phone: found?.phone ?? null };
  }
  const insert = await insertContactTouches(
    touchesFromBeeperCandidates(contact.id, found.candidates)
  );
  return { inserted: insert.inserted, phone: found.phone };
}

async function contactClearedOverdue(contactId: string): Promise<boolean> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("contacts")
    .select("last_touch_date, next_touch_date")
    .eq("id", contactId)
    .maybeSingle();
  const today = etToday();
  const last = (data?.last_touch_date as string | null) ?? null;
  return Boolean(last && last.slice(0, 10) === today);
}

function phoneHrefs(phone?: string | null): string[] {
  return beeperHrefStrings({ phone, network: "iMessage" });
}

/**
 * Open the person's Beeper chat, then pull recent messages for that chat into
 * contact_touches. Opening alone never cleared overdue; Sync had to run and
 * match them. Text now does the per-person pull so a send → Text-again (or a
 * Text after an already-sent message) advances last_touch / next_touch.
 *
 * Always returns portable compose links so the browser can retry formats on
 * this Mac when tunneled `/v1/focus` cannot open the thread.
 */
export async function openBeeperText(
  contactId: string
): Promise<OpenBeeperTextResult> {
  if (!contactId) return { ok: false, error: "Missing contact." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Not configured." };
  }

  let contact;
  try {
    contact = await loadContact(contactId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load contact.",
    };
  }
  if (!contact) return { ok: false, error: "Contact not found." };

  const fallbackHrefs = phoneHrefs(contact.phone);

  if (!(await isBeeperConfigured())) {
    if (fallbackHrefs.length) {
      return {
        ok: true,
        opened: "app",
        phone: contact.phone,
        hrefs: fallbackHrefs,
        touchesLogged: 0,
        clearedOverdue: false,
      };
    }
    return {
      ok: false,
      error: "Beeper is not configured. Paste a token in Settings → Beeper.",
    };
  }

  try {
    const result = await focusBeeperChatForContact({
      name: contact.name,
      phone: contact.phone,
      emails: contact.emails,
    });
    if (!result.ok) {
      return fallbackHrefs.length
        ? { ...result, hrefs: fallbackHrefs }
        : result;
    }

    const phoneFromFocus = result.phone ?? null;
    await enrichPhoneIfMissing(
      contactId,
      contact.phone,
      phoneFromFocus,
      contact.emails
    );

    let touchesLogged = 0;
    try {
      const pulled = await pullAndInsertBeeperTouches({
        id: contact.id,
        name: contact.name,
        phone: phoneFromFocus ?? contact.phone,
        emails: contact.emails,
      });
      touchesLogged = pulled.inserted;
      await enrichPhoneIfMissing(
        contactId,
        phoneFromFocus ?? contact.phone,
        pulled.phone,
        contact.emails
      );
    } catch (err) {
      // Opening the chat still succeeded — don't fail the whole Text action
      // if the follow-up pull flakes. User can hit "I sent it" / Text again.
      console.warn("[beeper-compose.openBeeperText.pull]", contact.name, err);
    }

    const clearedOverdue = await contactClearedOverdue(contactId);
    if (touchesLogged > 0 || clearedOverdue) revalidateOutreachPaths();

    return {
      ok: true,
      opened: result.opened,
      chatTitle: result.chatTitle,
      phone: phoneFromFocus ?? contact.phone,
      hrefs: result.hrefs.length ? result.hrefs : fallbackHrefs,
      touchesLogged,
      clearedOverdue,
    };
  } catch (err) {
    if (err instanceof BeeperUnavailableError) {
      if (fallbackHrefs.length) {
        return {
          ok: true,
          opened: "app",
          phone: contact.phone,
          hrefs: fallbackHrefs,
          touchesLogged: 0,
          clearedOverdue: false,
        };
      }
      return {
        ok: false,
        error:
          "Beeper Desktop is closed or unreachable. Open it and try again.",
      };
    }
    if (err instanceof BeeperApiError) {
      return fallbackHrefs.length
        ? { ok: false, error: err.message, hrefs: fallbackHrefs }
        : { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not open Beeper.",
      hrefs: fallbackHrefs.length ? fallbackHrefs : undefined,
    };
  }
}

/**
 * After Text opens Beeper and Jason sends, this confirms the send:
 * 1) Pull Beeper messages for that person and insert any new ones.
 * 2) If nothing new showed up yet, log a manual text touch for today so
 *    overdue clears immediately.
 */
export async function confirmBeeperTextSent(
  contactId: string
): Promise<ConfirmBeeperTextResult> {
  if (!contactId) return { ok: false, error: "Missing contact." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Not configured." };
  }

  let contact;
  try {
    contact = await loadContact(contactId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load contact.",
    };
  }
  if (!contact) return { ok: false, error: "Contact not found." };

  if (await isBeeperConfigured()) {
    try {
      const pulled = await pullAndInsertBeeperTouches(contact);
      await enrichPhoneIfMissing(contactId, contact.phone, pulled.phone, contact.emails);
      if (pulled.inserted > 0) {
        const clearedOverdue = await contactClearedOverdue(contactId);
        revalidateOutreachPaths();
        return {
          ok: true,
          touchesLogged: pulled.inserted,
          clearedOverdue,
          source: "beeper",
        };
      }
    } catch (err) {
      console.warn(
        "[beeper-compose.confirmBeeperTextSent.pull]",
        contact.name,
        err
      );
    }
  }

  const insert = await insertContactTouches([
    {
      contact_id: contactId,
      channel: "text",
      direction: "outbound",
      touched_at: new Date().toISOString(),
      source: "manual",
      brief: "Sent text via Beeper",
      subject: contact.name,
      objective_achieved: "neutral",
    },
  ]);
  if (insert.errors.length) {
    return { ok: false, error: insert.errors.join("; ") };
  }
  const clearedOverdue = await contactClearedOverdue(contactId);
  revalidateOutreachPaths();
  return {
    ok: true,
    touchesLogged: insert.inserted,
    clearedOverdue,
    source: "manual",
  };
}
