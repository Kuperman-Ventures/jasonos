# Trailbound AT — Implementation Status

Product source of truth: [trailbound-at-build-brief.md](trailbound-at-build-brief.md)

## Stack decision

JasonOS already ships personal project tools as self-contained local-first HTML apps under `public/projects/`, embedded via a Next.js route (see Marketing Professor Roadmap). Trailbound AT follows that pattern so it appears in **Projects** the same way.

| Choice | Decision |
|--------|----------|
| Host | JasonOS Next.js app shell + iframe page |
| App | Single-file SPA: `public/projects/trailbound-at.html` |
| Persistence | `localStorage` autosave (versioned JSON); export/import with preview |
| Schema | Versioned domain model matching the brief (`meta.version`) |
| Charts | None in v1 |
| Auth / backend | None |

No blocking conflicts. Brief’s Next.js/IndexedDB/Zod recommendation is satisfied at the product level by JasonOS hosting + versioned JSON; IndexedDB can replace `localStorage` later if archives grow large.

## Route map

| Route | Role |
|-------|------|
| `/projects` | Card under Personal tools |
| `/projects/trailbound-at` | JasonOS wrapper page |
| `/projects/trailbound-at.html` | Standalone SPA (redirects into wrapper when top-level) |

In-app sections (hash routes): `today`, `journey`, `readiness`, `decisions`, `risks`, `training`, `skills`, `gear`, `field-tests`, `route`, `budget`, `life`, `activity`, `trips`, `documents`, `sources`, `weekly`, `forecast`, `changelog`, `settings`, plus `onboarding`.

## Component tree (logical)

```
TrailboundShell
├── Sidebar (Command / Prepare / Evidence / Review)
├── Topbar (save status, strategy, import/export, demo/clean)
├── MobileBottomNav
└── Views
    ├── OnboardingWizard
    ├── TodayView
    ├── JourneyView
    ├── ReadinessView
    ├── DecisionsView
    ├── DomainWorkspaces…
    ├── EvidenceViews…
    └── ReviewViews… (weekly, forecast, changelog, settings)
```

## Build slices

1. **Foundation** — shell, tokens, nav, persistence, seed demo, export/import, medical disclaimer. **Done in this PR.**
2. **Goal & onboarding** — 6-step wizard, baseline lanes, first 14-day plan, strategy cards. **Done (usable v1).**
3. **Today** — primary + supporting actions, capacity, blockers, complete/defer. **Done.**
4. **Journey & readiness** — phase map, milestones, gates, nine lanes. **Done.**
5. **Reviews & adaptation** — weekly check-in, forecast snapshots, strategy switch history. **Partial** (weekly + forecast present; rule engine is transparent heuristics).
6. **Domain workspaces** — training, skills, gear, trips, budget, life, route sources. **Partial** (seeded lists + edit; deeper workflows later).
7. **Offline/mobile polish** — PWA, one-handed log, a11y QA. **Deferred.**

## Assumptions (non-blocking)

- Embed pattern matches Professor Roadmap rather than a separate Next.js package.
- Demo profile uses fictional readiness evidence; no real health/fitness/budget prefill for a clean start.
- Recommendation engine uses explicit rules in plain language, not ML.
- Official AT mileage seeded as 2,197.9 (2026) with recheck metadata.

## Remaining work

- Stronger gate enforcement UI (override modal with typed reason on every critical complete path)
- Trip report and weekly review templates as richer forms
- IndexedDB migration if export size becomes an issue
- PWA manifest / offline shell
- Screen-reader pass on all forms

## Verification

- Manual: empty (clean start), demo, onboarding resume, reload persistence, export/import preview
- Typecheck/lint: N/A for the HTML SPA; JasonOS wrapper page is a thin React route
