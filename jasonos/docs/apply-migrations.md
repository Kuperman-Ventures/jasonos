# Applying Supabase migrations

JasonOS doesn't have the Supabase CLI linked locally yet, so until that
happens migrations are applied manually via the Supabase Dashboard.

## Login hardening migrations (renamed on disk)

These two were applied to production under the temporary names `0085_*` and
`0086_*` during the passkey-login PR. Main already had
[`0085_connections_register.sql`](../supabase/migrations/0085_connections_register.sql),
and `0086` is reserved, so the files in git were renamed only:

| Applied name (production) | Repo file name now |
|---|---|
| `0085_lock_down_authenticated_jasonos` | [`0087_lock_down_authenticated_jasonos.sql`](../supabase/migrations/0087_lock_down_authenticated_jasonos.sql) |
| `0086_hash_mcp_tokens` | [`0088_hash_mcp_tokens.sql`](../supabase/migrations/0088_hash_mcp_tokens.sql) |

Do **not** re-run them. The SQL already ran; only the filenames changed to
clear the collision with Connections Register and keep `0086` free.

## What's pending (as of 2026-04-22)

- [`0002_user_integrations.sql`](../supabase/migrations/0002_user_integrations.sql)
  — adds `jasonos.user_integrations` (OAuth refresh tokens, one row per
  user × provider) and `jasonos.metric_snapshots` (daily KPI snapshots
  for real sparklines).
- [`0003_health_checks.sql`](../supabase/migrations/0003_health_checks.sql)
  — adds `jasonos.health_checks` (Product Health probe log) and the
  `jasonos.health_checks_latest` view.

Until both are applied:

- `/api/morning-brief` returns Gmail/Calendar/Granola/Fireflies as
  `configured: false` (no `user_integrations` table to read from).
- `/api/monitoring/health-check` runs but returns
  `persisted: false, note: "supabase service role missing"` even after
  you set `SUPABASE_SERVICE_ROLE_KEY`, because the table doesn't exist.
- `/api/monitoring/health-summary` returns synthetic-empty data.
- `/api/action-queue/add` returns `503` without persisting until Supabase is configured.

## Apply via Dashboard (fastest)

1. Open <https://supabase.com/dashboard/project/vtxbdyqpmwtzijqlzvtc/sql/new>.
2. Paste the contents of [`0002_user_integrations.sql`](../supabase/migrations/0002_user_integrations.sql),
   click **Run**.
3. Paste the contents of [`0003_health_checks.sql`](../supabase/migrations/0003_health_checks.sql),
   click **Run**.
4. Verify in the Table Editor that `jasonos.user_integrations`,
   `jasonos.metric_snapshots`, and `jasonos.health_checks` exist.

## Apply via Supabase CLI (preferred long-term)

One-time setup:

```sh
brew install supabase/tap/supabase   # if not already installed
cd jasonos
supabase login
supabase link --project-ref vtxbdyqpmwtzijqlzvtc
```

Then:

```sh
supabase db push
```

The CLI will diff `supabase/migrations/` against the remote and apply
anything pending. Future migrations: drop new `.sql` files in
`supabase/migrations/` and run `supabase db push`.

## Apply via psql (CI-friendly)

```sh
PGURL='postgres://postgres:<DB_PASSWORD>@db.vtxbdyqpmwtzijqlzvtc.supabase.co:5432/postgres'

psql "$PGURL" -f supabase/migrations/0002_user_integrations.sql
psql "$PGURL" -f supabase/migrations/0003_health_checks.sql
```

(`DB_PASSWORD` is in Supabase Dashboard → Project Settings → Database.)

## Smoke test after applying

```sh
# Should return persisted: true, checked: 9
curl -s https://jasonos.vercel.app/api/monitoring/health-check?source=cron \
  -H "Authorization: Bearer $CRON_SECRET" | jq

# Should return configured: true with one entry per target
curl -s https://jasonos.vercel.app/api/monitoring/health-summary | jq '.configured, .targets | length'
```
