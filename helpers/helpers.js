import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { getSnapshotPaths } from "../utils/utils";

// PageObject управляет страницей.
// Helpers управляют окружением.

export async function openPageInNewContext({ browser, url, PageObject }) {
  const context = await browser.newContext();
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

export async function compareEnvsSnapshots({
  browser,
  productionUrl,
  stagingUrl,
  lang,
  device,
  pageKey,
  PageObject,
  testInfo,
}) {
  const { production, staging, diff } = getSnapshotPaths({
    lang,
    device,
    pageKey,
  });

  // ---------- PRODUCTION ----------
  const prod = await openPageInNewContext({
    browser,
    url: productionUrl,
    PageObject,
  });

  // ---------- STAGING ----------
  const stage = await openPageInNewContext({
    browser,
    url: stagingUrl,
    PageObject,
  });

  try {
    await prod.pageObject.doScreenshot(production);
    await stage.pageObject.doScreenshot(staging);
  } finally {
    await closeContext(prod.context);
    await closeContext(stage.context);
  }

  // ---------- COMPARE ----------
  const prodImage = PNG.sync.read(fs.readFileSync(production));
  const stageImage = PNG.sync.read(fs.readFileSync(staging));

  if (
    prodImage.width !== stageImage.width ||
    prodImage.height !== stageImage.height
  ) {
    throw new Error("Images have different sizes");
  }

  const { width, height } = prodImage;
  const diffImage = new PNG({ width, height });

  const mismatchPixels = pixelmatch(
    prodImage.data,
    stageImage.data,
    diffImage.data,
    width,
    height,
    {
      threshold: 0.15,
      includeAA: false,
    },
  );

  const totalPixels = width * height;
  const diffPercent = (mismatchPixels / totalPixels) * 100;

  const allowedThreshold = 0; // допустимые %

  if (diffPercent > allowedThreshold) {
    fs.writeFileSync(diff, PNG.sync.write(diffImage));

    if (testInfo) {
      await testInfo.attach("visual-diff", {
        path: diff,
        contentType: "image/png",
      });
    }

    throw new Error(
      `Visual difference detected: ${mismatchPixels} pixels (${diffPercent.toFixed(
        2,
      )}%) differ`,
    );
  }
}

export async function compareEnvsSeoText({
  browser,
  productionUrl,
  stagingUrl,
  PageObject,
  testInfo,
}) {
  // ---------- PRODUCTION ----------
  const prod = await openPageInNewContext({
    browser,
    url: productionUrl,
    PageObject,
  });

  // ---------- STAGING ----------
  const stage = await openPageInNewContext({
    browser,
    url: stagingUrl,
    PageObject,
  });

  let prodSeo;
  let stageSeo;

  try {
    prodSeo = await prod.pageObject.getSeoImgAndHeaders();
    stageSeo = await stage.pageObject.getSeoImgAndHeaders();
  } finally {
    await closeContext(prod.context);
    await closeContext(stage.context);
  }

  const imagesDiff =
    JSON.stringify(prodSeo.images) !== JSON.stringify(stageSeo.images);

  const headersDiff =
    JSON.stringify(prodSeo.headers) !== JSON.stringify(stageSeo.headers);

  if (imagesDiff || headersDiff) {
    if (testInfo) {
      await testInfo.attach("production-seo.json", {
        body: JSON.stringify(prodSeo, null, 2),
        contentType: "application/json",
      });

      await testInfo.attach("staging-seo.json", {
        body: JSON.stringify(stageSeo, null, 2),
        contentType: "application/json",
      });
    }

    throw new Error(
      `SEO differences detected:
      Images different: ${imagesDiff}
      Headers different: ${headersDiff}`,
    );
  }
}

// async function openPageAndDoSnapshot(page, url) {
//   await page.goto(url, {
//     waitUntil: "networkidle",
//   });

//   await await page.click(button_accept_cookie);
//   await page.waitForTimeout(time_to_wait);

//   const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
//   console.log("Scroll HEIGHT = " + scrollHeight);
//   const scrollTimes = Number.parseInt(scrollHeight / 500);
//   console.log("Scroll TIMES = " + scrollTimes);

//   for (var i = 1; i < scrollTimes; i++) {
//     console.log("i = " + i + " - " + (i <= scrollTimes) + " -> " + scrollTimes);
//     await page.evaluate(() => {
//       window.scrollBy({
//         top: 500,
//         behavior: "smooth",
//       });
//     });
//     await page.waitForTimeout(time_to_wait);
//   }

//   console.log("Pages Scrolled");
//   await page.evaluate(async () => {
//     window.scrollTo(0, document.body.scrollHeight);
//   });

//   await page.waitForTimeout(time_to_wait);

//   console.log("Pages Scrolled to Top");
//   await page.evaluate(async () => {
//     window.scrollTo(0, 0);
//   });

//   await page.waitForTimeout(time_to_wait);

//   if (url.startsWith("https://www")) {
//     await page.screenshot({
//       path: "snapshots/prod/fullpage.png",
//       fullPage: true,
//     });
//   }

//   if (url.startsWith("https://stage")) {
//     await page.screenshot({
//       path: "snapshots/stage/fullpage.png",
//       fullPage: true,
//     });
//   }
// }

// export async function compareEnvsSnapshots({
//   browser,
//   productionUrl,
//   stagingUrl,
//   PageObject,
//   testInfo,
// }) {
//   const { production, staging, diff } = getSnapshotPaths({
//     lang,
//     device,
//     pageKey,
//   });

//   // PRODUCTION
//   const prod = await openPageInNewContext({
//     browser,
//     url: productionUrl,
//     PageObject,
//   });

//   const prodContext = await browser.newContext();
//   const prodPage = await prodContext.newPage();
//   const prodObj = new PageObject(prodPage);

//   await prodObj.openPage(productionUrl);
//   await prodObj.doScreenshot(production);

//   await prodContext.close();

//   // STAGING
//   const stageContext = await browser.newContext();
//   const stagePage = await stageContext.newPage();
//   const stageObj = new PageObject(stagePage);

//   await stageObj.openPage(stagingUrl);
//   await stageObj.doScreenshot(staging);

//   await stageContext.close();

//   // COMPARE
//   const prodImage = PNG.sync.read(fs.readFileSync(production));
//   const stageImage = PNG.sync.read(fs.readFileSync(staging));

//   if (
//     prodImage.width !== stageImage.width ||
//     prodImage.height !== stageImage.height
//   ) {
//     throw new Error("Images have different sizes");
//   }

//   const { width, height } = prodImage;
//   const diffImage = new PNG({ width, height });

//   const mismatchPixels = pixelmatch(
//     prodImage.data,
//     stageImage.data,
//     diffImage.data,
//     width,
//     height,
//     {
//       threshold: 0.15,
//       includeAA: false,
//     },
//   );

//   const totalPixels = width * height;
//   const diffPercent = (mismatchPixels / totalPixels) * 100;

//   const allowedThreshold = 0; // допустимые %

//   if (diffPercent > allowedThreshold) {
//     fs.writeFileSync(diff, PNG.sync.write(diffImage));

//     if (testInfo) {
//       await testInfo.attach("visual-diff", {
//         path: diff,
//         contentType: "image/png",
//       });
//     }

//     throw new Error(
//       `Visual difference detected: ${mismatchPixels} pixels (${diffPercent.toFixed(
//         2,
//       )}%) differ`,
//     );
//   }
//
