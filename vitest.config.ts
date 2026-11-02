import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so the PWA and React plugins don't load for
// plain logic tests. Run with `npm test` (which pins TZ to America/Chicago).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
});
