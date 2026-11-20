#!/usr/bin/env node
// Screenshots of the Angular baseline and variants A–D at the same window size, for reports.
//   node scripts/screenshots.mjs            → screenshots/*.png
// Needs the stack (Angular on :4200) and the four dev servers (npm run dev:a … dev:d) running.
// Uses the system Chrome headless with a throwaway profile.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const PAGES = [
  { file: "0-angular-baseline.png", url: "http://localhost:4200/home" },
  { file: "a-react-antd-react-router.png", url: "http://localhost:5171/" },
  { file: "b-react-shadcn-react-router.png", url: "http://localhost:5172/" },
  { file: "c-react-shadcn-tanstack-router.png", url: "http://localhost:5173/" },
  { file: "d-solid-shadcn-style-tanstack-router.png", url: "http://localhost:5174/" },
];

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "screenshots");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? execSync("command -v google-chrome", { encoding: "utf8" }).trim(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const { file, url } of PAGES) {
  await page.goto(url, { waitUntil: "networkidle" });
  // the first card section is the last thing to arrive (getTops + enrichment)
  await page.getByText("Top Loved Workflows").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500); // covers, avatars and fonts settle
  await page.screenshot({ path: join(out, file) });
  console.log(`saved screenshots/${file}`);
}
await browser.close();
