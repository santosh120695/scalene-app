import type { Backdrop, JournalStyleConfig } from "@/types";

// ---- Fonts (writing font applied to item content only) ----

export interface FontOption {
  key: string;
  label: string;
  className: string;
}

export const JOURNAL_FONTS: FontOption[] = [
  { key: "dm-sans", label: "DM Sans", className: "font-journal-sans" },
  { key: "instrument-serif", label: "Serif", className: "font-journal-serif" },
  { key: "fira-code", label: "Mono", className: "font-journal-mono" },
  { key: "caveat", label: "Handwriting", className: "font-journal-hand" },
];

export const DEFAULT_FONT_KEY = "dm-sans";

export function fontClass(fontKey?: string): string {
  const match = JOURNAL_FONTS.find((f) => f.key === fontKey);
  return (match ?? JOURNAL_FONTS[0]).className;
}

// ---- Backdrops ----

// 8 curated Warm-Scholar-compatible tints. "#ffffff" is the plain-paper default.
export const BACKDROP_PALETTE: string[] = [
  "#ffffff",
  "#faf6f0",
  "#f5ece2",
  "#eef2e9",
  "#e8f0f4",
  "#f0eaf6",
  "#f9ecec",
  "#f2f0ea",
];

export const DEFAULT_BACKDROP: Backdrop = { type: "color", value: "#ffffff" };

export function resolveBackdrop(config?: JournalStyleConfig): Backdrop {
  const bd = config?.backdrop;
  if (!bd || !bd.value) return DEFAULT_BACKDROP;
  return bd;
}

// Returns the inline style + whether an inner translucent sheet is needed
// (image backdrops need one so text stays legible).
export function backdropStyle(bd: Backdrop): {
  style: React.CSSProperties;
  isImage: boolean;
} {
  if (bd.type === "color") {
    return { style: { backgroundColor: bd.value }, isImage: false };
  }
  return {
    style: {
      backgroundImage: `url(${bd.value})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    isImage: true,
  };
}
