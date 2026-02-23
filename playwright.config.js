import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  snapshotDir: "./snapshots",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    ignoreHTTPSErrors: true,
  },
  expect: {
    toHaveScreenshot: {
      // Работает только для старых screenshot-тестов
      animations: "disabled",
    },
  },

  projects: [
    {
      name: "compare-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "compare-tablet",
      use: {
        browserName: "chromium",
        ...devices["iPad Pro 11"],
      },
    },
    {
      name: "compare-mobile",
      use: {
        browserName: "chromium",
        ...devices["Pixel 7"],
      },
    },
  ],
});
