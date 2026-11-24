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
const dataBytes = u => { const b = atob(u.slice(u.indexOf(",") + 1)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const pad2 = n => String(n).padStart(2, "0");

/* ---------- PDF store: PDFs live here as Blobs (not inside the content), so large files stay light ---------- */
const STORE = new Map(), URLS = new Map(); let storeN = 0;
const isStored = u => typeof u === "string" && u.startsWith("@store:");
const putStore = blob => { const k = "@store:" + (++storeN); STORE.set(k, blob); return k; };
const fileSize = d => (isStored(d.pdf) && STORE.get(d.pdf) ? STORE.get(d.pdf).size : 0);
const blobUrl = k => { if (!URLS.has(k)) URLS.set(k, URL.createObjectURL(STORE.get(k))); return URLS.get(k); };
const withPdfUrls = c => { for (const d of [c.core, ...c.modules]) if (isStored(d.pdf)) d.pdf = blobUrl(d.pdf); return c; };
const MAX_IMG = 30;   // page pictures made per PDF for the in-page viewer
const DEFAULT_FONTS = ["gsk-light.woff", "gsk-regular.woff", "gsk-regularitalic.woff", "gsk-bold.woff"];

/* ---------- Embedded resources ---------- */
const SCRIPT_OPEN = "<" + "script", SCRIPT_CLOSE = "<" + "/script>";
const T = id => document.getElementById(id).textContent.split("<\\" + "/script").join("<" + "/script");
const TPL = T("tpl"), FONTS_EXPORT = T("fontsExport"), CONTENT_DEFAULT = T("contentDefault"), LOGO_SVG = T("logoPlaceholder");
const SITE_INDEX = T("siteIndex");
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
const HANDOFF = window.__HANDOFF || (window.parent !== window ? (() => { try { return window.parent.__HANDOFF; } catch (e) { return null; } })() : null);
let C = HANDOFF ? normalize(clone(HANDOFF)) : clone(DEFAULT);
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
  for (const d of [out.core, ...out.modules]) { if (isData(d.pdf)) d.pdf = putStore(new Blob([dataBytes(d.pdf)], { type: "application/pdf" })); if (isStored(d.pdf) && !STORE.has(d.pdf)) d.pdf = ""; d.pdf = d.pdf || ""; d.images = d.images || []; d.facts = d.facts || []; d.points = d.points || []; }
  out.brand.fonts = out.brand.fonts || {};
  return out;
}
const modules = () => C.modules || [];
const docs = () => [{ id: "core", name: C.core.name, path: "core" }, ...modules().map((m, i) => ({ id: m.id, name: m.name, path: "modules." + i }))];

/* ---------- Status line ---------- */
let statusTimer;
function status(msg, kind = "", ms = 0) {
  const el = $("#status"); el.className = "statusbar " + kind; $("#statusText").textContent = msg;
  clearTimeout(statusTimer); if (ms) statusTimer = setTimeout(() => status("Ready. Changes show in the preview straight away. Save your content before closing this page."), ms);
}

/* ---------- Preview ---------- */
const frame = $("#preview");
let frameReady = false, sendTimer;
const ensureObj = k => { if (!C[k] || typeof C[k] !== "object") C[k] = {}; };
const consentOn = c => !!(c.consent && c.consent.enabled);
const stripMarked = (t, n) => { const a = t.indexOf(`/*${n}_START*/`), b = t.indexOf(`/*${n}_END*/`); return a > -1 && b > a ? t.slice(0, a) + t.slice(b + `/*${n}_END*/`.length) : t; };
const signinOn = c => !!(c.signin && c.signin.enabled), flowOn = c => consentOn(c) || signinOn(c), stripFlow = t => stripMarked(t, "FLOW");
function fillTemplate(content, forExport) {
  const json = JSON.stringify(content).split("</").join("<\\/");
  const preview = forExport ? "" : "window.HUB_PREVIEW = true; ";
  const libs = `${SCRIPT_OPEN}>${PDFLIB_SRC}${SCRIPT_CLOSE}`;
  // Shared files never carry the editor's live-preview code
  let tpl = TPL; if (forExport) { const a = tpl.indexOf("/*PREVIEW_START*/"), b = tpl.indexOf("/*PREVIEW_END*/"); if (a > -1 && b > a) tpl = tpl.slice(0, a) + tpl.slice(b + "/*PREVIEW_END*/".length); }
  if (forExport && !flowOn(content)) tpl = stripFlow(tpl);
  const map = { TITLE: esc(content.brand.pageTitle || content.brand.productName + " launch story"), FONTS_CSS: FONTS_EXPORT, LIBS: libs, CONTENT: `${SCRIPT_OPEN}>${preview}window.HUB = ${json};${SCRIPT_CLOSE}` };
  return Object.entries(map).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), tpl);
}
function reloadPreview() { frameReady = false; frame.onload = () => { frameReady = true; }; frame.srcdoc = fillTemplate(withPdfUrls(clone(C)), false); }
function inlineSet(path, v) { setP(path, v); renderForm(true); renderSide(); touch(); }
function touch() { dirty = true; updateSide(); clearTimeout(sendTimer); sendTimer = setTimeout(() => { try { if (window.parent !== window && window.parent.__applyContent) window.parent.__applyContent(withPdfUrls(clone(C))); } catch (e) {} if (frameReady) frame.contentWindow.postMessage({ type: "hub-content", content: withPdfUrls(clone(C)) }, "*"); }, 350); }
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
    if (isStored(d.pdf)) statusHtml = `<span class="ok">✓ ${esc(d.pdfName || "PDF added")}</span><span>${d.pages || d.images.length} pages · ${fmtSize(fileSize(d))}</span>`;
    else if (d.pdf) statusHtml = `<span class="linked">Linked by path</span><span>${esc(d.pdf)}</span>`;
    else statusHtml = `<span class="none">No PDF yet. Draft pages are shown until you add one.</span>`;
    if (isStored(d.pdf) && d.images.length) body = `<div class="thumbs">${d.images.slice(0, 8).map(s => `<img src="${s}" alt="">`).join("")}</div>`;
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
  { id: "sections", title: "Show or hide sections", goto: "top", render: () => frameSection("Show or hide sections", "Hide any part of the page you don't need. Your text is kept, so you can bring it back.",
    `${fCheck("Key figures (the large numbers)", "sections.stats")}${fCheck("Story chapters", "sections.story")}${fCheck("Timeline (“Where we are”)", "sections.timeline")}
     <p class="small">The opening screen and the pack builder are always shown, because they are the heart of the page.</p>`) },
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
     ${fNum("Page count", "core.pages", { dis: isStored(C.core.pdf), hint: isStored(C.core.pdf) ? "Counted from the PDF." : "Used until a PDF is added." })}
     <h2>Draft cover text</h2><p class="small">Only shown on the draft pages, until the approved PDF is added.</p>${fArea("Intro", "core.draftIntro")}${fArea("Note", "core.draftNote")}`) },
  { id: "people", title: "Stakeholders and engagements", goto: "builder", render: () => frameSection("Stakeholders and engagements", "Who is being engaged, and why. Each choice leads to recommended modules.",
    `<h2>Stakeholders</h2>${cards("stakeholders", "stakeholder", "Add stakeholder", s => s.label || "New stakeholder", (s, i, p) => `<div class="cols">${fText("Name", p + ".label")}${fText("Plural (used in sentences)", p + ".plural")}</div>${fText("Short description", p + ".desc")}`, { noDel: 1 })}
     <h2>Engagement types</h2>${cards("engagements", "engagement", "Add engagement type", s => s.label || "New engagement type", (s, i, p) => `<div class="cols">${fText("Name", p + ".label")}${fText("Short description", p + ".desc")}</div>${fText("Email subject", p + ".subject")}${fArea("Email opening", p + ".intro")}`, { noDel: 1 })}`) },
  { id: "modules", title: "Modules (PDFs)", goto: "pack", render: () => frameSection("Modules", "Each module is one approved PDF that can be added to a pack.",
    `<div class="bulk" data-bulk><b>Drop several PDFs here.</b><br>Each one is matched to a document by its code, for example PA-MOD-02.pdf goes to the module with the code PA-MOD-02.</div>
     ${cards("modules", "module", "Add module", m => m.name || "New module", (m, i, p) => `
       <div class="cols">${fText("Name", p + ".name")}${fText("Short name", p + ".short")}</div>${fText("Question it answers", p + ".question")}
       <div class="cols">${fText("PDF code", p + ".code")}${fNum("Page count", p + ".pages", { dis: isStored(m.pdf), hint: isStored(m.pdf) ? "Counted from the PDF." : "" })}</div>
       ${slot("pdf", p, "Approved PDF", "application/pdf")}
       <details><summary>Draft page text (shown until the PDF is added)</summary>${fArea("Intro", p + ".intro", { rows: 2, hint: "Use **double asterisks** for bold." })}<h2>Key facts</h2>${pairs(p + ".facts")}${fText("List heading", p + ".pointsTitle")}<h2>List</h2>${strs(p + ".points", "Point", 2)}</details>`)}`) },
  { id: "recommend", title: "Recommendations", goto: "builder", render: () => {
    const st = C.stakeholders || [], en = C.engagements || [], mo = modules();
    const head = `<tr><th></th>${en.map(e => `<th>${esc(e.label)}</th>`).join("")}</tr>`;
    const rows = st.map(s => `<tr><td class="rowh">${esc(s.label)}</td>${en.map(e => `<td>${orderedIds(`recommend.${s.id}.${e.id}`, mo, id => (mo.find(m => m.id === id) || {}).name)}</td>`).join("")}</tr>`).join("");
    return frameSection("Recommendations", "Which modules each choice adds to the pack, in the order they appear. The core notification is always included.", `<div class="matrix"><table>${head}${rows}</table></div>`);
  } },
  { id: "stats", title: "Key figures", goto: "stats", render: () => frameSection("Key figures", "The large numbers shown one at a time while the reader scrolls.",
    `${fCheck("Show this section on the page", "sections.stats")}${fText("Section label", "stats.label")}${cards("stats.items", "stat", "Add figure", s => (s.value || "") + (s.suffix || "") + " · " + (s.heading || "New figure"), (s, i, p) => `
      <div class="cols">${fText("Number", p + ".value", { hint: "For example 8,400" })}${fText("Unit or suffix", p + ".suffix", { hint: "For example nd, °C or ×" })}</div>
      <div class="cols">${fSel("Suffix style", p + ".suffixStyle", [["small", "Small"], ["accent", "Large, brand colour"]])}<div>${fCheck("Count up", p + ".countUp", "Only for plain numbers.")}</div></div>
      ${fText("Heading", p + ".heading")}${fArea("Text", p + ".text", { rows: 2 })}${fSel("Offer this module", p + ".module", modOpts("No module"))}`)}`) },
  { id: "story", title: "Story chapters", goto: "story", render: () => {
    const flex = (C.chapters || []).filter(c => !c.pin).map(c => ({ id: c.id, name: c.title })), st = C.stakeholders || [];
    return frameSection("Story chapters", "The core notification, chapter by chapter. Each chapter can offer one related module.",
      `${fCheck("Show this section on the page", "sections.story")}${fText("Heading", "story.title")}${fArea("Intro", "story.intro")}${fText("Download button text", "story.downloadLabel")}
       ${cards("chapters", "chapter", "Add chapter", c => c.title || "New chapter", (c, i, p) => `
         <div class="cols">${fText("Title", p + ".title")}${fSel("Position", p + ".pin", [["", "Moves for each stakeholder"], ["first", "Always first"], ["last", "Always last"]])}</div>
         ${fSel("Related module", p + ".module", modOpts("No module"))}${fArea("Text", p + ".lead", { rows: 4, hint: "Use **double asterisks** for bold." })}<h2>Key facts</h2>${pairs(p + ".facts")}`)}
       <h2>Chapter order for each stakeholder</h2><p class="small" style="margin:-4px 0 10px">Chapters that move are brought forward in this order. The first ones get a “Key for…” tag.</p>
       ${fNum("Chapters tagged “Key for…”", "keyCount")}
       ${st.map(s => `<div class="card"><div class="card-h"><b>${esc(s.label)}</b></div>${orderedIds("chapterPriority." + s.id, flex, id => (flex.find(c => c.id === id) || {}).name)}</div>`).join("")}`);
  } },
  { id: "timeline", title: "Timeline", goto: "tl", render: () => frameSection("Timeline", "Milestones shown as the page scrolls sideways.",
    `${fCheck("Show this section on the page", "sections.timeline")}${fText("Heading", "timeline.title")}${fArea("Text", "timeline.intro")}${cards("timeline.items", "milestone", "Add milestone", t => (t.when || "") + " · " + (t.what || "New milestone"), (t, i, p) => `
      <div class="cols">${fSel("Status", p + ".state", [["done", "Done"], ["now", "Next (highlighted)"], ["future", "Later"]])}${fText("Label", p + ".tag", { hint: "For example Done, Next, Expected" })}</div>
      <div class="cols">${fText("Date", p + ".when")}${fText("Milestone", p + ".what")}</div>${fArea("Text", p + ".text", { rows: 2 })}`)}`) },
  { id: "finish", title: "Pack, email and footer", goto: "pack", render: () => frameSection("Pack, email and footer", "The pack section, the email text and the legal footer.",
    `${fText("Pack heading", "finale.title")}${fArea("Pack text", "finale.sub")}
     <h2>Approved email</h2>${fArea("Closing paragraph", "email.closing")}${fArea("Sign-off", "email.signoff", { rows: 4 })}
     <h2>Footer</h2>${fText("First line", "legal.title")}${strs("legal.paragraphs", "Legal text", 3)}`) },
  { id: "signin", title: "Sign-in and consent screens", goto: "top", render: () => frameSection("Sign-in and consent screens", "The first two screens: a mock sign-in, then a tick-box consent screen, then the page. Switch either off and export again and its code is gone from the file.",
    `<h2>1. Sign-in screen (mock-up)</h2>${fCheck("Show the sign-in screen", "signin.enabled", "A mock-up: the button just continues. Real sign-in is added on the server later, and then this screen is switched off.")}
     ${fText("Title", "signin.title")}${fArea("Introduction", "signin.intro", { rows: 2 })}${fText("Button", "signin.button")}${fText("Help heading", "signin.helpTitle")}${fArea("Help text", "signin.help", { rows: 2 })}
     <h2>2. Consent screen</h2>${fCheck("Show the consent screen", "consent.enabled", "A notice and a record, not security. The server must also refuse pages and PDFs to anyone with no recorded consent.")}
     <div class="cols">${fText("Wording version", "consent.version", { hint: "Change it when the wording changes: everyone is asked again." })}${fText("Button", "consent.button")}</div>
     ${fText("Title", "consent.title")}${fArea("Introduction", "consent.intro", { rows: 2 })}${fText("Required tick", "consent.requiredLabel")}
     ${fCheck("Also ask for optional usage statistics", "consent.analytics")}${fText("Optional tick", "consent.analyticsLabel")}
     ${fArea("What is recorded (short notice)", "consent.notice", { rows: 2 })}${fText("Privacy notice link", "consent.privacyUrl", { ph: "https://…" })}
     <button class="bigbtn line" type="button" data-act="replayFlow">Show me the sign-in and consent screens</button>
     <h2>Later: connect to a server</h2><p class="small" style="margin:-4px 0 10px">Leave these blank for the mock-up (the choice is only remembered in this browser tab). When the server is ready, give the addresses it provides.</p>
     ${fText("Consent address", "consent.endpoint", { ph: "/api/consent", hint: "GET returns this reader's record; POST saves it." })}${fText("Usage events address", "consent.eventsEndpoint", { ph: "/api/events", hint: "Only used if the reader ticked the optional box." })}`) },
  { id: "export", title: "Check and export", goto: "top", render: () => {
    const is = issues(), counts = { err: is.filter(i => i.k === "err").length, warn: is.filter(i => i.k === "warn").length };
    return frameSection("Check and export", "Review these points, then export the site.",
      `<button class="bigbtn primary" type="button" data-act="exportSite">Export site (.zip) ↓</button><button class="bigbtn line" type="button" data-act="saveProject">Save my content ↓</button>
        <p class="small" style="margin:0 0 14px"><b>Export site</b> makes the finished folder, with no editor in it: <code>index.html</code> plus the PDFs, page pictures, fonts and logo. This is what you host. <b>Save my content</b> keeps your wording and PDFs in one file so you can load them back later with <b>Open content…</b> at the top. Do both before you close the page.</p>
        <h2>Checks · ${counts.err} to fix · ${counts.warn} to review</h2>${is.map(i => `<div class="issue ${i.k}"><i>${{ err: "✕", warn: "!", info: "i", ok: "✓" }[i.k]}</i><div><b>${esc(i.t)}</b>${i.d ? `<span>${esc(i.d)}</span>` : ""}</div></div>`).join("")}`);
  } }
];

/* ---------- Placeholder wording scan: shown on the Check page and before a final copy ---------- */
const PLACEHOLDER_RE = /mock-?up|placeholder|lorem|\bXX-UK-\d|\bCondition X\b|£\s?X[X,]*|\bTBC\b|\bTODO\b/i;
function placeholderHits() {
  const hits = [];
  (function walk(o, path) {
    if (typeof o === "string") { if (!isData(o) && PLACEHOLDER_RE.test(o) && !/^brand\.(mockLabel|jobCode)$/.test(path) || (path === "brand.jobCode" && /XX-UK/i.test(o))) hits.push({ path, text: o }); }
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, path + "." + i));
    else if (o && typeof o === "object") for (const k of Object.keys(o)) if (!["pdf", "images", "logo", "fonts", "pdfName", "id", "veeva", "consent"].includes(k)) walk(o[k], path ? path + "." + k : k);
  })(C, "");
  return hits;
}
const hitLabel = h => { const t = h.text.replace(/\s+/g, " "), m = t.match(PLACEHOLDER_RE), at = m ? Math.max(0, m.index - 28) : 0; return `${h.path.replace(/\./g, " › ")}: “${at ? "…" : ""}${t.slice(at, at + 70)}${t.length > at + 70 ? "…" : ""}”`; };

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
  all.forEach((d, i) => { const n = d.name || "Unnamed document"; if (!d.pdf) add(i === 0 ? "warn" : "info", `${n}: no PDF yet`, "Draft pages are shown in the viewer, and downloads say the PDF is not available yet."); else if (!isStored(d.pdf)) add("warn", `${n}: PDF linked by path`, "A linked file is not inside the exported file or website folder. Add the PDF with Choose PDF to include it."); if (!d.code) add("warn", `${n}: no PDF code`, "The code is used for file names and the viewer."); });
  if (isData(C.brand.logo) === false && C.brand.logo) add("warn", "Logo linked by path", "A linked logo is not inside the exported file. Add it with Choose file to embed it.");
  mo.forEach(m => { if (ids.has(m.id)) add("err", `Duplicate module id: ${m.id}`); ids.add(m.id); });
  if (consentOn(C)) {
    const k = C.consent;
    if (!k.endpoint) add("warn", "Consent is not recorded on a server", "With no consent address the choice is remembered in the reader's browser only. Fine for testing, not as a record.");
    if (k.analytics && !k.eventsEndpoint) add("warn", "Usage statistics have nowhere to go", "The optional tick is shown but no usage events address is set, so nothing is sent.");
    if (!k.privacyUrl) add("info", "No privacy notice link", "Add the link to the approved privacy notice.");
  }
  const ph = placeholderHits();
  if (ph.length) add("warn", `Placeholder wording in ${ph.length} place${ph.length > 1 ? "s" : ""}`, ph.slice(0, 6).map(hitLabel).join("  ·  ") + (ph.length > 6 ? `  ·  and ${ph.length - 6} more` : "") + ". Replace it before sending the final copy.");
  const miss = [];
  (C.chapters || []).forEach(c => { if (c.module && !mo.some(m => m.id === c.module)) miss.push(`chapter “${c.title}”`); });
  ((C.stats || {}).items || []).forEach(s => { if (s.module && !mo.some(m => m.id === s.module)) miss.push(`figure “${s.heading}”`); });
  if (miss.length) add("err", "Some items point to a module that no longer exists", miss.join(", "));
  const empty = []; (C.stakeholders || []).forEach(s => (C.engagements || []).forEach(e => { const r = ((C.recommend || {})[s.id] || {})[e.id] || []; if (!r.filter(id => mo.some(m => m.id === id)).length) empty.push(`${s.label} · ${e.label}`); }));
  if (empty.length) add("info", `${empty.length} choice${empty.length > 1 ? "s" : ""} recommend no modules`, empty.slice(0, 5).join("; ") + (empty.length > 5 ? "…" : ""));
  const pdfBytes = all.reduce((t, d) => t + fileSize(d), 0), imgBytes = all.reduce((t, d) => t + (d.images || []).reduce((x, u) => x + (isData(u) ? uriBytes(u) : 0), 0), 0);
  const est = pdfBytes * 1.34 + imgBytes * 1.34 + 700000;
  add("ok", `Website folder: about ${fmtSize(pdfBytes + imgBytes + 900000)}`, `The PDFs stay as separate files (${fmtSize(pdfBytes)} in total) in assets/pdfs, so each is requested and logged on its own.`);
  add(est > 60e6 ? "warn" : "ok", `Single file would be about ${fmtSize(est)}`, est > 60e6 ? "Too large for a single file to be comfortable (slow to open, blocked by email). Use the website folder." : "A single file suits sharing by email or a CLM; use the website folder for hosting.");
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
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise, imgs = [], shown = Math.min(pdf.numPages, MAX_IMG);
  for (let n = 1; n <= shown; n++) {
    status(`Reading ${file.name}: page ${n} of ${shown}${shown < pdf.numPages ? " (of " + pdf.numPages + ")" : ""}…`, "busy");
    const pg = await pdf.getPage(n), w = pg.getViewport({ scale: 1 }).width, vp = pg.getViewport({ scale: 1000 / w });
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp, background: "rgb(255,255,255)" }).promise;
    imgs.push(cv.toDataURL("image/jpeg", 0.82));
  }
  d.pdf = putStore(new Blob([file], { type: "application/pdf" })); d.images = imgs; d.pages = pdf.numPages; d.pdfName = file.name;
}
let queue = Promise.resolve();
function handleFile(kind, path, file) {
  queue = queue.then(async () => {
    try {
      if (kind === "pdf") {
        if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw new Error(`${file.name} is not a PDF.`);
        await ingestPdf(path, file); { const dd = getP(path); status(`${file.name} added: ${dd.pages} pages${dd.images.length < dd.pages ? " (the viewer shows the first " + dd.images.length + ")" : ""}, ${fmtSize(file.size)}.`, "", 5000); }
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

/* ---------- Zip files (stored, no compression, so big PDFs are not copied or recompressed) ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = -1; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
async function makeZip(entries) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const e of entries) {
    const blob = e.data instanceof Blob ? e.data : new Blob([e.data]), name = enc.encode(e.name), size = blob.size;
    if (size > 0xFFFFFFF0 || off > 0xFFFFFFF0) throw new Error("That folder is over 4 GB, which this zip writer can't make. Export fewer PDFs.");
    const crc = crc32(new Uint8Array(await blob.arrayBuffer()));
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true);
    parts.push(h.buffer, name, blob);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(c.buffer, name);
    off += 30 + name.length + size;
  }
  const cd = central.reduce((t, x) => t + x.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}
async function readZip(file) {
  const tail = new DataView(await file.slice(Math.max(0, file.size - 70000)).arrayBuffer());
  let p = tail.byteLength - 22; while (p >= 0 && tail.getUint32(p, true) !== 0x06054b50) p--;
  if (p < 0) throw new Error("That isn't a zip file.");
  const n = tail.getUint16(p + 10, true), cdSize = tail.getUint32(p + 12, true), cdOff = tail.getUint32(p + 16, true);
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), dec = new TextDecoder(), entries = []; let q = 0;
  for (let i = 0; i < n; i++) {
    if (cd.getUint32(q, true) !== 0x02014b50) throw new Error("The zip file is damaged.");
    const nl = cd.getUint16(q + 28, true), el = cd.getUint16(q + 30, true), cl = cd.getUint16(q + 32, true);
    entries.push({ method: cd.getUint16(q + 10, true), csize: cd.getUint32(q + 20, true), off: cd.getUint32(q + 42, true), name: dec.decode(new Uint8Array(cd.buffer, q + 46, nl)) });
    q += 46 + nl + el + cl;
  }
  return { entries, async blob(e) {
    const lh = new DataView(await file.slice(e.off, e.off + 30).arrayBuffer()), start = e.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const raw = file.slice(start, start + e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    throw new Error("That zip uses a compression this editor can't read.");
  } };
}

/* ---------- Save, open, export ---------- */
function download(name, data, type) { const a = document.createElement("a"), blob = data instanceof Blob ? data : new Blob([data], { type }); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
const base = () => slug(C.brand.productName) + "-launch-story";
/* A clean copy for sharing: no concept label and no editor-only notes about the files */
function finalCopy() {
  const c = clone(C);
  c.brand.mockLabel = "";
  for (const d of [c.core, ...c.modules]) delete d.pdfName;
  return c;
}
/* The checks and confirmations before any export; false means the user stopped */
function preflight(final) {
  const errs = issues().filter(i => i.k === "err");
  if (errs.length && !confirm(`There ${errs.length === 1 ? "is 1 error" : "are " + errs.length + " errors"} on the Check page. Export anyway?`)) return go("export"), false;
  if (final) {
    const draft = [C.core, ...modules()].filter(d => !d.pdf).map(d => d.name);
    if (draft.length && !confirm(`${draft.length} document${draft.length > 1 ? "s have" : " has"} no PDF yet (${draft.slice(0, 4).join(", ")}${draft.length > 4 ? "…" : ""}). Their draft pages would be visible in the final copy. Export anyway?`)) return go("modules"), false;
    if (!C.brand.jobCode && !confirm("There is no job code. Export the final copy anyway?")) return go("brand"), false;
    const ph = placeholderHits();
    if (ph.length && !confirm(`${ph.length} piece${ph.length > 1 ? "s" : ""} of placeholder wording found, for example: ${hitLabel(ph[0])}. Export the final copy anyway?`)) return go("export"), false;
  }
  return true;
}
const EXT = { "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "font/woff": "woff", "font/woff2": "woff2", "font/ttf": "ttf", "font/otf": "otf" };
const dataMime = u => u.slice(5, u.indexOf(";"));
const SITE_NOTES = `HOSTING NOTES
=============
Upload everything in this folder to your web host, keeping the folder layout. Open index.html on the host to check it.

