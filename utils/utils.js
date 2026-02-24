import fs from "fs";
import path from "path";
import { LANGS, PAGES, BASE_URLS } from "../constants/constants.js";

export const isEmpty = (v) => !v || (Array.isArray(v) && v.length === 0);

export const pathOnly = (url) => new URL(url).pathname;

export const normalizeImages = (images) =>
  images.map((img) => `${pathOnly(img.src)}|${img.alt}|${img.title}`);

export const normalizeHreflangs = (hreflangs) =>
  hreflangs.map((h) => `${h.hreflang}|${pathOnly(h.href)}`);

export function buildUrl(env, pageKey, lang) {
  return `${BASE_URLS[env]}${LANGS[lang]}${PAGES[pageKey][lang]}`;
}

export function getSnapshotPaths({ lang, device, pageKey }) {
  const dir = path.join(process.cwd(), "snapshots", lang, device, pageKey);

  fs.mkdirSync(dir, { recursive: true });

  return {
    dir,
    production: path.join(dir, "production.png"),
    staging: path.join(dir, "staging.png"),
    diff: path.join(dir, "diff.png"),
    diffSeo: path.join(dir, "diffSeo.json"),
  };
}
