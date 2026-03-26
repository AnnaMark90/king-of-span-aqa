import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 5 * 60 * 1000,
  reporter: [
    ["html"],
    ["blob"],
    [
      "allure-playwright",
      {
        detail: true,
        outputFolder: "allure-results",
        suiteTitle: false,
      },
    ],
  ],
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },

  projects: [
    {
      name: "Desktop-1920-Chrome",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "Desktop-1200-Chrome",
      use: {
        browserName: "chromium",
        viewport: { width: 1200, height: 800 },
      },
    },
    {
      name: "Tablet-768-Chrome",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
    },
    {
      name: "Mobile-iPhone14",
      use: {
        ...devices["iPhone 14 Pro"],
      },
    },
    // {
    //   name: "Smoke-Firefox",
    //   use: {
    //     browserName: "firefox",
    //     viewport: { width: 1920, height: 1080 },
    //   },
    // },
    // {
    //   name: "Smoke-Safari",
    //   use: {
    //     browserName: "webkit",
    //     viewport: { width: 1920, height: 1080 },
    //   },
    // },
  ],
});
