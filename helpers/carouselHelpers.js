import { CarouselComponent } from "../pages/components/CarouselComponent.js";

const {
  root: CAROUSEL_ROOT_SELECTOR,
  slides: SLIDE_SELECTOR,
  secondarySlide: SECONDARY_SLIDE_SELECTOR,
  productSlides: PRODUCT_SLIDE_SELECTOR,
  media: MEDIA_SELECTOR,
} = CarouselComponent;

const DOT_SELECTOR = CarouselComponent.dots;
const ACTIVE_DOT_SELECTOR = CarouselComponent.activeDots;
const NEXT_BUTTON_SELECTOR = CarouselComponent.nextButtons;
const PREVIOUS_BUTTON_SELECTOR = CarouselComponent.previousButtons;
const NEXT_REVEAL_TARGET_SELECTOR = CarouselComponent.nextRevealTargets;
const PREVIOUS_REVEAL_TARGET_SELECTOR = CarouselComponent.previousRevealTargets;
const TRACK_SELECTOR = CarouselComponent.tracks;
const PROGRESS_SELECTOR = CarouselComponent.progressIndicators;
const VISIBLE_STATE_NODE_SELECTOR =
  CarouselComponent.visibleStateSignatureNodes;

function buildResult({ ok = false, skipped = false, message }) {
  return { ok, skipped, message };
}

function buildSkippedResult(message) {
  return buildResult({ skipped: true, message });
}

function getCarouselLocator(page, index) {
  return page.locator(CAROUSEL_ROOT_SELECTOR).nth(index);
}

function hasStateChanged(before, after) {
  if (before.activeDotIndex !== after.activeDotIndex) {
    return true;
  }

  if (before.trackTransform !== after.trackTransform) {
    return true;
  }

  if (
    Number.isFinite(before.scrollLeft) &&
    Number.isFinite(after.scrollLeft) &&
    Math.abs(before.scrollLeft - after.scrollLeft) > 5
  ) {
    return true;
  }

  if (before.progressSignature !== after.progressSignature) {
    return true;
  }

  if (
    before.activeSlidesSignature.join(" | ") !==
    after.activeSlidesSignature.join(" | ")
  ) {
    return true;
  }

  if (
    before.visibleSlidesSignature.join(" | ") !==
    after.visibleSlidesSignature.join(" | ")
  ) {
    return true;
  }

  return (
    before.nextDisabled !== after.nextDisabled ||
    before.prevDisabled !== after.prevDisabled
  );
}

