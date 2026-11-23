// Developer tool: makes placeholder PDFs (assets/pdfs) and page pictures (assets/pages) from content.js,
// so the hub and the editor can be tried before real artwork exists.
// Needs Playwright:  SCRATCH=/some/temp/folder NODE_PATH=$(npm root -g) node src/make-samples.mjs
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const tmp = process.env.SCRATCH || path.join(root, "src");   // where the temporary HTML pages are written
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), ctx);
const HUB = ctx.window.HUB;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const font = (f, w, st) => `@font-face{font-family:"GSK";src:url("file://${root}/assets/fonts/${f}");font-weight:${w};font-style:${st}}`;

function pagesFor(d, isCore) {
  const n = d.pages, out = [];
  if (isCore) {
    out.push(`<div class="cover"><div class="bar"></div><p class="kick">${esc(HUB.hero.eyebrow)}</p><h1>${esc(d.name)}</h1><p class="big">${esc(d.draftIntro)}</p><p class="small">${esc(d.draftNote)}</p></div>`);
    const ch = HUB.chapters, per = Math.ceil(ch.length / Math.max(1, n - 2));
    for (let i = 0; i < n - 2; i++) out.push(ch.slice(i * per, i * per + per).map(c => `<h2>${esc(c.title)}</h2><p class="big">${md(c.lead)}</p><div class="facts">${c.facts.map(f => `<div><span>${esc(f[0])}</span><b>${esc(f[1])}</b></div>`).join("")}</div>`).join(""));
    out.push(`<h2>Timeline</h2>${HUB.timeline.items.map(i => `<div class="ms"><b>${esc(i.when)}</b> ${esc(i.what)}</div>`).join("")}<p class="small" style="margin-top:14mm">${(HUB.legal.paragraphs || []).map(esc).join(" ")}</p>`);
    return out.slice(0, n);
  }
  out.push(`<p class="kick">${esc(d.name)}</p><h1>${esc(d.question)}</h1>${d.intro ? `<p class="big">${md(d.intro)}</p>` : ""}${d.facts.length ? `<div class="facts">${d.facts.map(f => `<div><span>${esc(f[0])}</span><b>${esc(f[1])}</b></div>`).join("")}</div>` : ""}`);
  const pts = d.points, per = Math.ceil(pts.length / Math.max(1, n - 1));
  for (let i = 0; i < n - 1; i++) out.push(`${d.pointsTitle ? `<h2>${esc(d.pointsTitle)}</h2>` : ""}<ul>${pts.slice(i * per, i * per + per).map(p => `<li>${md(p)}</li>`).join("")}</ul>`);
  if (n === 1) out[0] += `${d.pointsTitle ? `<h2>${esc(d.pointsTitle)}</h2>` : ""}<ul>${pts.map(p => `<li>${md(p)}</li>`).join("")}</ul>`;
  return out;
}
function docHtml(d, isCore) {
  const pages = pagesFor(d, isCore);
  return `<!doctype html><meta charset="utf-8"><style>${font("gsk-light.woff", 300, "normal")}${font("gsk-regular.woff", 400, "normal")}${font("gsk-bold.woff", 700, "normal")}
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:GSK,Arial,sans-serif;color:#0d0e0f}
.page{width:210mm;height:297mm;padding:18mm 18mm 16mm;position:relative;page-break-after:always;overflow:hidden;display:grid;grid-template-rows:auto 1fr auto;gap:10mm;background:#fff}
.top,.foot{display:flex;justify-content:space-between;font-size:8.5pt;color:#5c6166;letter-spacing:.06em;text-transform:uppercase;font-weight:700}.top{border-bottom:1px solid #e1e3e5;padding-bottom:4mm}.foot{border-top:1px solid #e1e3e5;padding-top:4mm;font-size:7.5pt}
.dot{display:inline-block;width:3mm;height:3mm;border-radius:50%;background:#f36633;margin-right:2mm}
.body{align-self:start}h1{font-size:30pt;line-height:1.02;letter-spacing:-.02em;margin:0 0 8mm}h2{font-size:17pt;margin:8mm 0 3mm}.kick{color:#b9461c;font-size:9pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin:0 0 4mm}
.big{font-size:12.5pt;line-height:1.45;margin:0 0 6mm;max-width:150mm}.small{font-size:9pt;color:#5c6166}ul{padding-left:5mm;font-size:11.5pt;line-height:1.5}li{margin-bottom:3mm}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:6mm 0}.facts div{background:#f0f1f2;border-radius:3mm;padding:4mm}.facts span{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;color:#5c6166;font-weight:700}.facts b{font-size:11pt}
.cover{padding-top:50mm}.cover .bar{width:22mm;height:2.4mm;background:#f36633;border-radius:1mm;margin-bottom:8mm}.cover h1{font-size:44pt}.ms{padding:3mm 0;border-bottom:1px solid #e1e3e5;font-size:11pt}
.stamp{position:absolute;left:50%;bottom:30mm;transform:translateX(-50%) rotate(-6deg);border:.7mm dashed #c9ccd0;color:#8a8f94;padding:3mm 8mm;border-radius:3mm;font-size:11pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase}</style>
${pages.map((p, i) => `<section class="page"><div class="top"><span><i class="dot"></i>${esc(HUB.brand.productName)}</span><span>${esc(d.name)}</span></div><div class="body">${p}</div><div class="foot"><span>Job code ${esc(HUB.brand.jobCode)} · ${esc(d.code)}</span><span>Page ${i + 1} of ${pages.length}</span></div><div class="stamp">Placeholder · replace with approved artwork</div></section>`).join("")}`;
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const docs = [[HUB.core, true], ...HUB.modules.map(m => [m, false])];
for (const [d, isCore] of docs) {
  const f = path.join(tmp, d.code + ".html"); fs.writeFileSync(f, docHtml(d, isCore));
  const p = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
  await p.goto("file://" + f); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(root, "assets/pdfs", d.code + ".pdf"), width: "210mm", height: "297mm", printBackground: true });
  const els = await p.$$(".page");
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(root, "assets/pages", `${d.code}-${i + 1}.jpg`), type: "jpeg", quality: 82 });
  console.log(d.code, els.length, "pages");
  await p.close();
}
await browser.close();
