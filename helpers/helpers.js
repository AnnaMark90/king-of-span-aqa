import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { expect } from "@playwright/test";
import path from "path";
import { getStatusText } from "../constants/constants.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

function cropToIntersection(img1, img2) {
  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);

  const cropped1 = new PNG({ width, height });
  const cropped2 = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx1 = (y * img1.width + x) * 4;
      const idx2 = (y * img2.width + x) * 4;
      const cIdx = (y * width + x) * 4;

      cropped1.data.set(img1.data.slice(idx1, idx1 + 4), cIdx);
      cropped2.data.set(img2.data.slice(idx2, idx2 + 4), cIdx);
    }
  }

  return [cropped1, cropped2];
}

const safeRun = async (promise, fallback = null) => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

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
  const pageObject = new PageObject(page);

  try {
    const opened = await safeRun(pageObject.openPage(url), false);
    if (!opened) return { seo: {}, func: {}, snapshotPath };

    await safeRun(page.waitForLoadState("load", { timeout: 15000 }));

    if (snapshotPath) {
      await safeRun(preparePageForScreenshot(page));
      await safeRun(pageObject.freezeCarousels());
      await safeRun(pageObject.doScreenshot(snapshotPath));
    }

    const [seo, func] = await Promise.all([
      safeRun(pageObject.getSeoContent(), {}),
      safeRun(pageObject.getFunctionalData(), {}),
    ]);

    return { seo, func, snapshotPath };
  } finally {
    await safeRun(context.close());
  }
}

