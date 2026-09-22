"use client";

import { useEffect, useMemo, useState } from "react";
import { MemberBadge } from "./MemberBadge";
import type { MemberProfile } from "@/lib/member-avatars";
import {
  bandPinNotes,
  filterPinNotes,
  isNoteBoardFilter,
  kindLabel,
  markPinReviewed,
  noteFilterStorageKey,
  ownerAvatarGround,
  reviewInstruction,
  shortPinDate,
  waitingOnViewer,
  type NoteBoardFilter,
  type PinNote,
} from "@/lib/note-board";
import { memberOwnerId } from "@/lib/project-todos";
import { ownerLabel, type Owner } from "@/lib/types";

const FILTERS: { id: NoteBoardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "for-me", label: "For me" },
  { id: "links", label: "Links" },
  { id: "docs", label: "Docs" },
  { id: "notes", label: "Notes" },
];

function roleLabel(role: string | undefined): string {
  if (!role) return "household";
  if (role === "super_admin" || role === "admin") return "admin";
  if (role === "student") return "student";
  if (role === "consultant") return "consultant";
  return role.replace(/_/g, " ");
}

function Plate({ item }: { item: PinNote }) {
  if (item.kind === "note") {
    return (
      <div className="plate plate-note">
        <span className="plate-kicker">Typed note</span>
        <span className="plate-text">{item.body || item.title}</span>
      </div>
    );
  }
  if (item.kind === "recording") {
    return (
      <div className="plate plate-media">
        <span className="plate-kicker">
          {item.durationLabel ? `Webinar · ${item.durationLabel}` : "Recording"}
        </span>
        <span className="plate-text">{item.body || item.title}</span>
      </div>
    );
  }
  if (item.kind === "document") {
    if (item.assetUrl && (item.mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(item.assetUrl) || item.assetUrl.startsWith("data:image"))) {
      return (
        <div className="plate plate-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.assetUrl} alt="" />
        </div>
      );
    }
    const lines = [70, 92, 86, 58, 90];
    return (
      <div className="plate">
        <span className="plate-kicker">
          PDF{item.pageCount ? ` · ${item.pageCount} pages` : ""}
          {item.assetUrl ? " · file" : ""}
        </span>
        <span className="plate-lines" aria-hidden="true">
          {lines.map((width, index) => (
            <i key={index} style={{ width: `${width}%` }} />
          ))}
        </span>
      </div>
    );
  }

  const host = item.host ?? "link";
  const initial = host.charAt(0).toUpperCase();
  const quote = item.body.split("\n").find((line) => line.trim()) ?? item.title;
  return (
    <div className="plate">
      <span className="plate-site">
        <span className="favicon" style={{ background: "var(--color-accent-800)" }} aria-hidden="true">
          {initial}
        </span>
        <span className="plate-host">{host}</span>
      </span>
      <span className="plate-text">“{quote}”</span>
    </div>
  );
}

