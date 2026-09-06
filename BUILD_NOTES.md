# IUGR — Implementation Audit

**Project:** The Improbably Useful Guide to Reality (IUGR, “Eye-Ew-Gurr”)  
**First entry:** “Are You an Original?” (Bostrom simulation argument as thought experiment)  
**Host:** JasonOS on Vercel (no vanity URL yet). Supabase not required for Groups 1–3.  
**Date:** 2026-09-06  
**Scope of this file:** Audit only. No production app code changed.

---

## Current stack summary

### Two apps in this repo (do not confuse them)

| | **JasonOS (use this)** | CoSA root (ignore for IUGR) |
|---|---|---|
| Path | [`jasonos/`](jasonos/) | repo root |
| Framework | **Next.js 16.2.4** App Router | Vite 7 + React |
| Package manager | **npm** (`jasonos/package-lock.json`) | npm (root lockfile) |
| Deploy | Vercel project, **Root Directory = `jasonos/`** ([`jasonos/vercel.ts`](jasonos/vercel.ts)) | separate Vite Vercel config ([`vercel.json`](vercel.json)) |

### JasonOS technical inventory

| Concern | What exists |
|---|---|
| Runtime | React **19.2.4**, TypeScript **5**, `strict: true` |
| Routing | Next.js **App Router** (`jasonos/app/**/page.tsx`) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss`; tokens in [`jasonos/app/globals.css`](jasonos/app/globals.css) |
| Component library | **shadcn/ui** (style `base-nova`, RSC, CSS variables) — [`jasonos/components.json`](jasonos/components.json), primitives in [`jasonos/components/ui/`](jasonos/components/ui/) |
| Icons | **lucide-react** `^1.8.0` |
| Animation | **No Framer Motion.** [`tw-animate-css`](jasonos/package.json) + a few CSS keyframes in `globals.css` |
| Fonts | Root: Geist / Geist Mono (`next/font`). Feature-scoped example: Post Master loads Fraunces + IBM Plex + JetBrains in [`jasonos/app/post-master/layout.tsx`](jasonos/app/post-master/layout.tsx) |
| State | No Zustand/Jotai/Redux in app code. Pattern = React `useState` / local client components; server data via RSC + server actions |
| Lint | ESLint 9 + `eslint-config-next` ([`jasonos/eslint.config.mjs`](jasonos/eslint.config.mjs)) |
| Format | **No Prettier** config |
| Tests | Lightweight `node --test` / `tsx --test` on selected `lib/**/*.test.ts` files — no Playwright/Vitest suite |
| Auth / middleware | **No `middleware.ts`**. Root layout always mounts [`TopNav`](jasonos/components/jasonos/top-nav.tsx) |
| Dark mode | Forced: `<html className="dark …">` in [`jasonos/app/layout.tsx`](jasonos/app/layout.tsx) |
| Supabase | Shared project; JasonOS schema; used heavily by command-center features — **not needed** for a local interactive editorial entry |

### Checklist vs common IUGR assumptions

| Assumption | In JasonOS? |
|---|---|
| Next.js App Router | **Yes** |
| Tailwind CSS | **Yes (v4)** |
| shadcn/ui | **Yes** |
| Lucide icons | **Yes** |
| Framer Motion | **No** — do not install until a Group prompt needs choreographed motion |
| Global state library | **No** — stay with React local state + optional Context |

---

## Existing entry points & reusable surfaces

- **App entry / chrome:** [`jasonos/app/layout.tsx`](jasonos/app/layout.tsx) → TopNav + `<main>` + Tell Claude + toaster  
- **Global styles / design tokens:** [`jasonos/app/globals.css`](jasonos/app/globals.css) (oklch CSS variables, shadcn theme, `.jos-card-enter`)  
- **UI primitives:** [`jasonos/components/ui/`](jasonos/components/ui/) (`button`, `card`, `dialog`, `tabs`, `slider`, …)  
- **Utils:** [`jasonos/lib/utils.ts`](jasonos/lib/utils.ts) (`cn`)  
- **Public assets:** [`jasonos/public/`](jasonos/public/) (logos, SVGs)  
- **“Personal tools” precedent (iframe HTML):**  
  - Routes: [`jasonos/app/projects/trailbound-at/page.tsx`](jasonos/app/projects/trailbound-at/page.tsx), [`professor-roadmap/page.tsx`](jasonos/app/projects/professor-roadmap/page.tsx)  
  - Static: [`jasonos/public/projects/*.html`](jasonos/public/projects/)  
- **Interactive React product precedent (prefer this):** Post Master — route layout + scoped CSS + `components/post-master/*`  
- **Projects index / nav hooks:** [`jasonos/app/projects/page.tsx`](jasonos/app/projects/page.tsx) “Personal tools” list; Projects group in [`jasonos/components/jasonos/top-nav.tsx`](jasonos/components/jasonos/top-nav.tsx)

---

## Least disruptive path for Groups 1–3

**Do not** ship IUGR as a giant `public/projects/*.html` iframe (Trailbound pattern). That fights typed components, Tailwind tokens, and iterative scene work.

**Do** follow the **Post Master pattern**: native App Router route, scoped layout/CSS/fonts, client components for interaction, no new framework.

### Recommended URL (vanity-ready)

- Primary route: **`/iugr`** → `jasonos/app/iugr/`  
- First entry deep link later: `/iugr/are-you-an-original` (or hash/step state under `/iugr` until multi-route is needed)  
- Register in TopNav Projects group + Projects “Personal tools” list as **IUGR**  
- Future vanity domain can rewrite to `/iugr` without moving code

### Group 1 — IUGR foundation

Create (only when implementing):

```
jasonos/app/iugr/layout.tsx          # scoped fonts + iugr CSS class wrapper; metadata
jasonos/app/iugr/page.tsx            # shell entry
jasonos/app/iugr/iugr.css            # cosmic field-guide tokens (do not fight JasonOS globals)
jasonos/components/iugr/             # IUGR-only UI (shell, scene frame, copy blocks)
jasonos/lib/iugr/                    # copy constants, scene types, pure helpers
```

Wire discovery (small edits):

- [`jasonos/components/jasonos/top-nav.tsx`](jasonos/components/jasonos/top-nav.tsx) — add Projects child  
- [`jasonos/app/projects/page.tsx`](jasonos/app/projects/page.tsx) — add Personal tools card  

Reuse: `cn`, lucide, shadcn sparingly (prefer editorial layout over dashboard cards).  
Defer: Framer Motion, Supabase, new state libraries.

### Group 2 — Opening + Original Town

- Client scene flow under `components/iugr/` (opening → Original Town)  
- Local React state for step / focus; optional URL searchParam later  
- Tone guardrails in `lib/iugr/copy.ts`: hypothetical ≠ proof; no Hitchhiker’s protected expression  
- Visual: soft anime × field-guide editorial via scoped CSS variables; avoid Matrix/cyberpunk and SaaS dashboard chrome  

### Group 3 — Copy Machine + illustrative math

- Interactive widgets as client components (`CopyMachine`, math explainer)  
- Pure functions in `lib/iugr/` for illustrative numbers (keep pedagogy honest)  
- Prefer CSS/`tw-animate-css` first; add **framer-motion** only if step transitions need orchestration  

### Supabase

**Not required** for Groups 1–3 (no accounts, progress sync, or CMS assumed). Revisit only if later prompts add save/progress or CMS.

---

## Dependencies

### Reuse now

`next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`, `shadcn` / `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next/font/google`

### May add later (do not install in foundation unless a prompt forces it)

| Package | Why |
|---|---|
| `framer-motion` (or `motion`) | Scene transitions, soft character motion beyond CSS |
| `@radix-ui/react-*` extras | Only if a shadcn primitive is missing and needed |
| Lightweight MDX / content layer | Only if entries become long authored essays outside TS modules |

---

## Risks & compatibility

1. **Root layout TopNav** always wraps every page. IUGR will sit under JasonOS chrome until vanity URL / chrome-stripping work (likely a later `(marketing)` route-group refactor). Accept for now.  
2. **Forced dark theme** on `<html>`. IUGR tokens must look intentional in dark; light-only art direction needs scoped overrides.  
3. **Geist is the default sans.** Expressive IUGR fonts must be **route-scoped** (Post Master pattern), not swapped globally.  
4. **shadcn/card habits** fight “Cosmic Field Guide × Soft Anime × Minimal Interactive Editorial.” Prefer bespoke IUGR components; use shadcn for controls (dialog, button) only when interaction needs them.  
5. **Repo dual-root confusion:** never put IUGR under the Vite CoSA root or root [`vercel.json`](vercel.json). Deploy path is **`jasonos/`**.  
6. **Vercel ignoreCommand** skips previews when the commit does not touch `jasonos/` (except on `main`). Keep IUGR files under `jasonos/` so previews build.  
7. **Copyright / tone:** keep original IUGR voice; repeatedly label the simulation argument as hypothetical, not empirical proof.

---

## Recommended local commands

```bash
cd jasonos
cp .env.local.example .env.local   # only if not already present; IUGR Groups 1–3 need no new env keys
npm install
npm run dev                        # http://localhost:3000/iugr (after route exists)
npm run lint
npm run build                      # before merge / deploy confidence
```

Production: JasonOS Vercel project (root directory `jasonos/`). Live URL = existing JasonOS host + `/iugr`.

---

## Explicit non-actions (this audit)

- Did not modify `package.json`, lockfiles, Next/Tailwind/ESLint config, or production app files.  
- Did not install Framer Motion or other packages.  
- No Granola meeting notes found for IUGR / Bostrom / simulation argument; product direction comes from this brief only.
