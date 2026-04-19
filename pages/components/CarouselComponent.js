export class CarouselComponent {
  static SELECTORS = {
    rootVariants: [
      '[data-slot="carousel"][aria-roledescription="carousel"]',
      '[aria-roledescription="carousel"][data-slot="carousel"]',
      '[aria-roledescription="carousel"]',
    ],
    slideVariants: [
      '[data-slot="carousel-item-secondary"]',
      '[data-slot="carousel-item"]',
      '[aria-roledescription="slide"]',
    ],
    dotVariants: [
      ".carousel-indicators [role='tab']",
      "[role='tablist'] [role='tab']",
      "[role='tab'][aria-selected]",
      "[role='tab'][data-selected]",
    ],
    nextButtonVariants: [
      'button[data-slot="carousel-next"]',
      '[data-slot="carousel-next"]',
      'button[aria-label="Next slide"]',
    ],
    previousButtonVariants: [
      'button[data-slot="carousel-previous"]',
      '[data-slot="carousel-previous"]',
      'button[aria-label="Previous slide"]',
    ],
    nextRevealTargetVariants: [
      ".carousel-item-secondary-next",
      '[data-slot="carousel-item-secondary"].carousel-item-secondary-next',
    ],
    previousRevealTargetVariants: [
      ".carousel-item-secondary-previous",
      '[data-slot="carousel-item-secondary"].carousel-item-secondary-previous',
    ],
    secondarySlideVariants: [
      '[data-slot="carousel-item-secondary"]',
      ".carousel-item-secondary",
    ],
    productSlideVariants: [
      '[data-slot="carousel-item"]',
      ".carousel-item",
    ],
    trackVariants: [
      ".tiles-carousel-content",
      '[data-slot="carousel-content"] > div',
      '[data-slot="carousel-content"] > *',
    ],
    progressIndicatorVariants: [
      ".tiles-carousel-progress-track > div",
      ".carousel-progress [style*='width']",
      ".carousel-progress [class*='progress']",
    ],
    visibleStateNodes: [
      ".carousel-item-secondary-center",
      '[data-slot="carousel-item-secondary"]',
      '[data-slot="carousel-item"]',
      "[aria-roledescription='slide']",
      "a[href]",
      "img[src]",
      "[style*='background-image']",
      "[data-lazy-media]",
      "article",
      ".tiles-carousel-progress-track > div",
    ],
    media: "img, [style*='background-image'], [data-lazy-media]",
  };

  static get root() {
    return this.SELECTORS.rootVariants.join(", ");
  }

  static get slides() {
    return this.SELECTORS.slideVariants.join(", ");
  }

  static get dots() {
    return this.SELECTORS.dotVariants.join(", ");
  }

  static get activeDots() {
    return [
      ...this.SELECTORS.dotVariants.map(
        (selector) => `${selector}[aria-selected="true"]`,
      ),
      ...this.SELECTORS.dotVariants.map(
        (selector) => `${selector}[data-selected="true"]`,
      ),
    ].join(", ");
  }

  static get nextButtons() {
    return this.SELECTORS.nextButtonVariants.join(", ");
  }

  static get previousButtons() {
    return this.SELECTORS.previousButtonVariants.join(", ");
  }

  static get nextRevealTargets() {
    return this.SELECTORS.nextRevealTargetVariants.join(", ");
  }

  static get previousRevealTargets() {
    return this.SELECTORS.previousRevealTargetVariants.join(", ");
  }

  static get secondarySlide() {
    return this.SELECTORS.secondarySlideVariants.join(", ");
  }

  static get productSlides() {
    return this.SELECTORS.productSlideVariants.join(", ");
  }

  static get tracks() {
    return this.SELECTORS.trackVariants.join(", ");
  }

  static get progressIndicators() {
    return this.SELECTORS.progressIndicatorVariants.join(", ");
  }

  static get visibleStateSignatureNodes() {
    return this.SELECTORS.visibleStateNodes.join(", ");
  }

  static get media() {
    return this.SELECTORS.media;
  }
}
