import { defineConfig } from "vitest/config";
import path from "node:path";

// Live checks against the real Supabase project and the partner simulator. Run with: npm run e2e:phase1
export default defineConfig({
  test: { include: ["tests-live/**/*.live.test.ts"], environment: "node", testTimeout: 120_000, hookTimeout: 300_000, fileParallelism: false, setupFiles: ["tests-live/setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests-live/server-only-stub.ts") } },
});
