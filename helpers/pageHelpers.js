import {
  preparePageForScreenshot,
  takeSmartScreenshots,
} from "./screenshotHelpers.js";
import { USER_AGENT } from "../constants/constants.js";

export const safeRun = async (promise, fallback = null, context = "") => {
  try {
    return await promise;
  } catch (err) {
    console.error(`[safeRun] ${context}`, err);
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

export async function collectEnvData({
  browser,
  url,
  PageObject,
  snapshotPath,
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

  try {
    const opened = await safeRun(
      pageObject.openPage(url),
      false,
      `openPage ${url}`,
    );
    if (!opened) {
      console.error(`[CRITICAL] Couldn't collect data for: ${url}`);
      return null;
    }

    await pageObject.forceLoadImages();

    const [seo, func] = await Promise.all([
      safeRun(pageObject.getSeoContent(), null, `getSeoContent ${url}`),
      safeRun(pageObject.getFunctionalData(), null, `getFunctionalData ${url}`),
    ]);

    // if (snapshotPath) {
    //   await safeRun(
    //     preparePageForScreenshot(page),
    //     null,
    //     `preparePageForScreenshot ${url}`,
    //   );
    //   await safeRun(
    //     pageObject.doScreenshot(snapshotPath),
    //     null,
    //     `doScreenshot ${url}`,
    //   );
    // }

    let snapshotPaths = snapshotPath ? [snapshotPath] : null;

    if (snapshotPath) {
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
