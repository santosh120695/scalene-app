import { defineConfig } from "vitest/config";
import path from "path";

// Kept separate from vite.config.ts so the PWA/build plugins don't run under
// tests. Only the `@` path alias is shared.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
