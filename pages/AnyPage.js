import { BasePage } from "./BasePage.js";

/**
 * @typedef {Object} SeoHreflang
 * @property {string} lang
 * @property {string} href
 *
 * @typedef {Object} SeoImage
 * @property {string} filename
 * @property {string} alt
 * @property {string} title
 * @property {number} naturalWidth
 * @property {number} naturalHeight
 *
 * @typedef {Object} SeoMeta
 * @property {string} title
 * @property {string} ogTitle
 * @property {string} ogImage
 * @property {string} ogUrl
 * @property {string} robots
 * @property {string} description
 * @property {string} canonical
 * @property {SeoHreflang[]} hreflangs
 *
 * @typedef {Object} SeoStructure
 * @property {number} listItemsCount
 * @property {number} tableRowsCount
 *
 * @typedef {Object} SeoTexts
 * @property {string[]} h1
 * @property {string[]} h2
 * @property {string[]} h3
 * @property {string[]} h4
 * @property {string[]} h5
 * @property {string[]} h6
 * @property {string[]} p
 * @property {string[]} a
 *
 * @typedef {Object} SeoObject
 * @property {string} htmlTitle
 * @property {SeoTexts} texts
 * @property {SeoStructure} structure
 * @property {any} schema
 * @property {SeoMeta} meta
 * @property {SeoImage[]} images
 */

export class AnyPage extends BasePage {
  /**
   * Central repository of CSS selectors used by AnyPage functions. Updating a
   * selector here affects all SEO/functional collectors.
   */
  static SELECTORS = {
    canonical: 'link[rel="canonical"]',
    hreflangs: 'link[rel="alternate"][hreflang]',
    img: 'img',
    allTags: 'h1,h2,h3,h4,h5,h6,p,a',
    listItems: 'li',
    tableRows: 'tr',
    schemaScript: 'script[type="application/ld+json"]',
    metaTitle: 'meta[name="title"]',
    metaOgTitle: 'meta[property="og:title"]',
    metaOgImage: 'meta[property="og:image"]',
    metaOgUrl: 'meta[property="og:url"]',
    metaRobots: 'meta[name="robots"]',
    metaDescription: 'meta[name="description"]',
    metaOgDescription: 'meta[property="og:description"]',
  };

  constructor(page) {
    super(page);
    this.page = page;
  }

  /**
   * Ensure images have finished loading by awaiting pending `load` events.  
   * @returns {Promise<void>}
   */
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

  /**
   * Pause animations on carousels to stabilise screenshots.
   * @returns {Promise<void>}
   */
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

  /**
   * Take a full‑page screenshot.
   * @param {string} snapshotPath
   * @returns {Promise<void>}
   */
  async doScreenshot(snapshotPath) {
    await this.page.screenshot({
      path: snapshotPath,
      fullPage: true,
    });
  }

  /**
   * Collects a large set of SEO‑related data from the DOM.  The structure is
   * defined by {@link SeoObject}.
   * @returns {Promise<SeoObject>}
   */
  async getSeoContent() {
    return await this.page.evaluate((selectors) => {
      const getAttr = (sel, attr) => {
        const val = document.querySelector(sel)?.getAttribute(attr);
        return val ? val : "**Missing**";
      };

      const collectHreflangs = () =>
        Array.from(document.querySelectorAll(selectors.hreflangs)).map((link) => ({
          lang: link.getAttribute("hreflang"),
          href: link.getAttribute("href"),
        }));

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
        Array.from(document.querySelectorAll(selectors.schemaScript)).map((s) => {
          try {
            return JSON.parse(s.innerText);
          } catch {
            return "Invalid JSON";
          }
        });

      const collectImages = () => {
        return Array.from(document.querySelectorAll(selectors.img)).map((img) => ({
          filename:
            (img.getAttribute("src") || "").split("/").pop().split("?")[0] ||
            "**Missing**",
          alt: img.getAttribute("alt") || "**Missing**",
          title: img.getAttribute("title") || "**Missing**",
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        }));
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
  }

  /**
   * Gather basic functional data like links and forms.
   * @returns {Promise<{links:string[],forms:Array}>}
   */
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
