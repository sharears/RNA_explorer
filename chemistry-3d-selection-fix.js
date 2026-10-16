(() => {
  "use strict";
  if (window.__rnaExplorerChem3DSelectionFix) return;
  window.__rnaExplorerChem3DSelectionFix = true;

  const $ = id => document.getElementById(id);

  function activeSelectionMode() {
    const property = $("chemInspectPropertyV2")?.value;
    const scope = $("chemInspectScopeV2")?.value;
    return Boolean(property && property !== "off" && scope === "select");
  }

  function selectionSignature() {
    return [...document.querySelectorAll("#chemEditorSvg [data-atom-id].chem-inspect-selected")]
      .map(el => el.dataset.atomId || "")
      .join("|");
  }

  function viewerForHost(host) {
    if (!host) return null;
    for (const canvas of host.querySelectorAll("canvas")) {
      if (canvas._3dmol_viewer) return canvas._3dmol_viewer;
    }
    return null;
  }

  function modelForViewer(viewer) {
    if (!viewer) return null;
    try {
      const models = viewer.getModels?.();
      if (Array.isArray(models) && models.length) return models[0];
    } catch (_error) {}
    try { return viewer.getModel?.() || null; }
    catch (_error) { return null; }
  }

  function graphAtoms() {
    try { return MoleculeEditor?.getCurrentGraph?.()?.atoms || []; }
    catch (_error) { return []; }
  }

  function editableIndex(atom, limit) {
    let index = Number.isInteger(atom?.index) ? atom.index : -1;
    if (index < 0 && Number.isFinite(Number(atom?.serial))) index = Number(atom.serial) - 1;
    return Number.isInteger(index) && index >= 0 && index < limit ? index : -1;
  }

  function nearestEditableAtom(viewer, model, clientX, clientY, pointerType) {
    if (!viewer || !model || typeof viewer.modelToScreen !== "function") return null;
    const drawn = graphAtoms();
    if (!drawn.length) return null;

    let atoms = [];
    try { atoms = model.selectedAtoms?.({}) || []; }
    catch (_error) { return null; }
    const candidates = atoms.filter(atom => editableIndex(atom, drawn.length) >= 0);
    if (!candidates.length) return null;

    let points;
    try { points = viewer.modelToScreen(candidates); }
    catch (_error) { return null; }
    if (!Array.isArray(points)) points = [points];

    const pageX = Number(clientX) + window.scrollX;
    const pageY = Number(clientY) + window.scrollY;
    const threshold = pointerType === "touch" ? 36 : 22;
    let best = null;
    for (let i = 0; i < candidates.length; i++) {
      const point = points[i];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      const distance = Math.hypot(point.x - pageX, point.y - pageY);
      if (!best || distance < best.distance) best = { atom:candidates[i], distance };
    }
    return best && best.distance <= threshold ? best.atom : null;
  }

  function selectThroughShared2DPath(atom) {
    const drawn = graphAtoms();
    const index = editableIndex(atom, drawn.length);
    const id = index >= 0 ? drawn[index]?.id : null;
    if (!id) return false;
    const group = [...document.querySelectorAll("#chemEditorSvg [data-atom-id]")]
      .find(el => el.dataset.atomId === id);
    if (!group) return false;
    const before = selectionSignature();
    try {
      group.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles:true, cancelable:true, pointerType:"mouse", button:0, buttons:1,
        clientX:0, clientY:0
      }));
    } catch (_error) {
      try { group.dispatchEvent(new MouseEvent("mousedown", { bubbles:true, cancelable:true, button:0, buttons:1 })); }
      catch (_error2) { return false; }
    }
    return selectionSignature() !== before;
  }

  function fallbackPick(host, clientX, clientY, originalEvent, pointerType) {
    if (!activeSelectionMode()) return false;
    const viewer = viewerForHost(host);
    const model = modelForViewer(viewer);
    if (!viewer || !model) return false;
    const atom = nearestEditableAtom(viewer, model, clientX, clientY, pointerType);
    if (!atom) return false;

    if (selectThroughShared2DPath(atom)) {
      try { viewer.render?.(); } catch (_error) {}
      return true;
    }

    if (typeof atom.callback === "function") {
      try {
        atom.callback(atom, viewer, originalEvent, host, [{ clickable:atom, distance:0 }]);
        viewer.render?.();
        return true;
      } catch (_error) {}
    }
    return false;
  }

  function scheduleFallback(host, x, y, event, type, before, delay=55) {
    setTimeout(() => {
      if (!activeSelectionMode() || selectionSignature() !== before) return;
      fallbackPick(host, x, y, event, type);
    }, delay);
  }

  function bind(host) {
    if (!host || host.dataset.reliableInspectPick === "1") return;
    host.dataset.reliableInspectPick = "1";
    const pointers = new Map();
    let lastPointerFallbackAt = 0;

    host.addEventListener("pointerdown", event => {
      if (!activeSelectionMode()) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const entry = {
        startX:event.clientX, startY:event.clientY,
        x:event.clientX, y:event.clientY,
        moved:false, multi:pointers.size > 0,
        type:event.pointerType || "mouse",
        before:selectionSignature()
      };
      pointers.set(event.pointerId, entry);
      if (pointers.size > 1) pointers.forEach(pointer => { pointer.multi = true; });
    }, true);

    host.addEventListener("pointermove", event => {
      const entry = pointers.get(event.pointerId);
      if (!entry) return;
      entry.x = event.clientX;
      entry.y = event.clientY;
      const tolerance = entry.type === "touch" ? 12 : 5;
      if (Math.hypot(entry.x-entry.startX, entry.y-entry.startY) > tolerance) entry.moved = true;
    }, true);

    const finish = event => {
      const entry = pointers.get(event.pointerId);
      if (!entry) return;
      pointers.delete(event.pointerId);
      if (entry.moved || entry.multi || !activeSelectionMode()) return;
      lastPointerFallbackAt = performance.now();
      scheduleFallback(host, entry.x, entry.y, event, entry.type, entry.before, 65);
    };

    host.addEventListener("pointerup", finish, true);
    host.addEventListener("pointercancel", event => pointers.delete(event.pointerId), true);

    // Some browser/3Dmol combinations consume pointerup before its atom callback,
    // while still emitting a normal click. Keep a click fallback for desktop.
    host.addEventListener("click", event => {
      if (!activeSelectionMode() || event.button !== 0) return;
      if (performance.now() - lastPointerFallbackAt < 140) return;
      const before = selectionSignature();
      scheduleFallback(host, event.clientX, event.clientY, event, "mouse", before, 35);
    }, true);

    // iOS/Safari can be more reliable with touchend than synthetic click after a tap.
    host.addEventListener("touchend", event => {
      if (!activeSelectionMode() || event.touches?.length || event.changedTouches?.length !== 1) return;
      if (performance.now() - lastPointerFallbackAt < 140) return;
      const touch = event.changedTouches[0], before = selectionSignature();
      scheduleFallback(host, touch.clientX, touch.clientY, event, "touch", before, 35);
    }, {capture:true,passive:true});
  }

  function refresh() {
    const host = $("chem3DMolViewer");
    if (host) bind(host);
  }

  function initialize() {
    refresh();
    setInterval(refresh, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once:true });
  else initialize();
})();
