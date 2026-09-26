# The Track — design guidelines

A design system for a college-prep portal. Give this file to Cursor as the single source of truth for look and feel. Reference implementation: `Prep Portal - Design System.dc.html`. Logo asset: `assets/logo.png` (transparent PNG, 900×660).

**Legal note.** The orange accent is an original choice inspired by the general look of motorsport liveries. Do not add any team's logo, wordmark, chevron, or licensed typeface to this product.

---

## 1. Principles

1. **One accent.** Orange marks interactive elements, live state, and the single most important figure on a screen. If two things on a view are orange, one is wrong.
2. **Space, not boxes.** Sections are separated by whitespace. No rules, borders, or container cards used for grouping. Cards exist only for discrete, filable items (a task, a school, an event).
3. **Grotesque speaks, mono reports.** Anything a person wrote is Archivo. Anything a machine would report — scores, dates, counts, deadlines, status labels — is IBM Plex Mono, tabular.
4. **Flush left, asymmetric.** Headings hug the left edge; whitespace sits on the right. Nothing is centered.
5. **Both modes, always.** Every component is authored once against tokens and must be checked in light and dark before shipping.

---

## 2. Tokens

Author against these variables. Never hard-code a hex, font name, or spacing value that a token already carries.

### Semantic text tokens (these flip with mode — always use these for text color)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-text` | `#201e1d` | `#f0eeec` | Primary prose and headings |
| `--text-muted` | `#444141` | `#c3c8cf` | Secondary prose, captions |
| `--text-subtle` | `#605d5d` | `#9aa0a8` | Small mono labels, units, metadata |
| `--text-accent` | `#9e3603` | `#fab48e` | Accent-colored *text* (eyebrows, datelines) |

Do not color text with a raw `--color-neutral-*` or `--color-accent-*` step: those ramps run the same direction in both modes, so a fixed step inverts its contrast when the mode flips.

### Surfaces

| Token | Light | Dark |
| --- | --- | --- |
| `--color-bg` | `#f3f2f2` | `#16181b` |
| `--color-surface` | `#eae9e9` | `#1f2228` |
| `--color-divider` | `rgba(32,30,29,0.16)` | `rgba(240,238,236,0.16)` |

### Accent — orange (the one accent)

`100 #feeee4` · `200 #fdd6c0` · `300 #fab48e` · `400 #f58749` · **`500 #e85504`** · `600 #c74503` · `700 #9e3603` · `800 #742703` · `900 #461a05`

- `500` — primary button fill, active nav, progress fill, the one key figure.
- `600` — pressed state.
- `700` (light) / `300–400` (dark) — accent text. Use `--text-accent`.
- `100–200` — tinted fills behind accent text (deadline banner, highlighted row).

### Second spot — cyan `#0088b0`

Means *done / submitted*, and nothing else. Orange means attention. Never put both in the same small component.

### Brand blue — `#1b4ca8` (light) / `#7ba4ee` (dark)

The graduation-cap mark's blue. Used **only** by the mark. No UI element is tinted to match it.

### Neutral ramp

`100 #f8f4f4` · `200 #eae7e7` · `300 #d7d3d3` · `400 #bab6b6` · `500 #9b9797` · `600 #7d7979` · `700 #605d5d` · `800 #444141` · `900 #2d2b2b` (dark mode inverts the mapping of these to surfaces). Use for fills, tracks, and borders — not for text.

### Type

Archivo — a technical grotesque with a variable width axis. Wide, squared, engineering-adjacent, in the same typographic family as motorsport brand faces without being one of them.

```
--font-heading: "Archivo", system-ui, sans-serif   /* 700–800, wdth 118% at display sizes */
--font-body:    "Archivo", system-ui, sans-serif   /* 400, true italic */
mono:           "IBM Plex Mono", monospace          /* 400–500, tabular */
```

Load: `https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,300..900;1,62..125,300..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap`

The wide width (`font-stretch: 118%`) and uppercase are reserved for the display heading and the logo lockup. Everything else runs at normal width, sentence case.

| Role | Size / line-height / weight | Font |
| --- | --- | --- |
| Display | 78 / 0.92 / 800, wdth 118%, `-0.02em`, uppercase | Archivo |
| Page title | 42 / 1.1 / 700, `-0.02em` | Archivo |
| Section title | 28 / 1.15 / 600 | Archivo |
| Sub-title | 20–24 / 1.2 / 600 | Archivo |
| Body | 17 / 1.6–1.68 / 400 | Archivo |
| Secondary body | 16 / 1.55 / 400, `--text-muted` | Archivo |
| Pull quote | 19–21 / 1.5 / 400 italic | Archivo |
| Big figure | 46–52 / 1 / 500, `tabular-nums`, `-0.02em` | Mono |
| Label | 10–11 / 1.4 / 500, `0.16em`, uppercase | Mono |
| Datum | 12–15 / 1.5 / 400, `tabular-nums` | Mono |

