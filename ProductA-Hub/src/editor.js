/* Hub editor: forms for every part of the content, live preview, PDF and logo drop-in, and export to one offline file. */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = s => String(s || "hub").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hub";
const clone = o => JSON.parse(JSON.stringify(o));
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const uriBytes = u => Math.round((u.length - u.indexOf(",") - 1) * 0.75);
const isData = u => typeof u === "string" && u.startsWith("data:");

/* ---------- Embedded resources ---------- */
const SCRIPT_OPEN = "<" + "script", SCRIPT_CLOSE = "<" + "/script>";
const T = id => document.getElementById(id).textContent.split("<\\" + "/script").join("<" + "/script");
const TPL = T("tpl"), FONTS_EXPORT = T("fontsExport"), CONTENT_DEFAULT = T("contentDefault"), LOGO_SVG = T("logoPlaceholder");
const PDFLIB_SRC = document.getElementById("pdflib").textContent;
const svgUri = svg => "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
function parseJs(text) { const w = {}; new Function("window", text)(w); if (!w.HUB) throw new Error("No window.HUB found in that file."); return w.HUB; }

/* The sample content has no files (they live in the folder version); the editor starts with a placeholder logo */
const DEFAULT = (() => {
  const h = parseJs(CONTENT_DEFAULT);
  for (const d of [h.core, ...h.modules]) { d.pdf = ""; d.images = []; }
  h.brand.logo = svgUri(LOGO_SVG);
  return h;
})();

/* ---------- State ---------- */
let C = clone(DEFAULT);
let dirty = false;
let section = "brand";
const getP = (path, root = C) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), root);
function setP(path, val) {
  const keys = path.split("."), last = keys.pop();
  let o = C; for (const k of keys) { if (o[k] == null) o[k] = {}; o = o[k]; }
  o[last] = val;
}
function ensureArr(path) {
  const keys = path.split("."), last = keys.pop();
  let o = C; for (const k of keys) { if (o[k] == null) o[k] = {}; o = o[k]; }
  if (!Array.isArray(o[last])) o[last] = [];
  return o[last];
}
function normalize(c) {
  const out = clone(DEFAULT);
  for (const k of Object.keys(c)) {
    if (c[k] && typeof c[k] === "object" && !Array.isArray(c[k]) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) out[k] = Object.assign(out[k], c[k]);
    else out[k] = c[k];
  }
  for (const d of [out.core, ...out.modules]) { d.pdf = d.pdf || ""; d.images = d.images || []; d.facts = d.facts || []; d.points = d.points || []; }
  out.brand.fonts = out.brand.fonts || {};
  return out;
}
const modules = () => C.modules || [];
const docs = () => [{ id: "core", name: C.core.name, path: "core" }, ...modules().map((m, i) => ({ id: m.id, name: m.name, path: "modules." + i }))];

/* ---------- Status line ---------- */
let statusTimer;
function status(msg, kind = "", ms = 0) {
  const el = $("#status"); el.className = "statusbar " + kind; $("#statusText").textContent = msg;
  clearTimeout(statusTimer); if (ms) statusTimer = setTimeout(() => status("Ready. Changes show in the preview straight away. Save your project before closing this page."), ms);
}

/* ---------- Preview ---------- */
const frame = $("#preview");
let frameReady = false, sendTimer;
function fillTemplate(content, forExport) {
  const json = JSON.stringify(content).split("</").join("<\\/");
  const libs = `${SCRIPT_OPEN}>${PDFLIB_SRC}${SCRIPT_CLOSE}` + (forExport && content.veeva && content.veeva.include ? `\n${SCRIPT_OPEN} src="veeva-library.js">${SCRIPT_CLOSE}` : "");
  const map = { TITLE: esc(content.brand.pageTitle || content.brand.productName + " launch story"), FONTS_CSS: FONTS_EXPORT, LIBS: libs, CONTENT: `${SCRIPT_OPEN}>window.HUB = ${json};${SCRIPT_CLOSE}` };
  return Object.entries(map).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), TPL);
}
function reloadPreview() { frameReady = false; frame.onload = () => { frameReady = true; }; frame.srcdoc = fillTemplate(C, false); }
function touch() { dirty = true; updateSide(); clearTimeout(sendTimer); sendTimer = setTimeout(() => { if (frameReady) frame.contentWindow.postMessage({ type: "hub-content", content: C }, "*"); }, 350); }
function gotoPreview(id) { if (frameReady) frame.contentWindow.postMessage({ type: "hub-goto", id }, "*"); }

