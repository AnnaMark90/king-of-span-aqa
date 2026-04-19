import { test, expect } from "@playwright/test";
import { openStagePageContext } from "../../helpers/pageHelpers.js";
import {
  validateLinks,
  validateCarousels,
  validateDownloads,
} from "../../helpers/healthCheckOrchestrator.js";
import { getSnapshotPaths } from "../../utils/utils.js";
import { AnyPage } from "../../pages/AnyPage.js";
import { TEST_PAGES } from "../../constants/constants.js";

for (const targetPage of TEST_PAGES) {
  test.describe(`Functional Health: ${targetPage.path}`, () => {
    test("Audit Stage Page", async ({ browser, request }, testInfo) => {
      test.setTimeout(240000);

      const deviceConfig = testInfo.project.use;
      const { diffSeo } = getSnapshotPaths({
        lang: targetPage.lang,
        device: testInfo.project.name.split("-")[1],
        pageKey: targetPage.pageKey,
      });

      const ctx = await openStagePageContext({
        browser,
        url: targetPage.stageUrl,
        PageObject: AnyPage,
        deviceConfig,
      });

      expect(ctx, `Failed to open page: ${targetPage.stageUrl}`).toBeTruthy();
      const { context, page, pageObject } = ctx;

      try {
        const functionalData = await pageObject.getFunctionalData();

        await test.step("Links validation", () =>
          validateLinks({
            request,
            links: functionalData.links,
            diffSeo,
            testInfo,
            stageUrl: targetPage.stageUrl,
          }));

        await test.step("Carousels validation", () =>
          validateCarousels({
            page,
            pageObject,
            stageUrl: targetPage.stageUrl,
          }));

        await test.step("Downloads validation", () =>
          validateDownloads({
            page,
            request,
            isMobile: deviceConfig.isMobile,
            stageUrl: targetPage.stageUrl,
          }));
      } finally {
        await context.close();
      }
    });
  });
}
