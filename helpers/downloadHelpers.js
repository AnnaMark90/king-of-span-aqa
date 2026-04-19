import { DownloadsComponent } from "../pages/components/DownloadsComponent.js";

const {
  accordionButton: ACCORDION_BUTTON_SELECTOR,
  nestedLinks: NESTED_LINKS_SELECTOR,
  anchorLinks: ANCHOR_LINKS_SELECTOR,
  main: MAIN_SELECTOR,
  body: BODY_SELECTOR,
  bulkCheckboxVariants: BULK_CHECKBOX_SELECTORS,
  bulkButtonVariants: BULK_BUTTON_SELECTORS,
} = DownloadsComponent.SELECTORS;

const DOWNLOAD_PANEL_SELECTORS = DownloadsComponent.panels;
const DOWNLOAD_TRIGGER_SELECTORS = DownloadsComponent.triggers;

function buildResult({ ok = false, skipped = false, message }) {
  return { ok, skipped, message };
}

function buildSkippedResult(message) {
  return buildResult({ skipped: true, message });
}

async function clickLocator(locator) {
  try {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ timeout: 5000 });
    return true;
  } catch {
    return await locator
      .evaluate((element) => element.click())
      .then(() => true)
      .catch(() => false);
  }
}

async function resolveDownloadScope(downloadArea) {
  if (downloadArea?.page && downloadArea?.panelId) {
    return downloadArea.page.locator(`[id="${downloadArea.panelId}"]`).first();
  }

  return downloadArea?.scope || null;
}

async function findFirstVisibleLocator(root, selector) {
  const locator = root.locator(selector);
  const count = await locator.count();

  for (let index = 0; index < count; index++) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  return null;
}

async function collectPdfUrlsFromScope(scope) {
  return await scope.evaluate(
    (container, { anchorLinksSelector, nestedLinksSelector }) => {
      const isPdfUrl = (href) => {
        if (!href) return false;

        try {
          return new URL(href, window.location.origin).pathname
            .toLowerCase()
            .endsWith(".pdf");
        } catch {
          return false;
        }
      };

      const anchorUrls = Array.from(
        container.querySelectorAll(anchorLinksSelector),
      )
        .map((link) => link.href)
        .filter(isPdfUrl);

      const nestedLinkUrls = Array.from(
        container.querySelectorAll(nestedLinksSelector),
      )
        .flatMap((element) =>
          (element.getAttribute("data-gtm-directory-nested-links") || "")
            .split(",")
            .map((href) => href.trim()),
        )
        .filter(isPdfUrl);

      return [...new Set([...anchorUrls, ...nestedLinkUrls])];
    },
    {
      anchorLinksSelector: ANCHOR_LINKS_SELECTOR,
      nestedLinksSelector: NESTED_LINKS_SELECTOR,
    },
  );
}

async function expandCollapsedAccordions(scope) {
  const accordionButtons = scope.locator(ACCORDION_BUTTON_SELECTOR);
  const accordionCount = await accordionButtons.count();

  for (let index = 0; index < accordionCount; index++) {
    const button = accordionButtons.nth(index);
    if (!(await button.isVisible().catch(() => false))) {
      continue;
    }

    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.click({ timeout: 5000 }).catch(() => {});
  }
}

export async function detectDownloadSection(page) {
  let scope = await findFirstVisibleLocator(page, DOWNLOAD_PANEL_SELECTORS);

  if (scope) {
    const panelId = await scope.getAttribute("id");

    return {
      page,
      scope,
      panelId,
      type: "downloads-panel",
      expandAccordions: true,
    };
  }

  const trigger = await findFirstVisibleLocator(
    page,
    DOWNLOAD_TRIGGER_SELECTORS,
  );
  if (trigger) {
    const controlledPanelId = await trigger.getAttribute("aria-controls");
    const triggerClicked = await clickLocator(trigger);

    if (triggerClicked && controlledPanelId) {
      const controlledPanel = page
        .locator(`[id="${controlledPanelId}"]`)
        .first();

      await controlledPanel
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});

      if ((await controlledPanel.count()) > 0) {
        return {
          page,
          scope: controlledPanel,
          panelId: controlledPanelId,
          type: "downloads-panel",
          expandAccordions: true,
        };
      }
    }

    await page.waitForTimeout(500);
    scope = await findFirstVisibleLocator(page, DOWNLOAD_PANEL_SELECTORS);
    if (!scope) {
      const panelLocator = page.locator(DOWNLOAD_PANEL_SELECTORS);
      if ((await panelLocator.count()) > 0) {
        scope = panelLocator.first();
      }
    }

    if (scope) {
      const panelId = await scope.getAttribute("id");

      return {
        page,
        scope,
        panelId,
        type: "downloads-panel",
        expandAccordions: true,
      };
    }
  }

  const mainContent =
    (await findFirstVisibleLocator(page, MAIN_SELECTOR)) ||
    page.locator(BODY_SELECTOR);
  const pageLevelPdfUrls = await collectPdfUrlsFromScope(mainContent);

  if (pageLevelPdfUrls.length > 0) {
    return {
      page,
      scope: mainContent,
      panelId: null,
      type: "page-pdf-links",
      expandAccordions: false,
    };
  }

  return null;
}

