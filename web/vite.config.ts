import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/pdfjs-dist/cmaps/*",
          dest: "cmaps",
        },
      ],
    }),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Scalene",
        short_name: "Scalene",
        description: "Scalene — capture links, PDFs, and notes on boards.",
        theme_color: "#0f766e",
        background_color: "#0f766e",
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