Protect the WHOLE folder, not just index.html. If login only guards the page, anyone who knows the address of a file in assets/pdfs/ can still download it. Put the login (and the consent step) in front of every request to this folder.

Per-PDF logging: every document is its own file in assets/pdfs/. Each download is one request in your server's access log, so you can count them per PDF and per signed-in user. The page adds a marker to the address so you can tell how the file was used:
  assets/pdfs/PA-MOD-02.pdf?via=download   the reader downloaded that one PDF
  assets/pdfs/PA-MOD-02.pdf?via=pack       the file was read to build a merged pack
The page images in assets/pages/ are only for the on-screen viewer: leave them out of download counts.

Large PDFs: the server should send assets/pdfs/ with the correct type (application/pdf), allow range requests (most do), and not cache signed-in content in shared caches. Merging a very large pack happens in the reader's browser, so a pack of several hundred MB may fail on a phone: the separate downloads still work.

Open index.html straight from your computer and the page works, but merging a pack needs a web host (browsers block reading files from a local folder).
`;
/* Files already linked by path (a hosted copy being edited) are fetched so they travel with the export; on file:// the browser blocks this */
async function pull(u) { try { if (!u || isData(u) || /^(https?:)?\/\//i.test(u) || u.startsWith("blob:")) return null; const r = await fetch(u); return r.ok ? await r.blob() : null; } catch (e) { return null; } }
async function pullLinked() {
  if (!/^https?:/.test(location.protocol)) return;
  let n = 0;
  for (const d of [C.core, ...C.modules]) if (d.pdf && !isStored(d.pdf) && !isData(d.pdf)) {
    const b = await pull(d.pdf); if (b) { d.pdf = putStore(new Blob([b], { type: "application/pdf" })); d.pdfName = d.pdfName || "PDF from the site"; n++; }
  }
  if (n) { renderForm(true); renderSide(); status(`Loaded ${n} PDF${n > 1 ? "s" : ""} from the site.`, "", 5000); }
}
const siteContent = c => SCRIPT_OPEN + ">window.HUB = " + JSON.stringify(c).split("</").join("<\\/") + ";" + SCRIPT_CLOSE;
async function exportSite() {
  const final = true;
  if (!preflight(true)) return;
  try {
    status("Building the website folder…", "busy");
    const root = slug(C.brand.productName) + "-site/", c = final ? finalCopy() : clone(C), entries = [], names = new Set(), missing = [];
    const add = (name, data) => entries.push({ name: root + name, data });
    const uniq = (dir, stem, ext) => { let n = stem, i = 2; while (names.has(dir + n + ext)) n = stem + "-" + i++; names.add(dir + n + ext); return dir + n + ext; };
    const keep = async u => { if (!u || isData(u) || /^(https?:)?\/\//i.test(u)) return; if (names.has(u)) return; const b = await pull(u); if (b) { names.add(u); add(u, b); } else missing.push(u); };
    for (const d of [c.core, ...c.modules]) {
      const stem = String(d.code || d.id || "doc").replace(/[^A-Za-z0-9._-]+/g, "-");
      if (isStored(d.pdf)) { const f = uniq("assets/pdfs/", stem, ".pdf"); add(f, STORE.get(d.pdf)); d.pdf = f; } else await keep(d.pdf);
      const imgs = []; for (let i = 0; i < (d.images || []).length; i++) { const u = d.images[i]; if (isData(u)) { const f = uniq("assets/pages/", `${stem}-${pad2(i + 1)}`, ".jpg"); add(f, new Blob([dataBytes(u)], { type: "image/jpeg" })); imgs.push(f); } else { await keep(u); imgs.push(u); } }
      d.images = imgs; delete d.pdfName;
    }
    if (isData(c.brand.logo)) { const f = uniq("assets/logo/", "logo", "." + (EXT[dataMime(c.brand.logo)] || "png")); add(f, new Blob([dataBytes(c.brand.logo)])); c.brand.logo = f; } else await keep(c.brand.logo);
    for (const k of Object.keys(c.brand.fonts || {})) { const u = c.brand.fonts[k]; if (isData(u)) { const f = uniq("assets/fonts/", "custom-" + k, "." + (EXT[dataMime(u)] || "woff")); add(f, new Blob([dataBytes(u)])); c.brand.fonts[k] = f; } else await keep(u); }
    const fonts = [...FONTS_EXPORT.matchAll(/url\(data:font\/woff;base64,([^)]+)\)/g)];
    fonts.forEach((m, i) => { if (DEFAULT_FONTS[i]) add("assets/fonts/" + DEFAULT_FONTS[i], new Blob([dataBytes("data:;base64," + m[1])])); });
    if (!consentOn(c)) delete c.consent;
    if (!signinOn(c)) delete c.signin;
    delete c.veeva;
    let page = (flowOn(c) ? SITE_INDEX : stripFlow(SITE_INDEX)).split("{{CONTENT}}").join(siteContent(c));
    add("index.html", page);
    add("lib/pdf-lib.min.js", PDFLIB_SRC);
    add("HOSTING-NOTES.txt", SITE_NOTES);
    const zip = await makeZip(entries), name = slug(C.brand.productName) + "-site.zip";
    download(name, zip);
    const nPdf = entries.filter(e => e.name.includes("/assets/pdfs/")).length;
    status(`Exported ${name} (${fmtSize(zip.size)}, ${nPdf} PDF${nPdf === 1 ? "" : "s"}). Unzip it: index.html opens the finished site.${missing.length ? " " + missing.length + " sample file" + (missing.length > 1 ? "s" : "") + " could not be included (the browser can't read files from your computer). Add your own PDF to each document to include it." : ""}`, missing.length ? "err" : "", 14000);
  } catch (e) { status("Couldn't build the website folder: " + (e.message || e), "err"); }
}
async function saveProject() {
  try {
    const c = clone(C), entries = []; let n = 0;
    for (const d of [c.core, ...c.modules]) if (isStored(d.pdf)) { const f = `files/pdf-${++n}.pdf`; entries.push({ name: f, data: STORE.get(d.pdf) }); d.pdf = "@zip:" + f; }
    entries.unshift({ name: "project.json", data: JSON.stringify({ hubEditorProject: 2, content: c }) });
    const zip = await makeZip(entries); download(base().replace("-launch-story", "") + "-content.zip", zip);
    dirty = false; status(`Content saved (${fmtSize(zip.size)}). Load it back any time with Open content.`, "", 6000);
  } catch (e) { status("Couldn't save the project: " + (e.message || e), "err"); }
}
async function openFile(file) {
  try {
    let obj;
    if (/\.zip$/i.test(file.name)) {
      const z = await readZip(file), pj = z.entries.find(e => e.name === "project.json"); if (!pj) throw new Error("That zip isn't a hub project.");
      const j = JSON.parse(await (await z.blob(pj)).text()); obj = j.content;
      for (const d of [obj.core, ...obj.modules]) if (typeof d.pdf === "string" && d.pdf.startsWith("@zip:")) {
        const e = z.entries.find(x => x.name === d.pdf.slice(5)); d.pdf = e ? putStore(new Blob([await z.blob(e)], { type: "application/pdf" })) : "";
      }
    } else {
      const text = await file.text();
      if (/^\s*[{\[]/.test(text)) { const j = JSON.parse(text); obj = j.content || j; } else obj = parseJs(text);
    }
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
  else if (act === "saveProject") saveProject();
  else if (act === "exportSite") exportSite();
  else if (act === "reloadPreview") reloadPreview();
  else if (act === "replayFlow") { try { if (window.parent !== window && window.parent.hubFlowRestart) { window.parent.hubFlowRestart(); window.parent.__hideEditor(); } else if (frameReady) frame.contentWindow.postMessage({ type: "hub-consent-demo" }, "*"); } catch (err) {} }
  else if (act === "editOnPage") { try { window.parent.__startInline(inlineSet); } catch (err) { status("This works from the page's hidden editor (click the logo 5 times).", "err", 5000); } }
  else if (act === "backToSite") { try { window.parent.__hideEditor(); } catch (err) {} }
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
window.__editor = { get content() { return C; }, set content(v) { C = normalize(v); tidy(); renderSide(); renderForm(false); reloadPreview(); }, buildExport: () => fillTemplate(C, true), exportSite, pullLinked, saveProject, openFile, makeZip, readZip, STORE, issues, go };
tidy(); renderSide(); renderForm(false); reloadPreview(); pullLinked();
if (window.parent !== window) { for (const id of ["backBtn", "inlineBtn"]) { const bb = document.getElementById(id); if (bb) bb.hidden = false; } }
})();
