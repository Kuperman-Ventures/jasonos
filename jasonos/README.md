# JasonOS

Personal command center — four tracks (Kuperman Ventures, Kuperman Advisors,
Job Search, Personal), one always-on second-monitor dashboard. Pull-model;
nothing pushes notifications. Action-first; every card ends in a verb.

Spec: see `chief_of_staff_spec_v2.docx.md` (CoSA root) and the JasonOS spec
v0.1 in chat history.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + shadcn/ui (slate base) — dark by default
- Supabase (`@supabase/ssr`) — scoped to the **`jasonos`** Postgres schema in
  the same Supabase project as CoSA (auth.users is shared)
- AI SDK v6 → Vercel AI Gateway → Anthropic
  (Claude Opus for the Best Next Action engine, Sonnet for "Tell Claude")
- Recharts (held in reserve), date-fns, lucide-react

## Folder layout

```
jasonos/
├── app/
│   ├── layout.tsx               root chrome (top nav, palette, toaster)
│   ├── page.tsx                 the hero dashboard
│   ├── projects/                Goal → Plan output
│   ├── todos/                   to-do list grouped by track
│   ├── contacts/                stub (v2)
│   ├── settings/                env + alert thresholds + model picks
│   └── api/tell-claude/route.ts streaming Claude endpoint
├── components/
│   ├── jasonos/                 dashboard primitives
│   └── ui/                      shadcn primitives
├── lib/
│   ├── types.ts                 every entity from spec §4
│   ├── supabase/                browser + server clients (jasonos schema)
│   ├── ai/                      BNA engine + Tell Claude
│   └── mock/data.ts             intentionally empty; no runtime demo data
├── supabase/migrations/
│   └── 0001_init_jasonos_schema.sql
├── vercel.ts                    typed Vercel config (separate project)
└── .env.local.example
```

## First-time setup (local)

```bash
cd jasonos
cp .env.local.example .env.local        # paste real values
npm install                              # already done by the scaffold
npm run dev
# open http://localhost:3000
```

The dashboard only renders live values or explicit empty states. The Tell Claude
command palette (`⌘K`) needs `AI_GATEWAY_API_KEY` to respond; without it,
clicking it shows a "needs configuration" toast.

## Cursor & Claude

Cursor pastes a password. Claude Cowork opens a JasonOS login page and asks for the same password. Walkthrough:
[Let Cursor and Claude see JasonOS](docs/claude-desktop-mcp.md).

## Supabase setup

1. Open the Supabase project that already hosts CoSA.
2. Apply the migration. Either:
   - Paste `supabase/migrations/0001_init_jasonos_schema.sql` into Supabase
     SQL Editor and run, **or**
   - Run via Supabase CLI: `supabase db push` (after `supabase link`).
3. **Critical**: Supabase Dashboard → Project Settings → **API** → in
   "Exposed schemas" append `jasonos` (so it reads `public, jasonos`). Save.
   Without this, supabase-js can't read JasonOS tables.
4. Verify: in SQL Editor, `select * from jasonos.cards limit 1;` → should
   return zero rows (not an error).

## Vercel setup (separate project, same team as CoSA)

See the chat for the click-by-click walkthrough. Short version:
1. `vercel link` from this folder, choose your team, **create new project**
   named `jasonos`, set Root Directory to `jasonos`.
2. Add env vars in the Vercel dashboard (mirror your `.env.local`).
3. `vercel deploy` — preview URL. `vercel deploy --prod` when ready.

## Wiring real data, module by module

To wire each module to live data:

1. Pick a module (e.g. Crunchbase Daily — see spec §3.1).
2. Add an adapter under `lib/integrations/<source>.ts`.
3. Add a Server Component, Route Handler, or server action data fetch using
   `lib/supabase/server.ts` (or a direct API call).
4. Cards write to `jasonos.cards`; dispositions write to `jasonos.dispositions`.

The UI is intentionally agnostic — every component reads typed objects from
`lib/types.ts`, so as long as your data fetch returns those shapes, nothing
in `components/jasonos/` needs to change.
