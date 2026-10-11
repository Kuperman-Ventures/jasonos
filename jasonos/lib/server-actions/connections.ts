"use server";

import { revalidatePath } from "next/cache";
import { etDate } from "@/lib/connections/logic";
import {
  deleteGrant,
  updateGrant,
  upsertCoverage,
  upsertGrant,
} from "@/lib/connections/store";
import type { CoverageState, GrantStatus } from "@/lib/connections/types";

type Result = { ok: true } | { ok: false; error: string };

const PATH = "/settings/connections";

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
    revalidatePath(PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface GrantFormValues {
  identity: string;
  hub: string;
  target: string;
  access: string;
  used_by: string;
  status: GrantStatus;
  evidence: string;
  check_at: string;
}

export async function createGrantAction(values: GrantFormValues): Promise<Result> {
  return run(() => upsertGrant({ ...values, verified_on: etDate() }, "jasonos", { createNew: true }));
}

export async function editGrantAction(id: string, values: GrantFormValues): Promise<Result> {
  return run(() => updateGrant(id, values, "jasonos"));
}

export async function setGrantStatusAction(id: string, status: GrantStatus): Promise<Result> {
  return run(() => updateGrant(id, { status }, "jasonos"));
}

export async function markGrantVerifiedAction(id: string): Promise<Result> {
  return run(() => updateGrant(id, { verified_on: etDate() }, "jasonos"));
}

export async function deleteGrantAction(id: string): Promise<Result> {
  return run(() => deleteGrant(id, "jasonos"));
}

export async function setCoverageAction(input: {
  id: string;
  source: string;
  state: CoverageState;
  note: string;
}): Promise<Result> {
  return run(() => upsertCoverage(input, "jasonos"));
}
