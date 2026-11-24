/* Hub runtime: renders the whole page from window.HUB (its wording is in window.HUB). */
(() => {
"use strict";
let HUB = window.HUB || {};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2, "0");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const get = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const slug = s => String(s || "hub").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hub";

/* ---------- Documents: the core notification plus modules ---------- */
const modules = () => HUB.modules || [];
const isCore = id => id === "core";
const info = id => isCore(id) ? HUB.core : modules().find(m => m.id === id);
const pagesOf = d => +d.pages > 0 ? +d.pages : Math.max(1, (d.images && d.images.length) || 1);
const hasPdf = d => !!(d && d.pdf);
const shortName = d => d.short || d.name;
const covCls = id => isCore(id) ? "cv-core" : "cv-s" + (Math.max(0, modules().findIndex(m => m.id === id)) % 4);
const cover = (id, extra = "") => `<div class="cv ${covCls(id)} ${extra}"><span class="cv-t">${esc(shortName(info(id)))}</span></div>`;
const who = () => (HUB.stakeholders || []).find(s => s.id === state.who);
const eng = () => (HUB.engagements || []).find(e => e.id === state.eng);

/* ---------- State ---------- */
const state = { who: null, eng: null, added: new Set(), removed: new Set() };
const rec = () => {
  if (!state.who || !state.eng) return [];
  const ids = (HUB.recommend && HUB.recommend[state.who] && HUB.recommend[state.who][state.eng]) || [];
  return ids.filter(id => info(id));
};
const picked = () => {
  const r = rec().filter(id => !state.removed.has(id));
  return [...r, ...modules().map(m => m.id).filter(id => state.added.has(id) && !r.includes(id))];
};
const inPack = id => picked().includes(id);
const totalPages = ids => pagesOf(HUB.core) + ids.reduce((s, id) => s + pagesOf(info(id)), 0);
const sanitizeState = () => {
  if (state.who && !who()) state.who = null;
  if (state.eng && !eng()) state.eng = null;
  state.added = new Set([...state.added].filter(id => info(id)));
  state.removed = new Set([...state.removed].filter(id => info(id)));
};

/* ---------- Veeva CLM (only active when the Veeva library is present) ---------- */
const clm = () => (window.com && com.veeva && com.veeva.clm) || null;
const V = () => HUB.veeva || {};
const tracked = new Set();
function veevaTrack(type, id, desc, once) {
  const key = type + ":" + id;
  if (once && tracked.has(key)) return;
  tracked.add(key);
  if (window.hubTrack) window.hubTrack(type, id, desc);   // optional usage statistics (see the consent block)
  if (!clm() || V().trackEvents === false) return;
  try {
    clm().createRecord("Call_Clickstream_vod__c", {
      Track_Element_Type_vod__c: type, Track_Element_Id_vod__c: id, Track_Element_Description_vod__c: desc || ""
    }, () => {});
  } catch (e) {}
}
function veevaSend(ids, fallback) {
  const frags = ids.map(id => (V().fragments || {})[id]).filter(Boolean);
  if (clm() && V().emailTemplate) {
    try {
      clm().launchApprovedEmail(V().emailTemplate, frags, r => { if (r && r.success === false) toast("Approved Email didn't open. Check the template and fragment IDs."); });
      veevaTrack("approved_email", ids.join(","), `Approved Email opened with ${ids.length} document(s)`);
      return;
    } catch (e) {}
  }
  toast(clm() ? "Approved Email isn't set up yet. Add the template and fragment IDs in the editor's Veeva section." : fallback);
}
function veevaOpenSlide(id) {
  try {
    const name = (V().pdfSlides || {})[id];
    if (V().presentationId) clm().gotoSlide(name, V().presentationId); else clm().gotoSlide(name);
    veevaTrack("pdf_opened", id, info(id).name);
  } catch (e) { toast("That PDF slide couldn't open. Check the key message names."); }
}

/* ---------- Colour helpers: derive the page's accent shades from one brand colour ---------- */
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = h => { const c = hex2rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function rgb2hsl(h) {
  let [r, g, b] = hex2rgb(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  return [hh, s * 100, l * 100];
}
function hsl2hex(h, s, l) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
const EXT_ICON = `<svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 2.5H2.5v7h7V7M7 2.5h2.5V5M9.5 2.5 5.5 6.5"/></svg>`;
function footLinks(lg) {
  const l = (lg.links || []).filter(x => x && x.label);
  return l.length ? `<div class="foot-links">${l.map(x => `<a href="${x.url ? esc(x.url) : "#"}"${x.url ? ` target="_blank" rel="noopener"` : ` data-nolink="1"`}>${esc(x.label)}${x.external ? EXT_ICON : ""}</a>`).join("")}</div>` : "";
}
function applyBrand() {
  const b = HUB.brand || {}, root = document.documentElement.style;
  const acc = /^#[0-9a-f]{6}$/i.test(b.accent || "") ? b.accent : "#f36633";
  const [h, s] = rgb2hsl(acc); let l = rgb2hsl(acc)[2], ink = acc;
  while (contrast(ink, "#ffffff") < 4.5 && l > 4) { l -= 2; ink = hsl2hex(h, s, l); }
  root.setProperty("--orange", acc);
  root.setProperty("--on-accent", contrast(acc, "#0d0e0f") >= contrast(acc, "#ffffff") ? "#0d0e0f" : "#ffffff");
  root.setProperty("--orange-ink", ink);
  root.setProperty("--orange-soft", hsl2hex(h, Math.min(s, 92), 92));
  root.setProperty("--accent-deep", hsl2hex(h, Math.min(s, 80), 22));
  // Optional font overrides from the editor (data: URIs)
  let st = $("#brandFonts");
  if (!st) { st = document.createElement("style"); st.id = "brandFonts"; document.head.append(st); }
  const f = b.fonts || {}, face = (src, w, style) => src ? `@font-face{font-family:"BrandFont";src:url(${src});font-weight:${w};font-style:${style};font-display:swap}` : "";
  st.textContent = face(f.light, 300, "normal") + face(f.regular, 400, "normal") + face(f.italic, 400, "italic") + face(f.bold, 700, "normal");
  document.title = b.pageTitle || ((b.productName || "Launch story") + " launch story");
  document.body.classList.toggle("no-mock", !b.mockLabel && !b.mockLabel2);
  $("#conceptStrip").innerHTML = [b.mockLabel, b.mockLabel2].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("");
}
const mark = (cls = "") => HUB.brand && HUB.brand.logo ? `<img class="logo" src="${esc(HUB.brand.logo)}" alt="${esc(HUB.brand.productName)}">` : `<i aria-hidden="true"></i>${esc((HUB.brand || {}).productName)}`;

/* ---------- Static text and shell ---------- */
const BT = { backToTop: "Back to top", barCore: "Download core PDF", barCoreShort: "Core PDF", heroDownload: "Download PDF", heroPreview: "Preview", packPreview: "Preview pack", packDownload: "Download as one PDF", dockView: "View pack", viewerDownload: "Download pack", viewerDocDownload: "Download PDF", pdfSmall: "PDF", remove: "Remove" };
const bt = k => ((HUB.buttons || {})[k]) || BT[k];
function applyButtonText() { $$("[data-btn]").forEach(el => { el.textContent = bt(el.dataset.btn); }); }
const linkify = t => esc(t).replace(/\[([^\]]+)\]\((#[\w-]+|https?:\/\/[^)\s]+)\)/g, (m, a, u) => `<a href="${u}"${/^#pi-(view|download)$/.test(u) ? ` data-pi="${u.slice(4)}"` : u[0] === "#" ? "" : ` target="_blank" rel="noopener"`}>${a}</a>`);
function bindStatic() {
  { const h0 = HUB.hero || {}, tn = $("#topNote"); if (tn) tn.innerHTML = [["disclaimer", h0.disclaimer], ["disclaimer2", h0.disclaimer2]].filter(x => x[1]).map(x => `<p data-edit="hero.${x[0]}">${linkify(x[1])}</p>`).join(""); }
  $$("[data-t]").forEach(el => { const v = get(HUB, el.dataset.t); el.textContent = v == null ? "" : v; });
  const b = HUB.brand || {}, h = HUB.hero || {}, c = HUB.core || {};
  $("#brand").innerHTML = (HUB.brand && HUB.brand.logo ? mark() : `<i aria-hidden="true"></i><span>${esc(b.productName)}</span>`) + (b.mockLabel || b.mockLabel2 ? `<span class="concept">${b.mockLabel ? `<span data-edit="brand.mockLabel">${esc(b.mockLabel)}</span>` : ""}${b.mockLabel2 ? `<span data-edit="brand.mockLabel2">${esc(b.mockLabel2)}</span>` : ""}</span>` : "");
  $("#coverBrand").innerHTML = (HUB.brand && HUB.brand.logo) ? "" : `<i></i>${esc(b.productName)}`;
  // Only redraw the title when its text changes, so its rise-in animation doesn't replay on every edit
  const titleHtml = (h.titleLines || []).map((t, i) => `<span class="line"><span data-edit="hero.titleLines.${i}">${esc(t)}</span></span>`).join("");
  if ($("#heroTitle").dataset.h !== titleHtml) { $("#heroTitle").innerHTML = titleHtml; $("#heroTitle").dataset.h = titleHtml; }
  { const cl = document.querySelector(".cover-lg"); if (cl) { const old = cl.querySelector(".cover-img"); if (old) old.remove(); cl.classList.toggle("has-img", !!c.cover); if (c.cover) { const im = document.createElement("img"); im.className = "cover-img"; im.alt = ""; im.src = c.cover; cl.prepend(im); } } }
  $("#coverMeta").textContent = `PDF - ${pagesOf(c)} pages - ${b.jobCode || ""}`;
  const inV = !!clm();
  $("#barCore").innerHTML = inV ? `<span class="long">Send core PDF</span><span class="short">Send PDF</span><span aria-hidden="true">✉</span>` : `<span class="long">${esc(bt("barCore"))}</span><span class="short">${esc(bt("barCoreShort"))}</span><span aria-hidden="true">↓</span>`;
  $("#heroDownload").innerHTML = inV ? `Send core PDF <span aria-hidden="true">✉</span>` : `${esc(bt("heroDownload"))} <span aria-hidden="true">↓</span>`;
  $("#storyDownload").innerHTML = (esc((HUB.story || {}).downloadLabel || "Download the core notification")) + (inV ? ` <span aria-hidden="true">✉</span>` : ` <span aria-hidden="true">↓</span>`);
  $("#storyMeta").textContent = `PDF - ${pagesOf(c)} pages`;
  $("#dlPack").innerHTML = inV ? `Send pack by Approved Email <span aria-hidden="true">✉</span>` : `${esc(bt("packDownload"))} <span aria-hidden="true">↓</span>`;
  $("#pmDownload").innerHTML = inV ? `Send pack <span aria-hidden="true">✉</span>` : `${esc(bt("viewerDownload"))} <span aria-hidden="true">↓</span>`;
  const lg = HUB.legal || {};
  const dflt = `Job code ${b.jobCode || ""} | Date of preparation ${b.datePrepared || ""}`;
  $("#footerInner").innerHTML = (lg.paragraphs || []).map((p, i) => `<p data-edit="legal.paragraphs.${i}">${esc(p)}</p>`).join("") + footLinks(lg) + `<p class="foot-ref" data-edit="legal.line" data-fallback="${esc(dflt)}">${md(lg.line ? lg.line : dflt).replace(/ \| /g, `<span class="foot-vr" aria-hidden="true"></span>`)}</p>` + `<a class="foot-top" href="#top" data-top="1"><span data-btn="backToTop">Back to top</span><svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5"/></svg></a>`;
  $("#pickWho b").textContent = who() ? who().label : (HUB.builder || {}).whoPlaceholder || "Choose";
  $("#pickEng b").textContent = eng() ? eng().label : (HUB.builder || {}).engPlaceholder || "Choose";
  $("#pickWho b").classList.toggle("empty", !who());
  $("#pickEng b").classList.toggle("empty", !eng());
  // Timeline
  $("#tlTrack").innerHTML = ((HUB.timeline || {}).items || []).map((i, n) => `<div class="ms ${i.state === "done" ? "done" : i.state === "now" ? "now" : ""}"><span class="dot"></span><span class="tag" data-edit="timeline.items.${n}.tag">${esc(i.tag)}</span><span class="when" data-edit="timeline.items.${n}.when">${esc(i.when)}</span><span class="what" data-edit="timeline.items.${n}.what">${esc(i.what)}</span><p data-edit="timeline.items.${n}.text">${esc(i.text)}</p></div>`).join("");
}

/* ---------- Builder: chips in the hero, menus in the bar ---------- */
function renderChoices() {
  const chips = (el, data, key) => { el.innerHTML = data.map(d => `<button type="button" class="chip" data-set="${key}:${esc(d.id)}" aria-pressed="${state[key] === d.id}">${esc(d.label)}</button>`).join(""); };
  chips($("#chipsWho"), HUB.stakeholders || [], "who");
  chips($("#chipsEng"), HUB.engagements || [], "eng");
  const menu = (key, data) => {
    $(`[data-pick="${key}"] .menu`).innerHTML = data.map(d => `<button type="button" role="menuitemradio" aria-checked="${state[key] === d.id}" aria-pressed="${state[key] === d.id}" data-set="${key}:${esc(d.id)}"><b>${esc(d.label)}</b><span>${esc(d.desc || "")}</span></button>`).join("");
  };
  menu("who", HUB.stakeholders || []); menu("eng", HUB.engagements || []);
  $("#pickWho b").textContent = who() ? who().label : (HUB.builder || {}).whoPlaceholder || "Choose";
  $("#pickEng b").textContent = eng() ? eng().label : (HUB.builder || {}).engPlaceholder || "Choose";
  $("#pickWho b").classList.toggle("empty", !who());
  $("#pickEng b").classList.toggle("empty", !eng());
  const st = $("#builderStatus");
  if (state.who && state.eng) {
    const r = rec();
    st.innerHTML = `<span>Recommended for <b>${esc(who().plural || who().label)}</b>: the core notification${r.length ? " plus <b>" + r.map(id => esc(info(id).name)).join("</b> and <b>") + "</b>" : ""}. They're in your pack.</span><a class="btn btn-black go" href="#stats">Start reading <span aria-hidden="true">↓</span></a>`;
  } else {
    st.innerHTML = `<span>${state.who ? "Now choose the type of engagement." : state.eng ? "Now choose who you're engaging." : "Or just start reading. You can add modules from any chapter."}</span><a class="btn btn-line go" href="#stats">Skip to the story <span aria-hidden="true">↓</span></a>`;
  }
}
function setChoice(key, id) {
  const before = picked();
  state[key] = id; state.removed.clear();
  veevaTrack(key === "who" ? "stakeholder" : "engagement", id, (key === "who" ? who() : eng()).label);
  closeMenus(); renderAll();
  const gained = picked().filter(x => !before.includes(x));
  if (gained.length) { bumpDock(); toast(`${gained.length === 1 ? "1 recommended module" : gained.length + " recommended modules"} added to your pack`); }
}
function closeMenus() { $$(".pick").forEach(p => { $(".menu", p).hidden = true; $(".pick-btn", p).setAttribute("aria-expanded", "false"); }); }

/* ---------- Pinned figures ---------- */
const statHtml = s => esc(s.value) + (s.suffix ? (s.suffixStyle === "accent" ? `<em>${esc(s.suffix)}</em>` : `<small>${esc(s.suffix)}</small>`) : "");
let statIdx = -1;
function renderStats() {
  const st = (HUB.stats && HUB.stats.items) || [];
  $("#slides").innerHTML = st.map((s, i) => `<div class="slide${i === 0 ? " on" : ""}" data-i="${i}"><div class="num" data-count="${/^[\d,]+$/.test(s.value) && s.countUp !== false ? 1 : ""}">${statHtml(s)}</div><div class="copy"><h3 data-edit="stats.items.${i}.heading">${esc(s.heading)}</h3><p data-edit="stats.items.${i}.text">${esc(s.text)}</p>${s.module && info(s.module) ? promptCard(s.module) : ""}</div></div>`).join("");
  $("#statsRail").innerHTML = st.map(() => "<i></i>").join("");
  $("#statCount").innerHTML = st.length ? `<b>01</b> / ${pad(st.length)}` : "";
  $("#stats").style.display = st.length ? "" : "none";
  statIdx = 0;
}
function countUp(el) {
  if (!el || !el.dataset.count || reduced) return;
  const final = el.innerHTML, m = final.match(/^[\d,]+/); if (!m) return;
  const target = +m[0].replace(/,/g, ""), t0 = performance.now(), dur = 900;
  const step = t => { const k = Math.min(1, (t - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - k, 3))); el.innerHTML = k < 1 ? final.replace(/^[\d,]+/, v.toLocaleString("en-GB")) : final; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------- Module prompts ---------- */
function promptCard(id) {
  const m = info(id);
  return `<div class="prompt" data-prompt="${esc(id)}">${cover(id)}<div><div class="label p-label">Related module - ${pagesOf(m)} pages</div><div class="p-title">${esc(m.name)}<span class="rec" hidden>Recommended</span></div><div class="p-q">${esc(m.question || "")}</div></div><button type="button" class="add-btn" data-toggle="${esc(id)}" aria-pressed="false">Add to pack</button></div>`;
}
function syncPrompts() {
  const r = rec();
  $$("[data-prompt]").forEach(p => {
    const id = p.dataset.prompt, on = inPack(id);
    p.classList.toggle("in", on);
    const b = $(".add-btn", p); b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "✓ In your pack" : "+ Add to pack";
    $(".rec", p).hidden = !r.includes(id);
  });
}

/* ---------- Story chapters ---------- */
function chapterOrder() {
  const ch = HUB.chapters || [], flex = ch.filter(c => !c.pin), pr = (state.who && (HUB.chapterPriority || {})[state.who]) || [];
  const ordered = [...pr.map(id => flex.find(c => c.id === id)).filter(Boolean), ...flex.filter(c => !pr.includes(c.id))];
  return { list: [...ch.filter(c => c.pin === "first"), ...ordered, ...ch.filter(c => c.pin === "last")], top: state.who ? ordered.slice(0, HUB.keyCount == null ? 2 : HUB.keyCount).map(c => c.id) : [] };
}
let chObs;
function renderChapters() {
  const { list, top } = chapterOrder();
  $("#chapters").innerHTML = list.map((c, i) => `<article class="chapter" data-ch="${esc(c.id)}"><div class="ch-side"><span class="ch-n">${pad(i + 1)}</span><h3 data-edit="chapters.${(HUB.chapters || []).indexOf(c)}.title">${esc(c.title)}</h3>${top.includes(c.id) && who() ? `<span class="ch-for">Key for ${esc(who().plural || who().label)}</span>` : ""}</div><div class="ch-body"><p class="lead" data-edit="chapters.${(HUB.chapters || []).indexOf(c)}.lead">${md(c.lead)}</p>${(c.facts || []).length ? `<div class="ch-facts">${c.facts.map(f => `<div><span>${esc(f[0])}</span><b>${esc(f[1])}</b></div>`).join("")}</div>` : ""}${c.module && info(c.module) ? promptCard(c.module) : ""}</div></article>`).join("");
  if (chObs) chObs.disconnect();
  chObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("seen"); const c = (HUB.chapters || []).find(x => x.id === e.target.dataset.ch); veevaTrack("chapter_viewed", e.target.dataset.ch, c ? c.title : "", true); } }), { rootMargin: "0px 0px -45% 0px" });
  $$(".chapter").forEach(c => chObs.observe(c));
}

/* ---------- Pack: dock, finale, viewer ---------- */
const dlBtn = id => hasPdf(info(id)) ? `<button type="button" class="x-btn" data-pdf="${esc(id)}" aria-label="Download ${esc(info(id).name)} as PDF">${esc(bt("pdfSmall"))} ↓</button>` : `<span></span>`;
function renderPack() {
  const ids = picked(), all = ["core", ...ids], pp = totalPages(ids), docs = `${all.length} document${all.length > 1 ? "s" : ""}`;
  $("#dockStack").innerHTML = all.map(id => cover(id)).join("");
  $("#dockCount").textContent = docs; $("#dockPages").textContent = `${pp} pages`;
  $("#finDocs").textContent = all.length;
  $("#finPages").innerHTML = `document${all.length > 1 ? "s" : ""}<br>${pp} pages`;
  $("#finFor").innerHTML = state.who && state.eng ? `Built for a <b>${esc(who().label.toLowerCase())}</b> - <b>${esc(eng().label.toLowerCase())}</b>` : "Choose a stakeholder and engagement in the bar above for recommended modules.";
  $("#finList").innerHTML = `<li class="core"><span class="n">00</span><span>${esc(HUB.core.name)}</span><span class="pp">${pagesOf(HUB.core)} pp</span>${dlBtn("core")}<span></span></li>` +
    ids.map((id, i) => `<li><span class="n">${pad(i + 1)}</span><span>${esc(info(id).name)}</span><span class="pp">${pagesOf(info(id))} pp</span>${dlBtn(id)}<button type="button" class="x-btn" data-toggle="${esc(id)}" aria-label="Remove ${esc(info(id).name)}">${esc(bt("remove"))}</button></li>`).join("");
  const rest = modules().filter(m => !ids.includes(m.id));
  $("#finMore").innerHTML = rest.length ? `<span>Add:</span>` + rest.map(m => `<button type="button" data-toggle="${esc(m.id)}">+ ${esc(m.name)}</button>`).join("") : "";
  const n = all.length;
  $("#fan").innerHTML = all.map((id, i) => {
    const t = n === 1 ? 0 : i / (n - 1) - .5, spread = Math.min(340, 92 * (n - 1), ($("#fan").clientWidth || 600) * .5);
    return `<div class="cv ${covCls(id)}" style="transform: translate(calc(-50% + ${t * spread}px), calc(-50% + ${Math.abs(t) * 36}px)) rotate(${t * Math.min(24, 8 * (n - 1))}deg); z-index: ${i}"><span class="cv-t">${pad(i)}</span></div>`;
  }).join("");
  renderViewer(all, pp);
}
const html = s => { const t = document.createElement("template"); t.innerHTML = s.trim(); return t.content.firstElementChild; };
function mockPages(id, d) {
  const out = [], b = HUB.brand || {};
  const head = n => `<div class="pg-top"><span class="pg-brand">${HUB.brand && HUB.brand.logo ? mark() : `<i></i>${esc(b.productName)}`}</span><span>${esc(d.name)}</span></div>`;
  const foot = n => `<div class="pg-foot"><span>Job code ${esc(b.jobCode)} - ${esc(b.datePrepared)}</span><span>Page ${n} of ${pagesOf(d)}</span></div>`;
  for (let n = 1; n <= pagesOf(d); n++) {
    let body;
    if (isCore(id) && n === 1) body = `<div class="pg-cover"><div class="bar-o"></div><div class="label pg-kicker">${esc((HUB.hero || {}).eyebrow)}</div><h1>${esc(d.name)}</h1><p>${esc(d.draftIntro || "")}</p><p style="color: var(--muted); font-size: 12.5px">${esc(d.draftNote || "")}</p></div>`;
    else if (isCore(id) && n === 2) body = `<div class="pg-story">${(HUB.chapters || []).map(c => `<article><h4>${esc(c.title)}</h4><p>${md(c.lead)}</p></article>`).join("")}</div>`;
    else if (!isCore(id) && n === 1) body = `<div style="display: grid; gap: 6px"><div class="label pg-kicker">${esc(d.name)}</div><h2 class="pg-title">${esc(d.question || d.name)}</h2></div>${d.intro ? `<p class="mod-intro">${md(d.intro)}</p>` : ""}${(d.facts || []).length ? `<div class="facts">${d.facts.map(f => `<div class="fact"><span>${esc(f[0])}</span><b>${esc(f[1])}</b></div>`).join("")}</div>` : ""}${(d.points || []).length ? `<div class="mod-body">${d.pointsTitle ? `<h4>${esc(d.pointsTitle)}</h4>` : ""}<ul>${d.points.map(p => `<li>${md(p)}</li>`).join("")}</ul></div>` : ""}`;
    else body = `<div class="pg-ph" aria-hidden="true"><b></b><i></i><i></i><i style="width: 80%"></i><div class="box"></div><i></i><i></i><i style="width: 60%"></i></div><div class="pg-stamp">Artwork to follow</div>`;
    out.push(`<div class="pm-page">${head(n)}<div class="pg-body">${body}</div>${foot(n)}</div>`);
  }
  return out.join("");
}
function updateJump() {
  const n = document.getElementById("pmJump"); if (!n) return;
  const l = n.scrollLeft > 2, r = n.scrollLeft + n.clientWidth < n.scrollWidth - 2;
  n.classList.toggle("fade-l", l); n.classList.toggle("fade-r", r);
  document.querySelectorAll("#pmJumpWrap .pm-arrow").forEach(b => { b.hidden = b.dataset.jumpDir === "-1" ? !l : !r; });
}
function renderViewer(all, pp) {
  $("#pmCount").textContent = `${all.length} documents - ${pp} pages`;
  $("#pmTitle").textContent = who() ? `Pack for ${who().label.toLowerCase()}` : "Your pack";
  setTimeout(updateJump, 0);
  $("#pmJump").innerHTML = all.map((id, i) => `<button type="button" data-jump="${esc(id)}">${pad(i)} - ${esc(shortName(info(id)))}</button>`).join("");
  const draft = all.filter(id => !(info(id).images && info(id).images.length));
  const note = $("#pmNote"); note.hidden = !draft.length;
  note.textContent = draft.length ? `Draft pages: ${draft.length === all.length ? "these pages stand in for the artworked PDFs." : draft.length + " of " + all.length + " documents still show draft pages in place of the artworked PDF."} Once the approved PDF is added, it appears here and downloads as the same file.` : "";
  $("#pmDocs").innerHTML = all.map((id, i) => {
    const d = info(id), real = d.images && d.images.length;
    const btns = `${clm() && (V().pdfSlides || {})[id] ? `<button class="chip-btn" type="button" data-open-slide="${esc(id)}">Open PDF</button>` : ""}<button class="chip-btn" type="button" data-pdf="${esc(id)}">${clm() ? "Send PDF ✉" : esc(bt("viewerDocDownload")) + " ↓"}</button>${isCore(id) ? "" : `<button class="chip-btn" type="button" data-toggle="${esc(id)}">${esc(bt("remove"))}</button>`}`;
    return `<section class="pm-doc" id="doc-${esc(id)}" aria-label="${esc(d.name)}"><div class="pm-doc-head"><span class="n${isCore(id) ? " core" : ""}">${pad(i)}</span><div><div class="label">${esc(d.code || "")} - PDF - ${pagesOf(d)} pages</div><h3>${esc(d.name)}</h3></div><div class="btns">${btns}</div></div>${real ? d.images.map((src, n) => `<div class="pm-page img"><img src="${esc(src)}" alt="${esc(d.name)}, page ${n + 1}" loading="lazy"></div>`).join("") + (+d.pages > d.images.length ? `<p class="pm-more">Showing the first ${d.images.length} of ${+d.pages} pages here. Download the PDF to read all of it.</p>` : "") : mockPages(id, d)}</section>`;
  }).join("");
}

/* ---------- Toggle modules, with covers flying to the dock ---------- */
function toggle(id, from) {
  const on = !inPack(id);
  veevaTrack(on ? "module_added" : "module_removed", id, info(id).name);
  if (on) { state.added.add(id); state.removed.delete(id); } else { state.added.delete(id); if (rec().includes(id)) state.removed.add(id); }
  if (on && from) fly(id, from);
  renderPack(); syncPrompts();
  if (on) { bumpDock(); toast(`${info(id).name} added to your pack`); } else toast(`${info(id).name} removed from your pack`);
}
function fly(id, from) {
  const dock = $("#dock");
  if (reduced || dock.classList.contains("away")) return;
  const src = (from.closest && from.closest(".prompt") && from.closest(".prompt").querySelector(".cv")) || from;
  const a = src.getBoundingClientRect(), b = $("#dockStack").getBoundingClientRect();
  const f = html(cover(id, "flyer")); f.style.cssText = `left:${a.left}px; top:${a.top}px; width:${a.width}px`; document.body.append(f);
  const dx = b.right - a.left - 20, dy = b.top - a.top;
  f.animate([{ transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 }, { transform: `translate(${dx * .5}px, ${dy * .5 - 120}px) rotate(-12deg) scale(.9)`, opacity: 1, offset: .5 }, { transform: `translate(${dx}px, ${dy}px) rotate(0) scale(${32 / a.width})`, opacity: .2 }], { duration: 750, easing: "cubic-bezier(.5,0,.2,1)" }).onfinish = () => f.remove();
}
function bumpDock() { const d = $("#dock"); d.classList.remove("bump"); void d.offsetWidth; d.classList.add("bump"); }

/* ---------- Scroll: progress, pinned scenes, dock ---------- */
const vh = () => window.innerHeight;
function onScroll() {
  const doc = document.documentElement;
  $("#readBar").style.transform = `scaleX(${Math.min(1, scrollY / Math.max(1, doc.scrollHeight - vh()))})`;
  const items = (HUB.stats && HUB.stats.items) || [];
  const st = $("#stats");
  if (items.length && st.offsetHeight) {
    const r = st.getBoundingClientRect(), pin = $(".stats-pin", st).offsetHeight;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - pin))), idx = Math.min(items.length - 1, Math.floor(p * items.length));
    $$(".stats-rail i").forEach((el, i) => el.style.setProperty("--f", Math.min(1, Math.max(0, p * items.length - i))));
    if (idx !== statIdx) {
      veevaTrack("figure_viewed", "stat" + (idx + 1), items[idx].heading, true);
      $$(".slide").forEach((s, i) => { s.classList.toggle("on", i === idx); s.classList.toggle("past", i < idx); });
      $("#statCount").innerHTML = `<b>${pad(idx + 1)}</b> / ${pad(items.length)}`;
      countUp($(`.slide[data-i="${idx}"] .num`)); statIdx = idx;
    }
  }
  const tl = $("#tl"), track = $("#tlTrack");
  if (tl.offsetHeight) {
    const tr = tl.getBoundingClientRect(), tpin = $(".tl-pin", tl).offsetHeight, tp = Math.min(1, Math.max(0, -tr.top / Math.max(1, tr.height - tpin)));
    track.style.transform = `translateX(${-tp * Math.max(0, track.scrollWidth - innerWidth + 40)}px)`;
  }
  const heroGone = $(".hero").getBoundingClientRect().bottom < vh() * .4, finR = $("#pack").getBoundingClientRect();
  $("#dock").classList.toggle("away", !heroGone || (finR.top < vh() * .7 && finR.bottom > vh() * .3) || !$("#packModal").hidden);
}

