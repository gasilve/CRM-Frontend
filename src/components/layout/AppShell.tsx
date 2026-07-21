import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { LiveBackground } from "./LiveBackground";

const FULL_BLEED_ROUTES = ["/assistant"];

export default function AppShell() {
  const { pathname } = useLocation();
  const fullBleed = FULL_BLEED_ROUTES.some((r) => pathname.startsWith(r));

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
                {/* SMIL: discrete seed jumps = true TV-static interference */}
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

      <Sidebar />

      <div className="app-shell-main relative z-10 flex h-full flex-1 flex-col overflow-hidden">
        <TopBar />
        <main
          className={
            fullBleed
              ? "app-main flex-1 overflow-hidden"
              : "app-main flex-1 overflow-y-auto px-7 py-6"
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
