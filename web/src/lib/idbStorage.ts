import { get, set, del } from "idb-keyval";

// Adapts idb-keyval to the AsyncStorage shape TanStack Query's persister expects
// (getItem/setItem/removeItem), backed by IndexedDB instead of localStorage.
export const idbStorage = {
  getItem: (key: string) => get(key),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};
