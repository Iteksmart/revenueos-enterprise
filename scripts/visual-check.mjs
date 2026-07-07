import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const outputDir = "artifacts";
const targetUrl = process.env.VISUAL_CHECK_URL || "http://127.0.0.1:3100";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const viewport of [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 1200 },
]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outputDir}/revenueos-${viewport.name}.png`, fullPage: true });
  const issues = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    return [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: String(element.className),
          text: (element.textContent || "").trim().slice(0, 100),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.width > 0 && item.height > 0 && (item.left < -1 || item.right > viewportWidth + 1))
      .slice(0, 20);
  });
  await writeFile(`${outputDir}/revenueos-${viewport.name}-overflow.json`, JSON.stringify(issues, null, 2));
  await page.close();
}

await browser.close();
