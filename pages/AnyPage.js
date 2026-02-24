import { BUTTON_ACCEPT_COOKIE } from "../constants/constants";
import fs from "fs";
import path from "path";
export class AnyPage {
  constructor(page) {
    this.page = page;
    this.acceptCookieButton = page.locator(BUTTON_ACCEPT_COOKIE);
  }
  async clickAcceptCookieButton() {
    try {
      await this.page.waitForSelector("#ccc-notify-accept", {
        timeout: 10000,
        state: "visible",
      });

      await this.page.click("#ccc-notify-accept");
      await this.page.waitForTimeout(1000);
    } catch {
      console.log("Cookie button not found");
    }
  }

  async scrollPage() {
    await this.page.evaluate(async () => {
      const scrollStep = 500;
      const scrollHeight = document.body.scrollHeight;

      for (let i = 0; i < scrollHeight; i += scrollStep) {
        window.scrollBy(0, scrollStep);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      window.scrollTo(0, 0);
    });
  }

  async doScreenshot(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    await this.page.screenshot({
      path: filePath,
      fullPage: true,
    });
    console.log("SCREENSHOT SAVED:", filePath);
  }

  async openPage(url) {
    console.log(url);
    await this.page.goto(url, {
      waitUntil: "networkidle",
    });
    await this.clickAcceptCookieButton();
    await this.waitForFonts();
    await this.disableAnimations();
    await this.scrollPage();
    await this.hideDynamicElements();
    await this.page.waitForTimeout(300);
  }

  async getSeoContent() {
    // строго в DOM порядке
    const images = await this.page.$$eval("img", (imgs) =>
      imgs.map((img) => ({
        src: img.src,
        alt: img.alt,
        title: img.title,
      })),
    );
    console.log("========== IMAGES ==========");
    console.log("Number of images =", images.length);
    images.forEach((img) => {
      console.log("SRC:", img.src);
      console.log("ALT:", img.alt);
      console.log("TITLE:", img.title);
      console.log("----------");
    });

    const headers = await this.page.$$eval("h1, h2, h3, h4, h5, h6", (tags) =>
      tags.map((tag) => ({
        level: tag.tagName.toLowerCase(),
        text: tag.textContent.trim(),
      })),
    );
    console.log("========== HEADERS ==========");
    console.log("Number of headers =", headers.length);
    headers.forEach((header) => {
      console.log("LEVEL:", header.level);
      console.log("TEXT:", header.text);
      console.log("----------");
    });

    const meta = await this.page.evaluate(() => {
      const getMeta = (name) =>
        document.querySelector(`meta[name="${name}"]`)?.content || "";
      const hreflangs = Array.from(
        document.querySelectorAll('link[rel="alternate"][hreflang]'),
      ).map((link) => ({
        hreflang: link.getAttribute("hreflang"),
        href: link.href,
      }));
      return {
        title: document.title,
        description: getMeta("description"),
        robots: getMeta("robots"),
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        hreflangs,
      };
    });

    console.log("========== META ==========");
    console.log("TITLE:", meta.title);
    console.log("DESCRIPTION:", meta.description);
    console.log("ROBOTS:", meta.robots);
    console.log("CANONICAL:", meta.canonical);
    console.log("HREFLANGS:", meta.hreflangs.length);
    meta.hreflangs.forEach((h) => {
      console.log("hreflang:", h.hreflang, "href:", h.href);
    });
    console.log("----------");

    return {
      images,
      headers,
      meta,
    };
  }

  async disableAnimations() {
    await this.page.addStyleTag({
      content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
    });
  }
  async hideDynamicElements() {
    await this.page.addStyleTag({
      content: `
      .swiper,
      .slider,
      .carousel,
      video,
      iframe,
      [data-dynamic] {
        visibility: hidden !important;
      }
    `,
    });
  }

  async waitForFonts() {
    await this.page.evaluateHandle("document.fonts.ready");
  }
}

// module.exports = { AnyPage };
