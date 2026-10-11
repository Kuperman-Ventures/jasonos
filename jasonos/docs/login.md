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

Until passkeys are enabled in the dashboard, Google still unlocks JasonOS for Jason's emails. Face ID / Touch ID buttons will fail until that toggle is on.

## First time on a computer

1. Open JasonOS. You land on `/login`.
2. Continue with Google (Jason emails only).
3. Add Face ID or Touch ID when asked.
4. That browser stays unlocked for 7 days.

After this login ships, Claude may need to paste the Cursor & Claude password one more time. Cursor can keep using the same password.

## Cron

Set `CRON_SECRET` on the JasonOS Vercel project. Vercel Cron sends it as `Authorization: Bearer …`. Cron jobs fail closed if the secret is missing.
