# Theme CSS

Each file defines `html[data-theme="…"]` variable blocks consumed by the app shell.

| File | Themes |
|------|--------|
| `classic.css` | `dark-1` … `dark-5`, `light-1` … `light-5` — core palette only |
| `extended.css` | `dark-6` … `dark-20`, `light-6` … `light-10` — adds `--theme-sidebar-bg`, dock, atmosphere tokens |
| `overrides.css` | Shared layout tweaks for extended themes + light-mode atmosphere rules |
| `glass.css` | Full frosted-glass surface treatment when `html[data-glass="true"]` (stacks on any palette) |

**Registry (names, preview colors):** `src/contexts/ThemeContext.tsx` — keep `ThemeId` in sync when adding a theme. Glass mode is a separate boolean (`glass` / `setGlass`), persisted under `accenty.crm.glass.v1`. Backdrop opacity (`glassOpacity`) → `accenty.crm.glass-opacity.v1`. Blur (`glassBlur`) → `accenty.crm.glass-blur.v1`. Boot script in `index.html` applies these before first paint to avoid flash.

**Entry point:** `src/index.css` imports `./themes/index.css`.
