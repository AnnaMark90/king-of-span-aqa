import fs from "fs";
import { expect } from "@playwright/test";
import path from "path";
import {
  normalizeHreflangs,
  pathOnlySafe,
  normalizeImages,
  normalizePath,
} from "../utils/utils.js";

function addDiff(diff, key, expected, actual) {
  const safeExpected =
    expected === null || expected === undefined ? "**MISSING**" : expected;
  const safeActual =
    actual === null || actual === undefined ? "**MISSING**" : actual;

  if (JSON.stringify(safeExpected) !== JSON.stringify(safeActual)) {
    diff[key] = {
      expected: safeExpected,
      actual: safeActual,
    };
  }
}

function compareImageDimensions(prodImages, stageImages, diff) {
  const prodImgs = prodImages || [];
  const stageImgs = stageImages || [];

  if (prodImgs.length !== stageImgs.length) {
    diff["imageDimensions_count"] = {
      expected: prodImgs.length,
      actual: stageImgs.length,
    };
    return;
  }

  const dimensionMismatches = [];
  stageImgs.forEach((stageImg, idx) => {
    const prodImg = prodImgs[idx];
    if (!prodImg) return;

    const stageDims = {
      width: stageImg.naturalWidth || 0,
      height: stageImg.naturalHeight || 0,
    };
    const prodDims = {
      width: prodImg.naturalWidth || 0,
      height: prodImg.naturalHeight || 0,
    };

    if (
      stageDims.width !== prodDims.width ||
      stageDims.height !== prodDims.height
    ) {
      dimensionMismatches.push({
        index: idx,
        filename: stageImg.filename,
        expected: `${prodDims.width}x${prodDims.height}px`,
        actual: `${stageDims.width}x${stageDims.height}px`,
      });
    }
  });

  if (dimensionMismatches.length > 0) {
    diff["imageDimensions"] = {
      expected: "All images should match Prod pixel dimensions",
      actual: dimensionMismatches,
    };
  }
}

function compareHttpHeaders(prodHeaders, stageHeaders, diff) {
  const prodHdr = prodHeaders || {
    contentType: "**Missing**",
    cacheControl: "**Missing**",
  };
  const stageHdr = stageHeaders || {
    contentType: "**Missing**",
    cacheControl: "**Missing**",
  };

  if (prodHdr.contentType !== stageHdr.contentType) {
    diff["headers_contentType"] = {
      expected: prodHdr.contentType,
      actual: stageHdr.contentType,
    };
  }

  if (prodHdr.cacheControl !== stageHdr.cacheControl) {
    diff["headers_cacheControl"] = {
      expected: prodHdr.cacheControl,
      actual: stageHdr.cacheControl,
    };
  }

  if (prodHdr.etag && stageHdr.etag && prodHdr.etag !== stageHdr.etag) {
    diff["headers_etag"] = {
      expected: prodHdr.etag,
      actual: stageHdr.etag,
    };
  }
}

/**
 * @param {{ [key: string]: { expected: any, actual: any } }} diff
 * @param {string} diffSeoPath
 * @param {import('@playwright/test').TestInfo} [testInfo]
 */