/* ---------- Form building blocks ---------- */
const ph = path => `data-path="${path}"`;
const fText = (label, path, o = {}) => `<label class="f"><span>${label}</span><input type="text" ${ph(path)} value="${esc(getP(path))}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}>${o.hint ? `<em>${o.hint}</em>` : ""}</label>`;
const fArea = (label, path, o = {}) => `<label class="f"><span>${label}</span><textarea ${ph(path)} rows="${o.rows || 3}">${esc(getP(path))}</textarea>${o.hint ? `<em>${o.hint}</em>` : ""}</label>`;
const fNum = (label, path, o = {}) => `<label class="f"><span>${label}</span><input type="number" data-type="num" min="${o.min == null ? 0 : o.min}" ${ph(path)} value="${esc(getP(path))}"${o.dis ? " disabled" : ""}>${o.hint ? `<em>${o.hint}</em>` : ""}</label>`;
const fCheck = (label, path, hint) => `<label class="checkrow"><input type="checkbox" data-type="bool" ${ph(path)} ${getP(path) ? "checked" : ""}>${label}</label>${hint ? `<p class="small" style="margin:-6px 0 12px">${hint}</p>` : ""}`;
const fSel = (label, path, opts) => `<label class="f"><span>${label}</span><select ${ph(path)}>${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(getP(path) ?? "") === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
const modOpts = (none = "None") => [["", none], ...modules().map(m => [m.id, m.name])];
const fColor = (label, path, hint) => `<div class="f"><span>${label}</span><div class="colorrow"><input type="color" ${ph(path)} value="${esc(getP(path) || "#f36633")}" aria-label="${label} picker"><input type="text" ${ph(path)} value="${esc(getP(path))}" aria-label="${label} hex"></div>${hint ? `<em>${hint}</em>` : ""}</div>`;
const ctl = (arr, i, n, noDel) => `<span class="ctl"><button class="ib" type="button" data-act="up" data-arr="${arr}" data-i="${i}" title="Move up" ${i === 0 ? "disabled" : ""}>▲</button><button class="ib" type="button" data-act="down" data-arr="${arr}" data-i="${i}" title="Move down" ${i === n - 1 ? "disabled" : ""}>▼</button>${noDel ? "" : `<button class="ib del" type="button" data-act="del" data-arr="${arr}" data-i="${i}" title="Remove">✕</button>`}</span>`;
const addBtn = (arr, kind, text) => `<button class="addbtn" type="button" data-act="add" data-arr="${arr}" data-kind="${kind}">+ ${text}</button>`;
function cards(arr, kind, addText, title, body, o = {}) {
  const list = getP(arr) || [];
  return list.map((it, i) => `<div class="card"><div class="card-h"><b>${esc(title(it, i))}</b>${ctl(arr, i, list.length, o.noDel && list.length <= o.noDel)}</div>${body(it, i, `${arr}.${i}`)}</div>`).join("") + addBtn(arr, kind, addText);
}
function pairs(path, labels = ["Label", "Value"]) {
  const list = getP(path) || [];
  return `<div class="pairs">${list.map((p, i) => `<div class="pair"><input type="text" ${ph(path + "." + i + ".0")} value="${esc(p[0])}" placeholder="${labels[0]}" aria-label="${labels[0]}"><input type="text" ${ph(path + "." + i + ".1")} value="${esc(p[1])}" placeholder="${labels[1]}" aria-label="${labels[1]}"><span class="ctl"><button class="ib del" type="button" data-act="del" data-arr="${path}" data-i="${i}" title="Remove">✕</button></span></div>`).join("")}${addBtn(path, "pair", "Add row")}</div>`;
}
function strs(path, ph_ = "", rows = 2) {
  const list = getP(path) || [];
  return `<div class="strs">${list.map((s, i) => `<div class="str"><textarea rows="${rows}" ${ph(path + "." + i)} placeholder="${esc(ph_)}">${esc(s)}</textarea>${ctl(path, i, list.length)}</div>`).join("")}${addBtn(path, "str", "Add")}</div>`;
}
/* An ordered list of ids (recommended modules, chapter priority) with a dropdown to add more */
function orderedIds(path, options, nameOf) {
  const ids = (getP(path) || []).filter(id => options.some(o => o.id === id));
  const rest = options.filter(o => !ids.includes(o.id));
  return `<div class="chips">${ids.map((id, i) => `<div class="chip"><span>${esc(nameOf(id))}</span>${ctl(path, i, ids.length)}</div>`).join("") || '<div class="chips-empty">None yet</div>'}</div>${rest.length ? `<select class="addsel" data-addto="${path}" aria-label="Add"><option value="">+ Add…</option>${rest.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}</select>` : ""}`;
}
const frameSection = (title, intro, body) => `<h1>${title}</h1><p class="intro">${intro}</p>${body}`;

