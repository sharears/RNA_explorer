(() => {
  "use strict";
  if (window.__rnaExplorerChemInspectV2Loader) return;
  window.__rnaExplorerChemInspectV2Loader = true;

  function loadSitePolish() {
    if (document.querySelector('script[data-rna-site-polish="true"]')) return;
    const polish = document.createElement("script");
    polish.src = "rna-site-polish.js?v=20261015-1";
    polish.dataset.rnaSitePolish = "true";
    document.body.appendChild(polish);
  }

  function loadSelectionFix() {
    if (document.querySelector('script[data-rna-chem-3d-selection-fix="true"]')) {
      loadSitePolish();
      return;
    }
    const fix = document.createElement("script");
    fix.src = "chemistry-3d-selection-fix.js?v=20261015-3";
    fix.dataset.rnaChem3dSelectionFix = "true";
    fix.addEventListener("load", loadSitePolish, { once:true });
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