export async function compareEnvsSnapshots({
  prodPath,
  stagePath,
  diffPath,
  testInfo,
}) {
  if (!fs.existsSync(prodPath)) {
    return;
  }

  if (!fs.existsSync(stagePath)) {
    return;
  }

  const prodImage = PNG.sync.read(fs.readFileSync(prodPath));
  const stageImage = PNG.sync.read(fs.readFileSync(stagePath));

  const [croppedProd, croppedStage] = cropToIntersection(prodImage, stageImage);
  const { width, height } = croppedProd;

  const diffImage = new PNG({ width, height });

  const mismatchPixels = pixelmatch(
    croppedProd.data,
    croppedStage.data,
    diffImage.data,
    width,
    height,
    { threshold: 0.15 },
  );

  const diffPercent = (mismatchPixels / (width * height)) * 100;

  const dir = path.dirname(diffPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const diffBuffer = PNG.sync.write(diffImage);
  fs.writeFileSync(diffPath, diffBuffer);
  if (testInfo) {
    await testInfo.attach("diff.png", {
      body: diffBuffer,
      contentType: "image/png",
    });
  }

  if (mismatchPixels > 0) {
    expect
      .soft(
        diffPercent,
        `Visual difference detected on ${path.basename(stagePath)}`,
      )
      .toBeLessThanOrEqual(0);
  }
}

export async function checkLinks(browser, url) {
  let context = null;
  let page = null;
  const result = { url, status: null, ok: false };

  try {
    context = await browser.newContext({ userAgent: USER_AGENT });
    page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    result.status = response ? response.status() : 0;

    if (response?.status() === 404) {
      result.ok = false;
    } else {
      result.ok = true;
    }
  } catch (error) {
    result.error = error.message;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }

  return result;
}

export async function checkLinksStatus(request, urls) {
  const cleanUrls = [
    ...new Set(
      urls.filter((u) => u?.startsWith("http")).map((u) => u.split("#")[0]),
    ),
  ];
  const results = { successful: [], redirected: [], broken: [] };
  const headers = { "User-Agent": USER_AGENT, Accept: "*/*" };
  for (let i = 0; i < cleanUrls.length; i += 10) {
    const batch = cleanUrls.slice(i, i + 10);
    await Promise.all(
      batch.map(async (url) => {
        const response = await request
          .get(url, { timeout: 15000, ignoreHTTPSErrors: true, headers })
          .catch((err) => ({ status: () => 0, error: err.message }));

        const status = response.status();
        const record = {
          url,
          status: status || "FAILED",
          statusText: status ? getStatusText(status) : response.error,
        };

        if (status >= 200 && status < 300) results.successful.push(record);
        else if (status >= 300 && status < 400) results.redirected.push(record);
        else results.broken.push(record);
      }),
    );
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

// export async function checkLinksStatus(request, urls) {
//   const results = { successful: [], redirected: [], broken: [] };
//   const cleanUrls = [
//     ...new Set(
//       urls.filter((u) => u && u.startsWith("http")).map((u) => u.split("#")[0]),
//     ),
//   ];
//   const headers = {
//     "User-Agent":
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
//     Accept:
//       "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
//     "Accept-Language": "en-US,en;q=0.9",
//     "Accept-Encoding": "gzip, br",
//     "Upgrade-Insecure-Requests": "1",
//     "Sec-Fetch-Dest": "document",
//     "Sec-Fetch-Mode": "navigate",
//     "Sec-Fetch-Site": "none",
//   };
//   const batchSize = 10;
//   for (let i = 0; i < cleanUrls.length; i += batchSize) {
//     const batch = cleanUrls.slice(i, i + batchSize);
//     await Promise.all(
//       batch.map(async (url) => {
//         try {
//           const response = await request.get(url, {
//             timeout: 15000,
//             failOnStatusCode: false,
//             ignoreHTTPSErrors: true,
//             headers: headers,
//           });
//           const status = response.status();
//           const statusText = getStatusText(status);
//           const record = { url, status, statusText };
//           if (status >= 200 && status < 300) {
//             results.successful.push(record);
//           } else if (status >= 300 && status < 400) {
//             results.redirected.push(record);
//           } else {
//             results.broken.push(record);
//           }
//         } catch (error) {
//           results.broken.push({
//             url,
//             status: "FAILED",
//             statusText: error.message,
//           });
//         }
//       }),
//     );
//     await new Promise((resolve) => setTimeout(resolve, 500));
//   }
//   return results;
// }

export async function preparePageForScreenshot(page) {
  await page.addStyleTag({
    content: `
      #ccc, [id*="cookie"], [class*="cookie"], #onetrust-consent-sdk, .Menu__blur, .Menu { 
        display: none !important; 
      }
      header, .Header, .meganavHeader, .sticky, [class*="sticky"] { 
        position: relative !important; 
        top: 0 !important; 
      }
      .Header__filler { 
        display: none !important; 
      }
      [data-in-screen-reveal], .fade-in, .animate, [class*="animate-"], [class*="--reveal"] {
        opacity: 1 !important;
        visibility: visible !important;
      }
      *, *::before, *::after { 
        transition-duration: 0.01s !important; 
        transition-delay: 0s !important;
        animation-duration: 0.01s !important; 
        animation-delay: 0s !important; 
      }
    `,
  });

  await page.evaluate(() => document.fonts.ready).catch(() => {});

  let scrolls = 0;
  const maxScrolls = 40;
  let currentScrollY = 0;
  let lastScrollY = -1;

  while (scrolls < maxScrolls) {
    await page.mouse.wheel(0, 600);

    await page.evaluate(() => {
      document.querySelectorAll("img").forEach((img) => {
        if (img.loading === "lazy") {
          img.removeAttribute("loading");
          img.setAttribute("loading", "eager");
          img.setAttribute("fetchpriority", "high");
        }
        const lazySrc = img.getAttribute("data-src");
        if (lazySrc && !img.src) img.src = lazySrc;
      });
    });

    await page.waitForTimeout(400);

    currentScrollY = await page.evaluate(() => Math.ceil(window.scrollY));
    if (currentScrollY === lastScrollY) {
      break;
    }
    lastScrollY = currentScrollY;
    scrolls++;
  }

  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll("img")).filter(
      (img) => img.src && !img.src.startsWith("data:"),
    );
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 3000);
        });
      }),
    );
  });

  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"));
    window.scrollTo(0, 0);
  });

  await page.waitForTimeout(1500);
}
