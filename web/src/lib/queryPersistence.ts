import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { idbStorage } from "./idbStorage";

// Persists the query cache (and any paused, offline-queued mutations) to
// IndexedDB so boards/items stay available and edits survive a reload while offline.
export const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: "kc-query-cache",
});
