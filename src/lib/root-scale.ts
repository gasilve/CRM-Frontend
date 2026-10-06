/**
 * Extra root-font layer on top of the rem ladder in index.css.
 *
 * The ladder stays the authority up to 1920×1080, including a 4K panel whose
 * Windows scale has already shrunk the CSS viewport (300% on 4K is about
 * 1280×720). Forcing 16px into that smaller page makes the layout bigger and
 * more cramped, so those windows keep the ladder.
 *
 * A CSS viewport that is actually bigger than 1920×1080 (2K/4K at 100%, or
 * 4K at 150%) scales the root up with the shorter axis so density matches
 * 1920×1080, and stops at 32px (4K). An ultrawide that is still 1080 tall
 * does not grow, because the design is already full height.
 *
 * Keep the first-paint copy in index.html in sync with this function.
 */

const DESIGN_W = 1920;
const DESIGN_H = 1080;
const DESIGN_PX = 16;
/** 4K @ 100% — same density as 1920 @ 100%. */
const MAX_PX = 32;

export function rootFontOverride(cssW: number, cssH: number): number | null {
  if (cssW > DESIGN_W && cssH > DESIGN_H) {
    const factor = Math.min(cssW / DESIGN_W, cssH / DESIGN_H);
    const px = Math.round(DESIGN_PX * factor * 10) / 10;
    return Math.min(MAX_PX, px);
  }

  return null;
}

export function applyRootScale(): void {
  const px = rootFontOverride(
    document.documentElement.clientWidth,
    document.documentElement.clientHeight,
  );
  document.documentElement.style.fontSize = px == null ? "" : `${px}px`;
  document.documentElement.dataset.rootScale = px == null ? "ladder" : "large";
}

let installed = false;

export function installRootScale(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  applyRootScale();
  window.addEventListener("resize", applyRootScale);
}
