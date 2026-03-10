import { log } from "node:console";

export class BasePage {
  constructor(page) {
    this.page = page;
    this.responseHeaders = null;
  }

  async clickAcceptCookieButton() {
    try {
      const button = await this.page.waitForSelector("#ccc-notify-accept", {
        timeout: 1500,
        state: "visible",
      });
      if (button) {
        await button.click();
        await this.page.waitForTimeout(500);
      }
    } catch {
      await this.page
        .evaluate(() => {
          if (
            typeof CookieControl !== "undefined" &&
            typeof CookieControl.acceptAll === "function"
          ) {
            CookieControl.acceptAll();
          }
        })
        .catch(() => {});
    }
  }

  async hideHeaderAndFooter() {
    await this.page.addStyleTag({
      content: `
        header, .Header, footer, .Footer, #ccc-notify, .ccc-notify__notify {
          display: none !important; 
        }
        html, body { overflow: auto !important; 
        position: static !important; 
        height: auto !important; }
      `,
    });
  }

  async openPage(url) {
    console.log(`Opening page: ${url}`);
    try {
      const response = await this.page.goto(url, {
        waitUntil: "domcontentloaded",
      });

      const status = response ? response.status() : "No response";
      console.log(`[LOG] Status: ${status} | URL: ${this.page.url()}`);
      if (status === 403 || status === 502 || status === 404) {
        console.log(
          "Stop for diagnosis! Status code indicates a potential issue. Please check the page manually.",
        );
        await this.page.pause();
      }

      if (response && response.status() >= 400) return false;
      if (response) {
        this.responseHeaders = response.headers();
      }
    } catch (e) {
      console.log(`[LOG] Error: ${e.message}`);
      return false;
    }
    await this.clickAcceptCookieButton();
    await this.hideHeaderAndFooter();
    await this.page.waitForTimeout(1000);
    return true;
  }
}
