import type { ReactElement } from 'react';

/**
 * SCAN tile icon. Bootstrap Icons-compatible shape — 16×16 viewBox,
 * single-color fill, no emoji. Renders via parent's `color` inheritance.
 *
 * Intended visual: a CRT/monitor silhouette with a horizontal scanline
 * band crossing its middle (the band is a second filled path that
 * overlaps the hollow screen).
 */
export const ScanIcon = (): ReactElement => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    className="h-14 w-14"
  >
    {/* Monitor outer frame (hollow) */}
    <path
      fillRule="evenodd"
      d="M1.5 2A1.5 1.5 0 0 0 0 3.5v8A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 14.5 2h-13ZM1 3.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-8Z"
    />
    {/* Scanline band across the middle */}
    <path d="M1 7h14v1.2H1z" />
    {/* Stand */}
    <path d="M5 14h6v.6H5z" />
    <path d="M7 13h2v1H7z" />
  </svg>
);