Never set a sentence in the monospace. Body measure is 66 characters maximum.

### Spacing, radius, elevation

Spacing scale (1.25× density): `5 · 10 · 15 · 20 · 30 · 40` px, exposed as `--space-1/2/3/4/6/8`. Section gap is ~110px, header padding 72px. Do not tighten the scale to fit more in.

Radius: `--radius-sm 1px` · `--radius-md 2px` · `--radius-lg 4px`. This system is nearly square-cornered — no pill buttons, no 12px cards.

Elevation: `--shadow-sm/md/lg`, only on cards and dialogs. Never on buttons, inputs, or sections.

---

## 3. Components

**Buttons** — `.btn` plus `.btn-primary` (solid orange), `.btn-secondary` (outlined), `.btn-ghost`. One primary per view. Hover, pressed, focus and disabled states are built into the classes; do not restyle them inline.

**Tags** — `.tag-accent` (needs attention / due soon), `.tag-accent-2` (submitted / done), `.tag-neutral` (draft), `.tag-outline` (not started).

**Readouts** — the signature element. A mono uppercase label, a large mono tabular figure, and an optional delta line. Never boxed; separated by a 1px `--color-divider` left border and `--space-6` of padding. At most one readout per row takes the accent color.

**Progress bar** — 6px tall, `--color-neutral-300` track, full-strength accent fill, `--radius-sm`. Does not animate on load.

**Timeline** — a 130px mono date column, a centered hairline spine, then the content. Markers are 11px circles: filled cyan = done, filled orange = current, hollow with a `--color-neutral-400` border = upcoming. No cards, no arrows, no connecting curves.

**Article** — mono dateline in `--text-accent`, flush-left headline, italic standfirst, 66ch body measure, and a 200px right margin column for figures and related links. Pull quotes take a 2px left accent bar — the only rule allowed inside body copy.

**Table** — Archivo for names, mono `tabular-nums` right-aligned for numbers, themed header row, hairline row rules. Status column uses tags.

**Cards** — `.card` with `.card-kicker` / `.card-title` / `.card-body` / `.card-meta`, `.elev-sm`. Discrete items only.

**Fields** — `.field` + `label` + `.input`; `.seg` + `.seg-opt` for 2–3 exclusive choices. Native elements, no custom controls.

---

## 4. Interaction states

- Hover: one ramp step lighter/tinted from the accent.
- Pressed: `--color-accent-600` (light) / `--color-accent-400` (dark).
- Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px` on `:focus-visible`. Never leave the browser default.
- Disabled: 45% opacity.
- Selection: accent tint.
- Links: `--text-accent` with a 1px underline of `currentColor`; hover moves one step brighter.

---

## 5. Accessibility rules

- Body and label text must clear 4.5:1 against its ground in **both** modes. Headline-scale text (28px+) may sit at 3:1.
- Small mono labels are the usual failure point — they must use `--text-subtle`, not a mid neutral step.
- Numbers are `font-variant-numeric: tabular-nums` everywhere so columns align.
- Every interactive target is at least 44px tall on touch.

---

## 6. Logo

File: `assets/logo.png` — transparent background, works on both grounds.

- Clear space on all four sides equals the height of the tassel knot.
- Minimum height 28px. Below that the tassel fills in.
- Lockup: mark at 46px beside "THE TRACK" at 30px/800 Archivo, wdth 118%, uppercase, `--space-3` gap, cap heights aligned.
- Do not recolor it, outline it, shadow it, place it on a photograph, or scale it larger than the wordmark beside it.

---

## 7. Do / Don't

**Do**
- Let one orange figure carry each screen.
- Separate sections with space.
- Set every number in tabular mono.
- Keep prose at a 66-character measure, flush left.
- Check both modes before shipping.

**Don't**
- Use any team's logo, wordmark, chevron, or licensed typeface.
- Put orange and cyan in the same small component.
- Introduce a second typeface — Archivo carries every weight and width the site needs.
- Set a sentence in the monospace.
- Tighten the spacing scale.
- Color text with a raw ramp step instead of a semantic token.
