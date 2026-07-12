import axios from "axios";
import { api, API_BASE } from "./client";
import type {
  JournalTemplate,
  JournalDay,
  JournalDayCard,
  JournalItem,
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

export async function updateItem(
  id: string,
  patch: { title?: string; content?: string; styleConfig?: JournalStyleConfig },
): Promise<JournalItem> {
  const { data } = await api.patch<JournalItem>(`/journal/items/${id}`, patch);
  return data;
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
