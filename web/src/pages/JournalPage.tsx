import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Hash } from "lucide-react";
import { JournalShell } from "@/components/journal/JournalShell";
import { JournalHome } from "@/components/journal/JournalHome";
import { JournalDayView } from "@/components/journal/JournalDayView";
import { JournalItemEditor } from "@/components/journal/JournalItemEditor";
import { JournalItemPreview } from "@/components/journal/JournalItemPreview";
import {
  useTodayJournalDay,
  useJournalDay,
  useJournalItem,
  useJournalItemsByTag,
} from "@/hooks/useJournal";
import { formatDayHeading } from "@/components/journal/dates";
import type { JournalItem } from "@/types";
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
        <JournalHome
          onEnterToday={() => navigate("/journal/today")}
          onOpenDay={(date) => navigate(`/journal/day/${date}`)}
          onCreated={(itemId) => navigate(`/journal/item/${itemId}`)}
        />
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
          onOpenItem={(itemId) => navigate(`/journal/item/${itemId}`)}
        />
      )}
    </JournalShell>
  );
}

// /journal/day/:date — a specific (usually past) day's entries as previews.
// With no entry for that day, bounce to the home list.
export function JournalDayPage() {
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const dayQuery = useJournalDay(date);
  // const isToday = date === todayISO();

  useEffect(() => {
    if (!dayQuery.isLoading && dayQuery.data === null) {
      navigate("/journal", { replace: true, state: { home: true } });
    }
  }, [dayQuery.isLoading, dayQuery.data, navigate]);

  return (
    <JournalShell>
      {dayQuery.isLoading || !dayQuery.data ? (
        <Loader />
      ) : (
        <JournalDayView
          day={dayQuery.data}
          // canAddItems={isToday}
          onBack={() => navigate("/journal", { state: { home: true } })}
          onOpenItem={(itemId) => navigate(`/journal/item/${itemId}`)}
        />
      )}
    </JournalShell>
  );
}

// /journal/tag/:tag — every item carrying a tag, grouped by day. Reuses the
// day-view preview card + grid.
export function JournalTagPage() {
  const navigate = useNavigate();
  const { tag: raw } = useParams<{ tag: string }>();
  const tag = raw ? decodeURIComponent(raw) : "";
  const query = useJournalItemsByTag(tag);

  // Group the (already day-desc ordered) items by their day, preserving order.
  const groups = useMemo(() => {
    const map = new Map<string, JournalItem[]>();
    for (const it of query.data ?? []) {
      const day = (it.date ?? "").slice(0, 10) || "—";
      const arr = map.get(day);
      if (arr) arr.push(it);
      else map.set(day, [it]);
    }
    return [...map.entries()];
  }, [query.data]);

  return (
    <JournalShell>
      {query.isLoading ? (
        <Loader />
      ) : (
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => navigate("/journal", { state: { home: true } })}
              aria-label="Back"
              title="Back"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            >
              <ArrowLeft size={17} strokeWidth={1.5} />
            </button>
            <h1 className="flex items-center gap-1.5 text-xl font-semibold text-ink-primary">
              <Hash size={18} strokeWidth={1.5} className="text-brand" />
              {tag}
            </h1>
            <span className="text-[12px] text-ink-muted">
              {query.data?.length ?? 0}{" "}
              {(query.data?.length ?? 0) === 1 ? "entry" : "entries"}
            </span>
          </div>

          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border-default)] p-8 text-center text-[13px] text-ink-muted">
              No entries with this tag.
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map(([day, items]) => (
                <div key={day}>
                  <h2 className="mb-3 text-[13px] font-semibold text-ink-secondary">
                    {day === "—" ? "Undated" : formatDayHeading(day)}
                  </h2>
                  <div className="grid grid-cols-1 items-stretch gap-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
                    {items.map((item) => (
                      <JournalItemPreview
                        key={item.id}
                        item={item}
                        onClick={() => navigate(`/journal/item/${item.id}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </JournalShell>
  );
}

// /journal/item/:itemId — the dedicated edit page for one journal item. The
// listing pages only show previews; all writing happens here.
export function JournalItemPage() {
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const item = useJournalItem(itemId);

  // Missing/foreign/deleted item — bounce back to the day view.
  useEffect(() => {
    if (item.isError) navigate("/journal/today", { replace: true });
  }, [item.isError, navigate]);

  return (
    <JournalShell>
      {!item.data ? (
        <Loader />
      ) : (
          <div>
            <JournalItemEditor
              item={item.data}
              standalone
              onBack={() => navigate("/journal/today")}
              onDeleted={() => navigate("/journal/today")}
            />
          </div>
      )}
    </JournalShell>
  );
}
