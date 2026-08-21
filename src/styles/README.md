# Global styles

Split from the former monolithic `index.css` for easier navigation.

| File | Contents |
|------|----------|
| `tokens.css` | Tailwind `@theme` defaults + `:root` fallbacks |
| `base.css` | `@layer base` — reset, body, scrollbars |
| `components.css` | `@layer components` — `.surface`, `.pill`, `.eyebrow`, … |
| `atmosphere.css` | Surveillance background stack (`.atmo-*`, `.surveil-shell`) |
| `live-background.css` | Video/city-cam backdrop + crossfade |
| `gridstack.css` | Dashboard grid drag/resize |
| `dashboard.css` | FAB, trash zone, widget dock, modals, `::selection` |
| `boot-loader.css` | Cold-start screen (mirrored in `public/boot-loader.css`) |
| `loading.css` | Skeletons + beam loader used by `components/ui/LoadingState` |
| `motion.css` | Shared animation vocabulary (`.anim-*`, `.tap`, `.lift`) |

**Themes** live in `src/themes/` (not here).

**Entry point:** `src/index.css` — only `@import` lines plus the root rem ladder.

## Adding an animation

Reuse a class from `motion.css` rather than writing new keyframes. It carries
the shared durations/easings and a single `prefers-reduced-motion` switch, which
is why it must stay the **last** import.

| Surface | Class |
|---------|-------|
| Route content | `.anim-page` |
| Modal scrim / dialog | `.anim-backdrop` / `.anim-modal` |
| Dropdown, picker | `.anim-popover` (or `.anim-popover-bottom`) |
| Edge drawer | `.anim-drawer-right` / `-left` / `-bottom` |
| Card or section reveal | `.anim-panel`, `.anim-rise`, `.anim-fade` |
| Cards, tiles, roomy lists | `.anim-stagger` on the container |
| Table rows, dense feeds | `.anim-stagger .anim-stagger-tight` on the container |
| Inline notice | `.anim-banner` |
| Buttons, clickable rows | `.tap` |
| Tabs / segmented controls | `.anim-toggle` |
