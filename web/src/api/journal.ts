import axios from "axios";
import { api, API_BASE } from "./client";
import type {
  JournalTemplate,
  JournalDay,
  JournalDayCard,
  JournalItem,
  JournalTagCount,
  JournalPreferenceConfig,
  JournalStyleConfig,
} from "@/types";

// The backend resolves "today" in the client's timezone from this header
// (minutes, matching JS Date.getTimezoneOffset — UTC minus local). Sent on the
// requests that create or read today's day so rollover happens at local
// midnight, not UTC.
function tzHeaders() {
  return { "X-Client-TZ-Offset": String(new Date().getTimezoneOffset()) };
}

export async function listTemplates(): Promise<JournalTemplate[]> {
  const { data } = await api.get<JournalTemplate[]>("/journal/templates");
  return data;
}

export async function listDays(days = 7): Promise<JournalDayCard[]> {
  const { data } = await api.get<JournalDayCard[]>("/journal/days", {
    params: { days },
  });
  return data;
}

// Returns today's day, or null when no entry exists yet (the API 404s).
export async function getToday(): Promise<JournalDay | null> {
  try {
    const { data } = await api.get<JournalDay>("/journal/days/today", {
      headers: tzHeaders(),
    });
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

// A specific day (YYYY-MM-DD) with its items, or null when it has no entry.
// Lets past days be viewed, not just today.
export async function getDay(date: string): Promise<JournalDay | null> {
  try {
    const { data } = await api.get<JournalDay>(`/journal/day/${date}`);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export async function createItem(
  templateId: string,
  title = "",
): Promise<JournalItem> {
  const { data } = await api.post<JournalItem>(
    "/journal/items",
    { templateId, title },
    { headers: tzHeaders() },
  );
  return data;
}

// A single item, for the dedicated edit page (deep links load the item
// directly rather than via today's day).
export async function getItem(id: string): Promise<JournalItem> {
  const { data } = await api.get<JournalItem>(`/journal/items/${id}`);
  return data;
}

export async function updateItem(
  id: string,
  patch: {
    title?: string;
    content?: string;
    styleConfig?: JournalStyleConfig;
    tags?: string[];
  },
): Promise<JournalItem> {
  const { data } = await api.patch<JournalItem>(`/journal/items/${id}`, patch);
  return data;
}

// All of the user's distinct tags with item counts (sidebar + autocomplete).
export async function listTags(): Promise<JournalTagCount[]> {
  const { data } = await api.get<JournalTagCount[]>("/journal/tags");
  return data;
}

// All items carrying a given tag (newest day first); each item carries its date.
export async function listItemsByTag(tag: string): Promise<JournalItem[]> {
  const { data } = await api.get<{ tag: string; items: JournalItem[] }>(
    "/journal/items",
    { params: { tag } },
  );
  return data.items;
}

export async function deleteItem(id: string): Promise<void> {
  await api.delete(`/journal/items/${id}`);
}

export async function getPreferences(): Promise<JournalPreferenceConfig> {
  const { data } = await api.get<{ preferenceConfig: JournalPreferenceConfig }>(
    "/journal/preferences",
  );
  return data.preferenceConfig ?? {};
}

export async function savePreferences(
  preferenceConfig: JournalPreferenceConfig,
): Promise<JournalPreferenceConfig> {
  const { data } = await api.put<{ preferenceConfig: JournalPreferenceConfig }>(
    "/journal/preferences",
    { preferenceConfig },
  );
  return data.preferenceConfig ?? {};
}

// Uploads a custom backdrop and returns a durable URL served via the shared
// /editor/images/:id redirect route (re-presigns on each fetch, so it never
// expires), mirroring uploadEditorImage.
export async function uploadBackdrop(
  file: File,
): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ id: string }>("/journal/backdrops", form);
  return { id: data.id, url: `${API_BASE}/editor/images/${data.id}` };
}
