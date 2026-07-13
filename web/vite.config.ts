import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Scalene",
        short_name: "Scalene",
        description: "Scalene — capture links, PDFs, and notes on boards.",
        theme_color: "#1e3a5f",
        background_color: "#1e3a5f",
        display: "standalone",
        start_url: "/",
      },
      pwaAssets: {
        image: "public/favicon.svg",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,woff}"],
        runtimeCaching: [
          {
            // Board/item JSON and any uploaded file bytes served under /api/v1 —
            // prefer fresh data, fall back to the last-seen response when offline.
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith("/api/v1/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts — immutable once fetched.
            urlPattern: ({ url }: { url: URL }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The drag-handle extension imports these from the yjs/collab stack but
      // only uses them on the collaborative path (unused here). Shim them to
      // keep yjs out of the bundle. See src/lib/tiptap-collab-shims.ts.
      "@tiptap/extension-collaboration": path.resolve(
        __dirname,
        "./src/lib/tiptap-collab-shims.ts",
      ),
      "@tiptap/y-tiptap": path.resolve(
        __dirname,
        "./src/lib/tiptap-collab-shims.ts",
      ),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
