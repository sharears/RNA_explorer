(() => {
  "use strict";
  if (window.__rnaExplorerChemInspectV2Loader) return;
  window.__rnaExplorerChemInspectV2Loader = true;
  if (window.__rnaExplorerChemInspectV2) return;
  const existing = document.querySelector('script[data-rna-chemistry-inspect-v2="true"]');
  if (existing) return;
  const script = document.createElement("script");
  script.src = "chemistry-inspect-v2.js?v=20261015-2";
  script.dataset.rnaChemistryInspectV2 = "true";
  document.body.appendChild(script);
})();