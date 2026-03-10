import fs from "fs";
import path from "path";

export const isEmpty = (v) => !v || (Array.isArray(v) && v.length === 0);

export const pathOnly = (url) => {
  if (!url || url === "Missing") return "/";
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
};

export const normalizePath = (p) => {
  if (!p || p === "Missing" || p === "Empty") return p;
  let cleanPath = p.replace(/\/{2,}/g, "/");
  return cleanPath.endsWith("/") && cleanPath !== "/"
    ? cleanPath.slice(0, -1)
    : cleanPath;
};

export const pathOnlySafe = (url) => {
  if (!url || url === "Missing" || url === "" || url === "Empty") {
    return "Empty";
  }
  try {
    const u = new URL(url, "https://www.kingspan.com");
    const pathname = u.pathname;
    return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
};

export const normalizeImages = (images) => {
  if (!images || !Array.isArray(images)) return [];
  // "путь_к_файлу|текст_alt|текст_title"
  return images
    .map((img) => {
      let cleanSrc = "Missing Src";

      if (img.src && img.src !== "Missing" && img.src !== "Empty") {
        try {
          const urlObj = new URL(img.src, "https://base.com");
          cleanSrc = urlObj.pathname;
        } catch (e) {
          cleanSrc = img.src;
        }
      }

      const alt = img.alt || "";
      const title = img.title || "";
      return `${cleanSrc}|${alt}|${title}`;
    })
    .sort();
};

export const normalizeHreflangs = (hreflangs) =>
  hreflangs.map((h) => `${h.lang}|${pathOnlySafe(h.href)}`);

export function getSnapshotPaths({ lang, device, pageKey }) {
  const dir = path.join(process.cwd(), "snapshots", lang, device, pageKey);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return {
    dir,
    production: path.join(dir, "production.png"),
    staging: path.join(dir, "staging.png"),
    diff: path.join(dir, "diff.png"),
    diffSeo: path.join(dir, "diffSeo.json"),
  };
}