function PinCard({
  item,
  viewer,
  profiles,
  href,
  onOpen,
}: {
  item: PinNote;
  viewer: Owner;
  profiles: Map<string, MemberProfile>;
  href: string;
  onOpen: () => void;
}) {
  const forReview = waitingOnViewer(item, viewer);
  const instruction = reviewInstruction(item, viewer);
  const uploader = profiles.get(item.addedBy);
  const uploaderName = uploader?.displayName ?? ownerLabel(item.addedBy);
  const uploaderRole = roleLabel(uploader?.role);
  const otherReviewers = item.reviewers.filter((id) => id !== viewer);
  const shownReviewers = otherReviewers.slice(0, 3);
  const overflow = otherReviewers.length - shownReviewers.length;

  return (
    <a
      className={`pin${forReview ? " is-for-review" : ""}`}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onOpen();
      }}
    >
      <div className="pin-flag" />
      <Plate item={item} />
      <div className="pin-body">
        <span className="pin-kind">{instruction ?? kindLabel(item.kind)}</span>
        <h3 className="pin-title">{item.title}</h3>
        <div className="pin-meta">
          <span
            className="avatar"
            style={{ background: ownerAvatarGround(item.addedBy) }}
            title={`${uploaderName}, ${uploaderRole}`}
            aria-label={`Added by ${uploaderName}, ${uploaderRole}`}
          >
            {uploader?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploader.avatarUrl} alt="" />
            ) : (
              uploaderName.charAt(0).toUpperCase()
            )}
          </span>
          <span className="pin-date">{shortPinDate(item.createdAt)}</span>
          {shownReviewers.length ? (
            <span className="pin-reviewers">
              {shownReviewers.map((id) => {
                const profile = profiles.get(id);
                const name = profile?.displayName ?? ownerLabel(id);
                return (
                  <span
                    key={id}
                    className="avatar avatar-sm"
                    style={{ background: ownerAvatarGround(id) }}
                    title={name}
                    aria-label={`Reviewer ${name}`}
                  >
                    {profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </span>
                );
              })}
              {overflow > 0 ? <span className="avatar avatar-sm avatar-more">+{overflow}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

function NoteDetail({
  item,
  viewer,
  profiles,
  onBack,
  onMarkReviewed,
  onMakeTodo,
}: {
  item: PinNote;
  viewer: Owner;
  profiles: Map<string, MemberProfile>;
  onBack: () => void;
  onMarkReviewed: () => void;
  onMakeTodo: () => void;
}) {
  const forReview = waitingOnViewer(item, viewer);
  const uploader = profiles.get(item.addedBy);
  const uploaderName = uploader?.displayName ?? ownerLabel(item.addedBy);

  return (
    <section className="note-detail">
      <button type="button" className="btn btn-ghost note-detail-back" onClick={onBack}>
        ← Back to board
      </button>
      <div className={`pin note-detail-card${forReview ? " is-for-review" : ""}`}>
        <div className="pin-flag" />
        <Plate item={item} />
        <div className="pin-body">
          <span className="pin-kind">{kindLabel(item.kind)}</span>
          <h1 className="pin-title note-detail-title">{item.title}</h1>
          <div className="pin-meta">
            <MemberBadge
              name={uploaderName}
              avatarUrl={uploader?.avatarUrl}
              prefix="Added by"
              size="sm"
            />
            <span className="pin-date">{shortPinDate(item.createdAt)}</span>
          </div>
          {item.url ? (
            <p className="note-detail-link">
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.host ?? item.url}
              </a>
            </p>
          ) : null}
          {item.assetUrl && !item.mimeType?.startsWith("image/") ? (
            <p className="note-detail-link">
              <a href={item.assetUrl} target="_blank" rel="noreferrer">
                Open file
              </a>
            </p>
          ) : null}
          {item.body ? <div className="note-detail-body">{item.body}</div> : null}
          <div className="note-detail-actions">
            {forReview ? (
              <button type="button" className="btn btn-primary" onClick={onMarkReviewed}>
                Mark reviewed
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={onMakeTodo}>
              Make a to-do from this
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function NotesTab({
  memberId,
  memberProfiles,
  noteItems,
  openNoteId,
  dateline,
  onOpenNote,
  onChangeNoteItems,
  onMakeTodo,
}: {
  memberId: string;
  memberProfiles: MemberProfile[];
  noteItems: PinNote[];
  openNoteId: string | null;
  dateline: string;
  onOpenNote: (id: string | null) => void;
  onChangeNoteItems: (next: PinNote[]) => void;
  onMakeTodo: (note: PinNote) => void;
}) {
  const viewer = memberOwnerId(memberId);
  const profiles = useMemo(
    () => new Map(memberProfiles.map((row) => [row.id, row])),
    [memberProfiles],
  );
  const storageKey = noteFilterStorageKey(memberId);
  const [filter, setFilter] = useState<NoteBoardFilter>("all");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (isNoteBoardFilter(raw)) setFilter(raw);
    } catch {
      setFilter("all");
    }
  }, [storageKey]);

  function changeFilter(next: NoteBoardFilter) {
    setFilter(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }

  const visible = filterPinNotes(noteItems, filter, viewer);
  const bands = bandPinNotes(visible);
  const waiting = noteItems.filter((item) => waitingOnViewer(item, viewer)).length;
  const openItem = openNoteId ? noteItems.find((item) => item.id === openNoteId) ?? null : null;

  if (openItem) {
    return (
      <NoteDetail
        item={openItem}
        viewer={viewer}
        profiles={profiles}
        onBack={() => onOpenNote(null)}
        onMarkReviewed={() => {
          onChangeNoteItems(markPinReviewed(noteItems, openItem.id, viewer));
        }}
        onMakeTodo={() => onMakeTodo(openItem)}
      />
    );
  }

  return (
    <main className="board">
      <div className="board-head">
        <div>
          <div className="board-kicker">{dateline}</div>
          <h1>Notes</h1>
          <div className="board-count">
            {noteItems.length} item{noteItems.length === 1 ? "" : "s"}
            {waiting > 0 ? (
              <>
                {" · "}
                <b>
                  {waiting} waiting on you
                </b>
              </>
            ) : null}
          </div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Filter the board">
          {FILTERS.map((opt) => (
            <label key={opt.id} className="seg-opt">
              <input
                type="radio"
                name="board-filter"
                checked={filter === opt.id}
                onChange={() => changeFilter(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {!noteItems.length ? (
        <p className="board-empty">
          Nothing on the board yet. Route a paste, URL, or PDF to Note in{" "}
          <a href="/?tab=projects&pm=ingest">Project Management → Ingest</a>.
        </p>
      ) : !bands.length ? (
        <p className="board-empty">No items match this filter.</p>
      ) : (
        bands.map((band) => (
          <section key={band.id} className="band">
            <div className="band-when">
              <h2>{band.label}</h2>
              <span>{band.rangeLabel}</span>
            </div>
            <div className="band-items">
              {band.items.map((item) => (
                <PinCard
                  key={item.id}
                  item={item}
                  viewer={viewer}
                  profiles={profiles}
                  href={`/?tab=notes&note=${encodeURIComponent(item.id)}`}
                  onOpen={() => onOpenNote(item.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
