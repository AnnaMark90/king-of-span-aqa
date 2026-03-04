import { BUTTON_ACCEPT_COOKIE } from "../constants/constants.js";

export class BasePage {
  constructor(page) {
    this.page = page;
    this.acceptCookieButton = page.locator(BUTTON_ACCEPT_COOKIE);
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
    try {
      const response = await this.page.goto(url, {
        waitUntil: "domcontentloaded",
      });
      if (response && response.status() >= 400) return false;
    } catch (e) {
      return false;
    }
    await this.clickAcceptCookieButton();
    await this.hideHeaderAndFooter();
    await this.page.waitForTimeout(1000);
    return true;
  }
}
