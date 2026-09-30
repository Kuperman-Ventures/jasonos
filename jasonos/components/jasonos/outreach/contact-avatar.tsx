"use client";

import { cn } from "@/lib/utils";

/** LeadDelta / stored photo when present; otherwise initials monogram. */
export function ContactAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const sizeCls = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote LeadDelta / CDN hosts vary
      <img
        src={photoUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-full border border-border object-cover",
          sizeCls,
          className
        )}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-semibold text-muted-foreground",
        sizeCls,
        className
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
