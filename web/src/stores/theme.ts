import { create } from "zustand";

export type Theme = "light" | "dark";

const KEY = "kc_theme";

function read(): Theme {
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  init: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: read(),
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
    set({ theme: next });
  },
  init: () => {
    const theme = read();
    apply(theme);
    set({ theme });
  },
}));