async function captureCarouselState(locator) {
  return await locator.evaluate(
    (
      container,
      {
        dotSelector,
        activeDotSelector,
        nextButtonSelector,
        previousButtonSelector,
        trackSelector,
        progressSelector,
        slideSelector,
        visibleStateNodeSelector,
      },
    ) => {
      const round = (value) => {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
      };

      const normalizeText = (value) =>
        value?.replace(/\s+/g, " ").trim().slice(0, 80) || "";

      const normalizeTransform = (value) =>
        value && value !== "none" ? value.replace(/\s+/g, "") : "none";

      const getOverlapRatio = (rect, containerRect) => {
        const overlapWidth =
          Math.max(
            0,
            Math.min(rect.right, containerRect.right) -
              Math.max(rect.left, containerRect.left),
          ) || 0;
        const overlapHeight =
          Math.max(
            0,
            Math.min(rect.bottom, containerRect.bottom) -
              Math.max(rect.top, containerRect.top),
          ) || 0;
        const overlapArea = overlapWidth * overlapHeight;
        const area = rect.width * rect.height || 1;

        return overlapArea / area;
      };

      const hasVisibleAncestors = (element) => {
        let current = element;

        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            round(style.opacity ?? "1") === 0
          ) {
            return false;
          }

          current = current.parentElement;
        }

        return true;
      };

      const isVisible = (element) => {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          round(style.opacity ?? "1") !== 0 &&
          hasVisibleAncestors(element) &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const getElementLabel = (element, fallback = "") => {
        if (!element) return fallback;

        return (
          element.getAttribute("aria-label") ||
          element.getAttribute("alt") ||
          element.getAttribute("href") ||
          element.getAttribute("src") ||
          element.getAttribute("data-lazy-media") ||
          normalizeText(element.textContent) ||
          fallback
        );
      };

      const containerRect = container.getBoundingClientRect();
      const dots = Array.from(container.querySelectorAll(dotSelector));
      const activeDotIndex = dots.findIndex(
        (dot) =>
          dot.getAttribute("aria-selected") === "true" ||
          dot.getAttribute("data-selected") === "true",
      );

      const nextButton = container.querySelector(nextButtonSelector);
      const previousButton = container.querySelector(previousButtonSelector);
      const nextDisabled =
        !nextButton ||
        nextButton.disabled ||
        nextButton.getAttribute("aria-disabled") === "true";
      const prevDisabled =
        !previousButton ||
        previousButton.disabled ||
        previousButton.getAttribute("aria-disabled") === "true";

      const trackCandidates = Array.from(container.querySelectorAll(trackSelector))
        .filter((node) => isVisible(node))
        .map((node) => {
          const style = window.getComputedStyle(node);
          return {
            node,
            overflow: Math.max(node.scrollWidth - node.clientWidth, 0),
            transform: normalizeTransform(style.transform),
            childCount: node.children.length,
          };
        })
        .sort((left, right) => {
          if (right.overflow !== left.overflow) {
            return right.overflow - left.overflow;
          }

          if (right.childCount !== left.childCount) {
            return right.childCount - left.childCount;
          }

          return Number(left.transform === "none") - Number(right.transform === "none");
        });

      const primaryTrack = trackCandidates[0]?.node || null;
      const trackStyle = primaryTrack
        ? window.getComputedStyle(primaryTrack)
        : null;
      const trackTransform = trackStyle
        ? normalizeTransform(trackStyle.transform)
        : "none";

      const progressNode = container.querySelector(progressSelector);
      const progressStyle = progressNode
        ? window.getComputedStyle(progressNode)
        : null;
      const progressSignature = progressNode
        ? [
            normalizeText(progressNode.style.width || progressStyle?.width || ""),
            normalizeText(
              progressNode.style.insetInlineStart ||
                progressNode.style.left ||
                progressStyle?.left ||
                "",
            ),
            normalizeTransform(progressStyle?.transform),
          ].join("|")
        : null;

      const slides = Array.from(container.querySelectorAll(slideSelector)).map(
        (slide, index) => {
          const rect = slide.getBoundingClientRect();
          const style = window.getComputedStyle(slide);
          const labelSource =
            slide.querySelector("a[href]") ||
            slide.querySelector("img[alt]") ||
            slide.querySelector("[data-unit-content='true']") ||
            slide.querySelector("h1, h2, h3, h4, h5, h6, p");
          const className =
            typeof slide.className === "string" ? slide.className : "";
          const overlapRatio = getOverlapRatio(rect, containerRect);
          const opacity = round(style.opacity ?? "1") ?? 1;
          const classState = (
            className.match(
              /carousel-item-secondary-(?:center|next|previous)/g,
            ) || []
          ).join(",");

          const isActive =
            classState.includes("center") ||
            slide.getAttribute("aria-current") === "true" ||
            slide.getAttribute("aria-selected") === "true" ||
            slide.getAttribute("data-selected") === "true" ||
            (opacity > 0.5 &&
              style.pointerEvents !== "none" &&
              overlapRatio > 0.15);

          return {
            key: getElementLabel(labelSource, `slide-${index + 1}`),
            signature: [
              `#${index + 1}`,
              getElementLabel(labelSource, `slide-${index + 1}`),
              `opacity=${opacity}`,
              `pointer=${style.pointerEvents}`,
              `class=${classState || "none"}`,
              `x=${Math.round(rect.left - containerRect.left)}`,
              `overlap=${Math.round(overlapRatio * 100)}`,
              `transform=${normalizeTransform(style.transform)}`,
            ].join("|"),
            isActive,
            overlapRatio,
          };
        },
      );

      const visibleSlidesSignature = slides
        .filter((slide) => slide.overlapRatio > 0.15)
        .map((slide) => slide.signature)
        .slice(0, 8);

      const activeSlidesSignature = slides
        .filter((slide) => slide.isActive)
        .map((slide) => slide.signature)
        .slice(0, 8);

      const fallbackVisibleSignature = Array.from(
        container.querySelectorAll(visibleStateNodeSelector),
      )
        .filter((node) => isVisible(node))
        .map((node) => getElementLabel(node, node.tagName.toLowerCase()))
        .filter(Boolean)
        .slice(0, 8);

      return {
        activeDotIndex,
        nextDisabled,
        prevDisabled,
        scrollLeft: primaryTrack ? Math.round(primaryTrack.scrollLeft) : null,
        trackTransform,
        progressSignature,
        activeSlidesSignature:
          activeSlidesSignature.length > 0
            ? activeSlidesSignature
            : fallbackVisibleSignature,
        visibleSlidesSignature:
          visibleSlidesSignature.length > 0
            ? visibleSlidesSignature
            : fallbackVisibleSignature,
        hasActiveDot: !!container.querySelector(activeDotSelector),
      };
    },
    {
      dotSelector: DOT_SELECTOR,
      activeDotSelector: ACTIVE_DOT_SELECTOR,
      nextButtonSelector: NEXT_BUTTON_SELECTOR,
      previousButtonSelector: PREVIOUS_BUTTON_SELECTOR,
      trackSelector: TRACK_SELECTOR,
      progressSelector: PROGRESS_SELECTOR,
      slideSelector: SLIDE_SELECTOR,
      visibleStateNodeSelector: VISIBLE_STATE_NODE_SELECTOR,
    },
  );
}

