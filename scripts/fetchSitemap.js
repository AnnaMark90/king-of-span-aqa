import fs from "fs";
import path from "path";

const sitemapUrl =
  process.argv[2] || "https://www.kingspan.com/ie/en/sitemap.xml";

let batchName = process.argv[3];
if (!batchName) {
  const match = sitemapUrl.match(/\.com\/([a-z]{2})\/([a-z]{2})\//);
  batchName = match ? `${match[1]}_${match[2]}` : "sitemap_links";
}

async function fetchAndParse() {
  try {
    const response = await fetch(sitemapUrl);
    if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);

    const xmlText = await response.text();
    console.log(`Объем скачанного XML: ${xmlText.length} символов`);

    const matches = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/g)];
    const cleanPaths = matches.map((match) =>
      match[1].replace(/^https?:\/\/[^\/]+/, "").trim(),
    );

    const uniquePaths = [...new Set(cleanPaths)].filter((link) =>
      link.startsWith("/"),
    );
    const outputDir = path.resolve(process.cwd(), "dataBatches");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `${batchName}.txt`);
    fs.writeFileSync(outputPath, uniquePaths.join("\n"), "utf-8");

    console.log(`Файл успешно сохранен: dataBatches/${batchName}.txt`);
    console.log(`Количество ссылок для тестов: ${uniquePaths.length}`);
  } catch (error) {
    console.error(`\n Ошибка на этапе выполнения:`, error.message);
  }
}

fetchAndParse();
