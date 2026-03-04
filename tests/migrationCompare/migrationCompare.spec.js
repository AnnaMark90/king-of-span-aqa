import { test, expect } from "@playwright/test";
import { getSnapshotPaths } from "../../utils/utils.js";
import { collectEnvData, compareEnvsSnapshots } from "../../helpers/helpers.js";
import { compareEnvsSeo, compareFormsData } from "../../helpers/validators.js";
import { AnyPage } from "../../pages/AnyPage.js";
import { TEST_PAGES } from "../../constants/constants.js";

for (const page of TEST_PAGES) {
  test.describe(`${page.pageKey} prod vs stage`, () => {
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
      });

      test("forms structure compare", async ({}, testInfo) => {
        test.skip(
          !stageData?.func || !prodData?.func,
          "Data collection failed",
        );

        const prodForms = prodData.func?.forms || [];
        const stageForms = stageData.func?.forms || [];

        if (prodForms.length === 0 && stageForms.length === 0) {
          console.log(`[INFO] No forms found on page: ${page.pageKey}`);
          testInfo.annotations.push({
            type: "info",
            description: "No forms are present on Prod and Stage",
          });
          return;
        }

        const reportPath = diffSeoPath.replace(
          "diffSeo.json",
          "forms-report.json",
        );

        const formDiffs = await compareFormsData(
          prodForms,
          stageForms,
          reportPath,
          testInfo,
        );

        for (const diff of formDiffs) {
          expect.soft(false, diff).toBe(true);
        }
      });

      test.skip("visual compare", async ({}, testInfo) => {
        await compareEnvsSnapshots({
          prodPath: productionPath,
          stagePath: stagingPath,
          diffPath,
          testInfo,
        });
      });

      test.skip("seo compare", async ({}, testInfo) => {
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
