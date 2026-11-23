// Builds the folder version (index.html) and the editor (editor.html) from the files in src/.
// Run:  node src/build.mjs        (from the ProductA-Hub folder; Node 18+, no installs needed)
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (p, enc = "utf8") => fs.readFileSync(path.join(root, p), enc);
const b64 = p => fs.readFileSync(path.join(root, p)).toString("base64");
const fill = (tpl, map) => Object.entries(map).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), tpl);
const escClose = s => s.split("</script").join("<\\/script");   // keeps embedded text from ending its own <script> tag

const FONTS = [
  ["light", "gsk-light.woff", 300, "normal"], ["regular", "gsk-regular.woff", 400, "normal"],
  ["italic", "gsk-regularitalic.woff", 400, "italic"], ["bold", "gsk-bold.woff", 700, "normal"]
];
const fontsCss = mode => FONTS.map(([, f, w, st]) =>
  `@font-face { font-family: "GSK"; src: url(${mode === "path" ? "assets/fonts/" + f : "data:font/woff;base64," + b64("assets/fonts/" + f)}) format("woff"); font-weight: ${w}; font-style: ${st}; font-display: swap; }`).join("\n");

const style = read("src/style.css");
const script = read("src/hub.js");
// Shared files never carry the editor's live-preview code; the editor keeps it for its own preview
const sharedScript = script.replace(/\/\*PREVIEW_START\*\/[\s\S]*?\/\*PREVIEW_END\*\//, "");
const template = read("src/template.html");

// 1. Folder version: loads content.js and files from assets/
const index = fill(template, {
  TITLE: "Product A Launch Story",
  FONTS_CSS: fontsCss("path"),
  STYLE: style,
  LIBS: '<script src="lib/pdf-lib.min.js"></script>',
  CONTENT: '<script src="content.js"></script>',
  SCRIPT: sharedScript
});
fs.writeFileSync(path.join(root, "index.html"), index);
// The same page for the exported website folder: the editor fills in {{CONTENT}} (the content is inside the page, no content.js)
const siteIndex = fill(template, { TITLE: "Product A Launch Story", FONTS_CSS: fontsCss("path"), STYLE: style, LIBS: '<script src="lib/pdf-lib.min.js"></script>', CONTENT: "{{CONTENT}}", SCRIPT: sharedScript });

if (!fs.existsSync(path.join(root, "src/editor.js"))) { console.log("index.html built (editor sources not found, skipped)"); process.exit(0); }

// 2. Editor: one self-contained file that carries the template, fonts and libraries
//    so it can preview and export fully offline.
// The editor fills these four placeholders itself each time it previews or exports
const tplForEditor = fill(template, { STYLE: style, SCRIPT: script, FONTS_CSS: "{{FONTS_CSS}}", LIBS: "{{LIBS}}", CONTENT: "{{CONTENT}}", TITLE: "{{TITLE}}" });
const editor = fill(read("src/editor.html"), {
  EDITOR_CSS: read("src/editor.css"),
  EDITOR_JS: read("src/editor.js"),
  FONTS_UI: fontsCss("data"),
  TEMPLATE: escClose(tplForEditor),
  SITE_INDEX: escClose(siteIndex),
  LOADER: escClose(read("src/loader.js")),
  FONTS_EXPORT: escClose(fontsCss("data")),
  CONTENT_DEFAULT: escClose(read("content.js")),
  LOGO_PLACEHOLDER: escClose(read("assets/logo/placeholder-logo.svg")),
  PDFLIB: escClose(read("lib/pdf-lib.min.js")),
  PDFJS: escClose(read("src/vendor/pdf.min.js")),
  PDFJS_WORKER: escClose(read("src/vendor/pdf.worker.min.js"))
});
// Each embedded file must stay inside its own <script> element: the number of closing tags must equal the elements in the shell
const expected = (read("src/editor.html").match(/<script[\s>]/gi) || []).length, closes = (editor.match(/<\/script>/gi) || []).length;
if (expected !== closes) throw new Error(`editor.html should have ${expected} closing script tags but has ${closes}: an embedded file contains a stray tag.`);
const dbl = (editor.match(/<!--/g) || []).length; if (dbl) throw new Error(`editor.html contains ${dbl} "<!--" sequences, which can confuse the HTML parser inside scripts.`);
// editor.html is the editable working page: the site with a hidden editor inside it, opened straight into the editor.
const MARK = "</scr@@ipt";
const payload = editor.split("</script").join(MARK);
const seed = (() => { const w = {}; new Function("window", read("content.js"))(w); const h = w.HUB; for (const d of [h.core, ...h.modules]) { d.pdf = ""; d.images = []; } h.brand.logo = "data:image/svg+xml;base64," + Buffer.from(read("assets/logo/placeholder-logo.svg")).toString("base64"); return h; })();
const contentTag = '<script>window.__AUTO_EDIT = true; window.HUB = ' + JSON.stringify(seed).split("</").join("<\\/") + ';</script>';
const working = fill(siteIndex, {CONTENT: contentTag}).replace(/<\/body>(?![\s\S]*<\/body>)/, () => '<script>' + read("src/loader.js") + '</script>\n<script type="text/plain" id="edHtml">' + payload + '</script>\n</body>');
const outer = working.replace(payload, "");
const wExpected = (outer.match(/<script[\s>]/gi) || []).length, wCloses = (outer.match(/<\/script>/gi) || []).length;
if (wExpected !== wCloses) throw new Error(`working page has ${wExpected} script tags but ${wCloses} closing tags.`);
fs.writeFileSync(path.join(root, "editor.html"), working);
console.log("index.html", (index.length / 1024).toFixed(0) + " KB;", "editor.html", (working.length / 1024 / 1024).toFixed(2) + " MB");
