import { BasePage } from "./BasePage.js";

export class AnyPage extends BasePage {
  static SELECTORS = {
    canonical: 'link[rel="canonical"]',
    hreflangs: 'link[rel="alternate"][hreflang]',
    img: "img",
    allTags: "h1,h2,h3,h4,h5,h6,p,a",
    listItems: "li",
    tableRows: "tr",
    schemaScript: 'script[type="application/ld+json"]',
    metaTitle: 'meta[name="title"]',
    metaOgTitle: 'meta[property="og:title"]',
    metaOgImage: 'meta[property="og:image"]',
    metaOgUrl: 'meta[property="og:url"]',
    metaRobots: 'meta[name="robots"]',
    metaDescription: 'meta[name="description"]',
    metaOgDescription: 'meta[property="og:description"]',
    acceptButton: "#ccc-notify-accept",
  };

  constructor(page) {
    super(page);
    this.page = page;
  }

  async forceLoadImages() {
    await this.page.evaluate(async (sel) => {
      const images = Array.from(document.querySelectorAll(sel));
      const pending = images.filter((img) => !img.complete);
      if (pending.length === 0) return;
      await Promise.all(
        pending.map(
          (img) =>
            new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 1000);
            }),
        ),
      );
    }, AnyPage.SELECTORS.img);
  }

  async freezeCarousels() {
    await this.page.addStyleTag({
      content: `
        .carousel, .swiper-wrapper, .slick-track, [data-slot="carousel"], [aria-roledescription="carousel"] {
          animation-play-state: paused !important;
        }
        .carousel *, .swiper-wrapper *, .slick-track *, [data-slot="carousel"] * {
          transition: none !important;
        }
      `,
    });
    await this.page
      .evaluate(() => {
        const carousels = document.querySelectorAll(
          '.carousel, .swiper, .slick-slider, [data-slot="carousel"], [aria-roledescription="carousel"]',
        );
        carousels.forEach((carousel) => {
          carousel.dispatchEvent(
            new MouseEvent("mouseenter", { bubbles: true }),
          );
          carousel.dispatchEvent(
            new MouseEvent("mouseover", { bubbles: true }),
          );
        });
      })
      .catch(() => {});
  }

  async doScreenshot(snapshotPath) {
    await this.page.screenshot({
      path: snapshotPath,
      fullPage: true,
    });
  }

  getResponseHeaders() {
    const headers = this.responseHeaders || {};
    return {
      contentType: headers["content-type"] || "**Missing**",
      cacheControl: headers["cache-control"] || "**Missing**",
      etag: headers["etag"] || undefined,
      lastModified: headers["last-modified"] || undefined,
    };
  }

  async getSeoContent() {
    const domData = await this.page.evaluate((selectors) => {
      const getAttr = (sel, attr) => {
        const val = document.querySelector(sel)?.getAttribute(attr);
        return val ? val : "**Missing**";
      };

      const collectHreflangs = () =>
        Array.from(document.querySelectorAll(selectors.hreflangs)).map(
          (link) => ({
            lang: link.getAttribute("hreflang"),
            href: link.getAttribute("href"),
          }),
        );

      const collectTexts = () => {
        const nodes = Array.from(document.querySelectorAll(selectors.allTags));
        const texts = {};
        ["h1", "h2", "h3", "h4", "h5", "h6", "p", "a"].forEach((tag) => {
          texts[tag] = nodes
            .filter((n) => n.tagName.toLowerCase() === tag)
            .map((el) => el.innerText.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        });
        return texts;
      };

      const collectSchema = () =>
        Array.from(document.querySelectorAll(selectors.schemaScript)).map(
          (s) => {
            try {
              return JSON.parse(s.innerText);
            } catch {
              return "Invalid JSON";
            }
          },
        );

      const collectImages = () => {
        return Array.from(document.querySelectorAll(selectors.img)).map(
          (img) => ({
            filename:
              (img.getAttribute("src") || "").split("/").pop().split("?")[0] ||
              "**Missing**",
            alt: img.getAttribute("alt") || "**Missing**",
            title: img.getAttribute("title") || "**Missing**",
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          }),
        );
      };

      return {
        htmlTitle: document.title || "**Missing**",
        texts: collectTexts(),
        structure: {
          listItemsCount: document.querySelectorAll(selectors.listItems).length,
          tableRowsCount: document.querySelectorAll(selectors.tableRows).length,
        },
        schema: collectSchema(),
        meta: {
          title: getAttr(selectors.metaTitle, "content"),
          ogTitle: getAttr(selectors.metaOgTitle, "content"),
          ogImage: getAttr(selectors.metaOgImage, "content"),
          ogUrl: getAttr(selectors.metaOgUrl, "content"),
          robots: getAttr(selectors.metaRobots, "content"),
          description:
            getAttr(selectors.metaDescription, "content") !== "**Missing**"
              ? getAttr(selectors.metaDescription, "content")
              : getAttr(selectors.metaOgDescription, "content"),
          canonical: getAttr(selectors.canonical, "href"),
          hreflangs: collectHreflangs(),
        },
        images: collectImages(),
      };
    }, AnyPage.SELECTORS);

    return {
      ...domData,
      headers: this.getResponseHeaders(),
    };
  }

  async getFunctionalData() {
    await this.page
      .waitForSelector("form", { state: "attached", timeout: 5000 })
      .catch(() => {});

    return await this.page.evaluate(() => {
      const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

      return {
        links: Array.from(document.querySelectorAll("a[href]")).map(
          (a) => a.href,
        ),
        forms: Array.from(document.querySelectorAll("form")).map((f) => {
          const rawFormId =
            f.id ||
            (f.name ? `name: ${f.name}` : "") ||
            (typeof f.className === "string" && f.className
              ? `class: ${f.className.split(" ").slice(0, 2).join(" ")}`
              : "") ||
            "no-id-or-class";

          return {
            formId: clean(rawFormId),
            action: f.getAttribute("action") || "no-action",
            method: (f.getAttribute("method") || "POST").toUpperCase(),
            fields: Array.from(
              f.querySelectorAll("input, select, textarea"),
            ).map((i) => ({
              name: clean(i.name || i.id),
              type: i.type,
            })),
          };
        }),
      };
    });
  }
}
