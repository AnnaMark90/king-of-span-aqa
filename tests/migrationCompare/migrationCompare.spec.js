import { test, expect } from "@playwright/test";
import { getSnapshotPaths } from "../../utils/utils.js";
import { collectEnvData } from "../../helpers/pageHelpers.js";
import { compareEnvsSnapshots } from "../../helpers/screenshotHelpers.js";
import { compareEnvsSeo } from "../../helpers/validators.js";
import { AnyPage } from "../../pages/AnyPage.js";
import { TEST_PAGES } from "../../constants/constants.js";

for (const page of TEST_PAGES) {
  test.describe(`URL: /${page.path}`, () => {
    test.describe(`lang: ${page.lang}`, () => {
      let prodData, stageData;
      let productionPath, stagingPath, diffPath, diffSeoPath;

      test.beforeAll(async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const deviceConfig = testInfo.project.use;
        const device = testInfo.project.name.split("-")[1];
        const paths = getSnapshotPaths({
          lang: page.lang,
          device,
          pageKey: page.pageKey,
        });
        productionPath = paths.production;
        stagingPath = paths.staging;
        diffPath = paths.diff;
        diffSeoPath = paths.diffSeo;

        [prodData, stageData] = await Promise.all([
          collectEnvData({
            browser,
            url: page.prodUrl,
            PageObject: AnyPage,
            snapshotPath: productionPath,
            deviceConfig,
          }),
          collectEnvData({
            browser,
            url: page.stageUrl,
            PageObject: AnyPage,
            snapshotPath: stagingPath,
            deviceConfig,
          }),
        ]);
        if (!prodData?.func || !stageData?.func) {
          console.log(`[SKIP] Error data received for page: /${page.path}`);
          if (!prodData?.func) {
            console.log(`PROD ERROR ${page.prodUrl}`);
          }
          if (!stageData?.func) {
            console.log(`STAGE ERROR ${page.stageUrl}`);
          }
        }
      });

      test("visual compare", async ({}, testInfo) => {
        test.skip(
          !prodData || !stageData,
          "Data collection failed, skipping visual compare",
        );
        const prodPaths = prodData.snapshotPaths;
        const stagePaths = stageData.snapshotPaths;

        expect(prodPaths, "No screenshots found on Prod").toBeTruthy();
        expect(stagePaths, "No screenshots found on Stage").toBeTruthy();
        expect(
          stagePaths.length,
          `Height mismatch! Prod: ${prodPaths.length} parts, Stage: ${stagePaths.length} parts.`,
        ).toBe(prodPaths.length);

        for (let i = 0; i < prodPaths.length; i++) {
          const currentProdPath = prodPaths[i];
          const currentStagePath = stagePaths[i];
          const currentDiffPath = currentProdPath.replace("prod", "diff");

          await compareEnvsSnapshots({
            prodPath: currentProdPath,
            stagePath: currentStagePath,
            diffPath: currentDiffPath,
            testInfo,
          });
        }
      });

      test("seo compare", async ({}, testInfo) => {
        test.skip(
          !prodData?.seo || !stageData?.seo,
          "SEO data is missing, skipping seo compare",
        );

        await compareEnvsSeo({
          prodSeo: prodData.seo,
          stageSeo: stageData.seo,
          prodUrl: page.prodUrl,
          stageUrl: page.stageUrl,
          diffSeoPath,
          testInfo,
        });
      });
    });
  });
}
