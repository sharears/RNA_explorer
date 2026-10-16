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
    try {
      const event = new PointerEvent("pointerdown", {
        bubbles:true, cancelable:true, pointerType:"mouse", button:0, buttons:1,
        clientX:0, clientY:0
      });
      group.dispatchEvent(event);
      return true;
    } catch (_error) {
      try {
        const event = new MouseEvent("mousedown", { bubbles:true, cancelable:true, button:0, buttons:1 });
        group.dispatchEvent(event);
        return selectionSignature().includes(String(id));
      } catch (_error2) {
        return false;
      }
    }
  }

  function fallbackPick(host, clientX, clientY, originalEvent, pointerType) {
    if (!activeSelectionMode()) return false;
    const viewer = viewerForHost(host);
    const model = modelForViewer(viewer);
    if (!viewer || !model) return false;
    const atom = nearestEditableAtom(viewer, model, clientX, clientY, pointerType);
    if (!atom) return false;

    // Use the same selection path as the 2D editor so 2D highlighting, pick order,
    // measurement calculation and the 3D highlight remain synchronized.
    if (selectThroughShared2DPath(atom)) {
      try { viewer.render?.(); } catch (_error) {}
      return true;
    }

    // Last-resort compatibility path for viewers whose atom callback is available.
    if (typeof atom.callback === "function") {
      try {
        atom.callback(atom, viewer, originalEvent, host, [{ clickable:atom, distance:0 }]);
        viewer.render?.();
        return true;
      } catch (_error) {}
    }
    return false;
  }

  function bind(host) {
    if (!host || host.dataset.reliableInspectPick === "1") return;
    host.dataset.reliableInspectPick = "1";
    const pointers = new Map();

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
      const before = entry.before;
      setTimeout(() => {
        // Prefer 3Dmol's native click selection. If it did not change the shared
        // selection, use a larger screen-space target—especially useful on phones.
        if (selectionSignature() !== before) return;
        fallbackPick(host, entry.x, entry.y, event, entry.type);
      }, 70);
    };

    host.addEventListener("pointerup", finish, true);
    host.addEventListener("pointercancel", event => pointers.delete(event.pointerId), true);
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
