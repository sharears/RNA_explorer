(() => {
  "use strict";
  if (window.__rnaExplorerTertiarySvgExportFix) return;
  window.__rnaExplorerTertiarySvgExportFix = true;

  const XLINK = "http://www.w3.org/1999/xlink";
  const SVG_LABEL = "SVG (self-contained raster)";
  const SVG_NOTE = "The 3D viewer is WebGL. SVG export contains the rendered view as a self-contained embedded raster image and includes SVG 1.1 compatibility markup for Illustrator.";

  function makeIllustratorCompatible(svgText) {
    const text = String(svgText || "");
    if (!/<svg\b/i.test(text) || !/<image\b/i.test(text)) return text;

    try {
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      if (doc.querySelector("parsererror")) throw new Error("SVG parse error");
      const root = doc.documentElement;
      if (!root || root.localName.toLowerCase() !== "svg") return text;

      root.setAttribute("version", "1.1");
      if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      root.setAttribute("xmlns:xlink", XLINK);

      root.querySelectorAll("image").forEach(image => {
        const href = image.getAttribute("href") || image.getAttributeNS(XLINK, "href") || "";
        if (!/^data:image\/(?:png|jpeg);base64,/i.test(href)) return;
        image.setAttributeNS(XLINK, "xlink:href", href);
        image.removeAttribute("href");
        if (!image.hasAttribute("x")) image.setAttribute("x", "0");
        if (!image.hasAttribute("y")) image.setAttribute("y", "0");
      });

      let serialized = new XMLSerializer().serializeToString(root);
      if (!/xmlns:xlink=/.test(serialized)) {
        serialized = serialized.replace(/<svg\b/, `<svg xmlns:xlink="${XLINK}"`);
      }
      return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
    } catch (_error) {
      let out = text;
      out = out.replace(/<svg\b(?![^>]*\bversion=)/i, '<svg version="1.1"');
      out = out.replace(/<svg\b(?![^>]*\bxmlns:xlink=)/i, `<svg xmlns:xlink="${XLINK}"`);
      out = out.replace(/<image\b([^>]*?)\shref="(data:image\/(?:png|jpeg);base64,[^"]+)"([^>]*)>/gi,
        (whole, before, href, after) => /xlink:href=/i.test(whole)
          ? whole
          : `<image${before} xlink:href="${href}"${after}>`);
      if (!/^\s*<\?xml/i.test(out)) out = `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;
      return out;
    }
  }

  function patchExportTools() {
    if (typeof ExportTools === "undefined" || typeof ExportTools.downloadText !== "function") return false;
    if (ExportTools.downloadText.__rnaIllustratorCompatibleSvg) return true;

    const original = ExportTools.downloadText;
    const patched = function(text, name, type) {
      const filename = String(name || "");
      const isTertiarySvg = /^rna-tertiary-.*\.svg$/i.test(filename) && /<image\b/i.test(String(text || ""));
      const output = isTertiarySvg ? makeIllustratorCompatible(text) : text;
      return original.call(ExportTools, output, name, type);
    };
    patched.__rnaIllustratorCompatibleSvg = true;
    patched.__rnaOriginalDownloadText = original;
    ExportTools.downloadText = patched;
    return true;
  }

  function updateExportCopy() {
    const format = document.getElementById("teImageFormat");
    const option = format?.querySelector('option[value="svg"]');
    const panel = document.getElementById("teImageExportOptions");
    const note = panel?.querySelector(".te-tool-note");
    if (option && option.textContent !== SVG_LABEL) option.textContent = SVG_LABEL;
    if (note && note.textContent !== SVG_NOTE) note.textContent = SVG_NOTE;
    return Boolean(option && note);
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const ready = patchExportTools();
    updateExportCopy();
    if (ready && attempts > 4) clearInterval(timer);
    if (attempts > 120) clearInterval(timer);
  }, 250);
  patchExportTools();

  if (!updateExportCopy() && document.body) {
    const observer = new MutationObserver(() => {
      if (updateExportCopy()) observer.disconnect();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 30000);
  }
})();