/* ---------- PDF files: download, merge ---------- */
const dataToBytes = uri => { const b = atob(uri.split(",")[1]), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const via = (src, tag) => /^(data|blob):/.test(src) ? src : src + (src.includes("?") ? "&" : "?") + "via=" + tag;
async function getBytes(src, tag) { if (src.startsWith("data:")) return dataToBytes(src); const r = await fetch(via(src, tag || "pack")); if (!r.ok) throw new Error("fetch"); return new Uint8Array(await r.arrayBuffer()); }
function saveBlob(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
function downloadDoc(id) {
  const d = info(id);
  if (!hasPdf(d)) return toast(`${d.name} will be available to download once the artwork is approved.`);
  const name = (d.code || id) + ".pdf";
  veevaTrack("pdf_downloaded", id, d.name);
  if (d.pdf.startsWith("data:")) saveBlob(new Blob([dataToBytes(d.pdf)], { type: "application/pdf" }), name);
  else {
    // From a local folder browsers won't honour "download" on a file link, and would replace the hub with the PDF, so open it in a new tab
    const a = document.createElement("a"); a.href = via(d.pdf, "download");
    if (location.protocol === "file:") { a.target = "_blank"; a.rel = "noopener"; } else a.download = name;
    document.body.append(a); a.click(); a.remove();
  }
}
async function mergePack(ids) {
  const withPdf = ids.filter(id => hasPdf(info(id)));
  if (!withPdf.length) return toast("The pack will be available as one PDF once the artwork is approved.");
  if (!window.PDFLib) return toast("Merging isn't available in this copy. Download each PDF from the pack viewer.");
  try {
    const out = await PDFLib.PDFDocument.create();
    for (const id of withPdf) { const src = await PDFLib.PDFDocument.load(await getBytes(info(id).pdf, "pack"), { ignoreEncryption: true }); (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p)); }
    saveBlob(new Blob([await out.save()], { type: "application/pdf" }), `${slug((HUB.brand || {}).productName)}-pack.pdf`);
    veevaTrack("pack_downloaded", withPdf.join(","), `Pack downloaded: ${withPdf.length} document(s)`);
    toast(withPdf.length < ids.length ? `Pack downloaded. ${ids.length - withPdf.length} document(s) have no PDF yet.` : "Pack downloaded as one PDF");
  } catch (e) { toast("Couldn't merge the pack. Opened from a local folder, browsers block this; on a web host a very large PDF can also fail. Download each PDF separately instead."); }
}

/* ---------- Pack viewer ---------- */
const packModal = $("#packModal");
function piFile(kind) {
  const d = HUB.prescribing || {}; if (!d.pdf) return toast("The Prescribing Information will be available once it is approved.");
  veevaTrack(kind === "view" ? "pi_viewed" : "pi_downloaded", "pi", d.ctaText || "Prescribing Information");
  const a = document.createElement("a"); a.href = via(d.pdf, kind === "view" ? "view" : "download");
  if (kind === "view" || location.protocol === "file:") { a.target = "_blank"; a.rel = "noopener"; } else a.download = (d.code || "prescribing-information") + ".pdf";
  document.body.append(a); a.click(); a.remove();
}
function openPack(target) {
  veevaTrack("pack_viewed", ["core", ...picked()].join(","), "Pack viewer opened");
  packModal.hidden = false; document.body.classList.add("modal-open"); $("#dock").classList.add("away"); $("#pmScroll").scrollTop = 0; setTimeout(updateJump, 60);
  const d = target && document.getElementById("doc-" + target); if (d) d.scrollIntoView({ block: "start" });
  $("#pmClose").focus();
}
function closePack() { packModal.hidden = true; document.body.classList.remove("modal-open"); onScroll(); }
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200); }

