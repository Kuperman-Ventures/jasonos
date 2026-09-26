"use client";

import { useRef, useState } from "react";
import { MemberBadge } from "./MemberBadge";
import { HOUSEHOLD_ROLES, roleLabel } from "@/lib/permissions";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });
}

export function RailProfile({
  member,
  onAvatarChange,
}: {
  member: { displayName: string; role: string; avatarUrl: string | null };
  onAvatarChange: (avatarUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = roleLabel(member.role);
  const roleMeta = HOUSEHOLD_ROLES.find((row) => row.id === member.role);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/me/avatar", { method: "POST", body });
      const payload = (await response.json()) as { avatarUrl?: string | null; error?: string };
      if (response.status === 503) {
        // Local seed mode has no storage — keep a data URL in this browser only.
        const dataUrl = await readAsDataUrl(file);
        window.localStorage.setItem(`kyle-avatar:${member.displayName}`, dataUrl);
        onAvatarChange(dataUrl);
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      onAvatarChange(payload.avatarUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function clearAvatar() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/avatar", { method: "DELETE" });
      if (response.status === 503) {
        window.localStorage.removeItem(`kyle-avatar:${member.displayName}`);
        onAvatarChange(null);
        return;
      }
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not remove photo");
      onAvatarChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rail-profile">
      <button
        type="button"
        className="rail-profile-photo"
        disabled={busy}
        aria-label={member.avatarUrl ? "Change profile photo" : "Upload profile photo"}
        onClick={() => inputRef.current?.click()}
      >
        <MemberBadge name={member.displayName} avatarUrl={member.avatarUrl} size="md" showName={false} />
        <span className="rail-profile-hint">{busy ? "Uploading…" : "Upload photo"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="rail-profile-meta">
        <strong>{member.displayName}</strong>
        <span className="rail-profile-role" title={roleMeta?.blurb}>
          {label}
        </span>
      </div>
      <div className="rail-profile-roles" aria-label="Household roles">
        <span className="label">Roles</span>
        <ul>
          {HOUSEHOLD_ROLES.map((row) => (
            <li key={row.id} className={row.id === member.role ? "is-current" : undefined}>
              <span className="rail-profile-role-name">{row.label}</span>
              {row.id === member.role ? <span className="rail-profile-role-you">You</span> : null}
            </li>
          ))}
        </ul>
        {roleMeta ? <p className="rail-profile-role-blurb">{roleMeta.blurb}</p> : null}
      </div>
      {member.avatarUrl ? (
        <button type="button" className="rail-profile-remove" disabled={busy} onClick={() => void clearAvatar()}>
          Remove photo
        </button>
      ) : null}
      {error ? <p className="rail-profile-error">{error}</p> : null}
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}
