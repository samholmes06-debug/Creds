/* Hub runtime: renders the whole page from window.HUB (see content.js). */
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
const pagesOf = d => (d.images && d.images.length) ? d.images.length : Math.max(1, +d.pages || 1);
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
  if (!clm() || V().trackEvents === false) return;
  const key = type + ":" + id;
  if (once && tracked.has(key)) return;
  tracked.add(key);
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
  document.body.classList.toggle("no-mock", !b.mockLabel);
  $("#conceptStrip").textContent = b.mockLabel || "";
}
const mark = (cls = "") => HUB.brand && HUB.brand.logo ? `<img class="logo" src="${esc(HUB.brand.logo)}" alt="${esc(HUB.brand.productName)}">` : `<i aria-hidden="true"></i>${esc((HUB.brand || {}).productName)}`;

/* ---------- Static text and shell ---------- */
function bindStatic() {
  $$("[data-t]").forEach(el => { const v = get(HUB, el.dataset.t); el.textContent = v == null ? "" : v; });
  const b = HUB.brand || {}, h = HUB.hero || {}, c = HUB.core || {};
  $("#brand").innerHTML = (HUB.brand && HUB.brand.logo ? mark() : `<i aria-hidden="true"></i><span>${esc(b.productName)}</span>`) + (b.mockLabel ? `<span class="concept">${esc(b.mockLabel)}</span>` : "");
  $("#coverBrand").innerHTML = (HUB.brand && HUB.brand.logo) ? "" : `<i></i>${esc(b.productName)}`;
  // Only redraw the title when its text changes, so its rise-in animation doesn't replay on every edit
  const titleHtml = (h.titleLines || []).map(t => `<span class="line"><span>${esc(t)}</span></span>`).join("");
  if ($("#heroTitle").dataset.h !== titleHtml) { $("#heroTitle").innerHTML = titleHtml; $("#heroTitle").dataset.h = titleHtml; }
  $("#coverMeta").textContent = `PDF · ${pagesOf(c)} pages · ${b.jobCode || ""}`;
  const inV = !!clm();
  $("#barCore").innerHTML = inV ? `<span class="long">Send core PDF</span><span class="short">Send PDF</span><span aria-hidden="true">✉</span>` : `<span class="long">Download core PDF</span><span class="short">Core PDF</span><span aria-hidden="true">↓</span>`;
  $("#heroDownload").innerHTML = inV ? `Send core PDF <span aria-hidden="true">✉</span>` : `Download PDF <span aria-hidden="true">↓</span>`;
  $("#storyDownload").innerHTML = (esc((HUB.story || {}).downloadLabel || "Download the core notification")) + (inV ? ` <span aria-hidden="true">✉</span>` : ` <span aria-hidden="true">↓</span>`);
  $("#storyMeta").textContent = `PDF · ${pagesOf(c)} pages`;
  $("#dlPack").innerHTML = inV ? `Send pack by Approved Email <span aria-hidden="true">✉</span>` : `Download as one PDF <span aria-hidden="true">↓</span>`;
  $("#pmDownload").innerHTML = inV ? `Send pack <span aria-hidden="true">✉</span>` : `Download pack <span aria-hidden="true">↓</span>`;
  $("#showEmail").hidden = inV;
  $("#emailCode").textContent = `Approved email · ${b.jobCode || ""}`;
  const lg = HUB.legal || {};
  $("#footerInner").innerHTML = `<p><b>${esc(lg.title)}</b> · Job code ${esc(b.jobCode)} · Date of preparation ${esc(b.datePrepared)}</p>` + (lg.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join("");
  $("#pickWho b").textContent = who() ? who().label : (HUB.builder || {}).whoPlaceholder || "Choose";
  $("#pickEng b").textContent = eng() ? eng().label : (HUB.builder || {}).engPlaceholder || "Choose";
  $("#pickWho b").classList.toggle("empty", !who());
  $("#pickEng b").classList.toggle("empty", !eng());
  // Timeline
  $("#tlTrack").innerHTML = ((HUB.timeline || {}).items || []).map(i => `<div class="ms ${i.state === "done" ? "done" : i.state === "now" ? "now" : ""}"><span class="dot"></span><span class="tag">${esc(i.tag)}</span><span class="when">${esc(i.when)}</span><span class="what">${esc(i.what)}</span><p>${esc(i.text)}</p></div>`).join("");
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
  $("#slides").innerHTML = st.map((s, i) => `<div class="slide${i === 0 ? " on" : ""}" data-i="${i}"><div class="num" data-count="${/^[\d,]+$/.test(s.value) && s.countUp !== false ? 1 : ""}">${statHtml(s)}</div><div class="copy"><h3>${esc(s.heading)}</h3><p>${esc(s.text)}</p>${s.module && info(s.module) ? promptCard(s.module) : ""}</div></div>`).join("");
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
  return `<div class="prompt" data-prompt="${esc(id)}">${cover(id)}<div><div class="label p-label">Related module · ${pagesOf(m)} pages</div><div class="p-title">${esc(m.name)}<span class="rec" hidden>Recommended</span></div><div class="p-q">${esc(m.question || "")}</div></div><button type="button" class="add-btn" data-toggle="${esc(id)}" aria-pressed="false">Add to pack</button></div>`;
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
  $("#chapters").innerHTML = list.map((c, i) => `<article class="chapter" data-ch="${esc(c.id)}"><div class="ch-side"><span class="ch-n">${pad(i + 1)}</span><h3>${esc(c.title)}</h3>${top.includes(c.id) && who() ? `<span class="ch-for">Key for ${esc(who().plural || who().label)}</span>` : ""}</div><div class="ch-body"><p class="lead">${md(c.lead)}</p>${(c.facts || []).length ? `<div class="ch-facts">${c.facts.map(f => `<div><span>${esc(f[0])}</span><b>${esc(f[1])}</b></div>`).join("")}</div>` : ""}${c.module && info(c.module) ? promptCard(c.module) : ""}</div></article>`).join("");
  if (chObs) chObs.disconnect();
  chObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("seen"); const c = (HUB.chapters || []).find(x => x.id === e.target.dataset.ch); veevaTrack("chapter_viewed", e.target.dataset.ch, c ? c.title : "", true); } }), { rootMargin: "0px 0px -45% 0px" });
  $$(".chapter").forEach(c => chObs.observe(c));
}

