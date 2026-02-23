import { BUTTON_ACCEPT_COOKIE } from "../constants/constants";
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

  async doScreenshot(path) {
    await this.page.screenshot({
      path: path,
      fullPage: true,
    });
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

  async getSeoImgAndHeaders() {
    const images = await this.page.$$eval("img", (imgs) =>
      imgs.map((img) => ({
        fileName: img.src.split("/").pop() || "unknown",
        src: img.src,
        alt: img.alt,
        title: img.title,
      })),
    );

    images.sort((a, b) => a.fileName.localeCompare(b.fileName));

    console.log("========== IMAGES ==========");
    console.log("Number of images = " + images.length);
    images.forEach((img) => {
      console.log(img.fileName);
      console.log(img.src);
      console.log(img.alt);
      console.log(img.title);
      console.log("----------");
    });

    const headers = await this.page.$$eval("h1, h2, h3, h4, h5, h6", (tags) =>
      tags.map((tag) => ({
        level: tag.tagName.toLowerCase(), // 'h1', 'h2' и т.д.
        text: tag.textContent.trim(),
      })),
    );

    headers.sort((a, b) => a.level.localeCompare(b.level));

    console.log("========== H1...6 ==========");
    console.log("Number of Headers = " + headers.length);
    headers.forEach((header) => {
      console.log(header.level);
      console.log(header.text);
      console.log("----------");
    });

    return {
      images,
      headers,
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

module.exports = { AnyPage };
