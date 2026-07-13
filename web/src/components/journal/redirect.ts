import type { JournalDay } from "@/types";

// Pure redirect decision for the /journal home route, extracted so it can be
// unit-tested without a router. `today` is the result of the today-day query
// (undefined while loading, null when no entry exists, or the day). `forceHome`
// is set when the user deliberately navigated back via "All entries".
export function shouldRedirectToToday(
  today: JournalDay | null | undefined,
  forceHome: boolean,
): boolean {
  if (forceHome) return false;
  return !!today;
}

// Whether /journal/today should bounce back to the home list (no entry today).
export function shouldRedirectToHome(
  today: JournalDay | null | undefined,
  isLoading: boolean,
): boolean {
  return !isLoading && today === null;
}
