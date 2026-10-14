"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Library } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/jasonos/brand/page-header";
import { type CopyButtonHandle } from "@/components/jasonos/library/copy-button";
import { LibraryDetail } from "@/components/jasonos/library/library-detail";
import { LibraryItemDialog } from "@/components/jasonos/library/library-item-dialog";
import { LibraryRail } from "@/components/jasonos/library/library-rail";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  librarySearchMatch,
  type LibraryChannel,
} from "@/lib/library/text";
import {
  deleteLibraryItem,
  recordLibraryCopy,
  type LibraryContact,
  type LibraryItem,
  type LibraryKind,
} from "@/lib/server-actions/library";

function contactOptions(items: LibraryItem[]) {
  const map = new Map<string, LibraryContact>();
  for (const item of items) {
    for (const contact of item.contacts) {
      if (!map.has(contact.id)) map.set(contact.id, contact);
    }
  }
  const rows = [...map.values()];
  const nameCount = new Map<string, number>();
  for (const row of rows) nameCount.set(row.name, (nameCount.get(row.name) ?? 0) + 1);
  return rows
    .map((row) => ({
      value: row.id,
      label:
        (nameCount.get(row.name) ?? 0) > 1 && row.company
          ? `${row.name} (${row.company})`
          : row.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

function uniqueSorted(values: Array<string | null>): string[] {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function LibraryClient({
  initialItems,
  initialKinds,
  companies: initialCompanies,
  initialItemId,
  loadError,
}: {
  initialItems: LibraryItem[];
  initialKinds: LibraryKind[];
  companies: string[];
  initialItemId: string | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState(initialItems);
  const [kinds, setKinds] = useState(initialKinds);
  const [companies, setCompanies] = useState(initialCompanies);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<LibraryChannel | "all">("all");
  const [contactId, setContactId] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "copied">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; session: number } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [outreach, setOutreach] = useState<LibraryContact | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<CopyButtonHandle>(null);
  const session = useRef(0);

  const [seenItems, setSeenItems] = useState(initialItems);
  if (seenItems !== initialItems) {
    setSeenItems(initialItems);
    setItems(initialItems);
  }
  const [seenKinds, setSeenKinds] = useState(initialKinds);
  if (seenKinds !== initialKinds) {
    setSeenKinds(initialKinds);
    setKinds(initialKinds);
  }
  const [seenCompanies, setSeenCompanies] = useState(initialCompanies);
  if (seenCompanies !== initialCompanies) {
    setSeenCompanies(initialCompanies);
    setCompanies(initialCompanies);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), searchInput ? 200 : 0);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filteredWithoutChannel = useMemo(
    () =>
      items.filter((item) => {
        if (!librarySearchMatch(item, search)) return false;
        if (contactId && !item.contacts.some((contact) => contact.id === contactId)) return false;
        if (companyFilter && (item.company ?? "").toLowerCase() !== companyFilter.toLowerCase()) {
          return false;
        }
        if (kindFilter && (item.kind ?? "").toLowerCase() !== kindFilter.toLowerCase()) return false;
        return true;
      }),
    [items, search, contactId, companyFilter, kindFilter]
  );

  const counts = useMemo(
    () => ({
      all: filteredWithoutChannel.length,
      email: filteredWithoutChannel.filter((item) => item.channel === "email").length,
      linkedin: filteredWithoutChannel.filter((item) => item.channel === "linkedin").length,
      text: filteredWithoutChannel.filter((item) => item.channel === "text").length,
    }),
    [filteredWithoutChannel]
  );

  const shown = useMemo(() => {
    const rows =
      channel === "all"
        ? filteredWithoutChannel
        : filteredWithoutChannel.filter((item) => item.channel === channel);
    return [...rows].sort((a, b) => {
      if (sort === "copied" && a.copyCount !== b.copyCount) return b.copyCount - a.copyCount;
      if (a.sentOn !== b.sentOn) return a.sentOn < b.sentOn ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }, [filteredWithoutChannel, channel, sort]);

  const resolvedId =
    selectedId && shown.some((item) => item.id === selectedId)
      ? selectedId
      : (shown[0]?.id ?? null);
  const selected = shown.find((item) => item.id === resolvedId) ?? null;
  const filtered = Boolean(
    search.trim() || channel !== "all" || contactId || companyFilter || kindFilter
  );
  const shortcutsBlocked = dialog !== null || deleteOpen || outreach !== null;

  const nextSelection =
    selectedId && shown.some((item) => item.id === selectedId)
      ? selectedId
      : (shown[0]?.id ?? null);
  if (nextSelection !== selectedId) setSelectedId(nextSelection);

  useEffect(() => {
    const expected = resolvedId ? `?item=${encodeURIComponent(resolvedId)}` : "";
    if (window.location.search === expected) return;
    router.replace(resolvedId ? `${pathname}?item=${encodeURIComponent(resolvedId)}` : pathname, {
      scroll: false,
    });
  }, [resolvedId, pathname, router]);

  function scrollRowIntoView(id: string) {
    window.setTimeout(() => {
      document.getElementById(`library-row-${id}`)?.scrollIntoView({ block: "nearest" });
    }, 0);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (shortcutsBlocked) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (event.key === "/") {
        event.preventDefault();
        searchBoxRef.current?.querySelector("input")?.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (shown.length === 0) return;
        event.preventDefault();
        const index = shown.findIndex((item) => item.id === resolvedId);
        const nextIndex =
          event.key === "ArrowDown"
            ? Math.min(shown.length - 1, index + 1)
            : Math.max(0, (index < 0 ? 0 : index) - 1);
        const next = shown[nextIndex];
        if (!next || next.id === resolvedId) return;
        setSelectedId(next.id);
        scrollRowIntoView(next.id);
        return;
      }
      if (event.repeat) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openCreate();
      } else if ((event.key === "e" || event.key === "E") && selected) {
        event.preventDefault();
        openEdit();
      } else if ((event.key === "c" || event.key === "C") && selected) {
        event.preventDefault();
        void copyRef.current?.copy();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openCreate() {
    session.current += 1;
    setDialog({ mode: "create", session: session.current });
  }

  function openEdit() {
    if (!selected) return;
    session.current += 1;
    setDialog({ mode: "edit", session: session.current });
  }

  function reveal(item: LibraryItem) {
    setSearchInput((value) => (librarySearchMatch(item, value) ? value : ""));
    setSearch((value) => (librarySearchMatch(item, value) ? value : ""));
    setChannel((value) => (value !== "all" && value !== item.channel ? "all" : value));
    setContactId((value) =>
      value && !item.contacts.some((contact) => contact.id === value) ? "" : value
    );
    setCompanyFilter((value) =>
      value && value.toLowerCase() !== (item.company ?? "").toLowerCase() ? "" : value
    );
    setKindFilter((value) =>
      value && value.toLowerCase() !== (item.kind ?? "").toLowerCase() ? "" : value
    );
    setSelectedId(item.id);
    scrollRowIntoView(item.id);
  }

  function handleSaved(item: LibraryItem) {
    setItems((current) =>
      current.some((row) => row.id === item.id)
        ? current.map((row) => (row.id === item.id ? item : row))
        : [item, ...current]
    );
    if (item.company) {
      setCompanies((current) => {
        if (current.some((name) => name.toLowerCase() === item.company!.toLowerCase())) {
          return current;
        }
        return [...current, item.company!].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );
      });
    }
    reveal(item);
    setDialog(null);
    toast.success("Saved to library.");
    router.refresh();
  }

  function onCopied(id: string) {
    const lastCopiedAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, copyCount: item.copyCount + 1, lastCopiedAt } : item
      )
    );
    void recordLibraryCopy(id);
  }

  async function confirmDelete() {
    if (!selected || deleting) return;
    const id = selected.id;
    const index = shown.findIndex((item) => item.id === id);
    const neighbor = shown[index + 1]?.id ?? shown[index - 1]?.id ?? null;
    setDeleting(true);
    const result = await deleteLibraryItem(id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedId(neighbor);
    setDeleteOpen(false);
    toast.success("Message deleted.");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 py-8 min-[900px]:px-8">
      <PageHeader
        kicker={
          <>
            <Library className="size-5" aria-hidden />
            Custom Comms
          </>
        }
        title="Library"
        description={`Messages you have written and sent. Search them, copy one, and reuse it. ${items.length} saved.`}
      />

      {loadError ? (
        <p
          role="alert"
          className="rounded-[2px] bg-[var(--jos-danger-tint)] px-3 py-2 text-[13px] text-[var(--color-accent-2-text)]"
        >
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-col gap-10 min-[900px]:flex-row min-[900px]:items-start">
        <LibraryRail
          search={searchInput}
          onSearchChange={setSearchInput}
          searchBoxRef={searchBoxRef}
          channel={channel}
          onChannelChange={setChannel}
          counts={counts}
          contactId={contactId}
          contactOptions={contactOptions(items)}
          onContactChange={setContactId}
          company={companyFilter}
          companyOptions={uniqueSorted(items.map((item) => item.company))}
          onCompanyChange={setCompanyFilter}
          kind={kindFilter}
          kindOptions={uniqueSorted(items.map((item) => item.kind))}
          onKindChange={setKindFilter}
          sort={sort}
          onSortChange={setSort}
          total={items.length}
          shownCount={shown.length}
          filtered={filtered}
          onClearFilters={() => {
            setSearchInput("");
            setSearch("");
            setChannel("all");
            setContactId("");
            setCompanyFilter("");
            setKindFilter("");
          }}
          items={shown}
          query={search}
          selectedId={resolvedId}
          onSelect={(id) => setSelectedId(id)}
          onAdd={openCreate}
          emptyLibrary={items.length === 0}
        />
        <LibraryDetail
          item={selected}
          query={search}
          emptyLibrary={items.length === 0}
          copyRef={copyRef}
          onCopied={onCopied}
          onEdit={openEdit}
          onDelete={() => setDeleteOpen(true)}
          onOpenContact={setOutreach}
        />
      </div>

      {dialog ? (
        <LibraryItemDialog
          key={dialog.session}
          mode={dialog.mode}
          item={dialog.mode === "edit" ? selected : null}
          kinds={kinds}
          companies={companies}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
          onOpenExisting={(id) => {
            const existing = items.find((item) => item.id === id);
            setDialog(null);
            if (existing) reveal(existing);
            else setSelectedId(id);
          }}
          onKinds={setKinds}
        />
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this message?</DialogTitle>
            <DialogDescription>
              This removes it from the Library. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="text-[15px] font-medium text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
            >
              Cancel
            </button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OutreachModal
        open={outreach !== null}
        onOpenChange={(open) => {
          if (!open) setOutreach(null);
        }}
        contactId={outreach?.id}
        initialDisplay={outreach ? { name: outreach.name } : undefined}
      />
    </div>
  );
}
