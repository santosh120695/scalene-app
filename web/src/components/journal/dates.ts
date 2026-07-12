// Parse a YYYY-MM-DD wire date as a *local* calendar date (no timezone shift —
// `new Date("2026-07-12")` would parse as UTC midnight and can render as the
// previous day in western timezones).
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDayHeading(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function relativeDayLabel(iso: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseLocalDate(iso);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return null;
}
