// Parse a YYYY-MM-DD wire date as a *local* calendar date (no timezone shift —
// `new Date("2026-07-12")` would parse as UTC midnight and can render as the
// previous day in western timezones).
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// Format a local Date as a YYYY-MM-DD wire string (no timezone shift).
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Local today as a YYYY-MM-DD wire string.
export function todayISO(): string {
  return toISODate(new Date());
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