/* ---------- Events (attached once) ---------- */
document.addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if (set) { const [k, v] = set.dataset.set.split(":"); setChoice(k, v); return; }
  const tg = e.target.closest("[data-toggle]"); if (tg) { toggle(tg.dataset.toggle, tg); return; }
  const op = e.target.closest("[data-open-pack]"); if (op) { openPack(op.dataset.openPack); return; }
  const os = e.target.closest("[data-open-slide]"); if (os) { veevaOpenSlide(os.dataset.openSlide); return; }
  const pdf = e.target.closest("[data-pdf]"); if (pdf) { const id = pdf.dataset.pdf; if (clm()) veevaSend([id], ""); else downloadDoc(id); return; }
  const jump = e.target.closest("[data-jump]"); if (jump) { document.getElementById("doc-" + jump.dataset.jump).scrollIntoView({ block: "start" }); return; }
  if (!e.target.closest(".pick")) closeMenus();
});
$$(".pick-btn").forEach(b => b.addEventListener("click", e => { const m = b.nextElementSibling, open = m.hidden; closeMenus(); if (open) { m.hidden = false; b.setAttribute("aria-expanded", "true"); const f = m.querySelector("button"); if (f) f.focus(); } e.stopPropagation(); }));
document.addEventListener("keydown", e => {
  const m = e.target.closest && e.target.closest(".menu");
  if (m && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const items = $$("button", m), i = items.indexOf(e.target); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
  if (e.key !== "Escape") return;
  if (!packModal.hidden) closePack(); else closeMenus();
});
$("#pmClose").addEventListener("click", closePack);
packModal.addEventListener("click", e => { if (e.target === packModal) closePack(); });
$("#dlPack").addEventListener("click", () => { const ids = ["core", ...picked()]; if (clm()) veevaSend(ids, ""); else mergePack(ids); });
$("#pmDownload").addEventListener("click", () => $("#dlPack").click());
let ticking = false;
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
addEventListener("resize", onScroll);

/* ---------- Render ---------- */
function renderAll() { renderChoices(); renderChapters(); renderPack(); syncPrompts(); }
function applySections() { const v = HUB.sections || {}; [["stats", "stats"], ["story", "story"], ["tl", "timeline"], ["pi", "prescribing"]].forEach(([id, k]) => { const el = document.getElementById(id); if (el) el.hidden = v[k] === false; }); const pp = document.getElementById("pmPi"); if (pp) pp.hidden = v.prescribing === false; }
document.getElementById("pmJump").addEventListener("scroll", updateJump, { passive: true });
addEventListener("resize", updateJump);
document.getElementById("pmJumpWrap").addEventListener("click", e => { const a = e.target.closest(".pm-arrow"); if (a) { const n = document.getElementById("pmJump"); n.scrollBy({ left: +a.dataset.jumpDir * Math.max(160, n.clientWidth * 0.7), behavior: "smooth" }); } });
document.addEventListener("click", e => { const tp = e.target.closest && e.target.closest("a[data-top]"); if (tp) { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); return; } const pa = e.target.closest && e.target.closest("a[data-pi]"); if (pa) { e.preventDefault(); piFile(pa.dataset.pi); return; } const a = e.target.closest && e.target.closest("a[data-nolink]"); if (a) { e.preventDefault(); if (a.id === "piView") piFile("view"); else if (a.id === "piDownload") piFile("download"); } });
function boot() { applyButtonText(); applySections(); sanitizeState(); applyBrand(); bindStatic(); renderStats(); renderAll(); onScroll(); if (window.hubConsentLink) window.hubConsentLink(); }

