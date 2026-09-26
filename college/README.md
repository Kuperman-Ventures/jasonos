# Kyle's College Search (The Track)

A separate site from JasonOS for Kyle, Jason, and Kat. The college list is the front door. Timeline, FAQ, application questions, consultant scores, and notes sit behind it.

## Run

```bash
cd college
cp .env.local.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Without Supabase env vars the page opens in local seed mode (no login). With Supabase configured, the site requires a household login.

## Login

- Jason, Kat, and Kyle can sign in when their emails are on `college.members` and `ui_visible` is true.
- Wyatt and Guest exist in that table but stay hidden from the site until Jason turns them on.
- Sign-in options: Google, or an email link.
- Data still moves through the server with the service role. Browser clients do not query the `college` schema.

Jason is already linked to `jason@kupermanadvisors.com`. To turn on Kat or Kyle, set their email:

```sql
update college.members
set email = 'kat@example.com', updated_at = now()
where id = 'kat';

update college.members
set email = 'kyle@example.com', updated_at = now()
where id = 'kyle';
```

In Supabase Auth, add these redirect URLs:

- `http://localhost:3210/auth/callback`
- `https://kyle-college.vercel.app/auth/callback`

## Database

Migrations live in [college/supabase/migrations](supabase/migrations).

Use the same Supabase project as JasonOS. Keep `college` in **Integrations → Data API → Exposed schemas** so the server client can reach tables. Leave table grants on `service_role` only. Do not grant `anon` or `authenticated` on college tables.

## Deploy

Vercel project root `college/`. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` alongside the existing URL and service role key. Do not point a family domain at this until Kat and Kyle can sign in.
