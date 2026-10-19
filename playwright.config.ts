import { defineConfig } from "@playwright/test";

// End-to-end tests run the production build against a throw-away database
// (pk_test, recreated by e2e/global-setup.ts).
export const TEST_DB = process.env.TEST_DATABASE_URL || "postgres://pk:pk@localhost:5432/pk_test";
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, locale: "fa-IR", launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } },
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    env: { DATABASE_URL: TEST_DB, ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin12345" },
  },
});
