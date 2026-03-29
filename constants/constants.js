import fs from "fs";
import path from "path";

export const PROD_BASE = "https://www.kingspan.com";
export const STAGE_BASE = "https://d25x3lb2mhyb8n.cloudfront.net/kingspan-dep";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
export const getStatusText = (status) => {
  const codes = {
    200: "Successful",
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

console.log("Batch Name:", {
  npm: process.env.npm_config_batch,
  env: process.env.BATCH,
});

const batchName = (
  process.env.npm_config_batch ||
  process.env.BATCH ||
  "testRun"
).trim();

const filePath = path.resolve(process.cwd(), `dataBatches/${batchName}.txt`);

if (!fs.existsSync(filePath)) {
  throw new Error(
    `Файл не найден: ${filePath}. Убедитесь, что он есть в папке dataBatches.`,
  );
}

const rawPaths = fs
  .readFileSync(filePath, "utf-8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

export const TEST_PAGES = rawPaths.map((rawPath) => {
  const cleanPath = rawPath.replace(/^\/+|\/+$/g, "").trim();
  const parts = cleanPath.split("/").filter(Boolean);

  return {
    lang: parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "default",
    pageKey: parts.slice(2).join("/") || "home",
    path: cleanPath,
    prodUrl: `${PROD_BASE}/${cleanPath}`,
    stageUrl: `${STAGE_BASE}/${cleanPath}`,
  };
});