async function revealCarouselControl(locator, direction) {
  await locator.hover({ force: true }).catch(() => {});

  const revealSelector =
    direction === "next"
      ? NEXT_REVEAL_TARGET_SELECTOR
      : PREVIOUS_REVEAL_TARGET_SELECTOR;

  if (!revealSelector) {
    return;
  }

  const revealTarget = locator.locator(revealSelector).first();
  if ((await revealTarget.count()) === 0) {
    return;
  }

  await revealTarget.hover({ force: true }).catch(() => {});
}

async function isActionable(locator) {
  if ((await locator.count()) === 0) {
    return false;
  }

  const candidate = locator.first();
  const isVisible = await candidate.isVisible().catch(() => false);
  if (!isVisible) {
    return false;
  }

  return await candidate
    .evaluate((element) => {
      const style = window.getComputedStyle(element);
      return (
        style.pointerEvents !== "none" &&
        Number.parseFloat(style.opacity || "1") > 0
      );
    })
    .catch(() => false);
}

async function clickAndCapture(page, locator, controlLocator, actionLabel, direction) {
  if ((await controlLocator.count()) === 0) {
    return buildSkippedResult(`${actionLabel}: control not found`);
  }

  const control = controlLocator.first();

  if (!(await isActionable(controlLocator))) {
    await revealCarouselControl(locator, direction);
    await page.waitForTimeout(150);
  }

  const isEnabled = await control.isEnabled().catch(() => false);
  const actionable = await isActionable(controlLocator);

  if (!isEnabled || !actionable) {
    return buildSkippedResult(`${actionLabel}: control is not actionable`);
  }

  const before = await captureCarouselState(locator);

  await control.scrollIntoViewIfNeeded().catch(() => {});
  await control.click({ timeout: 5000 });
  await page.waitForTimeout(500);

  const after = await captureCarouselState(locator);
  const changed = hasStateChanged(before, after);

  return buildResult({
    ok: changed,
    message: changed
      ? `${actionLabel}: carousel state changed`
      : `${actionLabel}: carousel state did not change`,
  });
}

