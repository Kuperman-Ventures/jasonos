# JasonOS login

Locked pages on `jasonos.vercel.app` (Home, Today, Outreach, Settings, and the rest of the OS) require Face ID or Touch ID. IUGR, Ski Tracker, and the College tracker stay outside this lock.

College login is unchanged on `kyle-college.vercel.app`. Do not turn on project-wide MFA, do not disable Google, and do not change College redirect URLs.

## One-time Supabase dashboard steps

These are additive. They do not replace Google or magic-link for College.

1. Authentication → URL configuration → Redirect URLs: add
   - `https://jasonos.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`
   Leave `https://kyle-college.vercel.app/auth/callback` in place.
2. Authentication → Passkeys: enable passkeys.
   - Relying Party Display Name: `JasonOS`
   - Relying Party ID: `jasonos.vercel.app` (not `vercel.app`)
   - Origins: `https://jasonos.vercel.app` and `http://localhost:3000`

Face ID / Touch ID buttons need that Passkeys toggle. Google alone does **not** unlock JasonOS for 7 days (see below).

## First time on a computer

1. Open JasonOS. You land on `/login`.
2. Continue with Google (Jason emails only). That only creates a session and sends you to “Add Face ID or Touch ID.”
3. Add Face ID or Touch ID when asked. That is what writes the signed 7-day unlock cookie.
4. That browser stays unlocked for 7 days.

Allowed emails (app-level, not a Supabase dashboard allowlist): `jason@kupermanadvisors.com`, `jskuperman@gmail.com`, `jason.kuperman@outlook.com`.

## Unlock cookie

The `jasonos_unlocked_at` cookie is an HMAC of the unlock timestamp. Signing secret order:

1. `JASONOS_UNLOCK_SECRET` (preferred)
2. else `CRON_SECRET`
3. else `SUPABASE_SERVICE_ROLE_KEY`

Without one of those, unlock fails closed.

## Google unlock emergency switch

Set `JASONOS_ALLOW_GOOGLE_UNLOCK=1` on the JasonOS Vercel project only if passkeys are broken and you need Google to stamp a 7-day unlock. Leave it unset in normal production.

## Cron

Set `CRON_SECRET` on the JasonOS Vercel project. Vercel Cron sends it as `Authorization: Bearer …`. Cron jobs fail closed if the secret is missing. Confirm it is present before merging this login work to production.

After this login ships, Claude may need to paste the Cursor & Claude password one more time. Cursor can keep using the same password.
