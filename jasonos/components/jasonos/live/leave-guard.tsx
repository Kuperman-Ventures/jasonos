"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeaveGuardContext, type GuardedField, type LeaveGuardValue } from "./leave-guard-context";

interface LeaveGuardState {
  /** Labels of fields with unsaved changes, in the order they reported. */
  dirtyLabels: string[];
  /** Runs `proceed` now, or asks Save / Discard / Keep editing first. */
  requestLeave: (proceed: () => void) => void;
}

const LeaveGuardStateContext = createContext<LeaveGuardState>({
  dirtyLabels: [],
  requestLeave: (proceed) => proceed(),
});

export function useLeaveGuard(): LeaveGuardState {
  return useContext(LeaveGuardStateContext);
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** Tracks unsaved fields below it. Browser leave gets the native prompt; in-app leave gets the dialog. */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const fields = useRef(new Map<string, GuardedField>());
  const [dirty, setDirty] = useState<Array<{ id: string; label: string }>>([]);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    const next = [...fields.current.entries()]
      .filter(([, field]) => field.dirty)
      .map(([id, field]) => ({ id, label: field.label }));
    setDirty((current) =>
      current.length === next.length && current.every((item, index) => item.id === next[index].id && item.label === next[index].label)
        ? current
        : next
    );
  }, []);

  const guard = useMemo<LeaveGuardValue>(
    () => ({
      report: (id, field) => {
        fields.current.set(id, field);
        refresh();
      },
      forget: (id) => {
        fields.current.delete(id);
        refresh();
      },
    }),
    [refresh]
  );

  useEffect(() => {
    if (!dirty.length) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty.length]);

  const requestLeave = useCallback(
    (proceed: () => void) => {
      if (![...fields.current.values()].some((field) => field.dirty)) {
        proceed();
        return;
      }
      setFailed(false);
      setPending(() => proceed);
    },
    []
  );

  useEffect(() => {
    if (!dirty.length) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      requestLeave(() => router.push(`${url.pathname}${url.search}${url.hash}`));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty.length, requestLeave, router]);

  const dirtyLabels = useMemo(() => dirty.map((item) => item.label), [dirty]);
  const state = useMemo(() => ({ dirtyLabels, requestLeave }), [dirtyLabels, requestLeave]);

  const close = () => {
    setPending(null);
    setFailed(false);
  };

  const saveAll = async () => {
    const proceed = pending;
    setBusy(true);
    const open = [...fields.current.values()].filter((field) => field.dirty);
    const results = await Promise.all(open.map((field) => field.save()));
    setBusy(false);
    if (results.every(Boolean)) {
      close();
      proceed?.();
      return;
    }
    setFailed(true);
  };

  const discardAll = () => {
    const proceed = pending;
    for (const field of fields.current.values()) {
      if (field.dirty) field.cancel();
    }
    close();
    proceed?.();
  };

  return (
    <LeaveGuardContext.Provider value={guard}>
      <LeaveGuardStateContext.Provider value={state}>
        {children}
        <Dialog open={pending != null} onOpenChange={(open) => (!open && !busy ? close() : undefined)}>
          <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Unsaved changes</DialogTitle>
              <DialogDescription>
                {joinLabels(dirtyLabels)} {dirtyLabels.length === 1 ? "has" : "have"} changes that are not
                saved.
              </DialogDescription>
            </DialogHeader>
            {failed ? (
              <p className="bg-[var(--color-accent-2-100)] px-3 py-2 text-[14px] font-semibold text-[var(--color-accent-2-text)]">
                Some changes did not save. Retry, discard them, or keep editing.
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="ghost" disabled={busy} onClick={close}>
                Keep editing
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={discardAll}>
                Discard
              </Button>
              <Button type="button" disabled={busy} onClick={() => void saveAll()}>
                {busy ? "Saving…" : failed ? "Retry save" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </LeaveGuardStateContext.Provider>
    </LeaveGuardContext.Provider>
  );
}
