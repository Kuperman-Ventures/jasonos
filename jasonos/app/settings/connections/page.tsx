import { getConnectionsRegister } from "@/lib/connections/store";
import { ConnectionsRegisterClient } from "@/components/jasonos/settings/connections/connections-register-client";
import type { ConnectionsRegister } from "@/lib/connections/types";

export const metadata = { title: "Connections · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  let register: ConnectionsRegister | null = null;
  let loadError: string | null = null;
  try {
    register = await getConnectionsRegister();
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }
  return <ConnectionsRegisterClient register={register} loadError={loadError} />;
}
