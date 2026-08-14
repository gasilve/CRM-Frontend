import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeId =
  | "dark-1"
  | "dark-2"
  | "dark-3"
  | "dark-4"
  | "dark-5"
  | "dark-6"
  | "dark-7"
  | "dark-8"
  | "dark-9"
  | "dark-10"
  | "dark-11"
  | "dark-12"
  | "dark-13"
  | "dark-14"
  | "dark-15"
  | "dark-16"
  | "dark-17"
  | "dark-18"
  | "dark-19"
  | "dark-20"
  | "light-1"
  | "light-2"
  | "light-3"
  | "light-4"
  | "light-5"
  | "light-6"
  | "light-7"
  | "light-8"
  | "light-9"
  | "light-10";

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  mode: "dark" | "light";
  /** Preview card background */
  bg: string;
  /** Accent dot color */
  accent: string;
};

export const THEMES: ThemeMeta[] = [
  { id: "dark-5",  name: "True Cognition",  mode: "dark",  bg: "#0a0a0a", accent: "#00adef" },
  { id: "dark-1",  name: "Midnight", mode: "dark",  bg: "#0d1220", accent: "#4a7fff" },
  { id: "dark-3",  name: "Abyss",    mode: "dark",  bg: "#091614", accent: "#2dd4bf" },
  { id: "dark-4",  name: "Ember",    mode: "dark",  bg: "#1c1409", accent: "#f59e0b" },
  { id: "dark-2",  name: "Obsidian", mode: "dark",  bg: "#16111d", accent: "#a78bfa" },
  { id: "dark-6",  name: "Dynamo Dark",  mode: "dark",  bg: "#121212", accent: "#d40000" },
  { id: "dark-16", name: "Tsunami",      mode: "dark",  bg: "#080a13", accent: "#2b7bff" },
  { id: "dark-8",  name: "Premium Dark", mode: "dark",  bg: "#0a0a0a", accent: "#d4af37" },
  { id: "dark-9",  name: "Neon Dark",    mode: "dark",  bg: "#0c0617", accent: "#00e5ff" },
  { id: "dark-10", name: "Royal Dark",   mode: "dark",  bg: "#060915", accent: "#5b7cff" },
  { id: "dark-11", name: "Racer",        mode: "dark",  bg: "#0a0a0a", accent: "#d40000" },
  { id: "dark-7",  name: "Emerald Dark", mode: "dark",  bg: "#07110f", accent: "#10b981" },
  { id: "dark-13", name: "High End",     mode: "dark",  bg: "#050505", accent: "#f8f8f8" },
  { id: "dark-14", name: "Bunsen",       mode: "dark",  bg: "#090a0e", accent: "#3bc7ff" },
  { id: "dark-15", name: "Phantom",      mode: "dark",  bg: "#05070d", accent: "#8ea2ff" },
  { id: "dark-12", name: "Nitro",        mode: "dark",  bg: "#0a0a0a", accent: "#ff7a00" },
  { id: "dark-17", name: "Toxic",        mode: "dark",  bg: "#050906", accent: "#7fff00" },
  { id: "dark-18", name: "Iconic",       mode: "dark",  bg: "#010101", accent: "#f3f4f6" },
  { id: "dark-19", name: "Galaxy",       mode: "dark",  bg: "#010006", accent: "#b45cff" },
  { id: "dark-20", name: "Monolith",     mode: "dark",  bg: "#06080f", accent: "#6b7280" },
  { id: "light-10", name: "Royal Light",  mode: "light", bg: "#f3f6ff", accent: "#4864f2" },
  { id: "light-2", name: "Ivory",    mode: "light", bg: "#faf7f2", accent: "#6366f1" },
  { id: "light-3", name: "Frost",    mode: "light", bg: "#f6fbfa", accent: "#0d9488" },
  { id: "light-4", name: "Lilac",    mode: "light", bg: "#fdf9ff", accent: "#7c3aed" },
  { id: "light-5", name: "Dune",     mode: "light", bg: "#f3ede4", accent: "#d97706" },
  { id: "light-6", name: "Dynamo Light",  mode: "light", bg: "#fff3f5", accent: "#ff355e" },
  { id: "light-7", name: "Emerald Light", mode: "light", bg: "#effcf7", accent: "#10b981" },
  { id: "light-8", name: "Premium Light", mode: "light", bg: "#f9f9f7", accent: "#b8921f" },
  { id: "light-9", name: "Neon Light",    mode: "light", bg: "#f6f2ff", accent: "#00b8ff" },
  { id: "light-1", name: "Cloud",    mode: "light", bg: "#f0f4ff", accent: "#3b6ff5" },
];