// Live updates from the editor's preview. Only attached in the editor's preview, never in a file that is shared.




/*FLOW_START*/
/* ---------- Mock sign-in screen, consent screen, and optional usage statistics ----------
   Both screens are off unless switched on in the editor, and are removed from the file when both are off.
   The sign-in screen is a MOCK: its button just continues. Real sign-in is done by the host (server) later.
   The consent screen is a notice and a record, not security: the server must also refuse pages and PDFs to anyone with no recorded consent.
   With consent.endpoint set, the record is sent to that address (the login identifies the reader there; the page sends no name).
   Without it, the choice is only remembered for this browser tab, which is fine for a mock-up but is not a record. */
(() => {
  const cons = () => HUB.consent || {}, sign = () => HUB.signin || {};
  const sid = Math.random().toString(36).slice(2, 10);   // per page load, not stored, not linked to a person
  let analyticsOn = false;
  const ss = { get: k => { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const post = (url, body) => fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).then(r => { if (!r.ok) throw new Error("status " + r.status); });

  window.hubTrack = (name, id, desc) => {
    const c = cons(); if (!c.enabled || !c.analytics || !analyticsOn || !c.eventsEndpoint || window.HUB_PREVIEW) return;
    const body = JSON.stringify({ event: name, id: String(id || ""), desc: String(desc || "").slice(0, 120), session: sid, consentVersion: c.version || "1", t: new Date().toISOString() });
    try { if (!(navigator.sendBeacon && navigator.sendBeacon(c.eventsEndpoint, new Blob([body], { type: "application/json" })))) fetch(c.eventsEndpoint, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {}); } catch (e) {}
  };

  const root = document.documentElement;
  function overlay(inner) {
    const old = document.getElementById("consentGate"); if (old) old.remove();
    const el = document.createElement("div"); el.id = "consentGate"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.innerHTML = `<div class="cg-card"><div class="cg-brand">${mark()}</div><div class="cg-bar"></div>${inner}</div>`;
    root.classList.add("consent-wait"); document.body.append(el); return el;
  }
  const close = () => { const el = document.getElementById("consentGate"); if (el) el.remove(); root.classList.remove("consent-wait"); };

  function signinGate(next) {
    const s = sign(), el = overlay(`<h2>${esc(s.title || "Sign in")}</h2>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}
      <div class="cg-row"><button type="button" class="cg-go" id="sgGo">${esc(s.button || "Sign in")}</button></div>
      ${s.help ? `<div class="cg-help"><b>${esc(s.helpTitle || "Need access?")}</b><p>${esc(s.help)}</p></div>` : ""}<p class="cg-note">Mock-up: this button just continues. Real sign-in is added on the server later.</p>`);
    const go = el.querySelector("#sgGo"); go.addEventListener("click", () => { ss.set("hubMockSignin", 1); close(); next(); }); go.focus();
  }

  function consentGate(existing, demo, done) {
    const c = cons(), link = c.privacyUrl ? ` <a href="${esc(c.privacyUrl)}" target="_blank" rel="noopener">Privacy notice</a>` : "";
    const el = overlay(`<h2 id="cgTitle">${esc(c.title || "Before you continue")}</h2><p>${esc(c.intro || "")}</p>
      <label class="cg-tick"><input type="checkbox" id="cgReq"> <span>${esc(c.requiredLabel || "I confirm I am a healthcare professional.")}</span></label>
      ${c.analytics ? `<label class="cg-tick"><input type="checkbox" id="cgAn"> <span>${esc(c.analyticsLabel || "Allow anonymous usage statistics.")}</span></label>` : ""}
      <p class="cg-note">${esc(c.notice || "")}${link}</p><p class="cg-err" id="cgErr" role="alert" hidden></p>
      <div class="cg-row"><button type="button" class="cg-go" id="cgGo" disabled>${esc(c.button || "Continue")}</button>${demo || existing ? `<button type="button" class="cg-cancel" id="cgCancel">Close</button>` : ""}</div>`);
    const req = el.querySelector("#cgReq"), an = el.querySelector("#cgAn"), go = el.querySelector("#cgGo"), err = el.querySelector("#cgErr");
    if (existing) { req.checked = true; if (an) an.checked = !!existing.analytics; go.disabled = false; go.textContent = "Save my choice"; }
    req.addEventListener("change", () => { go.disabled = !req.checked; });
    const cancel = el.querySelector("#cgCancel"); if (cancel) cancel.addEventListener("click", close);
    go.addEventListener("click", async () => {
      const rec = { version: c.version || "1", required: true, analytics: !!(an && an.checked), t: new Date().toISOString() };
      go.disabled = true; err.hidden = true;
      try {
        if (c.endpoint && !demo) await post(c.endpoint, rec); else if (!demo) ss.set("hubConsent:" + rec.version, rec);
        analyticsOn = rec.analytics; close(); if (done) done();
        if (!demo) window.hubTrack("page_view", location.pathname, document.title);
      } catch (e) { err.textContent = "Your choice couldn't be recorded. Check your connection and try again."; err.hidden = false; go.disabled = false; }
    });
    req.focus();
  }

  async function start() {
    if (window.HUB_PREVIEW) return;
    const s = sign(), c = cons();
    const afterSignin = async () => {
      if (!c.enabled) return;
      let existing = null;
      try {
        if (c.endpoint) { const r = await fetch(c.endpoint, { credentials: "include" }); if (r.ok && r.status !== 204) { const j = await r.json(); if (j && j.version === (c.version || "1")) existing = j; } }
        else existing = ss.get("hubConsent:" + (c.version || "1"));
      } catch (e) { /* server unreachable: ask again rather than let the reader through unrecorded */ }
      if (existing) { analyticsOn = !!existing.analytics; window.hubTrack("page_view", location.pathname, document.title); } else consentGate(null, false);
    };
    if (s.enabled && !ss.get("hubMockSignin")) signinGate(afterSignin); else afterSignin();
  }
  window.hubConsentLink = () => {
    // Only offered when there is an optional usage-statistics choice to change later
    const c = cons(), f = document.getElementById("footerInner"); if (!f || !c.enabled || !c.analytics || f.querySelector("[data-consent-link]")) return;
    let row = f.querySelector(".foot-links"); if (!row) { row = document.createElement("div"); row.className = "foot-links"; f.append(row); }
    const b = document.createElement("button"); b.type = "button"; b.dataset.consentLink = "1"; b.textContent = "Usage choices";
    b.addEventListener("click", () => { if (!document.getElementById("consentGate")) consentGate({ analytics: analyticsOn }, false); });
    row.append(b);
  };
  window.hubFlowRestart = () => { ss.del("hubMockSignin"); ss.del("hubConsent:" + (cons().version || "1")); start(); };
  window.hubConsentDemo = () => { if (!document.getElementById("consentGate")) consentGate(null, true); };
  start();
})();
/*FLOW_END*/

/*EDIT_START*/
// The hidden editor (working copy only) pushes edits into the page behind it with this
window.__applyContent = c => { HUB = c; window.HUB = c; boot(); };
// Editing text directly on the page: the editor switches this on; double-click any marked text to change it
(() => {
  let on = false;
  function bar() {
    let b = document.getElementById("inlineBar");
    if (!b) {
      b = document.createElement("div"); b.id = "inlineBar";
      b.innerHTML = `<span>Editing on the page: double-click any text to change it. Enter saves, Esc cancels.</span><button type="button">Back to editor</button>`;
      b.querySelector("button").addEventListener("click", () => { window.__stopInline(); if (window.__showEditor) window.__showEditor(); });
      document.body.append(b);
    }
    b.hidden = false;
  }
  window.__startInline = fn => { window.__inlineSet = fn; on = true; document.body.classList.add("inline-edit"); bar(); if (window.__hideEditor) window.__hideEditor(); };
  window.__stopInline = () => { on = false; document.body.classList.remove("inline-edit"); const b = document.getElementById("inlineBar"); if (b) b.hidden = true; };
  function edit(el) {
    const path = el.dataset.edit || el.dataset.t; let raw = get(HUB, path); if ((raw == null || raw === "") && el.dataset.fallback != null) raw = el.dataset.fallback; if (typeof raw !== "string") return;
    el.textContent = raw;
    try { el.contentEditable = "plaintext-only"; } catch (e) { el.contentEditable = "true"; }
    if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    el.focus(); const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    let done = false;
    const finish = ok => {
      if (done) return; done = true; el.removeAttribute("contenteditable");
      const v = el.textContent.replace(/\s*\n\s*/g, " ").trim();
      if (ok && v !== raw && window.__inlineSet) window.__inlineSet(path, v); else boot();
    };
    el.addEventListener("blur", () => finish(true), { once: true });
    el.addEventListener("keydown", ke => { if (ke.key === "Enter") { ke.preventDefault(); el.blur(); } else if (ke.key === "Escape") { ke.preventDefault(); finish(false); el.blur(); } });
  }
  document.addEventListener("click", e => { if (on && e.target.closest && e.target.closest("[data-edit] a")) e.preventDefault(); });
  document.addEventListener("dblclick", e => {
    if (!on) return;
    const el = e.target.closest && e.target.closest("[data-t],[data-edit]"); if (!el || el.isContentEditable || el.closest("button, a, label")) return;
    e.preventDefault(); edit(el);
  });
})();
/*EDIT_END*/

/*PREVIEW_START*/
// The editor pushes new content into its preview with postMessage({ type: "hub-content", content })
if (window.HUB_PREVIEW) addEventListener("message", ev => {
  const d = ev.data; if (!d || typeof d !== "object") return;
  if (d.type === "hub-content" && d.content) { HUB = d.content; window.HUB = HUB; boot(); }
  else if (d.type === "hub-goto") { if (d.id === "top") scrollTo(0, 0); else { const el = document.getElementById(d.id); if (el) el.scrollIntoView({ block: "start" }); } }
  else if (d.type === "hub-consent-demo") { if (window.hubConsentDemo) window.hubConsentDemo(); }
  else if (d.type === "hub-choose") { state.who = d.who || null; state.eng = d.eng || null; state.removed.clear(); renderAll(); }
});

/*PREVIEW_END*/
boot();
})();
