# Kyle's College Search

A separate site from JasonOS, for Kyle, Jason, and his wife. The college list is the front door. Timeline, FAQ, application questions, consultant scores, and notes sit behind it.

Content is copied from the working artifact and from the engineering spreadsheet. Nothing in those files was rewritten.

## Run

```bash
cd college
cp .env.local.example .env.local
npm install
npm run dev
```

The page still opens without Supabase. Checkboxes, scores, notes, ranks, and visits save only after the database is connected.

## Database

Migration: [college/supabase/migrations/0001_init_college.sql](supabase/migrations/0001_init_college.sql).

It lives in a `college` schema on the same Supabase project as JasonOS. In the Supabase dashboard, add `college` to API → Exposed schemas, next to `public` and `jasonos`. Copy `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into this app's environment. The service role stays on the server.

There is no login yet. Do not put this on a public domain until the three family accounts exist. Those accounts should not be created until JasonOS stops treating every logged-in user as allowed to read its tables.

Checklist progress and edited consultant scores from the old artifact page are not in this folder. The new site starts unchecked, with the seed consultant scores.

## Deploy

New Vercel project, root directory `college/`. Do not point the family domain at jasonos.vercel.app.
