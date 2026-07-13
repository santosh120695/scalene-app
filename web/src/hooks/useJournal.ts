import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as journalApi from "@/api/journal";
import type {
  JournalDay,
  JournalItem,
  JournalPreferenceConfig,
  JournalStyleConfig,
} from "@/types";

export const journalKeys = {
  templates: ["journal", "templates"] as const,
  days: (n: number) => ["journal", "days", n] as const,
  today: ["journal", "today"] as const,
  day: (date: string) => ["journal", "day", date] as const,
  item: (id: string) => ["journal", "item", id] as const,
  tags: ["journal", "tags"] as const,
  tag: (t: string) => ["journal", "tag", t] as const,
  preferences: ["journal", "preferences"] as const,
};

export function useJournalTemplates() {
  return useQuery({
    queryKey: journalKeys.templates,
    queryFn: journalApi.listTemplates,
    staleTime: 5 * 60_000, // system templates rarely change
  });
}

export function useJournalDays(days = 7) {
  return useQuery({
    queryKey: journalKeys.days(days),
    queryFn: () => journalApi.listDays(days),
  });
}

export function useTodayJournalDay() {
  return useQuery({
    queryKey: journalKeys.today,
    queryFn: journalApi.getToday,
  });
}

// A specific day (any date) with its items, so past days are viewable.
export function useJournalDay(date: string | undefined) {
  return useQuery({
    queryKey: journalKeys.day(date ?? ""),
    queryFn: () => journalApi.getDay(date!),
    enabled: !!date,
  });
}

// A single item for the dedicated edit page. Seeded from today's cached day
// when possible so navigating from the list renders instantly.
export function useJournalItem(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: journalKeys.item(id ?? ""),
    queryFn: () => journalApi.getItem(id!),
    enabled: !!id,
    initialData: () => {
      const day = qc.getQueryData<JournalDay | null>(journalKeys.today);
      return day?.items.find((it) => it.id === id);
    },
  });
}

// The user's distinct tags with counts (sidebar list + input autocomplete).
export function useJournalTags() {
  return useQuery({
    queryKey: journalKeys.tags,
    queryFn: journalApi.listTags,
  });
}

// All items carrying a given tag, for the tag listing view.
export function useJournalItemsByTag(tag: string | undefined) {
  return useQuery({
    queryKey: journalKeys.tag(tag ?? ""),
    queryFn: () => journalApi.listItemsByTag(tag!),
    enabled: !!tag,
  });
}

export function useJournalPreferences() {
  return useQuery({
    queryKey: journalKeys.preferences,
    queryFn: journalApi.getPreferences,
  });
}

// After any create/delete/edit the day aggregates change, so refresh the home
// list, today's day, and any cached specific-day views.
function invalidateDays(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["journal", "days"] });
  qc.invalidateQueries({ queryKey: journalKeys.today });
  qc.invalidateQueries({ queryKey: ["journal", "day"] });
}

export function useCreateJournalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { templateId: string; title?: string }) =>
      journalApi.createItem(vars.templateId, vars.title),
    onSuccess: () => invalidateDays(qc),
  });
}

export function useUpdateJournalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      title?: string;
      content?: string;
      styleConfig?: JournalStyleConfig;
      tags?: string[];
    }) =>
      journalApi.updateItem(vars.id, {
        title: vars.title,
        content: vars.content,
        styleConfig: vars.styleConfig,
        tags: vars.tags,
      }),
    // Patch today's cached item in place so the editor keeps its styling
    // without a jarring refetch, then invalidate the day aggregates (item_count
    // / total_words) so the header and home cards stay accurate. The editor
    // holds its own local title/content state, so a background refetch won't
    // clobber in-flight typing.
    onSuccess: (updated: JournalItem) => {
      qc.setQueryData<JournalDay | null>(journalKeys.today, (day) =>
        day
          ? {
              ...day,
              items: day.items.map((it) =>
                it.id === updated.id ? updated : it,
              ),
            }
          : day,
      );
      // Keep the edit page's own item query in sync too.
      qc.setQueryData(journalKeys.item(updated.id), updated);
      qc.invalidateQueries({ queryKey: journalKeys.today });
      qc.invalidateQueries({ queryKey: ["journal", "day"] });
      qc.invalidateQueries({ queryKey: ["journal", "days"] });
      // Tags may have changed — refresh the tag list and any tag views.
      qc.invalidateQueries({ queryKey: journalKeys.tags });
      qc.invalidateQueries({ queryKey: ["journal", "tag"] });
    },
  });
}

export function useDeleteJournalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => journalApi.deleteItem(id),
    onSuccess: () => invalidateDays(qc),
  });
}

export function useSaveJournalPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: JournalPreferenceConfig) =>
      journalApi.savePreferences(config),
    onSuccess: (config) => qc.setQueryData(journalKeys.preferences, config),
  });
}
