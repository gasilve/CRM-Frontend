export { GLASS_CATALOG, renderGlassPattern } from "./glass";
export { BUZZ_CATALOG, renderBuzzPattern } from "./buzz";
export {
  PatternFrame,
  MockMetric,
  MockBar,
  MockPill,
  MockRailRow,
  MoreFooter,
  PatternExpandModal,
} from "./PatternChrome";

import type { ReactNode } from "react";
import type { PatternDef, PatternId, PatternSize, PatternTheme } from "@/lib/pattern-size";
import { GLASS_CATALOG, renderGlassPattern } from "./glass";
import { BUZZ_CATALOG, renderBuzzPattern } from "./buzz";

export const PATTERN_CATALOG: PatternDef[] = [...GLASS_CATALOG, ...BUZZ_CATALOG];

export function renderPattern(id: PatternId, size: PatternSize, theme?: PatternTheme): ReactNode {
  const def = PATTERN_CATALOG.find((p) => p.id === id);
  const t = theme ?? def?.theme ?? "glass";
  if (t === "buzz") return renderBuzzPattern(id, size);
  return renderGlassPattern(id, size);
}

export function catalogForTheme(theme: PatternTheme): PatternDef[] {
  return PATTERN_CATALOG.filter((p) => p.theme === theme);
}