async function clickTargetDot(page, locator) {
  const dots = locator.locator(DOT_SELECTOR);
  const dotCount = await dots.count();

  if (dotCount <= 1) {
    return buildSkippedResult("Dot navigation: less than two dots available");
  }

  const activeIndex = await dots.evaluateAll((elements) =>
    elements.findIndex(
      (element) =>
        element.getAttribute("aria-selected") === "true" ||
        element.getAttribute("data-selected") === "true",
    ),
  );

  const targetIndex =
    activeIndex >= 0 ? (activeIndex + 1) % dotCount : Math.min(1, dotCount - 1);
  const targetDot = dots.nth(targetIndex);

  const before = await captureCarouselState(locator);

  await targetDot.scrollIntoViewIfNeeded().catch(() => {});
  await targetDot.click({ timeout: 5000 });
  await page.waitForTimeout(500);

  const after = await captureCarouselState(locator);
  const changed = hasStateChanged(before, after);
  const expectedSelected =
    after.activeDotIndex === -1 || after.activeDotIndex === targetIndex;

  return buildResult({
    ok: changed && expectedSelected,
    message:
      changed && expectedSelected
        ? `Dot navigation: dot ${targetIndex + 1} became active`
        : `Dot navigation: expected dot ${targetIndex + 1} to become active`,
  });
}

function collectUsableResults(results, fallbackMessage) {
  return results.length > 0 ? results : [buildSkippedResult(fallbackMessage)];
}

