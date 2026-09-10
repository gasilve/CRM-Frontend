import { COLUMNS, DASHBOARD_MAX_ROWS, type LayoutItem } from "./dashboard-widgets";

/**
 * One level = 3 grid rows × 12 columns (full width).
 * User level 1 → index 0 (rows 0–2), user level 2 → index 1 (rows 3–5), …
 */
export const ROWS_PER_LEVEL = 3;

/**
 * Free levels cover the full board (4 × 3 = 12 soft rows, hard-capped
 * to DASHBOARD_MAX_ROWS). Case detail keeps its own fixed page height.
 */
export const FREE_LEVEL_COUNT = 4;

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
  const softMax = allowedLevelCount * ROWS_PER_LEVEL - 1;
  // Hard board cap — mirrors case-detail's fixed page height.
  return Math.min(softMax, DASHBOARD_MAX_ROWS - 1);
}

export function canPlaceAtY(nodes: GridRect[], y: number): boolean {
  if (y >= DASHBOARD_MAX_ROWS) return false;
  return canPlaceAtLevel(nodes, levelIndexForY(y));
}

export function clampY(
  nodes: GridRect[],
  y: number,
  excludeId?: string,
  itemH = 1,
): number {
  const peers = excludeId
    ? nodes.filter((n) => n.id !== excludeId)
    : nodes;
  const maxY = Math.min(maxAllowedY(peers), DASHBOARD_MAX_ROWS - Math.max(1, itemH));
  return Math.max(0, Math.min(Math.floor(y), maxY));
}

export function enforceLayoutRowRules(items: LayoutItem[]): LayoutItem[] {
  return items.map((item) => {
    const h = Math.min(item.h, DASHBOARD_MAX_ROWS);
    const y = clampY(
      items.filter((i) => i.id !== item.id),
      item.y,
      item.id,
      h,
    );
    return { ...item, h, y };
  });
}

/**
 * Collision-free pack inside the hard row cap. GridStack + maxRow infinite-loops
 * when saved layouts overlap or sit past the bottom — call this before load().
 */
export function packLayoutWithinMaxRows<
  T extends { id: string; x: number; y: number; w: number; h: number },
>(items: T[], maxRows = DASHBOARD_MAX_ROWS, columns = COLUMNS): T[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const occupied: boolean[][] = Array.from({ length: maxRows }, () =>
    Array<boolean>(columns).fill(false),
  );
  const placed: T[] = [];

  const fits = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || y < 0 || w < 1 || h < 1) return false;
    if (x + w > columns || y + h > maxRows) return false;
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        if (occupied[row][col]) return false;
      }
    }
    return true;
  };

  const mark = (x: number, y: number, w: number, h: number) => {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) occupied[row][col] = true;
    }
  };

  const findSpot = (w: number, h: number, preferX: number, preferY: number) => {
    if (fits(preferX, preferY, w, h)) return { x: preferX, y: preferY };
    for (let y = 0; y <= maxRows - h; y++) {
      for (let x = 0; x <= columns - w; x++) {
        if (fits(x, y, w, h)) return { x, y };
      }
    }
    return null;
  };

  for (const raw of sorted) {
    let w = Math.min(Math.max(1, Math.floor(raw.w)), columns);
    let h = Math.min(Math.max(1, Math.floor(raw.h)), maxRows);
    let x = Math.max(0, Math.min(Math.floor(raw.x), columns - w));
    let y = Math.max(0, Math.min(Math.floor(raw.y), maxRows - h));

    let spot = findSpot(w, h, x, y);
    while (!spot && h > 1) {
      h -= 1;
      y = Math.min(y, maxRows - h);
      spot = findSpot(w, h, x, y);
    }
    if (!spot) continue;

    mark(spot.x, spot.y, w, h);
    placed.push({ ...raw, x: spot.x, y: spot.y, w, h });
  }

  return placed;
}

export function gridMaxRow(_items: LayoutItem[]): number {
  return DASHBOARD_MAX_ROWS;
}
