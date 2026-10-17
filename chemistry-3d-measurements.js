(() => {
  "use strict";
  if (window.__rnaExplorerChemInspectV2Loader) return;
  window.__rnaExplorerChemInspectV2Loader = true;

  function loadTertiarySvgExportFixIfReady() {
    if (document.querySelector('script[data-rna-tertiary-svg-export-fix="true"]')) return true;
    if (!document.getElementById("teImageFormat")) return false;

    const svgFix = document.createElement("script");
    svgFix.src = "tertiary-svg-export-fix.js?v=20261016-3";
    svgFix.dataset.rnaTertiarySvgExportFix = "true";
    document.body.appendChild(svgFix);
    return true;
  }

  function watchForTertiaryExportControls() {
    if (loadTertiarySvgExportFixIfReady() || !document.body) return;

    const observer = new MutationObserver(() => {
      if (loadTertiarySvgExportFixIfReady()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }

  function loadSelectionFix() {
    watchForTertiaryExportControls();
    if (document.querySelector('script[data-rna-chem-3d-selection-fix="true"]')) return;
    const fix = document.createElement("script");
    fix.src = "chemistry-3d-selection-fix.js?v=20261015-3";
    fix.dataset.rnaChem3dSelectionFix = "true";
    document.body.appendChild(fix);
  }

  if (window.__rnaExplorerChemInspectV2) {
    loadSelectionFix();
    return;
  }

  const existing = document.querySelector('script[data-rna-chemistry-inspect-v2="true"]');
  if (existing) {
    existing.addEventListener("load", loadSelectionFix, { once:true });
    loadSelectionFix();
    return;
  }

  const script = document.createElement("script");
  script.src = "chemistry-inspect-v2.js?v=20261015-2";
  script.dataset.rnaChemistryInspectV2 = "true";
  script.addEventListener("load", loadSelectionFix, { once:true });
  document.body.appendChild(script);
})();