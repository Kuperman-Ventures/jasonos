"use client";

import { memberInitials } from "@/lib/member-avatars";

export function MemberBadge({
  name,
  avatarUrl,
  prefix,
  size = "sm",
  title,
  showName = true,
}: {
  name: string;
  avatarUrl?: string | null;
  /** e.g. "From" for assignment badges */
  prefix?: string;
  size?: "sm" | "md";
  title?: string;
  showName?: boolean;
}) {
  const initials = memberInitials(name);
  const label = prefix ? `${prefix} ${name}` : name;

  return (
    <span
      className={`member-badge member-badge-${size}${showName ? "" : " is-avatar-only"}`}
      title={title ?? label}
      data-member-badge={name}
    >
      <span className="member-badge-avatar" aria-hidden="true">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" />
        ) : (
          <span className="member-badge-initials">{initials}</span>
        )}
      </span>
      {showName ? (
        <span className="member-badge-name">
          {prefix ? <span className="member-badge-prefix">{prefix} </span> : null}
          {name}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
