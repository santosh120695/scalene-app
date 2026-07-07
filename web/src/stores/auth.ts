import axios from "axios";
import { create } from "zustand";
import type { User } from "@/types";
import {
  clearCachedUser,
  clearToken,
  getCachedUser,
  getToken,
  setCachedUser,
  setToken,
} from "@/api/client";
import * as authApi from "@/api/auth";

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  bootstrap: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { access_token, user } = await authApi.login(email, password);
      setToken(access_token);
      setCachedUser(user);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, fullName) => {
    set({ loading: true });
    try {
      const { access_token, user } = await authApi.register(email, password, fullName);
      setToken(access_token);
      setCachedUser(user);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    clearToken();
    clearCachedUser();
    set({ user: null });
  },

  // Restore the session from a stored token on app load. A network failure
  // (offline) must not log the user out — only a real 401 (invalid/expired
  // token) should. When offline, fall back to the last-known cached user so
  // the app stays usable.
  bootstrap: async () => {
    const token = getToken();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await authApi.me();
      setCachedUser(user);
      set({ user, initialized: true });
    } catch (err) {
      const isUnauthorized =
        axios.isAxiosError(err) && err.response?.status === 401;
      if (isUnauthorized) {
        clearToken();
        clearCachedUser();
        set({ user: null, initialized: true });
        return;
      }
      // Network error or other failure — keep the session alive offline.
      const cachedUser = getCachedUser();
      set({ user: cachedUser, initialized: true });
    }
  },
}));
