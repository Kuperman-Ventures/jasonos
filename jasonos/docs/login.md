# JasonOS login

Locked pages on `jasonos.vercel.app` (Home, Today, Outreach, Settings, and the rest of the OS) require Face ID or Touch ID. IUGR, Ski Tracker, Dark Matter Travel Tracker, and the College tracker stay outside this lock.

College login is unchanged on `kyle-college.vercel.app`. Do not turn on project-wide MFA, do not disable Google, and do not change College redirect URLs.

## One-time Supabase dashboard steps

These are additive. They do not replace Google or magic-link for College.

1. Authentication → URL configuration → Redirect URLs: add **exactly**
   - `https://jasonos.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`
   Leave `https://kyle-college.vercel.app/auth/callback` in place.
   Do **not** put query strings on those redirect URLs. JasonOS remembers `next`
   in a short-lived cookie so Google never falls back to the College Site URL.
2. Authentication → Passkeys: enable passkeys.
   - Relying Party Display Name: `JasonOS`
   - Relying Party ID: `jasonos.vercel.app` (not `vercel.app`)
   - Origins: `https://jasonos.vercel.app` only  
     (Do not add localhost here. Passkeys on this project are for the live site.)

Face ID / Touch ID buttons need that Passkeys toggle. Google alone does **not** unlock JasonOS for 7 days (see below).
Registration/unlock forces a platform authenticator (`client-device`) so macOS
Touch ID / iPhone Face ID is offered instead of a QR security-key sheet.

## First time on a computer

1. Open JasonOS. You land on `/login`.
2. Continue with Google (Jason emails only). That only creates a session and sends you back to the unlock screen. Google alone does not unlock JasonOS.
3. If this Mac or phone already has Face ID or Touch ID, tap **Unlock with Face ID or Touch ID**. Add it only the first time on this device. If Add is tapped and this device already has the passkey, JasonOS signs in with the existing one instead of stopping on the browser's "already registered" error.
4. That browser stays unlocked for 7 days.

Allowed emails (app-level, not a Supabase dashboard allowlist): `jason@kupermanadvisors.com`, `jskuperman@gmail.com`, `jason.kuperman@outlook.com`.

## Unlock cookie

The `jasonos_unlocked_at` cookie is an HMAC of the unlock timestamp. Signing secret order:

1. `JASONOS_UNLOCK_SECRET` (preferred — **set a dedicated value in Vercel Production**)
2. else `CRON_SECRET`
3. else `SUPABASE_SERVICE_ROLE_KEY`

`/auth/stamp` ignores the request body. It only stamps after `auth.getClaims()` shows a
recent `amr` method of `passkey` (or `mfa/webauthn`). After Google enrollment, the login
form signs in with the new passkey before calling stamp.

Without a signing secret, unlock fails closed. Keep `CRON_SECRET` set on the JasonOS
Vercel project as well (cron auth); do not rely on it as the unlock secret.

## Google unlock emergency switch

Set `JASONOS_ALLOW_GOOGLE_UNLOCK=1` on the JasonOS Vercel project only if passkeys are broken and you need Google to stamp a 7-day unlock. Leave it unset in normal production.

## Cron

Set `CRON_SECRET` on the JasonOS Vercel project. Vercel Cron sends it as `Authorization: Bearer …`. Cron jobs fail closed if the secret is missing. Confirm it is present before merging this login work to production.

After this login ships, Claude may need to paste the Cursor & Claude password one more time. Cursor can keep using the same password.
