import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { JournalShell } from "@/components/journal/JournalShell";
import { JournalHome } from "@/components/journal/JournalHome";
import { JournalDayView } from "@/components/journal/JournalDayView";
import { useTodayJournalDay } from "@/hooks/useJournal";
import {
  shouldRedirectToToday,
  shouldRedirectToHome,
} from "@/components/journal/redirect";

function Loader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <span className="text-[13px] text-ink-muted">Loading…</span>
    </div>
  );
}

// /journal — the home list. If a day already exists for today, land directly in
// the day view (unless the user deliberately came back via "All entries", which
// passes location.state.home to suppress the redirect).
export function JournalHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const forceHome = (location.state as { home?: boolean } | null)?.home === true;
  const today = useTodayJournalDay();
  const redirecting = shouldRedirectToToday(today.data, forceHome);

  useEffect(() => {
    if (redirecting) navigate("/journal/today", { replace: true });
  }, [redirecting, navigate]);

  return (
    <JournalShell>
      {today.isLoading || redirecting ? (
        <Loader />
      ) : (
        <JournalHome onEnterToday={() => navigate("/journal/today")} />
      )}
    </JournalShell>
  );
}

// /journal/today — the day view + editor. With no entry for today, bounce to the
// home list.
export function JournalTodayPage() {
  const navigate = useNavigate();
  const today = useTodayJournalDay();

  useEffect(() => {
    if (shouldRedirectToHome(today.data, today.isLoading)) {
      navigate("/journal", { replace: true, state: { home: true } });
    }
  }, [today.isLoading, today.data, navigate]);

  return (
    <JournalShell>
      {today.isLoading || !today.data ? (
        <Loader />
      ) : (
        <JournalDayView
          day={today.data}
          onBack={() => navigate("/journal", { state: { home: true } })}
        />
      )}
    </JournalShell>
  );
}
