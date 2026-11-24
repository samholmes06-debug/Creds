/* Hidden editor: click the logo 5 times quickly to open it. "Back to site" in the editor hides it again (the editor keeps your work). */
(() => {
  let n = 0, last = 0, frame = null;
  function showEditor() {
    if (window.__stopInline) window.__stopInline();
    if (!frame) {
      const ed = document.getElementById("edHtml"); if (!ed) return;
      window.__HANDOFF = JSON.parse(JSON.stringify(window.HUB));
      frame = document.createElement("iframe"); frame.id = "edFrame"; frame.title = "Editor";
      frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:5000;background:#fff;visibility:visible";
      frame.srcdoc = ed.textContent.split("</scr" + "@@ipt").join("</scr" + "ipt");
      document.body.append(frame);
    } else frame.style.display = "block";
    document.documentElement.style.overflow = "hidden";
  }
  window.__showEditor = showEditor;
  window.__hideEditor = () => { if (frame) frame.style.display = "none"; document.documentElement.style.overflow = ""; };
  document.addEventListener("click", e => {
    if (!(e.target.closest && e.target.closest("#brand"))) return;
    const now = Date.now(); n = now - last > 1500 ? 1 : n + 1; last = now;
    if (n >= 5) { n = 0; showEditor(); }
  });
})();
