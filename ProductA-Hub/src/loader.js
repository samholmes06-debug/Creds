/* Hidden editor entry: click the header 5 times quickly to open the editor. Only the editable working copy has this. */
(() => {
  let n = 0, last = 0;
  function openEditor() {
    const ed = document.getElementById("edHtml"); if (!ed) return;
    const html = ed.textContent.split("</scr" + "@@ipt").join("</scr" + "ipt");
    window.__HANDOFF = JSON.parse(JSON.stringify(window.HUB));
    window.__EDITOR_HTML = html;
    document.open(); document.write(html); document.close();
  }
  window.__openEditor = openEditor;
  document.addEventListener("click", e => {
    const bar = e.target.closest && e.target.closest("header.bar"); if (!bar || e.target.closest("button, a, select, input, label")) return;
    const now = Date.now(); n = now - last > 1500 ? 1 : n + 1; last = now;
    if (n >= 5) { n = 0; openEditor(); }
  });
  if (window.__AUTO_EDIT) addEventListener("DOMContentLoaded", openEditor);
})();
