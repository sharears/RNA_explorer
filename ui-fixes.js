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

  function syncLearningAdvancedControls() {
    const secondaryScene = document.getElementById("scene-secondary");
    const secondaryPanel = secondaryScene?.querySelector(".workspace-advanced-panel");
    if (secondaryPanel) {
      const summary = secondaryPanel.querySelector(":scope > summary");
      if (summary) summary.textContent = "Advanced controls";
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

    const tertiaryButton = document.getElementById("gpsTertiaryCustomize");
    if (tertiaryButton) {
      tertiaryButton.textContent = "Advanced controls";
      if (tertiaryButton.dataset.simpleAdvancedReady !== "true") {
        tertiaryButton.dataset.simpleAdvancedReady = "true";
        tertiaryButton.addEventListener("click", () => {
          queueMicrotask(() => {
            tertiaryButton.textContent = "Advanced controls";
            if (typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render();
          });
        });
      }
    }
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