export const THEME_LS_KEY = "accenty.crm.theme.v2";
export const GLASS_LS_KEY = "accenty.crm.glass.v1";
export const GLASS_OPACITY_LS_KEY = "accenty.crm.glass-opacity.v1";
export const GLASS_BLUR_LS_KEY = "accenty.crm.glass-blur.v1";
/** Marks that first-enable Tsunami + Night Grid has already been applied. */
export const GLASS_PRIMED_LS_KEY = "accenty.crm.glass-primed.v2";
const DEFAULT_THEME: ThemeId = "light-10";
const DEFAULT_GLASS = false;
/** Applied the first time glass is turned on. */
export const GLASS_FIRST_THEME: ThemeId = "dark-16"; // Tsunami
export const GLASS_FIRST_BACKGROUND = "cities-traffic"; // Night Grid

/** Lower = more of the scene shows through (matches the open/transparent look). */
export const DEFAULT_GLASS_OPACITY = 23;
export const GLASS_OPACITY_MIN = 0;
export const GLASS_OPACITY_MAX = 100;
/** Backdrop blur in px — default matches a soft frost (avoids 0→blur flash). */
export const DEFAULT_GLASS_BLUR = 13;
export const GLASS_BLUR_MIN = 0;
export const GLASS_BLUR_MAX = 60;

type ThemeCtx = {
  themeId: ThemeId;
  themeMeta: ThemeMeta;
  setTheme: (id: ThemeId) => void;
  glass: boolean;
  setGlass: (on: boolean) => void;
  /** Panel fill density 0–100. Lower = more transparent. */
  glassOpacity: number;
  setGlassOpacity: (value: number) => void;
  /** Frost blur in px (0–60). */
  glassBlur: number;
  setGlassBlur: (value: number) => void;
};

const defaultThemeMeta =
  THEMES.find((t) => t.id === DEFAULT_THEME) ?? THEMES[0];

const ThemeContext = createContext<ThemeCtx>({
  themeId: DEFAULT_THEME,
  themeMeta: defaultThemeMeta,
  setTheme: () => {},
  glass: DEFAULT_GLASS,
  setGlass: () => {},
  glassOpacity: DEFAULT_GLASS_OPACITY,
  setGlassOpacity: () => {},
  glassBlur: DEFAULT_GLASS_BLUR,
  setGlassBlur: () => {},
});

function clampGlassOpacity(n: number): number {
  return Math.min(GLASS_OPACITY_MAX, Math.max(GLASS_OPACITY_MIN, Math.round(n)));
}

