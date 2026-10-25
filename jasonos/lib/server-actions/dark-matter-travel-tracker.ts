"use server";

import { revalidatePath } from "next/cache";
import { DARK_MATTER_ROOT, DARK_MATTER_SHORT } from "@/lib/dark-matter-travel-tracker/types";
import {
  addItem,
  addTraveler,
  createTrip,
  deleteTrip,
  removeItem,
  removeTraveler,
  updateTrip,
} from "@/lib/dark-matter-travel-tracker/store";
import type { ItemWrite, TripWrite } from "@/lib/dark-matter-travel-tracker/types";

type ActionResult<T = { slug: string }> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateTrip(slug?: string) {
  revalidatePath(DARK_MATTER_ROOT);
  revalidatePath(DARK_MATTER_SHORT);
  revalidatePath(`${DARK_MATTER_ROOT}/[slug]`, "page");
  if (slug) revalidatePath(`${DARK_MATTER_ROOT}/${slug}`);
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    console.error("[dark-matter.action]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createDarkMatterTrip(input: TripWrite): Promise<ActionResult> {
  const result = await run(async () => {
    const trip = await createTrip(input);
    revalidateTrip(trip.slug);
    return { slug: trip.slug };
  });
  return result;
}

export async function updateDarkMatterTrip(
  slug: string,
  input: Partial<TripWrite>
): Promise<ActionResult> {
  return run(async () => {
    const trip = await updateTrip(slug, input);
    revalidateTrip(trip.slug);
    return { slug: trip.slug };
  });
}

export async function deleteDarkMatterTrip(slug: string): Promise<ActionResult> {
  return run(async () => {
    await deleteTrip(slug);
    revalidateTrip();
    return { slug };
  });
}

export async function addDarkMatterTraveler(
  slug: string,
  name: string
): Promise<ActionResult> {
  return run(async () => {
    await addTraveler(slug, name);
    revalidateTrip(slug);
    return { slug };
  });
}

export async function removeDarkMatterTraveler(
  slug: string,
  travelerId: string
): Promise<ActionResult> {
  return run(async () => {
    await removeTraveler(slug, travelerId);
    revalidateTrip(slug);
    return { slug };
  });
}

export async function addDarkMatterItem(
  slug: string,
  input: ItemWrite
): Promise<ActionResult> {
  return run(async () => {
    await addItem(slug, input);
    revalidateTrip(slug);
    return { slug };
  });
}

export async function removeDarkMatterItem(
  slug: string,
  itemId: string
): Promise<ActionResult> {
  return run(async () => {
    await removeItem(slug, itemId);
    revalidateTrip(slug);
    return { slug };
  });
}
