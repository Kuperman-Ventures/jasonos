"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bank,
  ClockCounterClockwise,
  DotsThree,
  Exam,
  Files,
  GearSix,
  GraduationCap,
  Kanban,
  NotePencil,
  Question,
  SignOut,
  SquaresFour,
  TrayArrowDown,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import {
  APPS_SECTIONS,
  type AppsSectionId,
} from "@/lib/apps-materials";
import {
  PROJECT_SECTIONS,
  type ProjectSectionId,
} from "@/lib/project-management";
import type { PhaseStatus } from "@/lib/phases";
import { HOUSEHOLD_ROLES, isAdminRole, roleLabel } from "@/lib/permissions";
import type { Phase, TabId } from "@/lib/types";
import { ThemeModeSwitch } from "./ThemeModeSwitch";

const HOUSEHOLD = {
  name: "Kyle's College Search",
  grade: "Junior",
  school: "Columbia High School",
};

type NavItem = {
  id: TabId;
  label: string;
  Icon: Icon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Plan",
    items: [
      { id: "dashboard", label: "Dashboard", Icon: SquaresFour },
      { id: "projects", label: "Project Management", Icon: Kanban },
      { id: "notes", label: "Notes", Icon: NotePencil },
      { id: "log", label: "Log", Icon: ClockCounterClockwise },
    ],
  },
  {
    label: "Schools",
    items: [
      { id: "colleges", label: "Colleges", Icon: Bank },
      { id: "apps", label: "Apps & Materials", Icon: Files },
      { id: "ingest", label: "Ingest", Icon: TrayArrowDown },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "consultants", label: "Consultants", Icon: UsersThree },
      { id: "faq", label: "FAQ", Icon: Question },
      { id: "testing", label: "Testing", Icon: Exam },
    ],
  },
];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });
}

function avatarInitial(name: string): string {
  return (name.trim()[0] || "?").toUpperCase();
}

