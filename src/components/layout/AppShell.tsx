import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import Sidebar from "./Sidebar";
import { LiveBackground } from "./LiveBackground";

const FULL_BLEED_ROUTES = ["/assistant", "/video"];
/**
 * Pages that own the viewport with `h-full` flex layouts (tables, grids,
 * calendars). They must NOT sit under a `min-h-full`-only wrapper — percentage
 * height only resolves when the parent has an explicit height.
 * Dashboard (`/`) uses fill-height so the fixed board does not create page scroll.
 */
const FILL_HEIGHT_PREFIXES = [
  "/",
  "/cases",
  "/my-day",
  "/pending-cases",
  "/schedule",
  "/investigators",
  "/clients",
  "/profile",
  "/administration",
  "/documents",
];
const SIDEBAR_COLLAPSED_LS_KEY = "accenty.crm.sidebar.collapsed";

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default function AppShell() {
  const { pathname } = useLocation();
  const fullBleed = FULL_BLEED_ROUTES.some((r) => pathname.startsWith(r));
  const fillHeight = FILL_HEIGHT_PREFIXES.some((r) => pathMatchesPrefix(pathname, r));
  const noScroll = fullBleed || fillHeight;
  /** Pending case detail only — not the list. Full-screen caution wash. */
  const pendingCaseDetail = /^\/pending-cases\/[^/]+/.test(pathname);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Keeps `--app-sidebar-w` in sync at :root so elements portaled straight
  // onto `document.body` (case action bar, page arrows) can position
  // themselves relative to the content pane rather than the whole viewport.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-w", collapsed ? "3.25rem" : "16rem");
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_LS_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <div className="surveil-shell relative flex h-screen w-full overflow-hidden bg-[var(--color-ink-0)] text-[var(--color-text-hi)]">
      {/* Atmospheric overlays */}
      <LiveBackground />
      <div className="atmo atmo-glass-scene" aria-hidden />
      <div className="atmo atmo-radial" aria-hidden />
      <div className="atmo atmo-noise" aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <filter id="atmoNoise" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                stitchTiles="stitch"
                seed="1"
              >
                <animate
                  attributeName="seed"
                  values="1;7;13;21;34;49;58;72;88;101;5;19;42;63;77"
                  dur="0.9s"
                  calcMode="discrete"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="baseFrequency"
                  values="0.85;0.98;0.9;1.05;0.88;0.96;0.92"
                  dur="3.6s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.78
                        0 0 0 0 0.84
                        0 0 0 0 1
                        0 0 0 0.85 0"
              />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#atmoNoise)" />
        </svg>
      </div>
      <div className="atmo atmo-scanlines" aria-hidden />
      <div className="atmo atmo-sweep" aria-hidden />
      <div className="atmo atmo-vignette" aria-hidden />
      {pendingCaseDetail ? <div className="pending-case-hazard-bg" aria-hidden /> : null}

      {navOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <Sidebar
        open={navOpen}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onNavigate={() => setNavOpen(false)}
      />

      {/* Mobile nav opener — the topbar is gone, so this floats over content */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setNavOpen(true)}
        className="fixed bottom-4 left-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/90 text-[var(--color-text-mid)] shadow-lg backdrop-blur-sm transition-colors hover:text-[var(--color-text-hi)] lg:hidden"
      >
        <Menu size={17} strokeWidth={1.7} />
      </button>

      <div className="app-shell-main relative z-10 flex h-full flex-1 flex-col overflow-hidden">
        <main
          className={cn(
            "app-main flex-1",
            fullBleed
              ? "flex flex-col overflow-hidden"
              : noScroll
                ? "flex flex-col overflow-hidden px-7 py-6"
                : "overflow-y-auto px-7 py-6",
          )}
        >
          {/* Fill pages: h-full so nested flex/percentage layouts get a real height.
              Dashboard: min-h-full so a tall GridStack can grow and the main scrolls.
              Fade only — no transform (transformed ancestors break GridStack). */}
          <div
            key={pathname}
            className={cn("anim-fade", fillHeight || fullBleed ? "flex h-full min-h-0 flex-col" : "min-h-full")}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
