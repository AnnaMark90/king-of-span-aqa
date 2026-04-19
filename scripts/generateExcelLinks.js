import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const CONFIG = {
  inputExcel: path.resolve(process.cwd(), "testDataExcel/migrationTable.xlsx"),
  outputDir: path.resolve(process.cwd(), "dataBatches"),
  targetColumn: 3,
  headerRow: 1,
  basePathToRemove: "/kingspan-dep/",
};

const isCellColored = (cell) => {
  const fill = cell?.fill;
  const hex = fill?.fgColor?.argb?.toUpperCase();

  return (
    fill?.type === "pattern" &&
    fill?.pattern === "solid" &&
    !!hex &&
    !["FFFFFFFF", "00FFFFFF"].includes(hex)
  );
};

const getValidPathname = (cell) => {
  const v = cell?.value;
  if (!v) return null;

  const rawUrl =
    v?.richText?.map((rt) => rt.text).join("") ??
    v?.hyperlink ??
    (typeof v === "string" ? v : null) ??
    cell?.text ??
    v?.toString() ??
    "";

  const url = String(rawUrl).trim();

  if (["undefined", "null", ""].includes(url)) return null;

  try {
    const { pathname } = new URL(url);
    return pathname.startsWith(CONFIG.basePathToRemove)
      ? pathname.replace(new RegExp(`^${CONFIG.basePathToRemove}`), "/")
      : pathname;
  } catch {
    return null;
  }
};

async function generateLinks() {
  const { inputExcel, outputDir, targetColumn, headerRow } = CONFIG;
  const targetTabs = process.argv.slice(2);

  if (!fs.existsSync(inputExcel)) {
    console.error(`[ERROR] Файл не найден: ${inputExcel}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputExcel);

  workbook.eachSheet((worksheet) => {
    const localeName = worksheet.name.trim();

    if (targetTabs.length && !targetTabs.includes(localeName)) return;

    const validPaths = [];

    worksheet.eachRow((row, rowNumber) => {
      const cell = row.getCell(targetColumn);

      if (rowNumber === headerRow || isCellColored(cell)) return;

      const cleanPath = getValidPathname(cell);
      cleanPath && validPaths.push(cleanPath);
    });

    if (validPaths.length) {
      const outputPath = path.join(outputDir, `${localeName}.txt`);
      fs.writeFileSync(outputPath, validPaths.join("\n"), "utf-8");
      console.log(
        `[SUCCESS] ${localeName}: сгенерировано ${validPaths.length} ссылок -> ${outputPath}`,
      );
    } else {
      console.log(`[INFO] ${localeName}: пропущена (нет валидных ссылок).`);
    }
  });
}

generateLinks().catch(console.error);
