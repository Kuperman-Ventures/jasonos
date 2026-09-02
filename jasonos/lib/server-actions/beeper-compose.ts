"use server";

import {
  BeeperApiError,
  focusBeeperChatForContact,
  isBeeperConfigured,
  type FocusBeeperResult,
} from "@/lib/integrations/beeper";
import { resolveBeeperTextFallback } from "@/lib/integrations/beeper-links";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function openBeeperText(
  contactId: string
): Promise<FocusBeeperResult> {
  if (!contactId) return { ok: false, error: "Missing contact." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Not configured." };
  }

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("name, phone")
    .eq("id", contactId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Contact not found." };

  const name = data.name as string | null;
  const phone = (data.phone as string | null) ?? null;

  if (!isBeeperConfigured()) {
    const link = resolveBeeperTextFallback(phone);
    if (!link.targetsChat && !phone) {
      return {
        ok: false,
        error:
          "No phone on file for this contact, so Beeper cannot open their chat from here.",
      };
    }
    return {
      ok: true,
      opened: link.targetsChat ? "chat" : "app",
      chatTitle: name || undefined,
      href: link.href,
      gap: link.gap,
    };
  }

  try {
    return await focusBeeperChatForContact({ name, phone });
  } catch (err) {
    const link = resolveBeeperTextFallback(phone);
    if (link.targetsChat) {
      return {
        ok: true,
        opened: "chat",
        chatTitle: name || undefined,
        href: link.href,
      };
    }
    if (err instanceof BeeperApiError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not open Beeper.",
    };
  }
}