export async function collectDownloadUrls(downloadArea) {
  const scope = await resolveDownloadScope(downloadArea);
  if (!scope) {
    return [];
  }

  if (downloadArea.expandAccordions) {
    await expandCollapsedAccordions(scope);
  }

  return await collectPdfUrlsFromScope(scope);
}

export async function verifyPdfLink(request, url) {
  const requestOptions = {
    timeout: 15000,
    ignoreHTTPSErrors: true,
  };

  const toResult = async (response, method) => {
    const status = response.status();
    const contentType = response.headers()["content-type"] || "";

    return {
      url,
      method,
      status,
      contentType,
      isPdf: contentType.includes("application/pdf"),
      valid: status === 200 && contentType.includes("application/pdf"),
    };
  };

  try {
    const headResponse = await request.head(url, requestOptions);
    const headResult = await toResult(headResponse, "HEAD");

    if (headResult.valid || ![0, 403, 405].includes(headResult.status)) {
      return headResult;
    }

    const getResponse = await request.get(url, requestOptions);
    return await toResult(getResponse, "GET");
  } catch (error) {
    return {
      url,
      method: "HEAD",
      status: 0,
      contentType: "error",
      isPdf: false,
      valid: false,
      error: error.message,
    };
  }
}

export async function testBulkDownload(page, downloadArea) {
  const scope = await resolveDownloadScope(downloadArea);
  if (!scope) {
    return buildSkippedResult("Bulk download: download area is not available");
  }

  if (downloadArea.expandAccordions) {
    await expandCollapsedAccordions(scope);
  }

  let checkboxButtons = null;

  for (const selector of BULK_CHECKBOX_SELECTORS) {
    const locator = scope.locator(selector);
    const count = await locator.count();
    if (count > 0) {
      checkboxButtons = locator;
      break;
    }
  }

  if (!checkboxButtons) {
    return buildSkippedResult("Bulk download: no selectable files found");
  }

  const checkboxCount = await checkboxButtons.count();
  const selectCount = Math.min(2, checkboxCount);
  let selectedCount = 0;

  for (let index = 0; index < selectCount; index++) {
    const checkbox = checkboxButtons.nth(index);
    if (!(await checkbox.isVisible().catch(() => false))) {
      continue;
    }

    await checkbox.scrollIntoViewIfNeeded().catch(() => {});
    const alreadySelected =
      (await checkbox.getAttribute("aria-checked").catch(() => null)) ===
      "true";

    if (!alreadySelected) {
      await checkbox.click({ timeout: 5000 }).catch(() => {});
    }

    selectedCount++;
  }

  if (selectedCount === 0) {
    return buildResult({
      ok: false,
      message: "Bulk download: unable to select any files",
    });
  }

  let bulkButton = null;

  for (const selector of BULK_BUTTON_SELECTORS) {
    const locator = scope.locator(selector);
    const count = await locator.count();
    if (count > 0) {
      bulkButton = locator.first();
      break;
    }
  }

  if (!bulkButton) {
    return buildSkippedResult(
      "Bulk download: bulk action button is not available",
    );
  }

  const isEnabled = await bulkButton.isEnabled().catch(() => false);
  if (!isEnabled) {
    return buildResult({
      ok: false,
      message: "Bulk download: bulk action button is disabled",
    });
  }

  await bulkButton.scrollIntoViewIfNeeded().catch(() => {});

  const downloadPromise = page
    .waitForEvent("download", { timeout: 5000 })
    .then((download) => ({
      type: "download",
      value: download.suggestedFilename(),
    }))
    .catch(() => null);

  const popupPromise = page
    .context()
    .waitForEvent("page", { timeout: 5000 })
    .then(async (popup) => {
      const popupUrl = popup.url();
      await popup.close().catch(() => {});

      return {
        type: "page",
        value: popupUrl,
      };
    })
    .catch(() => null);

  await bulkButton.click({ timeout: 5000 });

  const [downloadEvent, popupEvent] = await Promise.all([
    downloadPromise,
    popupPromise,
  ]);

  if (downloadEvent) {
    return buildResult({
      ok: true,
      message: `Bulk download: file download started (${downloadEvent.value})`,
    });
  }

  if (popupEvent?.value?.includes(".pdf")) {
    return buildResult({
      ok: true,
      message: `Bulk download: PDF opened in new page (${popupEvent.value})`,
    });
  }

  return buildResult({
    ok: false,
    message: "Bulk download: no download or PDF popup was detected",
  });
}
