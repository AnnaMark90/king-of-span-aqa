import { test } from "@playwright/test";
import { LANGS } from "../../constants/constants.js";
import { buildUrl } from "../../utils/utils.js";
import { compareEnvsSnapshots } from "../../helpers/helpers.js";
import { AnyPage } from "../../pages/AnyPage.js";

const prodUrl = "https://www.kingspan.com/pl/pl/";
const stageUrl = "https://stage.kingspan.com/pl/pl/";

const home_url_pl = "https://www.kingspan.com/pl/pl/o-nas/";

test.skip("check links", async ({ page }) => {
  await page.goto(home_url_pl, {
    waitUntil: "networkidle",
  });

  await page.click(button_accept_cookie);

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log("Total HEIGHT:", scrollHeight);

  await page.evaluate(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  });

  const urls = await page.$$eval("a", (tags) =>
    tags.map((tag) => ({
      href: tag.href,
      status_code: -1,
    })),
  );

  const validUrls = urls.filter((link) => link.href.startsWith("http"));

  for (const item of validUrls) {
    try {
      const response = await page.request.get(item.href, {
        failOnStatusCode: false,
      });
      item.status_code = response.status();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      item.status_code = 0;
      console.error(`Error fetching ${item.href}:`, errorMessage);
    }
  }

  console.log("========== LINKS ==========");
  console.log("Number of a = " + urls.length);
  console.log("Number of LINKS = " + validUrls.length);
  validUrls.forEach((validUrl) => {
    console.log(validUrl.href);
    console.log(validUrl.status_code);
    console.log("----------");
  });
});
