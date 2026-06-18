# Accenty CRM (web app)

Vite + React + TypeScript + Tailwind CSS v4 implementation of the Accenty CRM dashboard.

## Run

```bash
cd app
npm install
npm run dev
```

Then open <http://localhost:5173>.

## What's in here

- **Dashboard** (`/`) — drag-and-drop widget grid powered by [Gridstack.js](https://gridstackjs.com/).
  Click **Edit layout** in the top right to enable drag & resize handles. Layout persists to `localStorage` under `accenty.crm.dashboard.layout.v1`.
- **Clients** (`/clients`) — searchable, segmentable, sortable table with a side-drawer detail view.
- **Cases** (`/cases`) — Kanban board (drag cards across columns, powered by [`@dnd-kit`](https://dndkit.com/)) with an alternate table view.

## Stack

| Concern | Lib |
|---|---|
| Build / dev server | Vite 6 |
| Framework | React 18 + TypeScript |
| Styling | Tailwind CSS v4 (via `@tailwindcss/postcss`) |
| Routing | React Router 6 |
| Charts | Recharts |
| Icons | lucide-react |
| Dashboard DnD/resize | gridstack |
| Kanban DnD | @dnd-kit/core |
| Fonts (CDN) | Cinzel, Cormorant Garamond, Montserrat, JetBrains Mono |

## Folder map

```
src/
├─ App.tsx                 router
├─ main.tsx                entry
├─ index.css               style entry (@import only)
├─ styles/                 global CSS (see styles/README.md)
│  ├─ tokens.css           @theme + :root defaults
│  ├─ base.css             reset, body, scrollbars
│  ├─ components.css       .surface, .pill, …
│  ├─ atmosphere.css       background / .atmo-* stack
│  ├─ gridstack.css        dashboard grid DnD
│  └─ dashboard.css        FAB, dock, modals
├─ themes/                 per-theme CSS variables (see themes/README.md)
│  ├─ classic.css          dark-1…5, light-1…5
│  ├─ extended.css         dark-6…20, light-6…10
│  └─ overrides.css        extended-theme layout + light atmo rules
├─ contexts/ThemeContext.tsx   theme id registry + provider
├─ lib/
│  ├─ cn.ts
│  └─ mock-data.ts         clients, cases, schedule, activity, revenue
├─ components/
│  ├─ layout/{AppShell,Sidebar,TopBar,ThemePicker}.tsx
│  ├─ dashboard/            FAB, trash, confirm modal
│  └─ ui/{Card,Avatar,Pill,Eyebrow}.tsx
└─ pages/
   ├─ Dashboard.tsx        Gridstack host
   ├─ Clients.tsx
   ├─ Cases.tsx
   └─ widgets/             individual dashboard widgets
```

## Design tokens (excerpt)

Defaults in `src/styles/tokens.css` under `@theme { … }` (themes override via `html[data-theme]`):

- Surfaces: `ink-0` (deepest) → `ink-4`
- Text: `text-hi` / `text-mid` / `text-lo`
- Accent: `#4a7fff` with a `accent-glow` for shadows
- Type stack: `font-display` (Cormorant italic), `font-eyebrow` (Cinzel uppercase), `font-sans` (Montserrat), `font-mono` (JetBrains Mono)

## Notes for future work

- The dashboard is desktop-first (≥ 1280 px). Add a `mobile` layout via Gridstack's `column: 1` breakpoint.
- All data is mocked in `lib/mock-data.ts`. Swap in a real API by replacing imports.
- 30 themes (dark + light) via `data-theme` on `<html>`. To add one: extend `ThemeId` + `THEMES` in `ThemeContext.tsx`, then add a block in `themes/classic.css` or `themes/extended.css`.
- The Cases page persists changes in memory only. Add `localStorage` if needed, or wait for the API.
