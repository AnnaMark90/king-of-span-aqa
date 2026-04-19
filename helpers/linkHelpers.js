import fs from "fs";
import path from "path";
import {
  getStatusText,
  IGNORED_DOMAINS,
  REQUEST_HEADERS,
  USER_AGENT,
} from "../constants/constants.js";

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

export async function checkLinksStatus(request, linksData) {
  const cleanMap = new Map();

  for (const { href, parent } of linksData) {
    if (href?.startsWith("http")) {
      const cleanHref = href.split("#")[0];
      if (!cleanMap.has(cleanHref)) {
        cleanMap.set(cleanHref, { href: cleanHref, parent });
      }
    }
  }

  const cleanUrls = Array.from(cleanMap.values());
  const results = { successful: [], redirected: [], broken: [] };

  for (let i = 0; i < cleanUrls.length; i += 10) {
    const batch = cleanUrls.slice(i, i + 10);
    const skippedInBatch = [];

    await Promise.all(
      batch.map(async ({ href, parent }) => {
        const matchedDomain = IGNORED_DOMAINS.find((domain) =>
          href.includes(domain),
        );

        if (matchedDomain) {
          skippedInBatch.push(matchedDomain);
          results.successful.push({
            url: href,
            status: "SKIPPED",
            statusText: `Ignored Anti-Bot (${matchedDomain})`,
            parent,
          });
          return;
        }

        const response = await request
          .get(href, {
            timeout: 25000,
            ignoreHTTPSErrors: true,
            headers: REQUEST_HEADERS,
          })
          .catch((err) => ({ status: () => 0, error: err.message }));

        const status = response.status();
        const record = {
          url: href,
          status: status || "FAILED",
          statusText: status ? getStatusText(status) : response.error,
          parent,
        };

        if (status >= 200 && status < 300) {
          results.successful.push(record);
        } else if (status >= 300 && status < 400) {
          results.redirected.push(record);
        } else {
          results.broken.push(record);
        }
      }),
    );

    if (skippedInBatch.length > 0) {
      console.log(
        `[SKIP] Ignored social links: ${[...new Set(skippedInBatch)].join(", ")}`,
      );
    }

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