/* File slots */
function slot(kind, path, label, accept, o = {}) {
  const d = getP(path);
  let statusHtml, body = "";
  if (kind === "pdf") {
    if (isData(d.pdf)) statusHtml = `<span class="ok">✓ ${esc(d.pdfName || "PDF added")}</span><span>${d.images.length} pages · ${fmtSize(uriBytes(d.pdf))}</span>`;
    else if (d.pdf) statusHtml = `<span class="linked">Linked by path</span><span>${esc(d.pdf)}</span>`;
    else statusHtml = `<span class="none">No PDF yet. Draft pages are shown until you add one.</span>`;
    if (isData(d.pdf) && d.images.length) body = `<div class="thumbs">${d.images.slice(0, 8).map(s => `<img src="${s}" alt="">`).join("")}</div>`;
    const has = !!d.pdf;
    return `<div class="slot" data-slot="pdf" data-path="${path}"><div class="slot-h"><b>${label}</b><span class="slot-b"><label class="sbtn">${has ? "Replace" : "Choose"} PDF<input type="file" accept="${accept}" data-file="pdf" data-path="${path}" hidden></label>${has ? `<button class="sbtn" type="button" data-act="clearPdf" data-path="${path}">Remove</button>` : ""}</span></div><div class="slot-s">${statusHtml}</div>${body}<div class="small">Or drag a PDF onto this box.</div></div>`;
  }
  const val = getP(path);
  if (kind === "logo") {
    statusHtml = val ? `<span class="${isData(val) ? "ok" : "linked"}">${isData(val) ? "✓ Logo added · " + fmtSize(uriBytes(val)) : "Linked by path: " + esc(val)}</span>` : `<span class="none">No logo: a dot and the product name are shown.</span>`;
    body = val ? `<div class="logo-prev"><img src="${esc(val)}" alt="Logo preview"></div>` : "";
  } else {
    statusHtml = val ? `<span class="ok">✓ Font added · ${fmtSize(uriBytes(val))}</span>` : `<span class="none">Using the built-in font.</span>`;
  }
  return `<div class="slot" data-slot="${kind}" data-path="${path}"><div class="slot-h"><b>${label}</b><span class="slot-b"><label class="sbtn">${val ? "Replace" : "Choose"} file<input type="file" accept="${accept}" data-file="${kind}" data-path="${path}" hidden></label>${val ? `<button class="sbtn" type="button" data-act="clearFile" data-path="${path}">Remove</button>` : ""}</span></div><div class="slot-s">${statusHtml}</div>${body}</div>`;
}

