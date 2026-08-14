/** Design rem → CSS px using current root font-size (scales with laptop media queries). */
export function remToPx(rem: number): number {
  if (typeof document === "undefined") return rem * 16;
  const root = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize || "16",
  );
  return rem * (Number.isFinite(root) ? root : 16);
}

/** Design px at 1920 (1rem root) → live px under current root. */
export function designPx(pxAt1920: number): number {
  return remToPx(pxAt1920 / 16);
}
