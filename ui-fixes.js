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

  function initializeUiFixes() {
    setupUtilityMenuHover();
    syncLearningAdvancedControls();

    const observer = new MutationObserver(() => syncLearningAdvancedControls());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeUiFixes, { once: true });
  } else {
    initializeUiFixes();
  }
})();
