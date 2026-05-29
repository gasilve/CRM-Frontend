# Global styles

Split from the former monolithic `index.css` for easier navigation.

| File | Contents |
|------|----------|
| `tokens.css` | Tailwind `@theme` defaults + `:root` fallbacks |
| `base.css` | `@layer base` — reset, body, scrollbars |
| `components.css` | `@layer components` — `.surface`, `.pill`, `.eyebrow`, … |
| `atmosphere.css` | Surveillance background stack (`.atmo-*`, `.surveil-shell`) |
| `gridstack.css` | Dashboard grid drag/resize |
| `dashboard.css` | FAB, trash zone, widget dock, modals, `::selection` |

**Themes** live in `src/themes/` (not here).

**Entry point:** `src/index.css` — only `@import` lines; do not add rules there.
