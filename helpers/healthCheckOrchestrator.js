import { test, expect } from "@playwright/test";
import {
  detectCarousels,
  testSecondaryCarousel,
  testBenefitsCarousel,
  testProductListingCarousel,
  verifySlideImage,
} from "./carouselHelpers.js";
import {
  detectDownloadSection,
  collectDownloadUrls,
  verifyPdfLink,
  testBulkDownload,
} from "./downloadHelpers.js";
import { checkLinksStatus, handleLinkReport } from "./linkHelpers.js";

export function logOutcome(result) {
  if (result.skipped) {
    console.log(`[SKIP] ${result.message}`);
    return;
  }
  expect(result.ok, result.message).toBe(true);
}

export async function validateLinks({
  request,
  links,
  diffSeo,
  testInfo,
  stageUrl,
}) {
  if (!links || links.length === 0) {
    console.log(`[SKIP] No links found on: ${stageUrl}`);
    return;
  }

  const report = await checkLinksStatus(request, links);
  await handleLinkReport(report, diffSeo, testInfo);

  for (const broken of report.broken) {
    expect
      .soft(false, `Broken link: ${broken.url} | Status: ${broken.status}`)
      .toBe(true);
  }
}

export async function validateCarousels({ page, pageObject, stageUrl }) {
  await pageObject.forceLoadImages();
  const carousels = await detectCarousels(page);

  if (carousels.length === 0) {
    console.log(`[SKIP] No carousels found on: ${stageUrl}`);
    return;
  }

  for (const carousel of carousels) {
    await test.step(`Carousel ${carousel.index + 1} (${carousel.type})`, async () => {
      if (!carousel.interactive) return;

      const runChecks =
        carousel.type === "secondary"
          ? testSecondaryCarousel
          : carousel.type === "benefits"
            ? testBenefitsCarousel
            : testProductListingCarousel;

      const navResults = await runChecks(page, carousel);
      navResults.forEach(logOutcome);

      const imageResult = await verifySlideImage(page, carousel);
      logOutcome(imageResult);
    });
  }
}

export async function validateDownloads({ page, request, isMobile, stageUrl }) {
  const downloadArea = await detectDownloadSection(page);

  if (!downloadArea) {
    console.log(`[SKIP] No download area found on: ${stageUrl}`);
    return;
  }

  const urls = await collectDownloadUrls(downloadArea);
  expect(
    urls.length,
    `Download area detected but no PDFs found on ${stageUrl}`,
  ).toBeGreaterThan(0);

  for (const url of urls) {
    const result = await verifyPdfLink(request, url);
    expect.soft(result.status, `Broken PDF: ${url}`).toBe(200);
    expect.soft(result.isPdf, `Not a PDF file: ${url}`).toBe(true);
  }

  if (!isMobile) {
    const bulkResult = await testBulkDownload(page, downloadArea);
    logOutcome(bulkResult);
  }
}