function clampGlassBlur(n: number): number {
  return Math.min(GLASS_BLUR_MAX, Math.max(GLASS_BLUR_MIN, Math.round(n)));
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_LS_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function readStoredGlass(): boolean {
  try {
    const stored = localStorage.getItem(GLASS_LS_KEY);
    if (stored === "1" || stored === "true") return true;
    if (stored === "0" || stored === "false") return false;
  } catch {
    /* ignore */
  }
  return DEFAULT_GLASS;
}

function readStoredGlassOpacity(): number {
  try {
    const stored = localStorage.getItem(GLASS_OPACITY_LS_KEY);
    if (stored != null) {
      const n = Number(stored);
      if (Number.isFinite(n)) return clampGlassOpacity(n);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_GLASS_OPACITY;
}

function readStoredGlassBlur(): number {
  try {
    const stored = localStorage.getItem(GLASS_BLUR_LS_KEY);
    if (stored != null) {
      const n = Number(stored);
      if (Number.isFinite(n)) return clampGlassBlur(n);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_GLASS_BLUR;
}

/**
 * True only the first time glass is turned on in this browser.
 * (Do not key off GLASS_LS_KEY — that is written on every mount.)
 */
export function consumeGlassFirstEnable(): boolean {
  try {
    if (localStorage.getItem(GLASS_PRIMED_LS_KEY) === "1") return false;
    localStorage.setItem(GLASS_PRIMED_LS_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

function applyGlassOpacityCss(opacity: number) {
  const root = document.documentElement;
  const t = opacity / GLASS_OPACITY_MAX;

  // True alpha — not color-mix with transparent (that only darkens).
  const alpha = 0.04 + t * 0.5;
  const alphaStrong = Math.min(0.72, alpha + 0.12);
  const accentAlpha = 0.02 + t * 0.28;
  const shineAlpha = 0.06 + t * 0.22;

  root.style.setProperty("--glass-alpha", alpha.toFixed(3));
  root.style.setProperty("--glass-alpha-strong", alphaStrong.toFixed(3));
  root.style.setProperty("--glass-accent-alpha", accentAlpha.toFixed(3));
  root.style.setProperty("--glass-shine-alpha", shineAlpha.toFixed(3));
}

function applyGlassBlurCss(blurPx: number) {
  const root = document.documentElement;
  const blur = clampGlassBlur(blurPx);
  const blurSm = Math.max(0, Math.round(blur * 0.7));
  // Design blur values are authored as px @ 16px root; emit rem so they scale.
  root.style.setProperty("--glass-blur", `${blur / 16}rem`);
  root.style.setProperty("--glass-blur-sm", `${blurSm / 16}rem`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(readStoredTheme);
  const [glass, setGlassState] = useState<boolean>(readStoredGlass);
  const [glassOpacity, setGlassOpacityState] = useState<number>(readStoredGlassOpacity);
  const [glassBlur, setGlassBlurState] = useState<number>(readStoredGlassBlur);

  // Already-on glass from a prior session: never force Tsunami/Night Grid later.
  useLayoutEffect(() => {
    if (!glass) return;
    try {
      localStorage.setItem(GLASS_PRIMED_LS_KEY, "1");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only seed
  }, []);

  // Keep vars on <html> during render so the first painted frame already has blur
  // (boot script covers pre-JS; this covers React mount without waiting an effect).
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", themeId);
    document.documentElement.setAttribute("data-glass", glass ? "true" : "false");
    applyGlassOpacityCss(glassOpacity);
    applyGlassBlurCss(glassBlur);
  }

  // Persist after commit
  useLayoutEffect(() => {
    try {
      localStorage.setItem(THEME_LS_KEY, themeId);
    } catch {
      /* ignore */
    }
  }, [themeId]);

  useLayoutEffect(() => {
    try {
      localStorage.setItem(GLASS_LS_KEY, glass ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [glass]);

  useLayoutEffect(() => {
    try {
      localStorage.setItem(GLASS_OPACITY_LS_KEY, String(glassOpacity));
    } catch {
      /* ignore */
    }
  }, [glassOpacity]);

  useLayoutEffect(() => {
    try {
      localStorage.setItem(GLASS_BLUR_LS_KEY, String(glassBlur));
    } catch {
      /* ignore */
    }
  }, [glassBlur]);

  const themeMeta = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        themeMeta,
        setTheme: setThemeId,
        glass,
        setGlass: setGlassState,
        glassOpacity,
        setGlassOpacity: (value: number) =>
          setGlassOpacityState(clampGlassOpacity(value)),
        glassBlur,
        setGlassBlur: (value: number) => setGlassBlurState(clampGlassBlur(value)),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
