"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Menu, MoreHorizontal, Orbit, Settings2, X } from "lucide-react";
import type { ChapterId } from "@/lib/iugr/types";
import { CHAPTER_SEQUENCE, getChapter } from "@/lib/iugr/episodes";
import { OVERFLOW, SERIES } from "@/lib/iugr/copy";
import { EpistemicStatus } from "@/components/iugr/EpistemicStatus";

type EntryChromeProps = {
  chapterId: ChapterId;
  reducedMotion: boolean;
  highContrast: boolean;
  onNavigate: (id: ChapterId) => void;
  onOpenGuideSettings: () => void;
  onOpenSources: () => void;
  onRestart: () => void;
  onToggleReducedMotion: () => void;
  onToggleHighContrast: () => void;
};

export function EntryChrome({
  chapterId,
  reducedMotion,
  highContrast,
  onNavigate,
  onOpenGuideSettings,
  onOpenSources,
  onRestart,
  onToggleReducedMotion,
  onToggleHighContrast,
}: EntryChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="iugr-chrome">
      <a href="/iugr" className="iugr-mark" aria-label={SERIES.name}>
        <span className="iugr-mark-word">{SERIES.shortName}</span>
        <span className="iugr-mark-sub">{SERIES.name}</span>
      </a>

      <div className="iugr-chrome-center">
        <EpistemicStatus />
      </div>

      <div className="iugr-chrome-right">
        <nav className="iugr-orbit" aria-label="Entry chapters">
          {CHAPTER_SEQUENCE.map((id) => {
            const chapter = getChapter(id);
            const currentIndex = CHAPTER_SEQUENCE.indexOf(chapterId);
            const index = CHAPTER_SEQUENCE.indexOf(id);
            const state =
              id === chapterId
                ? "current"
                : index < currentIndex
                  ? "complete"
                  : "upcoming";
            return (
              <button
                key={id}
                type="button"
                className="iugr-orbit-dot"
                data-state={state}
                aria-label={`${chapter.title}${state === "current" ? ", current chapter" : ""}`}
                aria-current={state === "current" ? "step" : undefined}
                onClick={() => onNavigate(id)}
              />
            );
          })}
        </nav>

        <button
          type="button"
          className="iugr-icon-btn iugr-chrome-mobile-only"
          aria-label="Open chapter list"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          className="iugr-icon-btn"
          aria-label="Adjust your guide"
          onClick={onOpenGuideSettings}
        >
          <Settings2 className="size-4" aria-hidden />
        </button>

        <button
          ref={menuButtonRef}
          type="button"
          className="iugr-icon-btn"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>

        {menuOpen ? (
          <div
            ref={menuRef}
            id={menuId}
            className="iugr-menu"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onOpenSources();
              }}
            >
              {OVERFLOW.sources}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onRestart();
              }}
            >
              {OVERFLOW.restart}
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={reducedMotion}
              onClick={() => {
                onToggleReducedMotion();
                setMenuOpen(false);
              }}
            >
              <span>{OVERFLOW.reducedMotion}</span>
              <span>{reducedMotion ? "On" : "Off"}</span>
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={highContrast}
              onClick={() => {
                onToggleHighContrast();
                setMenuOpen(false);
              }}
            >
              <span>{OVERFLOW.highContrast}</span>
              <span>{highContrast ? "On" : "Off"}</span>
            </button>
          </div>
        ) : null}
      </div>

      {drawerOpen ? (
        <div className="iugr-drawer" role="dialog" aria-modal="true" aria-label="Chapters">
          <button
            type="button"
            className="iugr-drawer-backdrop"
            aria-label="Close chapter list"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="iugr-drawer-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>
                <Orbit className="size-4" aria-hidden style={{ display: "inline", marginRight: 8 }} />
                Chapters
              </h2>
              <button
                type="button"
                className="iugr-icon-btn"
                aria-label="Close"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <ul className="iugr-chapter-nav-list">
              {CHAPTER_SEQUENCE.map((id) => {
                const chapter = getChapter(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      data-current={id === chapterId}
                      onClick={() => {
                        onNavigate(id);
                        setDrawerOpen(false);
                      }}
                    >
                      {chapter.order}. {chapter.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </header>
  );
}
