# Cursor prompt: Dark mode fix

Attach:
- `tokens.css`: the full light + dark color token set. This is the source of truth.
- `the-track-design-guidelines.md`: site-wide guidelines (§2 and §2b are now in sync with `tokens.css`).
- The screenshot of the College list in dark mode.

---

## What's wrong

In dark mode the **text flips to light but many backgrounds stay light**, so text disappears. The cause is components that set their background (or border) with a hard-coded hex, `white`, a raw ramp step like `--color-neutral-100`, or a Tailwind/utility light color, while their text uses the semantic tokens that flip.

Seen on the College list:
1. **Main content area** below the header stays `#f3f2f2`. School names, location, selectivity, next action and the Visit column are near-invisible.
2. **Step 1 · Exploration** (active phase card) has a light fill, so its title is invisible.
3. **Top choice rows** keep the light blue row tint (`oklch(0.95 0.02 225)`).
4. **Table header** row stays light gray.
5. **Search schools**, **Add a school**, and the three filter **selects** (All selectivity, All interest, Sheet order) have light fills. Their placeholder and selected text is unreadable. "Download spreadsheet" is invisible.
6. **Empty interest meter bars** and the step 2/3 progress tracks use a light neutral that glows on dark.
7. **Left rail active item** (Colleges) has an orange outline border. The active style is the tint fill only, with no border.
8. **Ingest** shows a second highlight while Colleges is active. Only one nav item may look active. Check that hover isn't stuck, and that Ingest isn't matching the route too.

Not dark mode, but visible in the same screenshot: the header says **Phase 1 of 3** and the rail says **1 / 6**. Use one phase model everywhere.

---

## Fix

1. **Install `tokens.css`** at the app root, replacing any existing color variables. Keep the variable names; components should already reference most of them.
2. **Set the mode before first paint.** Set `data-mode` on `<html>` from the user's Appearance setting (System follows `prefers-color-scheme` and updates live). `tokens.css` sets `color-scheme` so native scrollbars, selects and date pickers go dark.
3. **Audit every component** for colors that don't come from a token. Search for:
   - `#fff`, `#ffffff`, `white`, `#f3f2f2`, `#eae9e9`, `#f8f4f4`, `#eae7e7`, `#d7d3d3`, `#e0dede`
   - `--color-neutral-` and `--color-accent-1`, `--color-accent-2` (raw ramp steps used as backgrounds or borders)
   - `oklch(0.9`, `rgba(255,255,255`
   - utility classes like `bg-white`, `bg-gray-*`, `bg-slate-*`, `text-gray-*`
   
   Replace each one with its semantic token:

   | Where | Token |
   | --- | --- |
   | Page / main content / modal | `--color-bg` |
   | Left rail | `--color-rail` |
   | Table header, inputs, selects, cards, tracks, neutral chips | `--color-surface` |
   | Row hover, pressed | `--color-surface-2` |
   | Popovers, menus, dropdown lists, **active phase card** | `--color-raised` |
   | Input, select and chip borders | `--color-border` |
   | Table row hairlines | `--color-rule` |
   | Active nav, in-progress chips, highlighted rows | `--color-accent-tint` + `--text-on-tint`, **no border** |
   | Top choice row tint | `--lvl-4-row` |
   | Interest bars / chips | `--lvl-1…4` + `--lvl-N-fg` |
   | Empty meter bars, empty progress tracks | `--meter-empty` |
   | Placeholder text | `--text-placeholder` |

4. **School logos** stay on a white tile (`--logo-tile`) in both modes so their colors hold. In dark mode add `box-shadow: inset 0 0 0 1px var(--logo-ring)`.
5. **Pair surfaces and text from the same set.** If a component sets a background, it must also set its text color from a token (or inherit it). Never set one without the other.
6. **The phase header band** is already dark in the screenshot. Once the page ground is `--color-bg`, the header band and the content read as one surface. Remove any separate hard-coded header background.

---

## Check before you're done

1. Open the College list, Dashboard, a school detail modal (every tab), the account menu and a dialog in **Light**, **Dark**, and **System** (flip Windows' setting while on System).
2. No light surface is visible anywhere in dark mode, except school logo tiles and photos.
3. All body and label text is at least 4.5:1 on `--color-bg` and on `--color-surface`. Pay attention to placeholders and small mono labels.
4. Open every native `<select>`. The dropdown list is dark.
5. Exactly one nav item looks active. Hover clears when the mouse leaves.
6. Top choice rows are tinted dark blue, not light blue. The interest bars read clearly.
7. Check once in Windows High Contrast (forced colors).
