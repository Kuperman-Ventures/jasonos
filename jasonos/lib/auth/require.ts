import "server-only";

import { isJasonosEmail } from "@/lib/auth/allowlist";
import { createPublicClient } from "@/lib/supabase/server";

export async function requireJasonosUser() {
  const supabase = await createPublicClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("not_authenticated");
  if (!isJasonosEmail(data.user.email)) throw new Error("not_authenticated");
  return { supabase, user: data.user, userId: data.user.id };
}
