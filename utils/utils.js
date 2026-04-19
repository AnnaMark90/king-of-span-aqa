import fs from "fs";
import path from "path";

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

  return images
    .map((img) => {
      const nameOrSrc = img.filename || img.src || "**Missing**";
      const alt = img.alt || "**Missing**";
      const title = img.title || "**Missing**";

      return `${nameOrSrc} | alt: ${alt} | title: ${title}`;
    })
    .sort();
};

export const normalizeHreflangs = (hreflangs) =>
  hreflangs.map((h) => `${h.lang}|${pathOnlySafe(h.href)}`);

export function getSnapshotPaths({ lang, device, pageKey }) {
  const safePageKey = (pageKey || "home")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[<>:"\\|?*]/g, "_"))
    .join(path.sep);
  const dir = path.join(process.cwd(), "snapshots", lang, device, safePageKey);

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
