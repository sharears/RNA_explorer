(() => {
  "use strict";

  function setupUtilityMenuHover() {
    // More is click/keyboard activated, not hover activated: its old hover
    // bridge was accidentally opening over Explore in the compact topbar.
    const menu=document.getElementById("utilityMenu");
    if(!menu||menu.dataset.exclusiveMenuReady==="true")return;
    menu.dataset.exclusiveMenuReady="true";
    const navButtons=()=>document.querySelectorAll(".nav-menu > button");
    const closeNav=()=>navButtons().forEach(b=>b.setAttribute("aria-expanded","false"));
    menu.addEventListener("toggle",()=>{if(menu.open)closeNav();});
    document.addEventListener("pointerdown",e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;},true);
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape"&&menu.open){menu.open=false;menu.querySelector("summary")?.focus();}
    });
    const nav=document.getElementById("innerNav");
    nav?.addEventListener("pointerover",()=>{if(menu.open)menu.open=false;});
    nav?.addEventListener("focusin",()=>{if(menu.open)menu.open=false;});
  }

  function renderTertiaryWithAdvancedMode() {
    const scene = document.getElementById("scene-tertiary");
    if (!scene?.classList.contains("learning-tools-open") || document.body.dataset.pageMode !== "journey") {
      if (typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render();
      return;
    }
    document.body.dataset.pageMode = "journey-advanced";
    try {
      if (typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render();
    } finally {
      queueMicrotask(() => {
        if (document.body.dataset.pageMode === "journey-advanced") document.body.dataset.pageMode = "journey";
      });
    }
  }

  function setupTertiaryAdvancedEventBridge() {
    const scene = document.getElementById("scene-tertiary");
    if (!scene || scene.dataset.advancedEventBridgeReady === "true") return;
    scene.dataset.advancedEventBridgeReady = "true";

    const begin = () => {
      if (!scene.classList.contains("learning-tools-open")) return;
      if (document.body.dataset.pageMode !== "journey") return;
      scene.dataset.restorePageMode = "journey";
      document.body.dataset.pageMode = "journey-advanced";
    };
    const finish = () => {
      if (!scene.dataset.restorePageMode) return;
      delete scene.dataset.restorePageMode;
      queueMicrotask(() => {
        if (document.body.dataset.pageMode === "journey-advanced") document.body.dataset.pageMode = "journey";
      });
    };

    ["click", "change", "input"].forEach(type => {
      scene.addEventListener(type, begin, true);
      scene.addEventListener(type, finish, false);
    });
  }

  function setTextIfChanged(element, text) {
    if (element && element.textContent !== text) element.textContent = text;
  }

  function syncLearningAdvancedControls() {
    const secondaryScene = document.getElementById("scene-secondary");
    const secondaryPanel = secondaryScene?.querySelector(".workspace-advanced-panel");
    if (secondaryPanel) {
      const summary = secondaryPanel.querySelector(":scope > summary");
      setTextIfChanged(summary, "Advanced controls");
      if (secondaryPanel.dataset.learningSyncReady !== "true") {
        secondaryPanel.dataset.learningSyncReady = "true";
        secondaryPanel.addEventListener("toggle", () => {
          secondaryScene.classList.toggle("learning-tools-open", secondaryPanel.open);
        });
      }
      secondaryScene.classList.toggle("learning-tools-open", secondaryPanel.open);
    }

    const legacySecondaryButton = document.getElementById("gpsSecondaryCustomize");
    if (legacySecondaryButton) legacySecondaryButton.hidden = true;

    const representation = document.getElementById("teRepresentation");
    const sticks = representation?.querySelector('option[value="sticks"]');
    setTextIfChanged(sticks, "Sticks");

    const tertiaryButton = document.getElementById("gpsTertiaryCustomize");
    if (tertiaryButton) {
      setTextIfChanged(tertiaryButton, "Advanced controls");
      if (tertiaryButton.dataset.simpleAdvancedReady !== "true") {
        tertiaryButton.dataset.simpleAdvancedReady = "true";
        tertiaryButton.addEventListener("click", () => {
          queueMicrotask(() => {
            setTextIfChanged(tertiaryButton, "Advanced controls");
            renderTertiaryWithAdvancedMode();
          });
        });
      }
    }

    setupTertiaryAdvancedEventBridge();
  }

  function setupHomeCoverArtwork() {
    const art = document.querySelector(".home-cover-art");
    const image = art?.querySelector("img");
    if (!art || !image) return;

    const desiredSource = "assets/rna-home-cover.webp?v=trna-craftsman-20261004e";
    if (!image.getAttribute("src")?.includes("trna-craftsman-20261004e")) {
      image.setAttribute("src", desiredSource);
    }

    image.style.setProperty("display", "block", "important");
    image.style.setProperty("opacity", "1", "important");
    image.style.setProperty("visibility", "visible", "important");
    image.style.setProperty("-webkit-mask-image", "none", "important");
    image.style.setProperty("mask-image", "none", "important");

    if (!document.getElementById("home-cover-regenerated-blend")) {
      const style = document.createElement("style");
      style.id = "home-cover-regenerated-blend";
      style.textContent = `
        .home-cover-art {
          position: relative !important;
          overflow: hidden !important;
          border-radius: 18px !important;
          background: rgb(8,24,43) !important;
          box-shadow: none !important;
        }
        .home-cover-art img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 560px !important;
          object-fit: cover !important;
          object-position: center 46% !important;
          opacity: 1 !important;
          visibility: visible !important;
          -webkit-mask-image: none !important;
          mask-image: none !important;
        }
        .home-cover-art::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: 2 !important;
          background:
            linear-gradient(to right, rgb(8,24,43) 0%, rgba(8,24,43,.72) 4%, rgba(8,24,43,.30) 9%, rgba(8,24,43,.08) 14%, transparent 20%, transparent 80%, rgba(8,24,43,.08) 86%, rgba(8,24,43,.30) 91%, rgba(8,24,43,.72) 96%, rgb(8,24,43) 100%),
            linear-gradient(to bottom, rgb(8,24,43) 0%, rgba(8,24,43,.68) 4%, rgba(8,24,43,.26) 9%, rgba(8,24,43,.07) 14%, transparent 20%, transparent 80%, rgba(8,24,43,.07) 86%, rgba(8,24,43,.26) 91%, rgba(8,24,43,.68) 96%, rgb(8,24,43) 100%) !important;
          pointer-events: none !important;
        }
        .home-thought-bubble,
        .home-cover-art figcaption {
          z-index: 3 !important;
        }
        @media (max-width: 980px) {
          .home-cover-art img { min-height: 520px !important; object-position: center 42% !important; }
        }
        @media (max-width: 620px) {
          .home-cover-art img { min-height: 440px !important; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function loadWorkspaceTools() {
    if (document.querySelector('script[data-rna-workspace-tools="true"]')) return;
    const script = document.createElement("script");
    script.src = "workspace-tools.js?v=3";
    script.dataset.rnaWorkspaceTools = "true";
    document.body.appendChild(script);
  }

  function loadTertiaryEnhancements() {
    if (document.querySelector('script[data-rna-tertiary-enhancements="true"]')) return;
    const script = document.createElement("script");
    script.src = "tertiary-enhancements-v2.js?v=20261014-2";
    script.dataset.rnaTertiaryEnhancements = "true";
    document.body.appendChild(script);
  }

  function loadChemistryMeasurements() {
    if (document.querySelector('script[data-rna-chemistry-measurements="true"]')) return;
    const script = document.createElement("script");
    script.src = "chemistry-3d-measurements.js?v=20261015-2";
    script.dataset.rnaChemistryMeasurements = "true";
    document.body.appendChild(script);
  }

  function loadOct15Updates() {
    if (document.querySelector('script[data-rna-oct15-updates="true"]')) return;
    const script = document.createElement("script");
    script.src = "oct15-ui-updates.js?v=20261015-3";
    script.dataset.rnaOct15Updates = "true";
    document.body.appendChild(script);
  }

  function initializeUiFixes() {
    setupUtilityMenuHover();
    syncLearningAdvancedControls();
    setupHomeCoverArtwork();
    loadWorkspaceTools();
    loadTertiaryEnhancements();
    loadChemistryMeasurements();
    loadOct15Updates();

    const observer = new MutationObserver(() => {
      syncLearningAdvancedControls();
      setupHomeCoverArtwork();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeUiFixes, { once: true });
  } else {
    initializeUiFixes();
  }
})();