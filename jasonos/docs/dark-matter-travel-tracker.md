# Dark Matter Travel Tracker

IUGR Entry 02. A world map of versions and crossings from *Dark Matter*, running on the JasonOS backend and staying outside JasonOS login.

## Where it lives

- Live experience: [`/iugr/dark-matter`](/iugr/dark-matter)
- Shareable aliases: `/dark-matter` and `/projects/dark-matter-travel-tracker` redirect there
- Series home (Entry 01): [`/iugr`](/iugr)

Family members with the URL never see JasonOS chrome, Tell Claude, or other JasonOS pages. Hitting `/today`, `/settings`, or `/projects` still requires Face ID / Touch ID. Dark Matter links back to Entry 01, not to JasonOS home.

## What it is

A spoiler-aware map through season 2 episode 9. You can trace Jason 1, Jason 2, Amanda 2, the original family, or the other Jason branches. Arrows follow story order, not geographic distance.

## Access model

Same as the rest of IUGR: the URL is public. Anyone who has the link can read it. They cannot use that access to open JasonOS.

## Isolation checks

- Public prefixes are exact path boundaries (`/iugr` covers this entry; `/projects/dark-matter-travel-tracker-evil` stays locked).
- The page does not link to Home, Today, Settings, or other JasonOS tools.
