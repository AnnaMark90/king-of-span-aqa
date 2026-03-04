import { test, expect } from "@playwright/test";
import { collectEnvData, checkLinksStatus } from "../../helpers/helpers.js";
import { getSnapshotPaths } from "../../utils/utils.js";
import { AnyPage } from "../../pages/AnyPage.js";
import { TEST_PAGES } from "../../constants/constants.js";
import fs from "fs";
import path from "path";

for (const page of TEST_PAGES) {
  test.skip(`${page.pageKey} stage only Health Check`, () => {
    test.describe(`lang: ${page.lang}`, () => {
      let stageData;
      let diffSeoPath;

      test.beforeAll(async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const device = testInfo.project.name.split("-")[1];
        const paths = getSnapshotPaths({
          lang: page.lang,
          device,
          pageKey: page.pageKey,
        });
        diffSeoPath = paths.diffSeo;
        const deviceConfig = testInfo.project.use;
        stageData = await collectEnvData({
          browser,
          url: page.stageUrl,
          PageObject: AnyPage,
          deviceConfig,
        });
      });
      test("functionality of links", async ({ request, page }, testInfo) => {
        test.skip(!stageData?.func?.links, "Stage data collection failed");

        const { links = [] } = stageData.func || {};
        const linkReport = await checkLinksStatus(request, links);
        const reportPath = diffSeoPath.replace(
          "diffSeo.json",
          "links-report.json",
        );
        const dir = path.dirname(reportPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(linkReport, null, 2));

        await testInfo.attach("links-report.json", {
          body: JSON.stringify(linkReport, null, 2),
          contentType: "application/json",
        });

        for (const broken of linkReport.broken) {
          expect
            .soft(
              false,
              `Broken link: ${broken.url} (Status: ${broken.status} - ${broken.statusText})`,
            )
            .toBe(true);
        }

        const webLinks = links.filter(
          (l) => l.startsWith("http") && !l.includes("google"),
        );
        if (webLinks.length > 0) {
          const testLink = webLinks[0];
          await page.goto(testLink, { waitUntil: "domcontentloaded" });
          expect(page.url()).not.toContain("404");
        }
      });
    });
  });
}
