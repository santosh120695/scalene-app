import axios from "axios";
import type { User } from "@/types";

const TOKEN_KEY = "kc_token";
const USER_KEY = "kc_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Last-known user, used to restore a session offline when /auth/me can't be reached.
export function getCachedUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
export function setCachedUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearCachedUser() {
  localStorage.removeItem(USER_KEY);
}

// The API origin+prefix the browser uses to reach the backend. Exported so
// callers can build absolute asset URLs (e.g. inline editor images) that point
// at the same origin — the frontend and API are deployed separately.
export const API_BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";

export const api = axios.create({ baseURL: API_BASE });

// Attach the Bearer token to every request (PRD §8.1).
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the token and bounce to /login (PRD prompt 3).
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Extract a human-readable message from an Axios error.
export function errMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.response?.data?.error || fallback;
  }
  return fallback;
}
