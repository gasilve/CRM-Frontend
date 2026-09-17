/** Shared 3-spoke steering-wheel glyph — used on the chassis dash and the empty driver seat. */
export function SteeringWheelIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
      <line x1="12" y1="3.4" x2="12" y2="9.9" />
      <line x1="5.4" y1="16.3" x2="9.9" y2="13.5" />
      <line x1="18.6" y1="16.3" x2="14.1" y2="13.5" />
    </svg>
  );
}