/* ---------- Sections ---------- */
const SECTIONS = [
  { id: "brand", title: "Brand and logo", goto: "top", render: () => frameSection("Brand and logo", "The product name, logo, colour and job details shown across the page.",
    `<div class="cols">${fText("Product name", "brand.productName")}${fText("Browser tab title", "brand.pageTitle")}</div>
     <div class="cols">${fText("Job code", "brand.jobCode")}${fText("Date of preparation", "brand.datePrepared")}</div>
     ${fText("Concept label", "brand.mockLabel", { hint: "Shown in the top bar. Leave empty for the approved version." })}
     ${fColor("Brand colour", "brand.accent", "One colour drives buttons, highlights and the timeline. Text colours on it are chosen automatically for contrast.")}
     <h2>Logo</h2>${slot("logo", "brand.logo", "Logo", "image/svg+xml,image/png,image/jpeg,image/webp")}
     <p class="small">SVG is best (sharp at every size). A PNG should be at least 400 pixels wide.</p>
     <h2>Fonts</h2><details><summary>Replace the built-in font (optional)</summary>
     ${slot("font", "brand.fonts.regular", "Regular", ".woff,.woff2,.ttf,.otf")}${slot("font", "brand.fonts.bold", "Bold", ".woff,.woff2,.ttf,.otf")}${slot("font", "brand.fonts.light", "Light", ".woff,.woff2,.ttf,.otf")}${slot("font", "brand.fonts.italic", "Italic", ".woff,.woff2,.ttf,.otf")}
     <p class="small">Check your licence allows the font to be embedded in a file you share. Fonts are embedded so the page works offline.</p></details>`) },
  { id: "hero", title: "Opening screen", goto: "top", render: () => frameSection("Opening screen", "The headline, the intro text and the stakeholder chooser.",
    `${fText("Small heading above the title", "hero.eyebrow")}<h2>Title lines</h2>${strs("hero.titleLines", "Title line", 1)}<p class="small" style="margin:-4px 0 12px">The last line is shown in the brand colour.</p>
     ${fArea("Intro", "hero.lede")}${fArea("Small print", "hero.note")}
     <h2>Stakeholder chooser</h2>${fText("Heading", "builder.title")}${fArea("Text", "builder.intro")}
     <div class="cols">${fText("First row label", "builder.whoLabel")}${fText("Second row label", "builder.engLabel")}</div>
     <div class="cols">${fText("Top bar label (who)", "builder.whoPick")}${fText("Top bar label (type)", "builder.engPick")}</div>
     <div class="cols">${fText("Placeholder (who)", "builder.whoPlaceholder")}${fText("Placeholder (type)", "builder.engPlaceholder")}</div>`) },
  { id: "core", title: "Core notification", goto: "top", render: () => frameSection("Core notification", "The core deliverable. It is included in every pack.",
    `${fText("Name", "core.name")}<div class="cols">${fText("Short name (for small covers)", "core.short")}${fText("PDF code", "core.code")}</div>${fText("Line under the cover", "core.blurb")}
     <h2>PDF</h2>${slot("pdf", "core", "Core notification PDF", "application/pdf")}
     ${fNum("Page count", "core.pages", { dis: isData(C.core.pdf), hint: isData(C.core.pdf) ? "Counted from the PDF." : "Used until a PDF is added." })}
     <h2>Draft cover text</h2><p class="small">Only shown on the draft pages, until the approved PDF is added.</p>${fArea("Intro", "core.draftIntro")}${fArea("Note", "core.draftNote")}`) },
  { id: "people", title: "Stakeholders and engagements", goto: "builder", render: () => frameSection("Stakeholders and engagements", "Who is being engaged, and why. Each choice leads to recommended modules.",
    `<h2>Stakeholders</h2>${cards("stakeholders", "stakeholder", "Add stakeholder", s => s.label || "New stakeholder", (s, i, p) => `<div class="cols">${fText("Name", p + ".label")}${fText("Plural (used in sentences)", p + ".plural")}</div>${fText("Short description", p + ".desc")}`, { noDel: 1 })}
     <h2>Engagement types</h2>${cards("engagements", "engagement", "Add engagement type", s => s.label || "New engagement type", (s, i, p) => `<div class="cols">${fText("Name", p + ".label")}${fText("Short description", p + ".desc")}</div>${fText("Email subject", p + ".subject")}${fArea("Email opening", p + ".intro")}`, { noDel: 1 })}`) },
  { id: "modules", title: "Modules (PDFs)", goto: "pack", render: () => frameSection("Modules", "Each module is one approved PDF that can be added to a pack.",
    `<div class="bulk" data-bulk><b>Drop several PDFs here.</b><br>Each one is matched to a document by its code, for example PA-MOD-02.pdf goes to the module with the code PA-MOD-02.</div>
     ${cards("modules", "module", "Add module", m => m.name || "New module", (m, i, p) => `
       <div class="cols">${fText("Name", p + ".name")}${fText("Short name", p + ".short")}</div>${fText("Question it answers", p + ".question")}
       <div class="cols">${fText("PDF code", p + ".code")}${fNum("Page count", p + ".pages", { dis: isData(m.pdf), hint: isData(m.pdf) ? "Counted from the PDF." : "" })}</div>
       ${slot("pdf", p, "Approved PDF", "application/pdf")}
       <details><summary>Draft page text (shown until the PDF is added)</summary>${fArea("Intro", p + ".intro", { rows: 2, hint: "Use **double asterisks** for bold." })}<h2>Key facts</h2>${pairs(p + ".facts")}${fText("List heading", p + ".pointsTitle")}<h2>List</h2>${strs(p + ".points", "Point", 2)}</details>`)}`) },
  { id: "recommend", title: "Recommendations", goto: "builder", render: () => {
    const st = C.stakeholders || [], en = C.engagements || [], mo = modules();
    const head = `<tr><th></th>${en.map(e => `<th>${esc(e.label)}</th>`).join("")}</tr>`;
    const rows = st.map(s => `<tr><td class="rowh">${esc(s.label)}</td>${en.map(e => `<td>${orderedIds(`recommend.${s.id}.${e.id}`, mo, id => (mo.find(m => m.id === id) || {}).name)}</td>`).join("")}</tr>`).join("");
    return frameSection("Recommendations", "Which modules each choice adds to the pack, in the order they appear. The core notification is always included.", `<div class="matrix"><table>${head}${rows}</table></div>`);
  } },
  { id: "stats", title: "Key figures", goto: "stats", render: () => frameSection("Key figures", "The large numbers shown one at a time while the reader scrolls.",
    `${fText("Section label", "stats.label")}${cards("stats.items", "stat", "Add figure", s => (s.value || "") + (s.suffix || "") + " · " + (s.heading || "New figure"), (s, i, p) => `
      <div class="cols">${fText("Number", p + ".value", { hint: "For example 8,400" })}${fText("Unit or suffix", p + ".suffix", { hint: "For example nd, °C or ×" })}</div>
      <div class="cols">${fSel("Suffix style", p + ".suffixStyle", [["small", "Small"], ["accent", "Large, brand colour"]])}<div>${fCheck("Count up", p + ".countUp", "Only for plain numbers.")}</div></div>
      ${fText("Heading", p + ".heading")}${fArea("Text", p + ".text", { rows: 2 })}${fSel("Offer this module", p + ".module", modOpts("No module"))}`)}`) },
  { id: "story", title: "Story chapters", goto: "story", render: () => {
    const flex = (C.chapters || []).filter(c => !c.pin).map(c => ({ id: c.id, name: c.title })), st = C.stakeholders || [];
    return frameSection("Story chapters", "The core notification, chapter by chapter. Each chapter can offer one related module.",
      `${fText("Heading", "story.title")}${fArea("Intro", "story.intro")}${fText("Download button text", "story.downloadLabel")}
       ${cards("chapters", "chapter", "Add chapter", c => c.title || "New chapter", (c, i, p) => `
         <div class="cols">${fText("Title", p + ".title")}${fSel("Position", p + ".pin", [["", "Moves for each stakeholder"], ["first", "Always first"], ["last", "Always last"]])}</div>
         ${fSel("Related module", p + ".module", modOpts("No module"))}${fArea("Text", p + ".lead", { rows: 4, hint: "Use **double asterisks** for bold." })}<h2>Key facts</h2>${pairs(p + ".facts")}`)}
       <h2>Chapter order for each stakeholder</h2><p class="small" style="margin:-4px 0 10px">Chapters that move are brought forward in this order. The first ones get a “Key for…” tag.</p>
       ${fNum("Chapters tagged “Key for…”", "keyCount")}
       ${st.map(s => `<div class="card"><div class="card-h"><b>${esc(s.label)}</b></div>${orderedIds("chapterPriority." + s.id, flex, id => (flex.find(c => c.id === id) || {}).name)}</div>`).join("")}`);
  } },
  { id: "timeline", title: "Timeline", goto: "tl", render: () => frameSection("Timeline", "Milestones shown as the page scrolls sideways.",
    `${fText("Heading", "timeline.title")}${fArea("Text", "timeline.intro")}${cards("timeline.items", "milestone", "Add milestone", t => (t.when || "") + " · " + (t.what || "New milestone"), (t, i, p) => `
      <div class="cols">${fSel("Status", p + ".state", [["done", "Done"], ["now", "Next (highlighted)"], ["future", "Later"]])}${fText("Label", p + ".tag", { hint: "For example Done, Next, Expected" })}</div>
      <div class="cols">${fText("Date", p + ".when")}${fText("Milestone", p + ".what")}</div>${fArea("Text", p + ".text", { rows: 2 })}`)}`) },
  { id: "finish", title: "Pack, email and footer", goto: "pack", render: () => frameSection("Pack, email and footer", "The pack section, the email text and the legal footer.",
    `${fText("Pack heading", "finale.title")}${fArea("Pack text", "finale.sub")}
     <h2>Approved email</h2>${fArea("Closing paragraph", "email.closing")}${fArea("Sign-off", "email.signoff", { rows: 4 })}
     <h2>Footer</h2>${fText("First line", "legal.title")}${strs("legal.paragraphs", "Legal text", 3)}`) },
  { id: "veeva", title: "Veeva (optional)", goto: "pack", render: () => frameSection("Veeva CLM", "Only needed if the page will run inside Veeva. Inside Veeva, download buttons become “Send by Approved Email” and choices are tracked.",
    `${fCheck("Include the Veeva library in the exported file", "veeva.include", "Adds a reference to veeva-library.js. Put that file (from your Veeva CLM resources) next to the exported file before zipping.")}
     ${fText("Approved Email template ID", "veeva.emailTemplate")}${fText("Presentation ID (only if the PDF slides are in another presentation)", "veeva.presentationId")}${fCheck("Record choices and chapters as Call Clickstream", "veeva.trackEvents")}
     <h2>Per document</h2><p class="small" style="margin:-4px 0 10px">The fragment ID is the Approved Email content block for that PDF. The slide name is optional: it lets “Open PDF” jump to a PDF slide in the meeting.</p>
     ${docs().map(d => `<div class="card"><div class="card-h"><b>${esc(d.name)}</b></div><div class="cols">${fText("Fragment ID", "veeva.fragments." + d.id)}${fText("PDF slide name", "veeva.pdfSlides." + d.id)}</div></div>`).join("")}`) },
  { id: "export", title: "Check and export", goto: "top", render: () => {
    const is = issues(), counts = { err: is.filter(i => i.k === "err").length, warn: is.filter(i => i.k === "warn").length };
    return frameSection("Check and export", "Review these points, then export one file that works offline.",
      `<button class="bigbtn primary" type="button" data-act="exportHtml">Export offline HTML ↓</button><button class="bigbtn line" type="button" data-act="saveProject">Save project</button><button class="bigbtn line" type="button" data-act="saveContentJs">Save content.js</button>
       <p class="small" style="margin:0 0 14px"><b>Export offline HTML</b> makes one finished file with the fonts, logo, PDFs and page pictures inside it, ready to share or test. <b>Save project</b> keeps your work so you can reopen it here. <b>Save content.js</b> is for the folder version.</p>
       <h2>Checks · ${counts.err} to fix · ${counts.warn} to review</h2>${is.map(i => `<div class="issue ${i.k}"><i>${{ err: "✕", warn: "!", info: "i", ok: "✓" }[i.k]}</i><div><b>${esc(i.t)}</b>${i.d ? `<span>${esc(i.d)}</span>` : ""}</div></div>`).join("")}`);
  } }
];

