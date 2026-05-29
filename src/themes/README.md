# Theme CSS

Each file defines `html[data-theme="…"]` variable blocks consumed by the app shell.

| File | Themes |
|------|--------|
| `classic.css` | `dark-1` … `dark-5`, `light-1` … `light-5` — core palette only |
| `extended.css` | `dark-6` … `dark-20`, `light-6` … `light-10` — adds `--theme-sidebar-bg`, dock, atmosphere tokens |
| `overrides.css` | Shared layout tweaks for extended themes + light-mode atmosphere rules |

**Registry (names, preview colors):** `src/contexts/ThemeContext.tsx` — keep `ThemeId` in sync when adding a theme.

**Entry point:** `src/index.css` imports `./themes/index.css`.
