import { test } from "@playwright/test";
import { LANGS } from "../../constants/constants.js";
import { buildUrl } from "../../utils/utils.js";
import { compareEnvsSeo } from "../../helpers/helpers.js";
import { AnyPage } from "../../pages/AnyPage.js";

const pageKey = "contact";

test.skip(`${pageKey} compare images, headers prod vs stage`, () => {
  for (const lang of Object.keys(LANGS)) {
    test(`seo compare | lang: ${lang}`, async ({ browser }, testInfo) => {
      const productionUrl = buildUrl("production", pageKey, lang);
      const stagingUrl = buildUrl("staging", pageKey, lang);

      await compareEnvsSeo({
        browser,
        productionUrl,
        stagingUrl,
        PageObject: AnyPage,
        testInfo,
      });
    });
  }
});
