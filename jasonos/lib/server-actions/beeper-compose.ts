"use server";

import {
  BeeperApiError,
  focusBeeperChatForContact,
  isBeeperConfigured,
  type FocusBeeperResult,
} from "@/lib/integrations/beeper";
import { beeperTextFallbackLink } from "@/lib/integrations/beeper-links";
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
    const href = beeperTextFallbackLink(phone);
    if (href === "beeper://focus" && !phone) {
      return {
        ok: false,
        error: "No phone on file for this contact, and Beeper is not configured.",
      };
    }
    return {
      ok: true,
      opened: href.startsWith("beeper://compose/") ? "chat" : "app",
      chatTitle: name || undefined,
      href,
    };
  }

  try {
    return await focusBeeperChatForContact({ name, phone });
  } catch (err) {
    if (err instanceof BeeperApiError) {
      const href = beeperTextFallbackLink(phone);
      if (href !== "beeper://focus") {
        return {
          ok: true,
          opened: "chat",
          chatTitle: name || undefined,
          href,
        };
      }
      return { ok: false, error: err.message };
    }
    const href = beeperTextFallbackLink(phone);
    if (href !== "beeper://focus") {
      return {
        ok: true,
        opened: "chat",
        chatTitle: name || undefined,
        href,
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not open Beeper.",
    };
  }
}
