import { createStore, del, entries, set } from "idb-keyval";

// PDF/image uploads carry a raw File, which can't survive the JSON-based
// query cache persister — they get their own IndexedDB-backed outbox instead,
// queued here when a request fails offline and replayed once reconnected.
export interface PendingUpload {
  id: string;
  boardId: string;
  kind: "pdf" | "image";
  file: File;
  createdAt: number;
}

const outboxStore = createStore("kc-upload-outbox", "uploads");

export async function queueUpload(upload: PendingUpload): Promise<void> {
  await set(upload.id, upload, outboxStore);
}

export async function listPendingUploads(): Promise<PendingUpload[]> {
  const all = await entries<string, PendingUpload>(outboxStore);
  return all.map(([, value]) => value);
}

export async function removePendingUpload(id: string): Promise<void> {
  await del(id, outboxStore);
}
