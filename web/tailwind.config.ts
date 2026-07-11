import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--brand-light)",

        // ── PRD semantic aliases (6.5.3) ──
        page: "var(--background)",
        surface: {
          primary: "var(--card)",
          raised: "var(--secondary)",
          sunken: "var(--muted)",
        },
        ink: {
          primary: "var(--foreground)",
          secondary: "var(--muted-foreground)",
          muted: "var(--text-muted)",
        },
        brand: {
          DEFAULT: "var(--primary)",
          hover: "var(--brand-hover)",
          light: "var(--accent)",
          muted: "var(--accent-foreground)",
        },
        item: {
          pdf: "#C25B3F",
          link: "#3B82F6",
          note: "#D97706",
          image: "#7C3AED",
          youtube: "#DC2626",
          excalidraw: "#DB2777",
        },
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
      },
      fontFamily: {
        // Notion uses a single UI typeface; Inter is the standard stand-in.
        display: ['"Inter"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"Fira Code"', "monospace"],
      },
      boxShadow: {
        item: "none",
        "item-hover": "0 1px 2px rgba(0,0,0,0.05)",
        panel: "0 4px 24px rgba(0,0,0,0.08)",
      },
      keyframes: {
        "item-pop": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "item-pop": "item-pop 350ms cubic-bezier(0.16,1,0.3,1) forwards",
      },
      // Slows every `transition-*` utility (transition-colors, transition-opacity,
      // transition-transform, etc.) app-wide from Tailwind's 150ms default.
      transitionDuration: {
        DEFAULT: "300ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
