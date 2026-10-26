"use client";

import { useEffect, useState } from "react";
import { ensureContactPhotoStored } from "@/lib/server-actions/contact-photo";
import { isStoredContactPhotoUrl } from "@/lib/outreach/contact-photo-cache";
import { cn } from "@/lib/utils";

const saveQueue: Array<() => Promise<void>> = [];
let saveActive = 0;
const saveInflight = new Map<string, Promise<{ photoUrl: string | null }>>();

function drainPhotoSaves() {
  while (saveActive < 2 && saveQueue.length > 0) {
    const task = saveQueue.shift();
    if (!task) return;
    saveActive += 1;
    void task().finally(() => {
      saveActive -= 1;
      drainPhotoSaves();
    });
  }
}

/** Save a remote picture onto the contact. Two at a time, one per contact. */
function requestStoredPhoto(contactId: string): Promise<{ photoUrl: string | null }> {
  const existing = saveInflight.get(contactId);
  if (existing) return existing;
  const pending = new Promise<{ photoUrl: string | null }>((resolve) => {
    saveQueue.push(async () => {
      try {
        const result = await ensureContactPhotoStored(contactId);
        resolve({
          photoUrl: result.ok ? result.photoUrl : null,
        });
      } catch {
        resolve({ photoUrl: null });
      }
    });
    drainPhotoSaves();
  }).finally(() => {
    saveInflight.delete(contactId);
  });
  saveInflight.set(contactId, pending);
  return pending;
}

/** Saved photo when present; otherwise initials. A broken remote link falls back to initials. */
export function ContactAvatar({
  name,
  photoUrl,
  contactId,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  contactId?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const remote = photoUrl?.trim() || "";
  const [view, setView] = useState({ remote, src: remote, broken: false });
  if (view.remote !== remote) {
    setView({ remote, src: remote, broken: false });
  }
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const sizeCls =
    size === "sm"
      ? "h-7 w-7 text-[10px]"
      : size === "lg"
        ? "h-14 w-14 text-[18px] font-extrabold"
        : "h-9 w-9 text-xs";

  useEffect(() => {
    if (!contactId || !remote || isStoredContactPhotoUrl(remote)) return;
    let cancelled = false;
    void requestStoredPhoto(contactId).then((saved) => {
      if (cancelled || !saved.photoUrl || saved.photoUrl === remote) return;
      setView({ remote, src: saved.photoUrl, broken: false });
    });
    return () => {
      cancelled = true;
    };
  }, [contactId, remote]);

  if (view.src && !view.broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- saved copies and remote hosts vary
      <img
        src={view.src}
        alt=""
        className={cn(
          "shrink-0 rounded-full border border-border object-cover",
          sizeCls,
          className
        )}
        referrerPolicy="no-referrer"
        onError={() => setView((current) => ({ ...current, broken: true }))}
      />
    );
  }

  return (
    <div
      className={cn(
        size === "lg"
          ? "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-text)] font-extrabold text-[var(--color-bg)]"
          : "flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-semibold text-muted-foreground",
        sizeCls,
        className
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
