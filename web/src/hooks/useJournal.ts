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

export function useJournalPreferences() {
  return useQuery({
    queryKey: journalKeys.preferences,
    queryFn: journalApi.getPreferences,
  });
}

// After any create/delete the day aggregates change, so refresh both today's
// day and the home list.
function invalidateDays(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["journal", "days"] });
  qc.invalidateQueries({ queryKey: journalKeys.today });
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
    }) =>
      journalApi.updateItem(vars.id, {
        title: vars.title,
        content: vars.content,
        styleConfig: vars.styleConfig,
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
      qc.invalidateQueries({ queryKey: journalKeys.today });
      qc.invalidateQueries({ queryKey: ["journal", "days"] });
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
