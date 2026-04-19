export class DownloadsComponent {
  static SELECTORS = {
    panelVariants: [
      '[role="tabpanel"][id*="downloads" i]',
      '[role="tabpanel"][id*="download" i]',
    ],
    triggerVariants: [
      '[role="tab"][aria-controls*="downloads" i]',
      '[role="tab"][aria-controls*="download" i]',
      'button[aria-controls*="downloads" i]',
      'button[aria-controls*="download" i]',
      '[role="tab"][id*="downloads" i]',
      '[role="tab"][id*="download" i]',
      'button[id*="downloads" i]',
      'button[id*="download" i]',
    ],
    bulkCheckboxVariants: [
      'button[role="checkbox"][data-slot="checkbox"]',
      'button[role="checkbox"]',
      'input[type="checkbox"]',
      '[data-testid*="checkbox"]',
      ".checkbox",
    ],
    bulkButtonVariants: [
      'button[data-gtm-download-button="true"]',
      'button[data-slot="button"][data-gtm-download-button]',
      "button[data-gtm-download-button]",
      '[data-testid="download-all-btn"]',
      ".download-all-button",
    ],
    accordionButton: 'button[aria-expanded="false"]',
    nestedLinks: "[data-gtm-directory-nested-links]",
    anchorLinks: "a[href]",
    main: "main",
    body: "body",
  };

  static get panels() {
    return this.SELECTORS.panelVariants.join(", ");
  }

  static get triggers() {
    return this.SELECTORS.triggerVariants.join(", ");
  }
}