export function LeftRail({
  tab,
  onChange,
  projectSection,
  onProjectSectionChange,
  appsSection,
  onAppsSectionChange,
  member,
  onAvatarChange,
  schoolCount,
  projectCount,
  questionCount,
  consultantCount,
  faqCount,
  testingCount,
  phases,
  statuses,
  phaseIndex,
  open,
  onOpenChange,
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
  projectSection: ProjectSectionId;
  onProjectSectionChange: (section: ProjectSectionId) => void;
  appsSection: AppsSectionId;
  onAppsSectionChange: (section: AppsSectionId) => void;
  member: { displayName: string; role: string; avatarUrl: string | null };
  onAvatarChange: (avatarUrl: string | null) => void;
  schoolCount: number;
  projectCount: number;
  questionCount: number;
  consultantCount: number;
  faqCount: number;
  testingCount: number;
  phases: Phase[];
  statuses: PhaseStatus[];
  phaseIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const railRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const current = phases[phaseIndex];
  const next = phases[phaseIndex + 1];
  const counts: Partial<Record<TabId, number>> = {
    colleges: schoolCount,
    projects: projectCount,
    apps: questionCount,
    consultants: consultantCount,
    faq: faqCount,
    testing: testingCount,
  };
  const viewLabel = roleLabel(member.role);
  const roleMeta = HOUSEHOLD_ROLES.find((row) => row.id === member.role);
  const heldRoles = HOUSEHOLD_ROLES.filter((row) => row.id === member.role);
  const showAdmin = isAdminRole(member.role) || member.displayName === "Local";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (menuOpen) {
          setMenuOpen(false);
          meRef.current?.focus();
          return;
        }
        if (open) onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, open, onOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (accountRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuOpen]);

  useEffect(() => {
    if (!open) return;
    railRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);

  function select(nextTab: TabId) {
    onChange(nextTab);
    onOpenChange(false);
    setMenuOpen(false);
  }

  function hrefFor(id: TabId): string {
    if (id === "projects") return "/?tab=projects&pm=timeline";
    if (id === "apps") return `/?tab=apps&am=${appsSection || "activities"}`;
    return `/?tab=${id}`;
  }

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/me/avatar", { method: "POST", body });
      const payload = (await response.json()) as { avatarUrl?: string | null; error?: string };
      if (response.status === 503) {
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
      if (fileRef.current) fileRef.current.value = "";
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
    <>
      <div
        className="rail-scrim"
        data-open={open ? "true" : "false"}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <aside className="rail" id="app-rail" ref={railRef} data-open={open ? "true" : "false"} aria-label="Main">
        <div className="rail-brand">
          <GraduationCap className="rail-brand-icon" weight="duotone" size={30} aria-hidden="true" />
          <div>
            <b>{HOUSEHOLD.name}</b>
            <span>
              {HOUSEHOLD.grade} · {HOUSEHOLD.school}
            </span>
          </div>
        </div>

        <div className="rail-phase" aria-label="Current phase">
          <div className="rail-phase-top">
            <b>{current?.phase ?? "Phase"}</b>
            <span>
              {phaseIndex + 1} / {phases.length}
            </span>
          </div>
          <div
            className="rail-phase-segs"
            role="progressbar"
            aria-valuenow={phaseIndex + 1}
            aria-valuemin={1}
            aria-valuemax={phases.length}
            aria-valuetext={`Phase ${phaseIndex + 1} of ${phases.length}${current ? `, ${current.phase}` : ""}`}
          >
            {phases.map((phase, index) => {
              const status = statuses[index]?.status ?? "upcoming";
              const on = index <= phaseIndex || status === "done" || status === "current";
              return <i key={phase.phase} className={on ? "on" : undefined} title={phase.phase} />;
            })}
          </div>
          {next ? (
            <span className="rail-phase-next">
              Next: {next.phase}
              {next.window ? `, ${next.window}` : ""}
            </span>
          ) : (
            <span className="rail-phase-next">Final phase</span>
          )}
        </div>

        <div className="rail-nav-groups">
          {NAV_GROUPS.map((group) => (
            <nav key={group.label} aria-label={group.label} className="rail-nav-group">
              <span className="rail-nav-label">{group.label}</span>
              {group.items.map((item) => {
                const count = counts[item.id];
                const showCount = typeof count === "number" && count > 0;
                const Icon = item.Icon;
                const active = tab === item.id;
                return (
                  <div key={item.id} className="rail-nav-block">
                    <a
                      className="rail-item"
                      href={hrefFor(item.id)}
                      aria-current={active ? "page" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        select(item.id);
                      }}
                    >
                      <Icon weight="duotone" size={20} aria-hidden="true" />
                      <span className="rail-item-label">{item.label}</span>
                      {showCount ? <span className="rail-item-count">{count}</span> : null}
                    </a>
                    {item.id === "projects" && active ? (
                      <div className="rail-subnav" aria-label="Project Management sections">
                        {PROJECT_SECTIONS.map((section) => (
                          <button
                            key={section.id}
                            type="button"
                            className={
                              projectSection === section.id ? "rail-sublink active" : "rail-sublink"
                            }
                            aria-current={projectSection === section.id ? "page" : undefined}
                            disabled={section.status === "soon"}
                            onClick={() => {
                              if (section.status !== "ready") return;
                              onProjectSectionChange(section.id);
                              onOpenChange(false);
                            }}
                          >
                            <span>{section.label}</span>
                            {section.status === "soon" ? <span className="soon">Soon</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {item.id === "apps" && active ? (
                      <div className="rail-subnav" aria-label="Apps and Materials sections">
                        {APPS_SECTIONS.map((section) => (
                          <button
                            key={section.id}
                            type="button"
                            className={
                              appsSection === section.id ? "rail-sublink active" : "rail-sublink"
                            }
                            aria-current={appsSection === section.id ? "page" : undefined}
                            disabled={section.status === "soon"}
                            onClick={() => {
                              if (section.status !== "ready") return;
                              onAppsSectionChange(section.id);
                              onOpenChange(false);
                            }}
                          >
                            <span>{section.label}</span>
                            {section.status === "soon" ? <span className="soon">Soon</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          ))}
        </div>

        <div className="rail-spacer" />

        <div className="rail-account" ref={accountRef}>
          <div
            className="rail-account-menu"
            id="rail-account-menu"
            role="dialog"
            aria-label="Account"
            hidden={!menuOpen}
          >
            <div className="rail-account-who">
              <span className="rail-avatar lg" aria-hidden="true">
                {member.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.avatarUrl} alt="" />
                ) : (
                  avatarInitial(member.displayName)
                )}
              </span>
              <div>
                <b>{member.displayName}</b>
                <div className="rail-account-photo-links">
                  <button
                    type="button"
                    className="rail-text-link"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    {busy ? "Working…" : "Change photo"}
                  </button>
                  {member.avatarUrl ? (
                    <button
                      type="button"
                      className="rail-text-link"
                      disabled={busy}
                      onClick={() => void clearAvatar()}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <span className="rail-menu-lbl">View as</span>
              <div className="rail-seg" role="group" aria-label="View as">
                {heldRoles.map((row) => (
                  <button key={row.id} type="button" aria-pressed="true">
                    {row.label}
                  </button>
                ))}
              </div>
              {roleMeta ? <p className="rail-role-note">{roleMeta.blurb}</p> : null}
            </div>

            <div>
              <span className="rail-menu-lbl">Appearance</span>
              <ThemeModeSwitch className="rail-seg rail-seg-neutral" />
            </div>

            <div className="rail-account-links">
              {showAdmin ? (
                <button
                  type="button"
                  className="rail-item"
                  onClick={() => select("admin")}
                >
                  <GearSix weight="duotone" size={18} aria-hidden="true" />
                  Admin
                </button>
              ) : null}
              <form action="/auth/signout" method="post">
                <button type="submit" className="rail-item">
                  <SignOut weight="duotone" size={18} aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
            {error ? <p className="rail-account-error">{error}</p> : null}
          </div>

          <button
            type="button"
            className="rail-me"
            id="rail-me"
            ref={meRef}
            aria-expanded={menuOpen}
            aria-controls="rail-account-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="rail-avatar" aria-hidden="true">
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt="" />
              ) : (
                avatarInitial(member.displayName)
              )}
            </span>
            <span className="rail-me-name">
              {member.displayName} <span>· {viewLabel}</span>
            </span>
            <DotsThree weight="duotone" size={22} aria-hidden="true" />
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>
      </aside>
    </>
  );
}
