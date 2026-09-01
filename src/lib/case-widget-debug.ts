const PREFIX = "[case-widget]";

export type DragDropTarget = "unsave" | "trash" | "save" | null;

/** Hit-test drag-dock targets at release — pointerenter/leave alone is unreliable during GridStack drags. */
export function resolveDragDropTarget(
  x: number,
  y: number,
  hover?: { unsave?: boolean; trash?: boolean; save?: boolean },
): DragDropTarget {
  if (hover?.unsave) return "unsave";
  if (hover?.trash) return "trash";
  if (hover?.save) return "save";

  const unsaveHit = document.querySelector(".drag-unsave-hit");
  if (unsaveHit) {
    const r = unsaveHit.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return "unsave";
  }
  const saveHit = document.querySelector(".drag-save-hit");
  if (saveHit) {
    const r = saveHit.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return "save";
  }
  const trashHit = document.querySelector(".drag-trash-hit");
  if (trashHit) {
    const r = trashHit.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return "trash";
  }
  return null;
}

/** Dev-only tracing for custom widget drag / bookmark-save flows. */
export const caseWidgetDebug = {
  log: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log(PREFIX, ...args);
  },
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.warn(PREFIX, ...args);
  },
  error: (...args: unknown[]) => {
    console.error(PREFIX, ...args);
  },
};
