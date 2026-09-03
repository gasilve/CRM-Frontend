// Shim: Prodigy theme helpers mapped to Valentin's CSS variables
export function useTheme() {
  return { dark: true, theme: "dark" };
}

export function isGlassTheme(): boolean {
  return false;
}

export function getColors(_dark: boolean) {
  return {
    bdr:  "var(--color-line)",
    bg1:  "var(--color-ink-1)",
    bg2:  "var(--color-ink-0)",
    txt:  "var(--color-text-hi)",
    sec:  "var(--color-text-mid)",
    mut:  "var(--color-text-lo)",
    acc:  "var(--color-accent)",
    grn:  "#10b981",
    yel:  "#f59e0b",
    red:  "#ef4444",
  };
}
