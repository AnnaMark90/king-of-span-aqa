import { test, expect } from "@playwright/test";
import { openStagePageContext, safeRun } from "../../helpers/pageHelpers.js";
import {
  detectCarousels,
  testSecondaryCarousel,
  testBenefitsCarousel,
  testProductListingCarousel,
  verifySlideImage,
} from "../../helpers/carouselHelpers.js";
import {
  detectDownloadSection,
  collectDownloadUrls,
  verifyPdfLink,
  testBulkDownload,
} from "../../helpers/downloadHelpers.js";
import {
  checkLinksStatus,
  handleLinkReport,
} from "../../helpers/linkHelpers.js";
import { getSnapshotPaths } from "../../utils/utils.js";
import { AnyPage } from "../../pages/AnyPage.js";
import { TEST_PAGES } from "../../constants/constants.js";

function logOutcome(result) {
  if (result.skipped) {
    console.log(`[SKIP] ${result.message}`);
    return;
  }

  if (result.ok) {
    console.log(`[LOG] ${result.message}`);
    return;
  }

  expect.soft(result.ok, result.message).toBe(true);
}

function runCarouselChecks(page, carousel) {
  if (carousel.type === "secondary") {
    return testSecondaryCarousel(page, carousel);
  }

  if (carousel.type === "benefits") {
    return testBenefitsCarousel(page, carousel);
  }

  return testProductListingCarousel(page, carousel);
}

async function collectFunctionalData(pageObject, stageUrl) {
  const functionalData = await pageObject.getFunctionalData();

  expect(
    functionalData,
    `Functional data is missing on STAGE: ${stageUrl}`,
  ).toBeTruthy();

  return functionalData;
}

async function validateLinks({ request, links, diffSeo, testInfo, stageUrl }) {
  if (links.length === 0) {
    console.log(`[SKIP] No links found on: ${stageUrl}`);
    return;
  }

  const linkReport = await checkLinksStatus(request, links);
  await handleLinkReport(linkReport, diffSeo, testInfo);

  console.log(
    `[LOG] Links checked on ${stageUrl}: ${links.length} total, ${linkReport.broken.length} broken`,
  );

  for (const broken of linkReport.broken) {
    expect
      .soft(
        false,
        `Broken link: ${broken.url} | Parent: ${broken.parent} | Status: ${broken.status} - ${broken.statusText}`,
      )
      .toBe(true);
  }
}

async function validateCarousels({ page, pageObject, stageUrl }) {
  await pageObject.forceLoadImages();

  const carousels = await detectCarousels(page);
  if (carousels.length === 0) {
    console.log(`[SKIP] No carousels found on: ${stageUrl}`);
    return;
  }

  console.log(`[LOG] Found ${carousels.length} carousel(s) on: ${stageUrl}`);

  for (const carousel of carousels) {
    await test.step(`Carousel ${carousel.index + 1} (${carousel.type})`, async () => {
      if (!carousel.interactive) {
        console.log(
          `[SKIP] Carousel ${carousel.index + 1}: ${carousel.skipReason}`,
        );
        return;
      }

      const navigationResults = await runCarouselChecks(page, carousel);
      for (const result of navigationResults) {
        logOutcome(result);
      }

      const imageResult = await verifySlideImage(page, carousel);
      logOutcome(imageResult);
    });
  }
}

async function validateDownloads({
  page,
  request,
  isMobile,
  stageUrl,
}) {
  const downloadArea = await detectDownloadSection(page);

  if (!downloadArea) {
    console.log(`[SKIP] No download area found on: ${stageUrl}`);
    return;
  }

  console.log(
    `[LOG] Download area detected on ${stageUrl} (${downloadArea.type})`,
  );

  const urls = await collectDownloadUrls(downloadArea);
  if (urls.length === 0) {
    expect(false, "Download area detected but no PDF URLs were found").toBe(
      true,
    );
    return;
  }

  console.log(`[LOG] Found ${urls.length} PDF link(s) to verify`);

  for (const url of urls) {
    const result = await verifyPdfLink(request, url);
    expect
      .soft(result.status, `PDF link broken (${result.method}): ${url}`)
      .toBe(200);

    expect
      .soft(
        result.isPdf,
        `Link has wrong content-type (${result.method}): ${url} -> ${result.contentType}`,
      )
      .toBe(true);
  }

  if (isMobile) {
    console.log(
      `[SKIP] Bulk download not applicable on mobile for: ${stageUrl}`,
    );
    return;
  }

  const bulkDownloadResult = await testBulkDownload(page, downloadArea);
  logOutcome(bulkDownloadResult);
}

for (const targetPage of TEST_PAGES) {
  test.describe(`URL: /${targetPage.path} stage functional health`, () => {
    test.describe(`lang: ${targetPage.lang}`, () => {
      test("Stage page checks", async ({ browser, request }, testInfo) => {
        test.setTimeout(240000);

        const deviceConfig = testInfo.project.use;
        const device = testInfo.project.name.split("-")[1];
        const isMobile = deviceConfig?.isMobile || deviceConfig?.viewport?.width <= 430;
        const { diffSeo } = getSnapshotPaths({
          lang: targetPage.lang,
          device,
          pageKey: targetPage.pageKey,
        });

        const ctxResult = await openStagePageContext({
          browser,
          url: targetPage.stageUrl,
          PageObject: AnyPage,
          deviceConfig,
        });

        expect(
          ctxResult,
          `Stage page failed to open: ${targetPage.stageUrl}`,
        ).toBeTruthy();

        const { context, page, pageObject } = ctxResult;

        try {
          let functionalData = null;

          await test.step("Collect page functional data", async () => {
            functionalData = await collectFunctionalData(
              pageObject,
              targetPage.stageUrl,
            );
          });

          await test.step("Validate stage links", async () => {
            await validateLinks({
              request,
              links: functionalData?.links || [],
              diffSeo,
              testInfo,
              stageUrl: targetPage.stageUrl,
            });
          });

          await test.step("Validate carousels", async () => {
            await validateCarousels({
              page,
              pageObject,
              stageUrl: targetPage.stageUrl,
            });
          });

          await test.step("Validate downloads and file responses", async () => {
            await validateDownloads({
              page,
              request,
              isMobile,
              stageUrl: targetPage.stageUrl,
            });
          });
        } finally {
          await safeRun(
            context?.close(),
            null,
            `closeContext after ${targetPage.stageUrl}`,
          );
        }
      });
    });
  });
}
