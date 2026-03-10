export * from "./pageHelpers.js";
export * from "./screenshotHelpers.js";
export * from "./linkHelpers.js";

export async function preparePageForScreenshot(page) {
  await page.addStyleTag({
    content: `
      #ccc, [id*="cookie"], [class*="cookie"], #onetrust-consent-sdk, .Menu__blur, .Menu { 
        display: none !important; 
      }
      header, .Header, .meganavHeader, .sticky, [class*="sticky"] { 
        position: relative !important; 
        top: 0 !important; 
      }
      .Header__filler { 
        display: none !important; 
      }
      [data-in-screen-reveal], .fade-in, .animate, [class*="animate-"], [class*="--reveal"] {
        opacity: 1 !important;
        visibility: visible !important;
      }
      *, *::before, *::after { 
        transition-duration: 0.01s !important; 
        transition-delay: 0s !important;
        animation-duration: 0.01s !important; 
        animation-delay: 0s !important; 
      }
    `,
  });

  await page.evaluate(() => document.fonts.ready).catch(() => {});

  let scrolls = 0;
  const maxScrolls = 40;
  let currentScrollY = 0;
  let lastScrollY = -1;

  while (scrolls < maxScrolls) {
    await page.mouse.wheel(0, 600);

    await page.evaluate(() => {
      document.querySelectorAll("img").forEach((img) => {
        if (img.loading === "lazy") {
          img.removeAttribute("loading");
          img.setAttribute("loading", "eager");
          img.setAttribute("fetchpriority", "high");
        }
        const lazySrc = img.getAttribute("data-src");
        if (lazySrc && !img.src) img.src = lazySrc;
      });
    });

    await page.waitForTimeout(400);

    currentScrollY = await page.evaluate(() => Math.ceil(window.scrollY));
    if (currentScrollY === lastScrollY) {
      break;
    }
    lastScrollY = currentScrollY;
    scrolls++;
  }

  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll("img")).filter(
      (img) => img.src && !img.src.startsWith("data:"),
    );
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 3000);
        });
      }),
    );
  });

  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"));
    window.scrollTo(0, 0);
  });

  await page.waitForTimeout(1500);
}
