import { COLUMNS, type LayoutItem } from "./dashboard-widgets";

/**
 * One level = 3 grid rows × 12 columns (full width).
 * User level 1 → index 0 (rows 0–2), user level 2 → index 1 (rows 3–5), …
 */
export const ROWS_PER_LEVEL = 3;

/** User levels 1–3 (indices 0–2) have no placement restrictions */
export const FREE_LEVEL_COUNT = 3;

/** How many full levels above the target are summed for the 25% check */
export const LOOKBACK_LEVELS = 3;

export const SLOTS_PER_LEVEL = COLUMNS * ROWS_PER_LEVEL;

export const SLOTS_PER_LOOKBACK = SLOTS_PER_LEVEL * LOOKBACK_LEVELS;

/** Min fill across the 3 previous levels combined (108 cells when all 3 exist) */
export const LEVEL_MIN_FILL = 0.25;

/** @deprecated alias */
export const LEVEL_HEIGHT = ROWS_PER_LEVEL;

type GridRect = { id?: string; x: number; y: number; w: number; h: number };

function rowOccupancy(
  nodes: GridRect[],
  excludeId?: string,
): Map<number, boolean[]> {
  const rows = new Map<number, boolean[]>();

  for (const n of nodes) {
    if (excludeId && n.id === excludeId) continue;
    const x = Math.max(0, n.x);
    const y = Math.max(0, n.y);
    const w = Math.max(1, Math.min(COLUMNS, n.w));
    const h = Math.max(1, n.h);

    for (let ry = y; ry < y + h; ry++) {
      let row = rows.get(ry);
      if (!row) {
        row = Array<boolean>(COLUMNS).fill(false);
        rows.set(ry, row);
      }
      for (let cx = x; cx < x + w && cx < COLUMNS; cx++) {
        row[cx] = true;
      }
    }
  }

  return rows;
}

export function levelIndexForY(y: number): number {
  return Math.floor(Math.max(0, y) / ROWS_PER_LEVEL);
}

export function userLevelNumber(levelIndex: number): number {
  return levelIndex + 1;
}

export function levelStartRow(levelIndex: number): number {
  return levelIndex * ROWS_PER_LEVEL;
}

/** Fill for a single level */
export function getLevelFill(
  nodes: GridRect[],
  levelIndex: number,
  excludeId?: string,
): number {
  const rows = rowOccupancy(nodes, excludeId);
  const start = levelStartRow(levelIndex);
  let filled = 0;

  for (let r = start; r < start + ROWS_PER_LEVEL; r++) {
    const row = rows.get(r);
    if (!row) continue;
    for (let c = 0; c < COLUMNS; c++) {
      if (row[c]) filled++;
    }
  }

  return filled / SLOTS_PER_LEVEL;
}

/** Level indices immediately above target (up to 3) */
export function getLookbackLevelIndices(targetLevel: number): number[] {
  const levels: number[] = [];
  if (targetLevel < FREE_LEVEL_COUNT) return levels;
  for (let i = 1; i <= LOOKBACK_LEVELS; i++) {
    const L = targetLevel - i;
    if (L >= 0) levels.push(L);
  }
  return levels;
}

/**
 * Combined fill across the previous 3 levels (e.g. level 5 → levels 2+3+4).
 * Empty level 4 can be offset by content in levels 2 and 3.
 */
export function getLookbackBandFill(
  nodes: GridRect[],
  targetLevel: number,
  excludeId?: string,
): number {
  const checkLevels = getLookbackLevelIndices(targetLevel);
  if (checkLevels.length === 0) return 1;

  const rows = rowOccupancy(nodes, excludeId);
  let filled = 0;
  const totalSlots = checkLevels.length * SLOTS_PER_LEVEL;

  for (const L of checkLevels) {
    const start = levelStartRow(L);
    for (let r = start; r < start + ROWS_PER_LEVEL; r++) {
      const row = rows.get(r);
      if (!row) continue;
      for (let c = 0; c < COLUMNS; c++) {
        if (row[c]) filled++;
      }
    }
  }

  return filled / totalSlots;
}

/**
 * - Levels 1–3: always allowed
 * - Level 4+: previous 3 levels combined must be ≥ 25% full
 */
export function canPlaceAtLevel(
  nodes: GridRect[],
  targetLevel: number,
): boolean {
  if (targetLevel < FREE_LEVEL_COUNT) return true;
  return getLookbackBandFill(nodes, targetLevel) >= LEVEL_MIN_FILL;
}

export function maxAllowedLevel(nodes: GridRect[]): number {
  let allowed = 0;
  const maxLevel = nodes.reduce(
    (m, n) => Math.max(m, levelIndexForY(n.y + n.h - 1)),
    0,
  );

  for (let L = 0; L <= maxLevel + 2; L++) {
    if (canPlaceAtLevel(nodes, L)) {
      allowed = L + 1;
    } else {
      break;
    }
  }

  return allowed;
}

export function maxAllowedY(nodes: GridRect[]): number {
  const allowedLevelCount = maxAllowedLevel(nodes);
  if (allowedLevelCount <= 0) return 0;
  return allowedLevelCount * ROWS_PER_LEVEL - 1;
}

export function canPlaceAtY(nodes: GridRect[], y: number): boolean {
  return canPlaceAtLevel(nodes, levelIndexForY(y));
}

export function clampY(
  nodes: GridRect[],
  y: number,
  excludeId?: string,
): number {
  const peers = excludeId
    ? nodes.filter((n) => n.id !== excludeId)
    : nodes;
  const maxY = maxAllowedY(peers);
  return Math.max(0, Math.min(Math.floor(y), maxY));
}

export function enforceLayoutRowRules(items: LayoutItem[]): LayoutItem[] {
  return items.map((item) => ({
    ...item,
    y: clampY(
      items.filter((i) => i.id !== item.id),
      item.y,
      item.id,
    ),
  }));
}

export function gridMaxRow(items: LayoutItem[]): number {
  const deepest = items.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  const allowedTop = maxAllowedY(items);
  return Math.max(deepest + 1, allowedTop + ROWS_PER_LEVEL);
}
