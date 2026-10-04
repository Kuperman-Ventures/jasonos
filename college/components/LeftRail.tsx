"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bank,
  BookOpenText,
  ClockCounterClockwise,
  Coins,
  DotsThree,
  Exam,
  Files,
  GearSix,
  GraduationCap,
  Kanban,
  NotePencil,
  PlugsConnected,
  Question,
  SidebarSimple,
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
import { phases as processPhases } from "@/lib/content";
import { currentPhaseIndex, phaseStatuses } from "@/lib/phases";
import { currentListPhaseId } from "@/lib/list-phases";
import { HOUSEHOLD_ROLES, canViewFinances, isAdminRole, roleLabel } from "@/lib/permissions";
import {
  RAIL_EXPANDED_WIDTH,
  RAIL_SHORT_LABELS,
  RAIL_SLIM_WIDTH,
  readStoredRailDensity,
  resolveRailDensity,
  shortProcessPhaseName,
  writeStoredRailDensity,
  type RailDensity,
} from "@/lib/rail-collapse";
import type { Phase, TabId } from "@/lib/types";
import { ThemeModeSwitch } from "./ThemeModeSwitch";

const HOUSEHOLD = {
  name: "Kyle's College Search",
  student: "Kyle",
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
      { id: "finances", label: "Finances", Icon: Coins },
      { id: "ingest", label: "Ingest", Icon: TrayArrowDown },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "guide", label: "Common App Guide", Icon: BookOpenText },
      { id: "consultants", label: "Consultants", Icon: UsersThree },
      { id: "faq", label: "FAQ", Icon: Question },
      { id: "testing", label: "Testing", Icon: Exam },
      { id: "sources", label: "Data Sources", Icon: PlugsConnected },
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

function applyRailWidth(density: RailDensity) {
  if (typeof document === "undefined") return;
  const width = density === "slim" ? RAIL_SLIM_WIDTH : RAIL_EXPANDED_WIDTH;
  document.documentElement.dataset.rail = density;
  document.documentElement.style.setProperty("--rail-w", `${width}px`);
}

function shortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+\\";
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return mac ? "⌘\\" : "Ctrl+\\";
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
  checklist = {},
  processPhaseList = processPhases,
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
  projectSection: ProjectSectionId;
  onProjectSectionChange: (section: ProjectSectionId) => void;
  appsSection: AppsSectionId;
  onAppsSectionChange: (section: AppsSectionId) => void;
  member: { id: string; displayName: string; role: string; avatarUrl: string | null };
  onAvatarChange: (avatarUrl: string | null) => void;
  schoolCount: number;
  projectCount: number;
  questionCount: number;
  consultantCount: number;
  faqCount: number;
  testingCount: number;
  checklist?: Record<string, boolean>;
  processPhaseList?: Phase[];
}) {
  const railRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [density, setDensity] = useState<RailDensity>("expanded");
  const [densityReady, setDensityReady] = useState(false);
  const [listPhaseId, setListPhaseId] = useState(currentListPhaseId());
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);

  useEffect(() => {
    const stored = readStoredRailDensity();
    const next = resolveRailDensity(stored, window.innerWidth);
    setDensity(next);
    applyRailWidth(next);
    setDensityReady(true);
    setListPhaseId(currentListPhaseId());
  }, []);

  useEffect(() => {
    if (!densityReady) return;
    applyRailWidth(density);
    writeStoredRailDensity(density);
  }, [density, densityReady]);

  const statuses = phaseStatuses(processPhaseList, checklist);
  const phaseIndex = currentPhaseIndex(statuses);
  const currentPhase = processPhaseList[phaseIndex];
  const nextPhase = processPhaseList[phaseIndex + 1] ?? null;
  const phaseCount = processPhaseList.length;

  const counts: Partial<Record<TabId, number>> = {
    colleges: schoolCount,
    projects: projectCount,
    apps: questionCount,
    finances: schoolCount,
    consultants: consultantCount,
    faq: faqCount,
    testing: testingCount,
  };
  const viewLabel = roleLabel(member.role);
  const roleMeta = HOUSEHOLD_ROLES.find((row) => row.id === member.role);
  const heldRoles = HOUSEHOLD_ROLES.filter((row) => row.id === member.role);
  const showAdmin = isAdminRole(member.role) || member.displayName === "Local";
  const showFinances = canViewFinances(
    { id: member.id, role: member.role },
    listPhaseId,
  );
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.id !== "finances" || showFinances),
  }));
  const slim = density === "slim";
  const shortcut = shortcutLabel();

  function setRailDensity(next: RailDensity) {
    setDensity(next);
    applyRailWidth(next);
    writeStoredRailDensity(next);
    window.requestAnimationFrame(() => toggleRef.current?.focus());
  }

  function toggleDensity() {
    setRailDensity(density === "slim" ? "expanded" : "slim");
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (menuOpen) {
          setMenuOpen(false);
          meRef.current?.focus();
          return;
        }
      }
      if (event.key !== "\\" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setRailDensity(density === "slim" ? "expanded" : "slim");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, density]);

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

  function select(nextTab: TabId) {
    onChange(nextTab);
    setMenuOpen(false);
    setTip(null);
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

  function showTooltip(label: string, el: HTMLElement) {
    if (!slim) return;
    const rect = el.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2 });
  }

  const collapseLabel = slim ? "Expand menu" : "Collapse menu";
  const phaseTitle = currentPhase
    ? `Phase ${phaseIndex + 1} of ${phaseCount} · ${currentPhase.phase}`
    : "";
  const phaseNextLine = nextPhase
    ? `Next: ${nextPhase.phase}${nextPhase.window ? `, ${nextPhase.window}` : ""}`
    : "Final phase";

  return (
    <aside
      className="rail"
      id="app-rail"
      ref={railRef}
      data-density={density}
      aria-label="Main"
    >
      <div className="rail-scroll">
        <div className="rail-brand">
          <GraduationCap className="rail-brand-icon" weight="duotone" size={30} aria-hidden="true" />
          {slim ? (
            <b className="rail-brand-student">{HOUSEHOLD.student}</b>
          ) : (
            <div>
              <b>{HOUSEHOLD.name}</b>
              <span>
                {HOUSEHOLD.grade} · {HOUSEHOLD.school}
              </span>
            </div>
          )}
          {!slim ? (
            <button
              ref={toggleRef}
              type="button"
              className="rail-density-toggle"
              aria-expanded={!slim}
              aria-controls="app-rail-nav"
              title={`${collapseLabel} (${shortcut})`}
              aria-label={`${collapseLabel} (${shortcut})`}
              onClick={toggleDensity}
            >
              <SidebarSimple weight="duotone" size={20} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {slim ? (
          <button
            ref={toggleRef}
            type="button"
            className="rail-density-toggle slim"
            aria-expanded={!slim}
            aria-controls="app-rail-nav"
            title={`${collapseLabel} (${shortcut})`}
            aria-label={`${collapseLabel} (${shortcut})`}
            onClick={toggleDensity}
          >
            <SidebarSimple
              weight="duotone"
              size={20}
              aria-hidden="true"
              style={{ transform: "scaleX(-1)" }}
            />
          </button>
        ) : null}

        {!slim ? (
          <div className="rail-phase" aria-label="Current phase">
            <div className="rail-phase-top">
              <b>{currentPhase?.phase ?? "—"}</b>
              <span>
                {phaseIndex + 1} / {phaseCount}
              </span>
            </div>
            <div
              className="rail-phase-segs"
              role="progressbar"
              aria-valuenow={phaseIndex + 1}
              aria-valuemin={1}
              aria-valuemax={phaseCount}
              aria-valuetext={`Phase ${phaseIndex + 1} of ${phaseCount}, ${currentPhase?.phase ?? ""}`}
            >
              {processPhaseList.map((phase, index) => (
                <i
                  key={phase.phase}
                  className={index <= phaseIndex ? "on" : undefined}
                  title={phase.phase}
                />
              ))}
            </div>
            <span className="rail-phase-next">{phaseNextLine}</span>
          </div>
        ) : null}

        <div id="app-rail-nav" className="rail-nav-groups">
          {navGroups.map((group, groupIndex) => (
            <nav key={group.label} aria-label={group.label} className="rail-nav-group">
              {slim && groupIndex > 0 ? <hr className="rail-group-rule" /> : null}
              {!slim ? <span className="rail-nav-label">{group.label}</span> : null}
              {group.items.map((item) => {
                const count = counts[item.id];
                const showCount = typeof count === "number" && count > 0;
                const Icon = item.Icon;
                const active = tab === item.id;
                const short = RAIL_SHORT_LABELS[item.id] ?? item.label;
                const tipLabel = showCount ? `${item.label} · ${count}` : item.label;
                return (
                  <div key={item.id} className="rail-nav-block">
                    <a
                      className="rail-item"
                      href={hrefFor(item.id)}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.label}
                      title={slim ? undefined : item.label}
                      onMouseEnter={(e) => showTooltip(tipLabel, e.currentTarget)}
                      onMouseLeave={() => setTip(null)}
                      onFocus={(e) => showTooltip(tipLabel, e.currentTarget)}
                      onBlur={() => setTip(null)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.currentTarget.focus();
                        select(item.id);
                      }}
                    >
                      <Icon weight="duotone" size={slim ? 22 : 20} aria-hidden="true" />
                      <span className="rail-item-label">{slim ? short : item.label}</span>
                      {showCount ? <span className="rail-item-count">{count}</span> : null}
                    </a>
                    {!slim && item.id === "projects" && active ? (
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
                            }}
                          >
                            <span>{section.label}</span>
                            {section.status === "soon" ? <span className="soon">Soon</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!slim && item.id === "apps" && active ? (
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

        {slim ? (
          <div
            className="rail-phase-slim"
            title={`${phaseTitle}\n${phaseNextLine}`}
            aria-label={phaseTitle}
          >
            <div className="rail-phase-dots" aria-hidden="true">
              {processPhaseList.map((phase, index) => (
                <i key={phase.phase} className={index === phaseIndex ? "on" : undefined} />
              ))}
            </div>
            <span className="rail-phase-slim-name">
              {currentPhase ? shortProcessPhaseName(currentPhase.phase) : ""}
            </span>
          </div>
        ) : null}
      </div>

      <div className={`rail-foot${slim ? " is-slim" : ""}`} ref={accountRef}>
        <div
          className={`rail-account-menu${slim ? " slim-side" : ""}`}
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
              <button type="button" className="rail-item" onClick={() => select("admin")}>
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
          title={slim ? `${member.displayName} · ${viewLabel}` : undefined}
          aria-label={slim ? `${member.displayName} · ${viewLabel}` : undefined}
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
          {!slim ? (
            <>
              <span className="rail-me-name">
                {member.displayName} <span>· {viewLabel}</span>
              </span>
              <DotsThree weight="duotone" size={22} aria-hidden="true" />
            </>
          ) : null}
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

      {slim && tip ? (
        <div className="rail-tooltip" style={{ top: tip.top }} role="tooltip">
          {tip.label}
        </div>
      ) : null}
    </aside>
  );
}
