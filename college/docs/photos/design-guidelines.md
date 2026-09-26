# Photos + Visit planning: design guidelines

Site-wide tokens, type and dark mode live in `the-track-design-guidelines.md`. This file covers only what's specific to these two tabs.

## Shared
- Header kicker matches the other tabs: 24px square school mark (3px radius, school color, white initial 12/800) + name 16/700 + mono uppercase tab label.
- User tags are 24px circles (`#d3dcea` / `#2f5aa0`; dark `#26344d` / `#a9c1ec`). School tags are 24px squares in the school's color. In dark mode, school marks get a 1px `rgba(240,238,236,.14)` inset ring.
- Section heads: 16/700, with a mono 12 count right-aligned.

## Photos
| Element | Spec |
| --- | --- |
| Family grid | square tiles, `minmax(180px,1fr)`, 10px gap, caption 13 muted |
| School grid | square tiles, `minmax(96px,1fr)`, 4px gap |
| Placeholder fills | light `#dcdada / #d2cece / #c9c5c5`; dark `#2d3139 / #353a43 / #3d424b` |
| Hover | 2px accent outline, `cursor: zoom-in` |
| Star | Phosphor duotone `star`, 18px, accent |
| Add tile | 1.5px dashed neutral-500 (dark `#5d636c`), hover border accent + accent text |
| Viewer ground | `rgba(22,24,27,.97)` in both modes |
| Viewer buttons | 44px circles `#2d3139`, hover `#3d424b`; close is a 36px square |
| Viewer text | caption 16/600 `#f0eeec`; meta 13 `#9aa0a8` |
| Filmstrip | 44px thumbs, 3px gap, 60% opacity; active 100% + 2px accent border |

## Visit planning

### Interest ramp (from the Interest picker, 6a)
| Level | Fill | Label |
| --- | --- | --- |
| Top choice | `oklch(0.42 0.12 232)` | `#fff` |
| High interest | `oklch(0.54 0.12 228)` | `#fff` |
| Moderate interest | `oklch(0.66 0.10 225)` | `#201e1d` |
| Safety / backup | `oklch(0.78 0.07 225)` | `#201e1d` |
| Not on list | none, 1px dashed `#9b9797` | muted |

Dark mode lifts each fill slightly (0.48 / 0.58 / 0.70 / 0.80 lightness) so the deep steps don't sink into `#1f2228`. Labels keep the same colors.

Interest is shown **only** as chip fill. The current school is marked with an ink ring, not a different fill, so its interest color still reads.

### Clusters
| Element | Spec |
| --- | --- |
| Cluster name / sub | 18/700 · 14 subtle |
| Day count | mono 13/600, `--text-accent` |
| Add to trip | 30px outlined; pressed = orange tint `#feeee4` / border `#fab48e` / text `#461a05` |
| Chip | 36px tall, 3px radius, mark + name 14/600 |
| Drive leg | mono 12 subtle, 18px hairlines either side |
| Gap between clusters | 30px |

### Itinerary
| Element | Spec |
| --- | --- |
| Title / meta | 22/700 · 14 muted |
| Day label | mono 11 uppercase subtle |
| Slot | 52px mono time column, box min 40px, 8/12 padding |
| School slot | surface fill; current school = orange tint + `#fab48e` border |
| Drive / meal slot | transparent, 1px dashed `#c9c6c6` (dark `#3d424b`), duotone icon 18px |
| Primary button | solid accent, `#461a05` label; hover `#c74503` with white label |

## Accessibility
- Every thumbnail is a button with `aria-label` = caption.
- Viewer: `role="dialog" aria-modal="true"`, focus moves to Close on open and returns to the opener on close. Arrow keys and Esc work while it's open.
- Interest chips carry a `title` with school + level name, so color is never the only signal.
- Add to trip uses `aria-pressed`.
- Forced colors: chips, tiles and slot boxes get a `CanvasText` border.
