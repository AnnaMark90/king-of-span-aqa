import { test } from "@playwright/test";
import {
  preparePageForScreenshot,
  takeSmartScreenshots,
} from "./screenshotHelpers.js";
import { USER_AGENT } from "../constants/constants.js";

export const safeRun = async (promise, fallback = null, context = "") => {
  try {
    return await promise;
  } catch (err) {
    const errorMessage = err?.message || String(err);
    console.error(`[safeRun] ${context}:`, errorMessage);

    try {
      const testInfo = test.info();
      if (testInfo) {
        testInfo.annotations.push({
          type: "Warning",
          description: `[safeRun] ${context}: ${errorMessage}`,
        });
      }
    } catch (e) {}

    return fallback;
  }
};

export async function openPageInNewContext({ browser, url, PageObject }) {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const pageObject = new PageObject(page);

  await pageObject.openPage(url);
  return { context, page, pageObject };
}

export async function closeContext(context) {
  if (context) {
    await context.close();
  }
}

export async function openStagePageContext({
  browser,
  url,
  PageObject,
  deviceConfig = {},
}) {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    ...deviceConfig,
  });
  const page = await context.newPage();
  await context.route(
    /(analytics|google-analytics|hotjar|facebook|gtm|ads|clarity)/i,
    (route) => route.abort(),
  );
  const pageObject = new PageObject(page);

  let opened = false;
  for (let i = 0; i < 3; i++) {
    opened = await safeRun(pageObject.openPage(url), false, `openPage ${url}`);
    if (opened) break;
    if (i < 2) await page.waitForTimeout(2000);
  }

  if (!opened) {
    console.error(`[CRITICAL] Couldn't open: ${url}`);
    await safeRun(
      context.close(),
      null,
      `closeContext after failed open ${url}`,
    );
    return null;
  }

  return { context, page, pageObject };
}

export async function collectEnvData({
  browser,
  url,
  PageObject,
  snapshotPath,
  deviceConfig = {},
  needsSeo = true,
  needsFunc = true,
}) {
  const result = await openStagePageContext({
    browser,
    url,
    PageObject,
    deviceConfig,
  });

  if (!result) {
    return null;
  }

  const { context, page, pageObject } = result;

  try {
    await pageObject.forceLoadImages();

    const [seo, func] = await Promise.all([
      needsSeo
        ? safeRun(pageObject.getSeoContent(), null, `getSeoContent ${url}`)
        : Promise.resolve(null),
      needsFunc
        ? safeRun(
            pageObject.getFunctionalData(),
            null,
            `getFunctionalData ${url}`,
          )
        : Promise.resolve(null),
    ]);

    let snapshotPaths = snapshotPath ? [snapshotPath] : null;

    if (snapshotPath) {
      await safeRun(
        pageObject.freezeCarousels(),
        null,
        `freezeCarousels ${url}`,
      );
      await safeRun(
        preparePageForScreenshot(page),
        null,
        `preparePageForScreenshot ${url}`,
      );
      snapshotPaths = await safeRun(
        takeSmartScreenshots(page, snapshotPath),
        [snapshotPath],
        `takeSmartScreenshots ${url}`,
      );
    }

    return { seo, func, snapshotPaths };
  } finally {
    await safeRun(context.close(), null, `closeContext after ${url}`);
  }
}
