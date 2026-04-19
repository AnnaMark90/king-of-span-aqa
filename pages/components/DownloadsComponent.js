export class DownloadsComponent {
  static SELECTORS = {
    panelVariants: [
      '[role="tabpanel"][id$="-downloads"]',
      '[id*="-downloads"][data-state="active"]',
    ],
    triggerVariants: [
      '[role="tab"][id$="-trigger-downloads"]',
      '[aria-controls*="-downloads"]',
    ],
    bulkCheckboxVariants: ['button[role="checkbox"][data-slot="checkbox"]'],
    bulkButtonVariants: ['button[data-gtm-download-button="true"]'],
    accordionButton: "button[aria-expanded]",
    nestedLinks: "[data-gtm-directory-nested-links]",
    anchorLinks: "a[href$='.pdf']",
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
