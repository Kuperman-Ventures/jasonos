"use server";

import {
  BeeperApiError,
  BeeperUnavailableError,
  focusBeeperChatForContact,
  isBeeperConfigured,
  type FocusBeeperResult,
} from "@/lib/integrations/beeper";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function openBeeperText(
  contactId: string
): Promise<FocusBeeperResult> {
  if (!contactId) return { ok: false, error: "Missing contact." };
  if (!isBeeperConfigured()) {
    return {
      ok: false,
      error: "Beeper is not configured. Set BEEPER_ACCESS_TOKEN.",
    };
  }
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

  try {
    return await focusBeeperChatForContact({
      name: data.name as string | null,
      phone: (data.phone as string | null) ?? null,
    });
  } catch (err) {
    if (err instanceof BeeperUnavailableError) {
      return {
        ok: false,
        error: "Beeper Desktop is closed or unreachable. Open it and try again.",
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
