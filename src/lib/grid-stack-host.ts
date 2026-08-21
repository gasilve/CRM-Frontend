import { designPx } from "@/lib/rem";
import type { GridStack } from "gridstack";

/** Recompute cell metrics and force GridStack to regenerate its positioning CSS. */
export function settleGridMetrics(
  grid: GridStack,
  cellHeightRem: number,
  marginRem: number,
): void {
  const apply = () => {
    const cellHeight = designPx(cellHeightRem);
    const margin = designPx(marginRem);
    grid.cellHeight(cellHeight);
    grid.margin(margin);
  };

  apply();
  requestAnimationFrame(apply);

  if (typeof document !== "undefined" && document.fonts?.ready) {
    void document.fonts.ready.then(apply);
  }
}
