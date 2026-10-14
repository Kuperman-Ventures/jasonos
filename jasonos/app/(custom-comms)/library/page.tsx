import type { Metadata } from "next";
import { LibraryClient } from "@/components/jasonos/library/library-client";
import {
  listLibraryCompanies,
  listLibraryItems,
  listLibraryKinds,
} from "@/lib/server-actions/library";

export const metadata: Metadata = { title: "Library · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.item) ? params.item[0] : params.item;
  const [itemsRes, kindsRes, companiesRes] = await Promise.all([
    listLibraryItems(),
    listLibraryKinds(),
    listLibraryCompanies(),
  ]);
  const loadError = !itemsRes.ok
    ? itemsRes.error
    : !kindsRes.ok
      ? kindsRes.error
      : !companiesRes.ok
        ? companiesRes.error
        : null;

  return (
    <LibraryClient
      initialItems={itemsRes.ok ? itemsRes.items : []}
      initialKinds={kindsRes.ok ? kindsRes.kinds : []}
      companies={companiesRes.ok ? companiesRes.companies : []}
      initialItemId={requested ?? null}
      loadError={loadError}
    />
  );
}
