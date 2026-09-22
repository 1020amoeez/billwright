/**
 * Inline stroke icons, 24×24, traced from the design files.
 * `vat` and `bars` are new — drawn to match the existing set's weight.
 */
export const icons = {
  invoice: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 17h6"/>',
  quote: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>',
  receipt:
    '<path d="M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5z"/><path d="M9 8h6M9 12h6"/>',
  margin: '<path d="M19 5 5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  chart: '<path d="M3 20h18"/><path d="M4 17 10 9l4 5 6-9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.8" cy="7.8" r="1.6"/>',
  bars: '<path d="M3 20h18"/><path d="M7 16V9M12 16V5M17 16v-4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
} as const;

export type IconName = keyof typeof icons;
