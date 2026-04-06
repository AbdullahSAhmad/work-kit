/** Difference in ms between two ISO timestamps; 0 on missing/invalid input. */
export function durationMs(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, b - a);
}

/** Human-readable duration: "12s", "5m", "2h30m", or "—" for non-positive. */
export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${hr}h${rem}m` : `${hr}h`;
}

/** Elapsed since `start` formatted with `formatDurationMs`. Returns "" on bad input. */
export function formatDurationSince(start: string): string {
  const startMs = new Date(start).getTime();
  if (isNaN(startMs)) return "";
  return formatDurationMs(Date.now() - startMs);
}
