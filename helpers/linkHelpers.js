import fs from "fs";
import path from "path";
import { getStatusText, USER_AGENT } from "../constants/constants.js";

// function for link validation, may be reuse for other link-related checks in the future
export async function checkLinks(browser, url) {
  let context = null;
  let page = null;
  const result = { url, status: null, ok: false };

  try {
    context = await browser.newContext({
      userAgent: USER_AGENT,
      launchOptions: {
        args: ["--disable-blink-features=AutomationControlled"],
      },
    });
    page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    result.status = response ? response.status() : 0;

    if (response?.status() >= 400) {
      result.ok = false;
    } else {
      result.ok = true;
    }
  } catch (error) {
    result.error = error.message;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }

  return result;
}

export async function checkLinksStatus(request, urls) {
  const cleanUrls = [
    ...new Set(
      urls.filter((u) => u?.startsWith("http")).map((u) => u.split("#")[0]),
    ),
  ];
  const results = { successful: [], redirected: [], broken: [] };
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "*/*",
    "Accept-Encoding": "identity",
  };
  for (let i = 0; i < cleanUrls.length; i += 10) {
    const batch = cleanUrls.slice(i, i + 10);
    await Promise.all(
      batch.map(async (url) => {
        const response = await request
          .get(url, { timeout: 25000, ignoreHTTPSErrors: true, headers })
          .catch((err) => ({ status: () => 0, error: err.message }));

        const status = response.status();
        const record = {
          url,
          status: status || "FAILED",
          statusText: status ? getStatusText(status) : response.error,
        };

        if (status >= 200 && status < 300) results.successful.push(record);
        else if (status >= 300 && status < 400) results.redirected.push(record);
        else results.broken.push(record);
      }),
    );
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

export async function handleLinkReport(linkReport, diffSeoPath, testInfo) {
  const reportPath = diffSeoPath.replace("diffSeo.json", "links-report.json");
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(linkReport, null, 2));

  await testInfo.attach("links-report.json", {
    body: JSON.stringify(linkReport, null, 2),
    contentType: "application/json",
  });
}