/* ---------- Pack: dock, finale, viewer ---------- */
function renderPack() {
  const ids = picked(), all = ["core", ...ids], pp = totalPages(ids), docs = `${all.length} document${all.length > 1 ? "s" : ""}`;
  $("#dockStack").innerHTML = all.map(id => cover(id)).join("");
  $("#dockCount").textContent = docs; $("#dockPages").textContent = `${pp} pages`;
  $("#finDocs").textContent = all.length;
  $("#finPages").innerHTML = `document${all.length > 1 ? "s" : ""}<br>${pp} pages`;
  $("#finFor").innerHTML = state.who && state.eng ? `Built for a <b>${esc(who().label.toLowerCase())}</b> · <b>${esc(eng().label.toLowerCase())}</b>` : "Choose a stakeholder and engagement in the bar above for recommended modules.";
  $("#finList").innerHTML = `<li class="core"><span class="n">00</span><span>${esc(HUB.core.name)}</span><span class="pp">${pagesOf(HUB.core)} pp</span><span></span></li>` +
    ids.map((id, i) => `<li><span class="n">${pad(i + 1)}</span><span>${esc(info(id).name)}</span><span class="pp">${pagesOf(info(id))} pp</span><button type="button" class="x-btn" data-toggle="${esc(id)}" aria-label="Remove ${esc(info(id).name)}">Remove</button></li>`).join("");
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
  const foot = n => `<div class="pg-foot"><span>Job code ${esc(b.jobCode)} · ${esc(b.datePrepared)}</span><span>Page ${n} of ${pagesOf(d)}</span></div>`;
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
function renderViewer(all, pp) {
  $("#pmCount").textContent = `${all.length} documents · ${pp} pages`;
  $("#pmTitle").textContent = who() ? `Pack for ${who().label.toLowerCase()}` : "Your pack";
  $("#pmJump").innerHTML = all.map((id, i) => `<button type="button" data-jump="${esc(id)}">${pad(i)} · ${esc(shortName(info(id)))}</button>`).join("");
  const draft = all.filter(id => !(info(id).images && info(id).images.length));
  const note = $("#pmNote"); note.hidden = !draft.length;
  note.textContent = draft.length ? `Draft pages: ${draft.length === all.length ? "these pages stand in for the artworked PDFs." : draft.length + " of " + all.length + " documents still show draft pages in place of the artworked PDF."} Once the approved PDF is added, it appears here and downloads as the same file.` : "";
  $("#pmDocs").innerHTML = all.map((id, i) => {
    const d = info(id), real = d.images && d.images.length;
    const btns = `${clm() && (V().pdfSlides || {})[id] ? `<button class="chip-btn" type="button" data-open-slide="${esc(id)}">Open PDF</button>` : ""}<button class="chip-btn" type="button" data-pdf="${esc(id)}">${clm() ? "Send PDF ✉" : "Download PDF ↓"}</button>${isCore(id) ? "" : `<button class="chip-btn" type="button" data-toggle="${esc(id)}">Remove</button>`}`;
    return `<section class="pm-doc" id="doc-${esc(id)}" aria-label="${esc(d.name)}"><div class="pm-doc-head"><span class="n${isCore(id) ? " core" : ""}">${pad(i)}</span><div><div class="label">${esc(d.code || "")} · PDF · ${pagesOf(d)} pages</div><h3>${esc(d.name)}</h3></div><div class="btns">${btns}</div></div>${real ? d.images.map((src, n) => `<div class="pm-page img"><img src="${esc(src)}" alt="${esc(d.name)}, page ${n + 1}" loading="lazy"></div>`).join("") : mockPages(id, d)}</section>`;
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
async function getBytes(src) { if (src.startsWith("data:")) return dataToBytes(src); const r = await fetch(src); if (!r.ok) throw new Error("fetch"); return new Uint8Array(await r.arrayBuffer()); }
function saveBlob(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
function downloadDoc(id) {
  const d = info(id);
  if (!hasPdf(d)) return toast(`${d.name} will be available to download once the artwork is approved.`);
  const name = (d.code || id) + ".pdf";
  if (d.pdf.startsWith("data:")) saveBlob(new Blob([dataToBytes(d.pdf)], { type: "application/pdf" }), name);
  else {
    // From a local folder browsers won't honour "download" on a file link, and would replace the hub with the PDF, so open it in a new tab
    const a = document.createElement("a"); a.href = d.pdf;
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
    for (const id of withPdf) { const src = await PDFLib.PDFDocument.load(await getBytes(info(id).pdf), { ignoreEncryption: true }); (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p)); }
    saveBlob(new Blob([await out.save()], { type: "application/pdf" }), `${slug((HUB.brand || {}).productName)}-pack.pdf`);
    toast(withPdf.length < ids.length ? `Pack downloaded. ${ids.length - withPdf.length} document(s) have no PDF yet.` : "Pack downloaded as one PDF");
  } catch (e) { toast("Couldn't merge here: browsers block reading PDF files from a local folder. Use the single-file export or a web host, or download each PDF from the pack viewer."); }
}

/* ---------- Pack viewer and email ---------- */
const packModal = $("#packModal"), overlay = $("#emailOverlay");
function openPack(target) {
  veevaTrack("pack_viewed", ["core", ...picked()].join(","), "Pack viewer opened");
  packModal.hidden = false; document.body.classList.add("modal-open"); $("#dock").classList.add("away"); $("#pmScroll").scrollTop = 0;
  const d = target && document.getElementById("doc-" + target); if (d) d.scrollIntoView({ block: "start" });
  $("#pmClose").focus();
}
function closePack() { packModal.hidden = true; document.body.classList.remove("modal-open"); onScroll(); }
function emailText() {
  const e = eng() || (HUB.engagements || [])[0] || { subject: "Information", intro: "" }, em = HUB.email || {};
  const links = [HUB.core.name, ...picked().map(id => info(id).name)];
  return `Subject: ${e.subject}\n\nDear [Name],\n\n${e.intro}\n\n${links.map(l => "• " + l + ": [hub link]").join("\n")}\n\n${em.closing || ""}\n\n${em.signoff || ""}\n\nJob code ${(HUB.brand || {}).jobCode || ""} · Date of preparation ${(HUB.brand || {}).datePrepared || ""}`;
}
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
  if (!overlay.hidden) { overlay.hidden = true; $("#showEmail").focus(); } else if (!packModal.hidden) closePack(); else closeMenus();
});
$("#pmClose").addEventListener("click", closePack);
packModal.addEventListener("click", e => { if (e.target === packModal) closePack(); });
$("#dlPack").addEventListener("click", () => { const ids = ["core", ...picked()]; if (clm()) veevaSend(ids, ""); else mergePack(ids); });
$("#pmDownload").addEventListener("click", () => $("#dlPack").click());
$("#showEmail").addEventListener("click", () => { $("#emailBody").textContent = emailText(); overlay.hidden = false; $("#closeEmail").focus(); });
$("#closeEmail").addEventListener("click", () => { overlay.hidden = true; $("#showEmail").focus(); });
overlay.addEventListener("click", e => { if (e.target === overlay) overlay.hidden = true; });
$("#copyEmail").addEventListener("click", () => {
  const fallback = () => { const r = document.createRange(); r.selectNodeContents($("#emailBody")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Text selected. Press Ctrl+C or ⌘C to copy."); };
  if (navigator.clipboard) navigator.clipboard.writeText(emailText()).then(() => toast("Email text copied"), fallback); else fallback();
});
let ticking = false;
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
addEventListener("resize", onScroll);

/* ---------- Render ---------- */
function renderAll() { renderChoices(); renderChapters(); renderPack(); syncPrompts(); }
function boot() { sanitizeState(); applyBrand(); bindStatic(); renderStats(); renderAll(); onScroll(); }

// Live updates from the editor's preview. Only attached in the editor's preview, never in a file that is shared.
/*PREVIEW_START*/
// The editor pushes new content into its preview with postMessage({ type: "hub-content", content })
if (window.HUB_PREVIEW) addEventListener("message", ev => {
  const d = ev.data; if (!d || typeof d !== "object") return;
  if (d.type === "hub-content" && d.content) { HUB = d.content; window.HUB = HUB; boot(); }
  else if (d.type === "hub-goto") { if (d.id === "top") scrollTo(0, 0); else { const el = document.getElementById(d.id); if (el) el.scrollIntoView({ block: "start" }); } }
  else if (d.type === "hub-choose") { state.who = d.who || null; state.eng = d.eng || null; state.removed.clear(); renderAll(); }
});

/*PREVIEW_END*/
boot();
})();
