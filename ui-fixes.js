(() => {
  "use strict";

  function setupUtilityMenuHover() {
    const menu = document.getElementById("utilityMenu");
    if (!menu || menu.dataset.hoverReady === "true") return;
    menu.dataset.hoverReady = "true";

    const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    let closeTimer = null;
    const canHover = () => finePointer ? finePointer.matches : true;
    const cancelClose = () => {
      if (closeTimer !== null) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    };
    const openMenu = () => {
      if (!canHover()) return;
      cancelClose();
      menu.open = true;
    };
    const scheduleClose = () => {
      if (!canHover()) return;
      cancelClose();
      closeTimer = setTimeout(() => {
        closeTimer = null;
        if (!menu.matches(":hover") && !menu.matches(":focus-within")) menu.open = false;
      }, 140);
    };

    menu.addEventListener("mouseenter", openMenu);
    menu.addEventListener("mouseleave", scheduleClose);
    menu.addEventListener("focusin", cancelClose);
    menu.addEventListener("focusout", scheduleClose);
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

    // Force the newly regenerated artwork rather than a browser-cached older cover.
    const desiredSource = "assets/rna-home-cover.webp?v=trna-craftsman-20261004";
    if (!image.getAttribute("src")?.includes("trna-craftsman-20261004")) {
      image.setAttribute("src", desiredSource);
    }

    if (!document.getElementById("home-cover-regenerated-blend")) {
      const style = document.createElement("style");
      style.id = "home-cover-regenerated-blend";
      style.textContent = `
        .home-cover-art {
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .home-cover-art img {
          -webkit-mask-image: radial-gradient(ellipse 91% 92% at 50% 50%, #000 0%, #000 54%, rgba(0,0,0,.98) 66%, rgba(0,0,0,.74) 79%, rgba(0,0,0,.30) 90%, transparent 100%) !important;
          mask-image: radial-gradient(ellipse 91% 92% at 50% 50%, #000 0%, #000 54%, rgba(0,0,0,.98) 66%, rgba(0,0,0,.74) 79%, rgba(0,0,0,.30) 90%, transparent 100%) !important;
        }
        .home-cover-art::after {
          inset: -1px !important;
          background:
            linear-gradient(to right, rgba(8,24,43,.92) 0%, rgba(8,24,43,.48) 5%, rgba(8,24,43,.10) 11%, transparent 18%, transparent 82%, rgba(8,24,43,.10) 89%, rgba(8,24,43,.48) 95%, rgba(8,24,43,.92) 100%),
            linear-gradient(to bottom, rgba(8,24,43,.88) 0%, rgba(8,24,43,.42) 5%, rgba(8,24,43,.08) 11%, transparent 18%, transparent 82%, rgba(8,24,43,.08) 89%, rgba(8,24,43,.42) 95%, rgba(8,24,43,.88) 100%) !important;
          pointer-events: none;
        }
        @media (max-width: 620px) {
          .home-cover-art img {
            -webkit-mask-image: radial-gradient(ellipse 94% 93% at 50% 50%, #000 0%, #000 58%, rgba(0,0,0,.94) 72%, rgba(0,0,0,.48) 87%, transparent 100%) !important;
            mask-image: radial-gradient(ellipse 94% 93% at 50% 50%, #000 0%, #000 58%, rgba(0,0,0,.94) 72%, rgba(0,0,0,.48) 87%, transparent 100%) !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function initializeUiFixes() {
    setupUtilityMenuHover();
    syncLearningAdvancedControls();
    setupHomeCoverArtwork();

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
