import fs from "fs";
import { expect } from "@playwright/test";
import path from "path";
import {
  normalizeHreflangs,
  normalizeImages,
  pathOnlySafe,
  normalizePath,
} from "../utils/utils.js";

export async function compareFormsData(
  prodForms,
  stageForms,
  reportPath,
  testInfo,
) {
  const diffs = [];
  const prodIds = prodForms.map((f) => f.formId || "no-id").join(", ");
  const stageIds = stageForms.map((f) => f.formId || "no-id").join(", ");

  prodForms.length !== stageForms.length &&
    diffs.push(
      `Forms count mismatch: Prod(${prodForms.length}) vs Stage(${stageForms.length}). Prod IDs: [${prodIds}]. Stage IDs: [${stageIds}]`,
    );

  stageForms.forEach((sForm, i) => {
    const pForm =
      prodForms.find((p) => p.formId === sForm.formId) || prodForms[i];
    if (!pForm) return;

    sForm.action !== pForm.action &&
      diffs.push(
        `Form ${sForm.formId || i}: Action URL changed from '${pForm.action}' to '${sForm.action}'`,
      );

    if (sForm.fields.length !== pForm.fields.length) {
      return diffs.push(
        `Form ${sForm.formId || i}: Fields count mismatch. Prod(${pForm.fields.length}) vs Stage(${sForm.fields.length})`,
      );
    }

    sForm.fields.forEach((sField, j) => {
      const pField = pForm.fields[j];
      (sField.name !== pField.name || sField.type !== pField.type) &&
        diffs.push(
          `Form ${sForm.formId}: Field mismatch at index ${j}. Prod(${pField.name}/${pField.type}) vs Stage(${sField.name}/${sField.type})`,
        );
    });
  });

  const missingOnStage = prodForms.filter(
    (p) => !stageForms.find((s) => s.formId === p.formId),
  );
  const missingOnProd = stageForms.filter(
    (s) => !prodForms.find((p) => p.formId === s.formId),
  );

  if (diffs.length > 0 && reportPath && testInfo) {
    const dir = path.dirname(reportPath);
    !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });

    const jsonContent = JSON.stringify(
      {
        errors: diffs,
        missingOnStage,
        missingOnProd,
        prodFormsData: prodForms,
        stageFormsData: stageForms,
      },
      null,
      2,
    );
    fs.writeFileSync(reportPath, jsonContent);
    testInfo
      .attach("forms-report.json", {
        body: jsonContent,
        contentType: "application/json",
      })
      .catch(() => {});
  }
  return diffs;
}

export async function compareEnvsSeo({
  prodSeo,
  stageSeo,
  prodUrl,
  stageUrl,
  diffSeoPath,
  testInfo,
}) {
  const diff = {};

  const addDiff = (key, expected, actual) => {
    const safeExpected =
      expected === null || expected === undefined ? "**MISSING**" : expected;
    const safeActual =
      actual === null || actual === undefined ? "**MISSING**" : actual;

    if (JSON.stringify(safeExpected) !== JSON.stringify(safeActual)) {
      diff[key] = {
        expected: safeExpected,
        actual: safeActual,
      };
    }
  };

  addDiff("htmlTitle", prodSeo?.htmlTitle, stageSeo?.htmlTitle);
  addDiff("metaTitle", prodSeo?.meta?.title, stageSeo?.meta?.title);
  addDiff("ogTitle", prodSeo?.meta?.ogTitle, stageSeo?.meta?.ogTitle);
  addDiff(
    "description",
    prodSeo?.meta?.description,
    stageSeo?.meta?.description,
  );
  addDiff("texts", prodSeo?.texts, stageSeo?.texts);
  addDiff(
    "listItemsCount",
    prodSeo?.structure?.listItemsCount,
    stageSeo?.structure?.listItemsCount,
  );
  addDiff(
    "tableRowsCount",
    prodSeo?.structure?.tableRowsCount,
    stageSeo?.structure?.tableRowsCount,
  );
  addDiff("robots", prodSeo?.meta?.robots, stageSeo?.meta?.robots);
  addDiff("ogImage", prodSeo?.meta?.ogImage, stageSeo?.meta?.ogImage);
  addDiff("ogUrl", prodSeo?.meta?.ogUrl, stageSeo?.meta?.ogUrl);
  addDiff("schema", prodSeo?.schema, stageSeo?.schema);

  const prodCanonicalPath = normalizePath(
    pathOnlySafe(prodSeo?.meta?.canonical),
  );
  const stageCanonicalPath = normalizePath(
    pathOnlySafe(stageSeo?.meta?.canonical),
  );
  const expectedProdPath = normalizePath(pathOnlySafe(prodUrl));
  const expectedStagePath = normalizePath(pathOnlySafe(stageUrl));

  if (prodCanonicalPath !== stageCanonicalPath) {
    diff["canonicalMatch"] = {
      expected: prodCanonicalPath,
      actual: stageCanonicalPath,
    };
  }

  addDiff("canonicalProdSelf", expectedProdPath, prodCanonicalPath);
  addDiff("canonicalStageSelf", expectedStagePath, stageCanonicalPath);

  const normProdImages = normalizeImages(prodSeo?.images || []);
  const normStageImages = normalizeImages(stageSeo?.images || []);
  addDiff("images", normProdImages, normStageImages);

  const normProdHreflangs = normalizeHreflangs(prodSeo?.meta?.hreflangs || []);
  const normStageHreflangs = normalizeHreflangs(
    stageSeo?.meta?.hreflangs || [],
  );
  addDiff("hreflangs", normProdHreflangs, normStageHreflangs);

  const hasDiffs = Object.keys(diff).length > 0;

  if (hasDiffs) {
    const jsonContent = JSON.stringify(diff, null, 2);
    const dir = path.dirname(diffSeoPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(diffSeoPath, jsonContent, "utf-8");

    if (testInfo) {
      await testInfo.attach("diffSeo.json", {
        body: jsonContent,
        contentType: "application/json",
      });
    }

    for (const [key, value] of Object.entries(diff)) {
      expect.soft(value.actual, `SEO Mismatch: ${key}`).toEqual(value.expected);
    }

    expect(
      hasDiffs,
      `SEO differences found: ${Object.keys(diff).join(", ")}`,
    ).toBe(false);
  }
}

export async function compareLinksData(prodLinks = [], stageLinks = []) {
  const diffs = [];

  const cleanProd = [...new Set(prodLinks.map(pathOnlySafe))].sort();
  const cleanStage = [...new Set(stageLinks.map(pathOnlySafe))].sort();

  if (cleanProd.length !== cleanStage.length) {
    diffs.push(
      `Links count mismatch: Prod has ${cleanProd.length} links, Stage has ${cleanStage.length} links.`,
    );
  }

  const missingOnStage = cleanProd.filter((link) => !cleanStage.includes(link));
  if (missingOnStage.length > 0) {
    diffs.push(
      `Missing links on Stage: ${missingOnStage.slice(0, 10).join(", ")} ${missingOnStage.length > 10 ? "..." : ""}`,
    );
  }

  return diffs;
}
