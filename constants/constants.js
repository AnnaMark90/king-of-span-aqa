export const BUTTON_ACCEPT_COOKIE = "#ccc-notify-accept";

const PROD_BASE = "https://www.kingspan.com";
const STAGE_BASE = "https://d2ciz519lp8snl.cloudfront.net";

export const getStatusText = (status) => {
  const codes = {
    200: "OK",
    201: "Created",
    301: "Moved Permanently",
    302: "Found / Redirect",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return codes[status] || "Unknown Status";
};

export const TEST_PAGES = [
  {
    lang: "ie-en",
    pageKey: "passiveFireProtection",
    path: "ie/en/campaigns/passive-fire-protection-service",
  },
  {
    lang: "ie-en",
    pageKey: "internalWallInsulation",
    path: "ie/en/knowledge-articles/what-you-need-to-know-about-internal-wall-insulation--",
  },
  {
    lang: "gb-en",
    pageKey: "thermalBridging",
    path: "gb/en/knowledge-articles/what-is-thermal-bridging",
  },
  {
    lang: "cz-cs",
    pageKey: "cookiePolicy",
    path: "cz/cs/zasady-pouzivani-souboru-cookie",
  },
  {
    lang: "sa-ar",
    pageKey: "roofInsulationBoard",
    path: "sa/ar/products/insulation-boards/roof-insulation-board/tt47",
  },
  {
    lang: "gb-en",
    pageKey: "contactTechnicalInsulation",
    path: "gb/en/contact-us/kingspan-technical-insulation",
  },
  {
    lang: "gb-en",
    pageKey: "contactKingspanInsulation",
    path: "gb/en/contact-us/kingspan-insulation",
  },
  {
    lang: "ie-en",
    pageKey: "tarecpirM1CR",
    path: "ie/en/knowledge-articles/tarecpir-m1-cr-for-marine-applications",
  },
  {
    lang: "ee-et",
    pageKey: "planetPassionate",
    path: "ee/et/meist/planet-passionate",
  },
  {
    lang: "se-sv",
    pageKey: "dokument",
    path: "se/sv/dokument",
  },
].map((page) => {
  const cleanPath = page.path.startsWith("/") ? page.path.slice(1) : page.path;

  return {
    ...page,
    prodUrl: `${PROD_BASE}/${cleanPath}`,
    stageUrl: `${STAGE_BASE}/${cleanPath}`,
  };
});
