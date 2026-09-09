"use server";

import {
  BeeperApiError,
  BeeperUnavailableError,
  focusBeeperChatForContact,
  isBeeperConfigured,
  type FocusBeeperResult,
} from "@/lib/integrations/beeper";
import { normalizePhone } from "@/lib/outreach/contact-lookup";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function openBeeperText(
  contactId: string
): Promise<FocusBeeperResult> {
  if (!contactId) return { ok: false, error: "Missing contact." };
  if (!(await isBeeperConfigured())) {
    return {
      ok: false,
      error: "Beeper is not configured. Paste a token in Settings → Beeper.",
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
    const result = await focusBeeperChatForContact({
      name: data.name as string | null,
      phone: (data.phone as string | null) ?? null,
    });
    if (
      result.ok &&
      result.opened === "chat" &&
      result.phone &&
      !data.phone &&
      normalizePhone(result.phone)
    ) {
      await sb
        .from("contacts")
        .update({ phone: result.phone })
        .eq("id", contactId)
        .is("phone", null);
    }
    return result;
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