export async function detectCarousels(page) {
  return await page.locator(CAROUSEL_ROOT_SELECTOR).evaluateAll(
    (
      containers,
      {
        dotSelector,
        secondarySlideSelector,
        productSlideSelector,
        nextButtonSelector,
        previousButtonSelector,
      },
    ) => {
      const isVisible = (element) => {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      return containers
        .map((container, index) => {
          if (!isVisible(container)) {
            return null;
          }

          const dotsCount = container.querySelectorAll(dotSelector).length;
          const secondarySlidesCount = container.querySelectorAll(
            secondarySlideSelector,
          ).length;
          const productSlidesCount = container.querySelectorAll(
            productSlideSelector,
          ).length;
          const nextButton = container.querySelector(nextButtonSelector);
          const previousButton = container.querySelector(previousButtonSelector);
          const hasNextButton = !!nextButton;
          const hasPrevButton = !!previousButton;
          const nextDisabled =
            !nextButton ||
            nextButton.disabled ||
            nextButton.getAttribute("aria-disabled") === "true";
          const prevDisabled =
            !previousButton ||
            previousButton.disabled ||
            previousButton.getAttribute("aria-disabled") === "true";

          let type = "unknown";
          if (secondarySlidesCount > 0) {
            type = "secondary";
          } else if (dotsCount > 0) {
            type = "benefits";
          } else if (productSlidesCount > 0 || hasNextButton || hasPrevButton) {
            type = "productListing";
          }

          const interactive =
            dotsCount > 1 ||
            (hasNextButton && !nextDisabled) ||
            (hasPrevButton && !prevDisabled);

          return {
            index,
            type,
            dotsCount,
            secondarySlidesCount,
            productSlidesCount,
            hasNextButton,
            hasPrevButton,
            interactive,
            skipReason: interactive
              ? null
              : "Static carousel without usable navigation",
          };
        })
        .filter(Boolean);
    },
    {
      dotSelector: DOT_SELECTOR,
      secondarySlideSelector: SECONDARY_SLIDE_SELECTOR,
      productSlideSelector: PRODUCT_SLIDE_SELECTOR,
      nextButtonSelector: NEXT_BUTTON_SELECTOR,
      previousButtonSelector: PREVIOUS_BUTTON_SELECTOR,
    },
  );
}

export async function testSecondaryCarousel(page, carousel) {
  const locator = getCarouselLocator(page, carousel.index);
  const results = [];

  const nextResult = await clickAndCapture(
    page,
    locator,
    locator.locator(NEXT_BUTTON_SELECTOR),
    "Secondary carousel: next button",
    "next",
  );
  if (!nextResult.skipped) {
    results.push(nextResult);
  }

  const previousResult = await clickAndCapture(
    page,
    locator,
    locator.locator(PREVIOUS_BUTTON_SELECTOR),
    "Secondary carousel: previous button",
    "previous",
  );
  if (!previousResult.skipped) {
    results.push(previousResult);
  }

  const dotResult = await clickTargetDot(page, locator);
  if (!dotResult.skipped) {
    results.push(dotResult);
  }

  return collectUsableResults(
    results,
    "Secondary carousel: no usable controls found",
  );
}

export async function testBenefitsCarousel(page, carousel) {
  const locator = getCarouselLocator(page, carousel.index);
  const results = [];

  const nextResult = await clickAndCapture(
    page,
    locator,
    locator.locator(NEXT_BUTTON_SELECTOR),
    "Benefits carousel: next button",
    "next",
  );
  if (!nextResult.skipped) {
    results.push(nextResult);
  }

  const previousResult = await clickAndCapture(
    page,
    locator,
    locator.locator(PREVIOUS_BUTTON_SELECTOR),
    "Benefits carousel: previous button",
    "previous",
  );
  if (!previousResult.skipped) {
    results.push(previousResult);
  }

  const dotResult = await clickTargetDot(page, locator);
  if (!dotResult.skipped) {
    results.push(dotResult);
  }

  return collectUsableResults(
    results,
    "Benefits carousel: no usable controls found",
  );
}

export async function testProductListingCarousel(page, carousel) {
  const locator = getCarouselLocator(page, carousel.index);
  const results = [];

  const nextResult = await clickAndCapture(
    page,
    locator,
    locator.locator(NEXT_BUTTON_SELECTOR),
    "Product listing carousel: next button",
    "next",
  );
  if (!nextResult.skipped) {
    results.push(nextResult);
  }

  const previousResult = await clickAndCapture(
    page,
    locator,
    locator.locator(PREVIOUS_BUTTON_SELECTOR),
    "Product listing carousel: previous button",
    "previous",
  );
  if (!previousResult.skipped) {
    results.push(previousResult);
  }

  return collectUsableResults(
    results,
    "Product listing carousel: no usable controls found",
  );
}

export async function verifySlideImage(page, carousel) {
  const carouselLocator = getCarouselLocator(page, carousel.index);
  const mediaLocator = carouselLocator.locator(MEDIA_SELECTOR);
  const mediaCount = await mediaLocator.count();

  if (mediaCount === 0) {
    return buildSkippedResult(
      `Carousel ${carousel.index + 1}: no media in this carousel`,
    );
  }

  await page.waitForTimeout(500);

  const mediaState = await mediaLocator.evaluateAll((nodes) => {
    const getBackgroundUrl = (value) => {
      const match = /url\((['"]?)(.*?)\1\)/.exec(value || "");
      return match?.[2] || "";
    };

    const hasVisibleAncestors = (element) => {
      let current = element;

      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number.parseFloat(style.opacity || "1") === 0
        ) {
          return false;
        }

        current = current.parentElement;
      }

      return true;
    };

    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity || "1") > 0 &&
        hasVisibleAncestors(element) &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const describeNode = (node) => {
      if (node.tagName.toLowerCase() === "img") {
        return node.getAttribute("src") || node.getAttribute("alt") || "img";
      }

      return (
        node.getAttribute("data-lazy-media") ||
        getBackgroundUrl(window.getComputedStyle(node).backgroundImage) ||
        "background"
      );
    };

    const visibleNodes = nodes.filter((node) => isVisible(node));

    return {
      totalCount: nodes.length,
      visibleCount: visibleNodes.length,
      invalidVisibleNodes: visibleNodes
        .filter((node) => {
          if (node.tagName.toLowerCase() === "img") {
            return node.naturalWidth === 0 || node.naturalHeight === 0;
          }

          const style = window.getComputedStyle(node);
          const backgroundUrl = getBackgroundUrl(style.backgroundImage);
          const lazyUrl = node.getAttribute("data-lazy-media") || "";

          return !(backgroundUrl || lazyUrl);
        })
        .map((node) => describeNode(node)),
    };
  });

  if (mediaState.visibleCount === 0) {
    return buildResult({
      ok: false,
      message: `Carousel ${carousel.index + 1}: media exist but none are visible`,
    });
  }

  return buildResult({
    ok: mediaState.invalidVisibleNodes.length === 0,
    message:
      mediaState.invalidVisibleNodes.length === 0
        ? `Carousel ${carousel.index + 1}: visible media are loaded`
        : `Carousel ${carousel.index + 1}: unloaded visible media detected (${mediaState.invalidVisibleNodes.join(", ")})`,
  });
}
