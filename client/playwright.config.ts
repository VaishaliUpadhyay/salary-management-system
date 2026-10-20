import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: process.env.QA_PRODUCTION_UI === "1" ? ["workspace.spec.ts", "production.spec.ts"] : "workspace.spec.ts",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:5174", browserName: "chromium" },
  webServer: {
    command: process.env.QA_PRODUCTION_UI === "1"
      ? "../node_modules/.bin/tsx ../server/test/frontend-preview.ts"
      : "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
  reporter: "list",
});
