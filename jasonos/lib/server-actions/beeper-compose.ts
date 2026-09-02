"use server";

import {
  BeeperApiError,
  beeperLocalOpenConfig,
  focusBeeperChatForContact,
  isBeeperConfigured,
  type FocusBeeperResult,
} from "@/lib/integrations/beeper";
import {
  resolveBeeperTextFallback,
  toE164,
} from "@/lib/integrations/beeper-links";
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
  const phone = toE164((data.phone as string | null) ?? null);
  const localApi = beeperLocalOpenConfig() || undefined;

  if (!isBeeperConfigured()) {
    if (!phone) {
      return {
        ok: false,
        error:
          "No phone on file for this contact, so Beeper cannot open their chat from here.",
      };
    }
    const link = resolveBeeperTextFallback(phone);
    return {
      ok: true,
      opened: "app",
      chatTitle: name || undefined,
      href: link.href,
      phone,
      networkHint: "iMessage",
      localApi,
      gap: link.gap,
    };
  }

  try {
    return await focusBeeperChatForContact({ name, phone });
  } catch (err) {
    if (phone) {
      const link = resolveBeeperTextFallback(phone);
      return {
        ok: true,
        opened: "app",
        chatTitle: name || undefined,
        href: link.href,
        phone,
        networkHint: "iMessage",
        localApi,
        gap: link.gap,
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
