import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import path from "path";
import {
  normalizeHreflangs,
  normalizeImages,
  pathOnly,
  isEmpty,
} from "../utils/utils";

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

export async function collectEnvData({
  browser,
  url,
  PageObject,
  snapshotPath,
}) {
  const { context, pageObject } = await openPageInNewContext({
    browser,
    url,
    PageObject,
  });

  try {
    const seo = await pageObject.getSeoContent();
    if (snapshotPath) {
      await pageObject.doScreenshot(snapshotPath);
    }
    return {
      seo,
      snapshotPath,
    };
  } finally {
    await closeContext(context);
  }
}

export async function compareEnvsSnapshots({
  prodPath,
  stagePath,
  diffPath,
  testInfo,
}) {
  console.log("PROD PATH:", prodPath);
  console.log("STAGE PATH:", stagePath);
  console.log("DIFF PATH:", diffPath);

  if (!fs.existsSync(prodPath))
    throw new Error(`Production screenshot missing: ${prodPath}`);

  if (!fs.existsSync(stagePath))
    throw new Error(`Staging screenshot missing: ${stagePath}`);

  const prodImage = PNG.sync.read(fs.readFileSync(prodPath));
  const stageImage = PNG.sync.read(fs.readFileSync(stagePath));

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
    { threshold: 0.15 },
  );

  const diffPercent = (mismatchPixels / (width * height)) * 100;

  if (mismatchPixels > 0) {
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });

    fs.writeFileSync(diffPath, PNG.sync.write(diffImage));

    console.log("DIFF SAVED:", diffPath);

    if (testInfo) {
      await testInfo.attach("diff.png", {
        path: diffPath,
        contentType: "image/png",
      });
    }

    throw new Error(`Visual difference: ${diffPercent.toFixed(2)}%`);
  }
}

export async function compareEnvsSeo({
  prodSeo,
  stageSeo,
  prodUrl,
  stageUrl,
  diffSeoPath,
  testInfo,
}) {
  const rules = [
    ["title", prodSeo.meta.title, stageSeo.meta.title],
    ["description", prodSeo.meta.description, stageSeo.meta.description],
    ["headers", prodSeo.headers, stageSeo.headers],
    [
      "images",
      normalizeImages(prodSeo.images),
      normalizeImages(stageSeo.images),
    ],
    [
      "hreflangs",
      normalizeHreflangs(prodSeo.meta.hreflangs),
      normalizeHreflangs(stageSeo.meta.hreflangs),
    ],
  ];

  const diff = {};

  for (const [name, prod, stage] of rules) {
    const state =
      isEmpty(prod) || isEmpty(stage)
        ? "missing"
        : JSON.stringify(prod) !== JSON.stringify(stage)
          ? "different"
          : "ok";

    switch (state) {
      case "missing":
        diff[name] = { error: "missing", prod, stage };
        break;

      case "different":
        diff[name] = { prod, stage };
        break;
    }
  }

  const canonicals = [
    ["prodCanonical", prodSeo.meta.canonical, prodUrl],
    ["stageCanonical", stageSeo.meta.canonical, stageUrl],
  ];

  for (const [name, actual, expected] of canonicals) {
    if (actual !== expected) {
      diff[name] = { expected, actual };
    }
  }

  if (!Object.keys(diff).length) return;

  const json = JSON.stringify(diff, null, 2);

  fs.mkdirSync(path.dirname(diffSeoPath), { recursive: true });

  fs.writeFileSync(diffSeoPath, json, "utf-8");

  if (testInfo) {
    await testInfo.attach("seo-diff.json", {
      path: diffSeoPath,
      contentType: "application/json",
    });
  }

  throw new Error(`SEO issues: ${Object.keys(diff).join(", ")}`);
}
