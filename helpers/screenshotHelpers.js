import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import path from "path";
import { expect } from "@playwright/test";

export function cropToIntersection(img1, img2) {
  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);

  const cropped1 = new PNG({ width, height });
  const cropped2 = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx1 = (y * img1.width + x) * 4;
      const idx2 = (y * img2.width + x) * 4;
      const cIdx = (y * width + x) * 4;

      cropped1.data.set(img1.data.slice(idx1, idx1 + 4), cIdx);
      cropped2.data.set(img2.data.slice(idx2, idx2 + 4), cIdx);
    }
  }

  return [cropped1, cropped2];
}

export async function takeSmartScreenshots(page, basePath) {
  const MAX_HEIGHT = 16000;
  const paths = [];
  const dir = path.dirname(basePath);
  const parentDir = path.dirname(dir);
  const envName = path.basename(dir);
  const ext = path.extname(basePath);
  const name = path.basename(basePath, ext);

  const bodySize = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));

  if (bodySize.height <= MAX_HEIGHT) {
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

    const singlePath = path.join(parentDir, `${envName}-${name}${ext}`);
    await page.screenshot({ path: singlePath, fullPage: true });
    paths.push(singlePath);
  } else {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const chunks = Math.ceil(bodySize.height / MAX_HEIGHT);
    for (let i = 0; i < chunks; i++) {
      const chunkPath = path.join(dir, `${name}-${i + 1}${ext}`);
      const clipY = i * MAX_HEIGHT;
      const clipHeight = Math.min(MAX_HEIGHT, bodySize.height - clipY);

      await page.screenshot({
        path: chunkPath,
        fullPage: true, // принудительно снимаем всю страницу для корректного clip
        clip: { x: 0, y: clipY, width: bodySize.width, height: clipHeight },
      });
      paths.push(chunkPath);
    }
  }
  return paths;
}

export async function compareEnvsSnapshots({
  prodPath,
  stagePath,
  diffPath,
  testInfo,
}) {
  const hasProd = fs.existsSync(prodPath);
  const hasStage = fs.existsSync(stagePath);
  if (!hasProd || !hasStage) {
    expect(
      false,
      `CRITICAL: Snapshots aren't found! Prod: ${hasProd}, Stage: ${hasStage} (вероятно 404)`,
    ).toBe(true);
    return;
  }
  const [prodBuffer, stageBuffer] = await Promise.all([
    fs.promises.readFile(prodPath),
    fs.promises.readFile(stagePath),
  ]);
  const prodImage = PNG.sync.read(prodBuffer);
  const stageImage = PNG.sync.read(stageBuffer);
  const [croppedProd, croppedStage] = cropToIntersection(prodImage, stageImage);
  const { width, height } = croppedProd;

  const diffImage = new PNG({ width, height });
  const mismatchPixels = pixelmatch(
    croppedProd.data,
    croppedStage.data,
    diffImage.data,
    width,
    height,
    { threshold: 0.15 },
  );
  if (mismatchPixels > 0) {
    const dir = path.dirname(diffPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const diffBuffer = PNG.sync.write(diffImage);
    fs.writeFileSync(diffPath, diffBuffer);
    if (testInfo) {
      try {
        await testInfo.attach("diff.png", {
          path: path.resolve(diffPath),
          contentType: "image/png",
        });
      } catch (e) {
        console.error("Attachment error:", e);
      }
    }
    const diffPercent = (mismatchPixels / (width * height)) * 100;
    expect
      .soft(
        diffPercent,
        `Visual difference detected on ${path.basename(stagePath)}`,
      )
      .toBeLessThanOrEqual(0);
  }
}

export async function preparePageForScreenshot(page) {
  await page.addStyleTag({
    content: `
      #ccc, [id*="cookie"], [class*="cookie"], #onetrust-consent-sdk, .Menu__blur, .Menu, .cookie-banner, .cookiePolicy, #cookiePolicy, .cookies, .cc-banner, .cookie-consent, .consent-banner, .gdpr-consent, .onetrust-banner { 
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

  await page.evaluate(async () => {
    document.querySelectorAll("img").forEach((img) => {
      if (img.loading === "lazy") img.loading = "eager";
      const lazySrc =
        img.getAttribute("data-src") || img.getAttribute("data-lazy");
      if (lazySrc && !img.src) img.src = lazySrc;
    });

    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > 15000) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

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
          setTimeout(resolve, 5000);
        });
      }),
    );
    window.scrollTo(0, 0);
  });

  await page.waitForTimeout(1000);

  await page.waitForTimeout(1000);
}
