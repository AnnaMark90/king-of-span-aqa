import { test } from "@playwright/test";
import { LANGS } from "../../constants/constants.js";
import { buildUrl } from "../../utils/utils.js";
import { compareEnvsSnapshots } from "../../helpers/helpers.js";
import { AnyPage } from "../../pages/AnyPage.js";

const pageKey = "contact";

test.describe(`${pageKey} compare snapshots prod vs stage`, () => {
  for (const lang of Object.keys(LANGS)) {
    test(`lang: ${lang}`, async ({ browser }, testInfo) => {
      const device = testInfo.project.name.split("-")[1];

      const productionUrl = buildUrl("production", pageKey, lang);
      const stagingUrl = buildUrl("staging", pageKey, lang);

      await compareEnvsSnapshots({
        browser,
        productionUrl,
        stagingUrl,
        PageObject: AnyPage,
        lang,
        pageKey,
        device,
        testInfo,
      });
    });
  }
});