/* ---------- Checks ---------- */
function issues() {
  const out = [], add = (k, t, d) => out.push({ k, t, d });
  const mo = modules(), ids = new Set();
  const all = [C.core, ...mo];
  if (!C.brand.jobCode) add("warn", "No job code", "Add the approval job code under Brand and logo.");
  if (C.brand.mockLabel) add("info", "The concept label is on", "Clear it under Brand and logo for the approved version.");
  const acc = /^#[0-9a-f]{6}$/i.test(C.brand.accent) ? C.brand.accent : null;
  if (!acc) add("err", "The brand colour isn't a valid hex colour", "Use a value like #f36633.");
  else { const c = ((a, b) => { const l = h => { const r = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * r[0] + .7152 * r[1] + .0722 * r[2]; }; const x = l(a), y = l(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); })(acc, "#0d0e0f"); if (c < 3) add("warn", "The brand colour is hard to read on the black sections", `Contrast is ${c.toFixed(1)}:1 on black. Try a lighter colour.`); }
  all.forEach((d, i) => { const n = d.name || "Unnamed document"; if (!d.pdf) add(i === 0 ? "warn" : "info", `${n}: no PDF yet`, "Draft pages are shown in the viewer, and downloads say the PDF is not available yet."); else if (!isData(d.pdf)) add("warn", `${n}: PDF linked by path`, "A linked file is not inside the exported file. Add the PDF with Choose PDF to embed it."); if (!d.code) add("warn", `${n}: no PDF code`, "The code is used for file names and the viewer."); });
  if (isData(C.brand.logo) === false && C.brand.logo) add("warn", "Logo linked by path", "A linked logo is not inside the exported file. Add it with Choose file to embed it.");
  mo.forEach(m => { if (ids.has(m.id)) add("err", `Duplicate module id: ${m.id}`); ids.add(m.id); });
  const miss = [];
  (C.chapters || []).forEach(c => { if (c.module && !mo.some(m => m.id === c.module)) miss.push(`chapter “${c.title}”`); });
  ((C.stats || {}).items || []).forEach(s => { if (s.module && !mo.some(m => m.id === s.module)) miss.push(`figure “${s.heading}”`); });
  if (miss.length) add("err", "Some items point to a module that no longer exists", miss.join(", "));
  const empty = []; (C.stakeholders || []).forEach(s => (C.engagements || []).forEach(e => { const r = ((C.recommend || {})[s.id] || {})[e.id] || []; if (!r.filter(id => mo.some(m => m.id === id)).length) empty.push(`${s.label} · ${e.label}`); }));
  if (empty.length) add("info", `${empty.length} choice${empty.length > 1 ? "s" : ""} recommend no modules`, empty.slice(0, 5).join("; ") + (empty.length > 5 ? "…" : ""));
  const size = [...all.flatMap(d => [d.pdf, ...(d.images || [])]), C.brand.logo, ...Object.values(C.brand.fonts || {})].reduce((s, u) => s + (isData(u) ? uriBytes(u) : 0), 0);
  const est = size * 1.34 + 700000;
  add(est > 15e6 ? "warn" : "ok", `Estimated export size: ${fmtSize(est)}`, est > 15e6 ? "Large files can be blocked by email and CLM limits. Consider fewer or lighter PDFs." : "Includes fonts and the PDF merge library.");
  if (!out.some(i => i.k === "err")) add("ok", "No errors found");
  return out.sort((a, b) => ({ err: 0, warn: 1, info: 2, ok: 3 }[a.k] - { err: 0, warn: 1, info: 2, ok: 3 }[b.k]));
}

