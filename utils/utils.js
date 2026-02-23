import path from "path";
import fs from "fs";
import { LANGS, PAGES, BASE_URLS } from "../constants/constants.js";

export function buildUrl(env, pageKey, lang) {
  return `${BASE_URLS[env]}${LANGS[lang]}${PAGES[pageKey][lang]}`;
}

export function getSnapshotPaths({ lang, device, pageKey }) {
  const dir = path.join("snapshots", lang, device, pageKey);
  fs.mkdirSync(dir, { recursive: true });

  return {
    production: path.join(dir, "production.png"),
    staging: path.join(dir, "staging.png"),
    diff: path.join(dir, "diff.png"),
  };
}
