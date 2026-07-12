// Design tokens (PRD §6.5.11) — single source for non-CSS consumers.
export const tokens = {
  font: {
    display: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'Fira Code', monospace",
  },
  color: {
    pageBg: "#f7f6f3",
    surfacePrimary: "#ffffff",
    surfaceRaised: "#eef2f0",
    surfaceSunken: "#ebebeb",
    textPrimary: "#1a1a18",
    textSecondary: "#6b7a74",
    textMuted: "#9CA8A3",
    borderSubtle: "rgba(26, 26, 24, 0.1)",
    borderDefault: "rgba(26, 26, 24, 0.16)",
    brandPrimary: "#1e3a5f",
    brandHover: "#172033",
    brandLight: "#93c5fd",
    itemPdf: "#C25B3F",
    itemLink: "#3B82F6",
    itemNote: "#D97706",
    itemImage: "#7C3AED",
    itemYoutube: "#DC2626",
    itemExcalidraw: "#DB2777",
  },
  itemHeight: {
    pdf: 280,
    link: 240,
    note: 200,
    image: 280,
    excalidraw: 280,
  },
} as const;

// Per-type accent colour used for the 3px left border (PRD §6.5.6).
export const itemAccent: Record<string, string> = {
  pdf: tokens.color.itemPdf,
  link: tokens.color.itemLink,
  note: tokens.color.itemNote,
  image: tokens.color.itemImage,
  youtube: tokens.color.itemYoutube,
  excalidraw: tokens.color.itemExcalidraw,
};

// Uniform fixed card height for every item type, so the grid renders as a
// clean, even Pinterest-style grid with no ragged rows.
export const CARD_HEIGHT = 280;

export const itemHeight: Record<string, number> = {
  pdf: CARD_HEIGHT,
  link: CARD_HEIGHT,
  note: CARD_HEIGHT,
  image: CARD_HEIGHT,
  excalidraw: CARD_HEIGHT,
};
