import {
  createContext,
  useContext,
  useEffect,
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
  { id: "dark-5",  name: "Ruby",  mode: "dark",  bg: "#1E0000", accent: "#d40000" },
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
const DEFAULT_THEME: ThemeId = "light-10";

type ThemeCtx = {
  themeId: ThemeId;
  themeMeta: ThemeMeta;
  setTheme: (id: ThemeId) => void;
};

const defaultThemeMeta =
  THEMES.find((t) => t.id === DEFAULT_THEME) ?? THEMES[0];

const ThemeContext = createContext<ThemeCtx>({
  themeId: DEFAULT_THEME,
  themeMeta: defaultThemeMeta,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(THEME_LS_KEY) as ThemeId | null;
      if (stored && THEMES.some((t) => t.id === stored)) return stored;
    } catch {
      /* ignore */
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeId);
    try {
      localStorage.setItem(THEME_LS_KEY, themeId);
    } catch {
      /* ignore */
    }
  }, [themeId]);

  const themeMeta = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ themeId, themeMeta, setTheme: setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
