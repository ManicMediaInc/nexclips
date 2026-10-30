import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "public", "config.js");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(configPath, "utf8"), context);
const siteUrl = String(context.window.NEX_CONFIG.siteUrl || "").replace(/\/+$/, "");
if (!siteUrl) {
  console.error("siteUrl is missing from public/config.js");
  process.exit(1);
}

const pages = ["/"];
const today = new Date().toISOString().slice(0, 10);
const urls = pages
  .map((page) => {
    const loc = page === "/" ? `${siteUrl}/` : `${siteUrl}${page}`;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
  })
  .join("\n");

const robots = `# Generated from public/config.js by scripts/generate-seo.mjs. Do not edit by hand.\nUser-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generated from public/config.js by scripts/generate-seo.mjs. Do not edit by hand. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

fs.writeFileSync(path.join(root, "public", "robots.txt"), robots);
fs.writeFileSync(path.join(root, "public", "sitemap.xml"), sitemap);

const absoluteTags = [
  [/property="og:url" content="[^"]*"/, `property="og:url" content="${siteUrl}/"`],
  [/property="og:image" content="[^"]*"/, `property="og:image" content="${siteUrl}/og-image-1200x630.png"`],
  [/name="twitter:image" content="[^"]*"/, `name="twitter:image" content="${siteUrl}/twitter-image-1200x600.png"`],
];

function htmlFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

const pagesOnDisk = htmlFiles(path.join(root, "public"));
if (!pagesOnDisk.length) {
  console.error("no HTML pages under public/");
  process.exit(1);
}
for (const file of pagesOnDisk) {
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes("<head")) continue;
  for (const [pattern, value] of absoluteTags) {
    if (!pattern.test(html)) {
      console.error(`missing ${pattern} in ${path.relative(root, file)}`);
      process.exit(1);
    }
    html = html.replace(pattern, value);
  }
  fs.writeFileSync(file, html);
}
console.log(`wrote robots.txt, sitemap.xml, and absolute social URLs for ${siteUrl}`);
