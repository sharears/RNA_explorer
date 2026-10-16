(() => {
  "use strict";

  if (window.__rnaExplorerOct15Updates) return;
  window.__rnaExplorerOct15Updates = true;

  const $ = id => document.getElementById(id);
  const isMobile = () => window.matchMedia?.("(max-width: 760px)")?.matches ?? window.innerWidth <= 760;
  const pdbCache = new Map();
  let chainInfoKey = "";
  let pendingChainInfoKey = "";
  let labelPatchTimer = null;

  function addStyles() {
    if ($("rnaOct15UpdateStyles")) return;
    const style = document.createElement("style");
    style.id = "rnaOct15UpdateStyles";
    style.textContent = `
      .chem-tool-group[data-oct15-category]{border:1px solid rgba(135,169,204,.22);border-radius:9px;padding:.15rem .55rem;margin:.28rem 0;background:rgba(255,255,255,.018)}
      .chem-tool-group[data-oct15-category]>summary{padding:.48rem .08rem;font-weight:750;cursor:pointer;color:var(--cream)}
      .chem-tool-group-body{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;padding:.2rem 0 .55rem}
      .chem-tool-group-body>.chem-text-controls,.chem-tool-group-body>.chem-inspect-panel,.chem-tool-group-body>.chem-pair-controls,.chem-tool-group-body>.chem-editor-export{width:100%;margin:0}
      .chem-tool-group-body>.chem-inspect-panel{border:0;padding:.2rem 0;background:transparent}
      .chem-tool-group-body>.chem-text-controls{border:0;padding:.2rem 0;background:transparent}
      .chem-tool-group-body>.chem-pair-controls{padding:.2rem 0}
      .chem-3d-mobile-controls{margin-left:auto;min-width:min(430px,100%)}
      .chem-3d-mobile-controls>summary{cursor:pointer;color:var(--cream);font-size:.74rem;font-weight:750}
      .chem-3d-mobile-controls-body{display:flex;flex-wrap:wrap;gap:.42rem;align-items:center;margin-top:.45rem}
      .chem-3d-mobile-controls-body .chem-3d-mode-controls,.chem-3d-mobile-controls-body .chem-3d-view-controls{display:flex;flex-wrap:wrap;gap:.35rem}
      .chem-3d-mobile-controls-body .chem-3d-help{width:100%;margin-top:.15rem}
      .te-chain-info-panel{margin:.65rem 0;padding:.72rem .78rem;border:1px solid rgba(116,215,182,.28);border-radius:10px;background:rgba(8,24,43,.46)}
      .te-chain-info-panel>strong{display:block;color:var(--cream);font-size:.82rem;margin-bottom:.42rem}
      .te-chain-info-grid{display:grid;grid-template-columns:minmax(90px,.42fr) minmax(0,1fr);gap:.3rem .65rem;font-size:.76rem;line-height:1.42}
      .te-chain-info-grid dt{color:var(--muted);font-weight:700}.te-chain-info-grid dd{margin:0;color:var(--text);overflow-wrap:anywhere}
      .te-chain-info-source{margin:.5rem 0 0!important;font-size:.7rem!important;color:var(--muted)!important}
      .te-chain-info-source a{color:var(--mint)}
      @media(max-width:760px){
        #chemEditorDialog .chem-editor-toolbar{display:block}
        #chemEditorDialog .chem-tool-group[data-oct15-category]{width:100%;box-sizing:border-box;margin:.32rem 0}
        #chemEditorDialog .chem-tool-group-body{display:grid;grid-template-columns:1fr 1fr;align-items:stretch}
        #chemEditorDialog .chem-tool-group-body>label,#chemEditorDialog .chem-tool-group-body>button{width:100%;box-sizing:border-box}
        #chemEditorDialog .chem-tool-group-body>.chem-text-controls,#chemEditorDialog .chem-tool-group-body>.chem-inspect-panel,#chemEditorDialog .chem-tool-group-body>.chem-pair-controls,#chemEditorDialog .chem-tool-group-body>.chem-editor-export{grid-column:1/-1}
        #chemEditorDialog .chem-inspect-controls{display:grid;grid-template-columns:1fr;align-items:stretch}
        #chemEditorDialog .chem-inspect-controls label{min-width:0!important;width:100%!important}
        #chemEditorDialog .chem-text-controls{display:grid;grid-template-columns:1fr 1fr}
        #chemEditorDialog .chem-text-controls>strong,#chemEditorDialog .chem-text-controls>.chem-text-help,#chemEditorDialog .chem-text-controls>#chemApplyTextStyle{grid-column:1/-1}
        .chem-3d-mobile-controls{width:100%;margin-left:0}
        .chem-3d-heading{align-items:flex-start;flex-wrap:wrap}
        .te-chain-info-grid{grid-template-columns:1fr;gap:.08rem}.te-chain-info-grid dd{margin-bottom:.35rem}
      }
    `;
    document.head.appendChild(style);
  }

  function textReplacement(text) {
    if (!text || !/pymol/i.test(text)) return text;
    return text
      .replace(/PyMOL[-‑–— ]*style\s+sticks/gi, "element-colored sticks")
      .replace(/PyMOL[-‑–— ]*style\s+color(?:ing|s)?/gi, "element-based coloring")
      .replace(/PyMOL[-‑–— ]*style\s+visuali[sz]ation/gi, "molecular visualization")
      .replace(/PyMOL[-‑–— ]*style\s+viewer/gi, "interactive molecular viewer")
      .replace(/\bPyMOL\b/gi, "molecular viewer");
  }

  function neutralizeNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent?.closest?.("script,style,pre,code")) return;
      const next = textReplacement(node.nodeValue || "");
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node;
    ["title","aria-label","placeholder"].forEach(attr => {
      if (!element.hasAttribute?.(attr)) return;
      const oldValue = element.getAttribute(attr) || "";
      const next = textReplacement(oldValue);
      if (next !== oldValue) element.setAttribute(attr, next);
    });
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) neutralizeNode(current);
  }

  function installNeutralWording() {
    neutralizeNode(document.body);
    if (document.documentElement.dataset.neutralMolecularWording === "1") return;
    document.documentElement.dataset.neutralMolecularWording = "1";
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === "characterData") neutralizeNode(record.target);
        record.addedNodes?.forEach(neutralizeNode);
      });
    });
    observer.observe(document.body, {childList:true,subtree:true,characterData:true});
  }

  function findToolGroup(toolbar, test) {
    return [...toolbar.querySelectorAll(":scope > details.chem-tool-group")].find(details => test((details.querySelector(":scope > summary")?.textContent || "").trim().toLowerCase())) || null;
  }

  function ensureToolGroup(toolbar, category, label) {
    let details = toolbar.querySelector(`:scope > details.chem-tool-group[data-oct15-category="${category}"]`);
    if (details) return details;
    details = document.createElement("details");
    details.className = "chem-tool-group";
    details.dataset.oct15Category = category;
    const summary = document.createElement("summary"); summary.textContent = label;
    const body = document.createElement("div"); body.className = "chem-tool-group-body";
    details.append(summary, body); toolbar.append(details);
    return details;
  }

  function organizeMolecularDrawing() {
    const dialog = $("chemEditorDialog"), toolbar = dialog?.querySelector(".chem-editor-toolbar");
    if (!dialog || !toolbar) return false;
    addStyles();

    const configs = [
      ["history", "History", s => s.startsWith("history")],
      ["select", "Select", s => s.startsWith("select")],
      ["build", "Build & Edit", s => s.startsWith("build")],
      ["display", "Display", s => s.startsWith("display")],
      ["view", "View", s => s.startsWith("view")]
    ];
    const groups = {};
    configs.forEach(([key,label,test]) => {
      let details = findToolGroup(toolbar,test) || ensureToolGroup(toolbar,key,label);
      details.dataset.oct15Category = key;
      const summary = details.querySelector(":scope > summary"); if (summary) summary.textContent = label;
      groups[key] = details;
    });
    groups.inspect = ensureToolGroup(toolbar,"inspect","Inspect");
    groups.export = ensureToolGroup(toolbar,"export","Export");

    const move = (node,key) => {
      if (!node || !groups[key]) return;
      const body = groups[key].querySelector(":scope > .chem-tool-group-body");
      if (body && node.parentElement !== body) body.append(node);
    };
    move(dialog.querySelector("#chemPairControls"),"build");
    move(dialog.querySelector(".chem-text-controls"),"display");
    move(dialog.querySelector("#chem3DToggle"),"view");
    move(dialog.querySelector("#chemInspectPanelV2"),"inspect");
    move(dialog.querySelector(".chem-editor-export"),"export");

    const order = ["history","build","select","display","inspect","view","export"];
    order.forEach(key => toolbar.append(groups[key]));
    if (toolbar.dataset.oct15InitialOpen !== "1") {
      toolbar.dataset.oct15InitialOpen = "1";
      order.forEach(key => { groups[key].open = isMobile() ? false : ["build","select"].includes(key); });
    }

    document.querySelectorAll('.rna-tool-tabs button[data-rna-tab="analyze"]').forEach(button => {
      if (button.textContent !== "Inspect") button.textContent = "Inspect";
    });

    const heading = dialog.querySelector(".chem-3d-heading");
    if (heading && !heading.querySelector(".chem-3d-mobile-controls")) {
      const mode = heading.querySelector(".chem-3d-mode-controls"), view = heading.querySelector(".chem-3d-view-controls"), help = heading.querySelector(".chem-3d-help");
      if (mode || view || help) {
        const details = document.createElement("details"); details.className = "chem-3d-mobile-controls"; details.open = !isMobile();
        const summary = document.createElement("summary"); summary.textContent = "View";
        const body = document.createElement("div"); body.className = "chem-3d-mobile-controls-body";
        [mode,view,help].forEach(node => { if (node) body.append(node); });
        details.append(summary,body); heading.append(details);
      }
    }
    return true;
  }

  function getChemViewer() {
    const host = $("chem3DMolViewer"); if (!host) return null;
    for (const canvas of host.querySelectorAll("canvas")) if (canvas._3dmol_viewer) return canvas._3dmol_viewer;
    return null;
  }

  function installLabelPatch() {
    const proto = window.$3Dmol?.GLViewer?.prototype;
    if (!proto?.addLabel) return false;
    if (proto.addLabel.__rnaExplorerReadableInspectLabels) return true;
    const original = proto.addLabel;
    const wrapped = function(text,spec,...rest) {
      let next = spec;
      try {
        const container = this.container || this._container  || this.getContainer?.();
        const host = $("chem3DMolViewer"), inspectActive = $("chemInspectPropertyV2")?.value && $("chemInspectPropertyV2").value !== "off";
        if (inspectActive && host && (container === host || host.contains?.(container))) {
          next = {...(spec || {})};
          const base = Number(next.fontSize || 12);
          next.fontSize = Math.max(base, isMobile() ? 14 : 13);
        }
      } catch (_error) {}
      return original.call(this,text,next,...rest);
    };
    wrapped.__rnaExplorerReadableInspectLabels = true;
    wrapped.__rnaExplorerOriginal = original;
    proto.addLabel = wrapped;
    return true;
  }

  function selected2DSignature() {
    return [...document.querySelectorAll("#chemEditorSvg [data-atom-id].chem-inspect-selected")].map(el => el.dataset.atomId).join("|");
  }

  function fallbackPickChemAtom(clientX, clientY, originalEvent) {
    const property = $("chemInspectPropertyV2")?.value, scope = $("chemInspectScopeV2")?.value;
    if (!property || property === "off" || scope !== "select") return false;
    const viewer = getChemViewer(); if (!viewer) return false;
    let model = null;
    try { const models = viewer.getModels?.(); model = Array.isArray(models) && models.length ? models[0] : viewer.getModel?.(); } catch (_error) {}
    if (!model) return false;
    let clickable = [];
    try { clickable = model.selectedAtoms?.({clickable:true}) || []; } catch (_error) {}
    if (!clickable.length) { try { viewer.render?.(); clickable = model.selectedAtoms?.({clickable:true}) || []; } catch (_error) {} }
    if (!clickable.length || typeof viewer.targetedObjects !== "function") return false;
    const canvas = viewer.getCanvas?.() || $("chem3DMolViewer")?.querySelector("canvas"); if (!canvas) return false;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return false;
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    let intersections = [];
    try { intersections = viewer.targetedObjects(x,y,clickable) || []; } catch (_error) { return false; }
    if (!intersections.length) return false;
    const item = intersections[0].clickable || intersections[0].object || intersections[0].atom;
    if (!item || typeof item.callback !== "function") return false;
    try { item.callback(item,viewer,originalEvent,$("chem3DMolViewer"),intersections); return true; } catch (_error) { return false; }
  }

  function bindMobileChem3dSelection() {
    const host = $("chem3DMolViewer");
    if (!host || host.dataset.mobileInspectTap === "1") return false;
    host.dataset.mobileInspectTap = "1";
    const pointers = new Map();
    host.addEventListener("pointerdown", event => {
      if (event.pointerType !== "touch") return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,multi:pointers.size>0,before:selected2DSignature()});
      if (pointers.size > 1) pointers.forEach(p => p.multi = true);
    },true);
    host.addEventListener("pointermove", event => {
      const p = pointers.get(event.pointerId); if (!p) return;
      p.x = event.clientX; p.y = event.clientY;
      if (Math.hypot(p.x-p.startX,p.y-p.startY) > 12) p.moved = true;
    },true);
    const finish = event => {
      const p = pointers.get(event.pointerId); if (!p) return;
      pointers.delete(event.pointerId);
      if (p.moved || p.multi) return;
      const before = p.before;
      setTimeout(() => {
        if (selected2DSignature() !== before) return;
        fallbackPickChemAtom(p.x,p.y,event);
      },80);
    };
    host.addEventListener("pointerup",finish,true);
    host.addEventListener("pointercancel",event=>pointers.delete(event.pointerId),true);
    return true;
  }

  function ensureChainInfoPanel() {
    const select = $("teChainSelect"); if (!select) return null;
    let panel = $("teChainInfoPanel"); if (panel) return panel;
    panel = document.createElement("section"); panel.id = "teChainInfoPanel"; panel.className = "te-chain-info-panel"; panel.setAttribute("aria-live","polite");
    panel.innerHTML = '<strong>Chain information</strong><div class="te-chain-info-grid" id="teChainInfoGrid"><dt>Chain</dt><dd>Select one chain to view its information.</dd></div><p class="te-chain-info-source" id="teChainInfoSource"></p>';
    select.closest("label")?.insertAdjacentElement("afterend",panel);
    return panel;
  }

  function selectedVisibleChain() {
    const boxes = [...document.querySelectorAll("#teChainChoicesV3 input[data-chain]")];
    if (boxes.length) {
      const selected = boxes.filter(box => box.checked).map(box => String(box.dataset.chain ?? ""));
      return selected.length === 1 ? selected[0] : null;
    }
    const select = $("teChainSelect");
    return select && !select.disabled && select.value !== "" ? String(select.value) : (select?.value === "" && select?.options?.length === 1 ? "" : null);
  }

  function pdbIdFromUi() {
    const source = $("teStructureSource")?.textContent || "";
    let match = source.match(/\bPDB\s+([0-9][A-Za-z0-9]{3})\b/i);
    if (!match) match = source.match(/\b([0-9][A-Za-z0-9]{3})\.(?:pdb|ent|cif|mmcif)\b/i);
    if (!match) {
      const value = String($("tePdbId")?.value || "").trim();
      if (/^[0-9][A-Za-z0-9]{3}$/.test(value)) match = [value,value];
    }
    return match ? match[1].toUpperCase() : null;
  }

  function observedChainLength(chain) {
    const host = $("tertiaryMolecularViewer"); if (!host) return null;
    let viewer = null; for (const canvas of host.querySelectorAll("canvas")) if (canvas._3dmol_viewer) { viewer = canvas._3dmol_viewer; break; }
    if (!viewer) return null;
    let model = null; try { const models=viewer.getModels?.(); model=Array.isArray(models)&&models.length?models[0]:viewer.getModel?.(); } catch (_error) {}
    if (!model) return null;
    try {
      const atoms = model.selectedAtoms?.(chain === "" ? {chain:""} : {chain}) || [];
      const residues = new Set(atoms.filter(a=>!['HOH','WAT','H2O','DOD'].includes(String(a.resnM�S���,