async function writeDiffReport(diff, diffSeoPath, testInfo) {
  const jsonContent = JSON.stringify(diff, null, 2);
  fs.mkdirSync(path.dirname(diffSeoPath), { recursive: true });
  fs.writeFileSync(diffSeoPath, jsonContent, "utf-8");

  if (testInfo) {
    await testInfo
      .attach("diffSeo.json", {
        body: jsonContent,
        contentType: "application/json",
      })
      .catch(() => {});
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
  const diff = {};

  addDiff(diff, "htmlTitle", prodSeo?.htmlTitle, stageSeo?.htmlTitle);
  addDiff(diff, "metaTitle", prodSeo?.meta?.title, stageSeo?.meta?.title);
  addDiff(diff, "ogTitle", prodSeo?.meta?.ogTitle, stageSeo?.meta?.ogTitle);
  addDiff(
    diff,
    "description",
    prodSeo?.meta?.description,
    stageSeo?.meta?.description,
  );
  addDiff(diff, "texts", prodSeo?.texts, stageSeo?.texts);
  addDiff(
    diff,
    "listItemsCount",
    prodSeo?.structure?.listItemsCount,
    stageSeo?.structure?.listItemsCount,
  );
  addDiff(
    diff,
    "tableRowsCount",
    prodSeo?.structure?.tableRowsCount,
    stageSeo?.structure?.tableRowsCount,
  );
  addDiff(diff, "robots", prodSeo?.meta?.robots, stageSeo?.meta?.robots);
  addDiff(diff, "ogImage", prodSeo?.meta?.ogImage, stageSeo?.meta?.ogImage);
  addDiff(diff, "ogUrl", prodSeo?.meta?.ogUrl, stageSeo?.meta?.ogUrl);
  addDiff(diff, "schema", prodSeo?.schema, stageSeo?.schema);

  const prodCanonicalPath = normalizePath(
    pathOnlySafe(prodSeo?.meta?.canonical),
  );
  const stageCanonicalPath = normalizePath(
    pathOnlySafe(stageSeo?.meta?.canonical),
  );
  const expectedProdPath = normalizePath(pathOnlySafe(prodUrl));
  const expectedStagePath = normalizePath(pathOnlySafe(stageUrl));

  if (prodCanonicalPath !== stageCanonicalPath) {
    diff["canonicalMatch"] = {
      expected: prodCanonicalPath,
      actual: stageCanonicalPath,
    };
  }

  addDiff(diff, "canonicalProdSelf", expectedProdPath, prodCanonicalPath);
  addDiff(diff, "canonicalStageSelf", expectedStagePath, stageCanonicalPath);

  const prodImagesStr = normalizeImages(prodSeo?.images || []);
  const stageImagesStr = normalizeImages(stageSeo?.images || []);
  addDiff(diff, "images_and_alts", prodImagesStr, stageImagesStr);
  compareImageDimensions(prodSeo?.images || [], stageSeo?.images || [], diff);

  const normProdHreflangs = normalizeHreflangs(prodSeo?.meta?.hreflangs || []);
  const normStageHreflangs = normalizeHreflangs(
    stageSeo?.meta?.hreflangs || [],
  );
  addDiff(diff, "hreflangs", normProdHreflangs, normStageHreflangs);
  compareHttpHeaders(prodSeo?.headers, stageSeo?.headers, diff);

  const hasDiffs = Object.keys(diff).length > 0;
  const leakedLinks = (stageSeo?.links || [])
    .map((l) => l.href)
    .filter(
      (href) =>
        href &&
        (href.includes("www.kingspan.com") ||
          href.includes("kingspan.com/content")),
    );

  if (leakedLinks.length > 0) {
    diff["leakedProdLinks"] = {
      expected: "0",
      actual: `${leakedLinks.length} (${leakedLinks.slice(0, 3).join(", ")})`,
    };
  }

  if (hasDiffs) {
    await writeDiffReport(diff, diffSeoPath, testInfo);

    for (const [key, value] of Object.entries(diff)) {
      expect.soft(value.actual, `SEO Mismatch: ${key}`).toEqual(value.expected);
    }

    expect(
      hasDiffs,
      `SEO differences found: ${Object.keys(diff).join(", ")}`,
    ).toBe(false);
  }
}

export async function compareLinksData(prodLinks = [], stageLinks = []) {
  const diffs = [];
  const cleanProd = [...new Set(prodLinks.map(pathOnlySafe))].sort();
  const cleanStage = [...new Set(stageLinks.map(pathOnlySafe))].sort();

  if (cleanProd.length !== cleanStage.length) {
    diffs.push(
      `Links count mismatch: Prod has ${cleanProd.length} links, Stage has ${cleanStage.length} links.`,
    );
  }
  const missingOnStage = cleanProd.filter((link) => !cleanStage.includes(link));
  if (missingOnStage.length > 0) {
    diffs.push(
      `Missing links on Stage: ${missingOnStage.slice(0, 10).join(", ")} ${missingOnStage.length > 10 ? "..." : ""}`,
    );
  }

  return diffs;
}