/* ---------- Rendering the editor ---------- */
function renderSide() {
  const is = issues(), err = is.filter(i => i.k === "err").length;
  $("#side").innerHTML = SECTIONS.map((s, i) => `<button type="button" data-section="${s.id}" ${s.id === "export" ? 'data-last="1"' : ""} aria-current="${s.id === section}">${s.id === "export" ? "" : `<span class="n">${i + 1}</span>`}${s.title}${s.id === "export" && err ? `<span class="badge err">${err}</span>` : ""}</button>`).join("").replace('<button type="button" data-section="export"', '<div class="sep"></div><button type="button" data-section="export"');
}
function updateSide() { $$("#side [aria-current]").forEach(b => b.setAttribute("aria-current", b.dataset.section === section)); $("#projName").textContent = C.brand.productName || ""; }
function renderForm(keepScroll) {
  const f = $("#form"), st = f.scrollTop;
  f.innerHTML = SECTIONS.find(s => s.id === section).render();
  f.scrollTop = keepScroll ? st : 0;
  $("#projName").textContent = C.brand.productName || "";
}
function go(id) { section = id; renderSide(); renderForm(false); const s = SECTIONS.find(x => x.id === id); gotoPreview(s.goto); }

/* ---------- Structure changes ---------- */
const uid = (prefix, taken) => { let n = taken.length + 1, id; do { id = prefix + n++; } while (taken.includes(id)); return id; };
const KINDS = {
  str: () => "", pair: () => ["", ""],
  stakeholder: () => { const id = uid("s", C.stakeholders.map(x => x.id)); return { id, label: "New stakeholder", plural: "new stakeholders", desc: "" }; },
  engagement: () => { const id = uid("e", C.engagements.map(x => x.id)); return { id, label: "New engagement type", desc: "", subject: "", intro: "" }; },
  module: () => { const id = uid("m", modules().map(x => x.id)); return { id, name: "New module", short: "New module", question: "", code: "PA-MOD-" + String(modules().length + 1).padStart(2, "0"), pages: 1, pdf: "", images: [], intro: "", facts: [], pointsTitle: "", points: [] }; },
  chapter: () => { const id = uid("c", C.chapters.map(x => x.id)); return { id, pin: "", title: "New chapter", module: "", lead: "", facts: [] }; },
  stat: () => ({ value: "", suffix: "", suffixStyle: "small", countUp: false, heading: "", text: "", module: "" }),
  milestone: () => ({ state: "future", tag: "Planned", when: "", what: "", text: "" })
};
function tidy() {
  const mids = modules().map(m => m.id), sids = C.stakeholders.map(s => s.id), eids = C.engagements.map(e => e.id);
  C.recommend = C.recommend || {}; C.chapterPriority = C.chapterPriority || {};
  for (const s of Object.keys(C.recommend)) if (!sids.includes(s)) delete C.recommend[s];
  for (const s of sids) { const r = C.recommend[s] = C.recommend[s] || {}; for (const e of Object.keys(r)) if (!eids.includes(e)) delete r[e]; for (const e of eids) r[e] = (r[e] || []).filter(id => mids.includes(id)); }
  const flex = C.chapters.filter(c => !c.pin).map(c => c.id);
  for (const s of Object.keys(C.chapterPriority)) if (!sids.includes(s)) delete C.chapterPriority[s];
  for (const s of sids) C.chapterPriority[s] = (C.chapterPriority[s] || []).filter(id => flex.includes(id));
  C.chapters.forEach(c => { if (c.module && !mids.includes(c.module)) c.module = ""; });
  C.stats.items.forEach(s => { if (s.module && !mids.includes(s.module)) s.module = ""; });
  const docIds = ["core", ...mids];
  for (const k of ["fragments", "pdfSlides"]) { C.veeva[k] = C.veeva[k] || {}; for (const id of Object.keys(C.veeva[k])) if (!docIds.includes(id)) delete C.veeva[k][id]; }
}
function structure(act, arr, i, kind) {
  const list = ensureArr(arr);
  if (act === "add") list.push(KINDS[kind]());
  else if (act === "del") { const it = list[i]; if (it && (it.pdf || it.pdfName) && !confirm("Remove this module and its PDF from the project?")) return; list.splice(i, 1); }
  else if (act === "up" && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
  else if (act === "down" && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
  tidy(); renderForm(true); renderSide(); touch();
}

/* ---------- Files ---------- */
function readUri(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
let pdfReady = false;
function initPdfJs() {
  if (pdfReady) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([T("pdfworker")], { type: "text/javascript" })); pdfReady = true;
}
async function ingestPdf(path, file) {
  initPdfJs();
  const d = getP(path), bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise, imgs = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    status(`Reading ${file.name}: page ${n} of ${pdf.numPages}…`, "busy");
    const pg = await pdf.getPage(n), w = pg.getViewport({ scale: 1 }).width, vp = pg.getViewport({ scale: 1000 / w });
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp, background: "rgb(255,255,255)" }).promise;
    imgs.push(cv.toDataURL("image/jpeg", 0.82));
  }
  d.pdf = await readUri(new Blob([bytes], { type: "application/pdf" })); d.images = imgs; d.pages = pdf.numPages; d.pdfName = file.name;
}
let queue = Promise.resolve();
function handleFile(kind, path, file) {
  queue = queue.then(async () => {
    try {
      if (kind === "pdf") {
        if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw new Error(`${file.name} is not a PDF.`);
        await ingestPdf(path, file); status(`${file.name} added: ${getP(path).images.length} pages.`, "", 4000);
      } else if (kind === "logo") {
        let u = await readUri(file); if (!/^data:image\//.test(u)) throw new Error("That file isn't an image.");
        if (/\.svg$/i.test(file.name) && !u.startsWith("data:image/svg+xml")) u = "data:image/svg+xml;base64," + u.split(",")[1];
        setP(path, u); status("Logo added.", "", 3000);
      } else if (kind === "font") {
        const ext = (file.name.split(".").pop() || "").toLowerCase(), mime = { woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf" }[ext];
        if (!mime) throw new Error("Use a .woff, .woff2, .ttf or .otf font file.");
        setP(path, "data:" + mime + ";base64," + (await readUri(file)).split(",")[1]); status("Font added.", "", 3000);
      }
      renderForm(true); renderSide(); touch();
    } catch (e) { status(e.message || "That file couldn't be read.", "err"); }
  });
}
function bulkFiles(files) {
  const norm = s => s.toLowerCase().replace(/\.pdf$/, "");
  const unmatched = [];
  [...files].forEach(f => {
    const n = norm(f.name), hit = docs().find(d => { const doc = getP(d.path); return doc.code && n.startsWith(doc.code.toLowerCase()); });
    if (hit) handleFile("pdf", hit.path, f); else unmatched.push(f.name);
  });
  if (unmatched.length) queue = queue.then(() => status(`Not matched to a document: ${unmatched.join(", ")}. Name files starting with the PDF code, or add them to a module directly.`, "err"));
}

/* ---------- Save, open, export ---------- */
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); }
const base = () => slug(C.brand.productName) + "-launch-story";
function exportHtml() {
  const is = issues(); const errs = is.filter(i => i.k === "err");
  if (errs.length && !confirm(`There ${errs.length === 1 ? "is 1 error" : "are " + errs.length + " errors"} on the Check page. Export anyway?`)) return go("export");
  const html = fillTemplate(C, true);
  download(base() + "-offline.html", html, "text/html"); status(`Exported ${base()}-offline.html (${fmtSize(html.length)}). Open it with Wi-Fi off to check it.`, "", 8000);
}
function saveProject() { download(base() + "-project.json", JSON.stringify({ hubEditorProject: 1, content: C }), "application/json"); dirty = false; status("Project saved. Reopen it any time with Open.", "", 6000); }
function saveContentJs() {
  const header = `/* ${C.brand.productName} launch story: CONTENT. Saved from the hub editor. Replace content.js in the hub folder with this file. */\n`;
  download("content.js", header + "window.HUB = " + JSON.stringify(C, null, 2) + ";\n", "text/javascript"); status("content.js saved. Files embedded in it stay inside the file.", "", 6000);
}
async function openFile(file) {
  try {
    const text = await file.text(); let obj;
    if (/^\s*[{\[]/.test(text)) { const j = JSON.parse(text); obj = j.content || j; } else obj = parseJs(text);
    if (dirty && !confirm("Replace the current project? Unsaved changes will be lost.")) return;
    C = normalize(obj); tidy(); dirty = false; renderSide(); renderForm(false); reloadPreview(); status(`Opened ${file.name}.`, "", 5000);
  } catch (e) { status("Couldn't open that file: " + (e.message || e), "err"); }
}

/* ---------- Events ---------- */
document.addEventListener("input", e => {
  const el = e.target.closest("[data-path]"); if (!el || el.type === "file") return;
  const path = el.dataset.path; let v = el.value;
  if (el.dataset.type === "bool") v = el.checked; else if (el.dataset.type === "num") v = el.value === "" ? 0 : Math.max(0, +el.value);
  setP(path, v);
  $$(`[data-path="${path}"]`).forEach(x => { if (x !== el && x.type !== "checkbox") x.value = v; });
  if (path === "brand.productName") $("#projName").textContent = v;
  touch();
});
document.addEventListener("change", e => {
  const add = e.target.closest("[data-addto]");
  if (add && add.value) { ensureArr(add.dataset.addto).push(add.value); tidy(); renderForm(true); touch(); return; }
  const f = e.target.closest("input[type=file][data-file]");
  if (f && f.files.length) { handleFile(f.dataset.file, f.dataset.path, f.files[0]); f.value = ""; return; }
  if (e.target.id === "openFile" && e.target.files[0]) { openFile(e.target.files[0]); e.target.value = ""; }
  // Fields that change what other sections show (names, positions) refresh the side and any open lists
  const el = e.target.closest("[data-path]");
  if (el && /\.(pin|name|label|title|short)$/.test(el.dataset.path)) setTimeout(() => {
    // Refresh lists that show these names, then put the cursor back where the user went next
    const a = document.activeElement, p = a && a.dataset && a.dataset.path;
    tidy(); renderForm(true); renderSide();
    if (p) { const n = $(`#form [data-path="${p}"]`); if (n) { n.focus(); if (n.type === "text") try { n.setSelectionRange(n.value.length, n.value.length); } catch (err) {} } }
  }, 0);
});
document.addEventListener("click", e => {
  const sec = e.target.closest("[data-section]"); if (sec) return go(sec.dataset.section);
  const v = e.target.closest("[data-view]"); if (v) { $$("[data-view]").forEach(b => b.setAttribute("aria-pressed", b === v)); const st = $("#stage"); st.classList.toggle("dev", v.dataset.view !== "desktop"); st.style.setProperty("--w", v.dataset.view === "phone" ? "400px" : "1024px"); return; }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act;
  if (["add", "del", "up", "down"].includes(act)) return structure(act, a.dataset.arr, +a.dataset.i, a.dataset.kind);
  if (act === "clearPdf") { const d = getP(a.dataset.path); d.pdf = ""; d.images = []; delete d.pdfName; renderForm(true); renderSide(); touch(); }
  else if (act === "clearFile") { setP(a.dataset.path, ""); renderForm(true); renderSide(); touch(); }
  else if (act === "exportHtml") exportHtml();
  else if (act === "saveProject") saveProject();
  else if (act === "saveContentJs") saveContentJs();
  else if (act === "reloadPreview") reloadPreview();
});
// Drag and drop onto file slots and the bulk drop zone
["dragenter", "dragover"].forEach(t => document.addEventListener(t, e => { const z = e.target.closest && e.target.closest(".slot, [data-bulk]"); if (z) { e.preventDefault(); z.classList.add("over"); } }));
document.addEventListener("dragleave", e => { const z = e.target.closest && e.target.closest(".slot, [data-bulk]"); if (z) z.classList.remove("over"); });
document.addEventListener("drop", e => {
  const z = e.target.closest && e.target.closest(".slot, [data-bulk]"); if (!z) return;
  e.preventDefault(); z.classList.remove("over");
  const files = [...(e.dataTransfer ? e.dataTransfer.files : [])]; if (!files.length) return;
  if (z.hasAttribute("data-bulk")) bulkFiles(files); else handleFile(z.dataset.slot, z.dataset.path, files[0]);
});
document.addEventListener("dragover", e => e.preventDefault()); document.addEventListener("drop", e => { if (!(e.target.closest && e.target.closest(".slot, [data-bulk]"))) e.preventDefault(); });
addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- Test hooks and start ---------- */
window.__editor = { get content() { return C; }, set content(v) { C = normalize(v); tidy(); renderSide(); renderForm(false); reloadPreview(); }, buildExport: () => fillTemplate(C, true), issues, go };
tidy(); renderSide(); renderForm(false); reloadPreview();
})();
