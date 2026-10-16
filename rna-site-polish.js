(() => {
  "use strict";
  if (window.__rnaSitePolish20261015) return;
  window.__rnaSitePolish20261015 = true;

  const $ = id => document.getElementById(id);
  const isMobile = () => window.matchMedia?.("(max-width: 720px)")?.matches ?? (window.innerWidth <= 720);

  function ensureStyles() {
    if ($("rnaSitePolish20261015Styles")) return;
    const style = document.createElement("style");
    style.id = "rnaSitePolish20261015Styles";
    style.textContent = `
      #chemEditorDialog .chem-category{border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.018);margin:6px 0;padding:0;min-width:0}
      #chemEditorDialog .chem-category>summary{cursor:pointer;list-style:none;padding:9px 11px;font-size:.78rem;font-weight:700;color:var(--cream);display:flex;align-items:center;justify-content:space-between;gap:10px}
      #chemEditorDialog .chem-category>summary::-webkit-details-marker{display:none}
      #chemEditorDialog .chem-category>summary::after{content:"+";color:var(--muted);font-size:1rem;line-height:1}
      #chemEditorDialog .chem-category[open]>summary::after{content:"−"}
      #chemEditorDialog .chem-category-body{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0 10px 10px}
      #chemEditorDialog .chem-category-body>.chem-text-controls{width:100%;margin:0}
      #chemEditorDialog .chem-category-body>.chem-inspect-panel{width:100%;margin:0}
      #chemEditorDialog .chem-category-body>.chem-pair-controls{width:100%;margin:0}
      #chemEditorDialog .chem-category-body>.chem-editor-export{width:100%;margin:0}
      #chemEditorDialog .chem-editor-toolbar{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px!important;align-items:start}
      #chemEditorDialog .chem-editor-toolbar>.chem-tool-group{margin:0!important}
      #chemEditorDialog .chem-editor-toolbar>.chem-tool-group>.chem-tool-group-body{align-content:flex-start}
      #teChainInfoPanel{margin:.7rem 0;padding:.7rem .75rem;border:1px solid rgba(116,215,182,.28);border-radius:9px;background:rgba(8,24,43,.45)}
      #teChainInfoPanel h4{margin:0 0 .45rem;color:var(--cream);font-size:.82rem}
      #teChainInfoPanel dl{display:grid;grid-template-columns:max-content 1fr;gap:.3rem .65rem;margin:0;font-size:.76rem;line-height:1.4}
      #teChainInfoPanel dt{color:var(--muted)}
      #teChainInfoPanel dd{margin:0;color:var(--text);overflow-wrap:anywhere}
      #teChainInfoPanel p{margin:.2rem 0;color:var(--muted);font-size:.75rem;line-height:1.45}
      @media(max-width:720px){
        #chemEditorDialog .chem-editor-toolbar{grid-template-columns:1fr!important}
        #chemEditorDialog .chem-category{width:100%}
        #chemEditorDialog .chem-category>summary{min-height:42px;font-size:.82rem}
      }
    `;
    document.head.appendChild(style);
  }

  function viewerBelongsToChem(v) {
    const host = $("chem3DMolViewer");
    if (!host || !v) return false;
    try { const c = v.getCanvas?.(); if (c && host.contains(c)) return true; } catch (_e) {}
    const container = v.container || v._container || v.getContainer?.();
    return container === host || (container instanceof HTMLElement && host.contains(container));
  }

  function looksLikeInspectionLabel(text) {
    const t = String(text ?? "").trim();
    return /^(?:sp(?:[²³23])?|N\/A|not available)$/i.test(t) || /^[-+]?\d+(?:\.\d+)?\s*(?:Å|°)$/.test(t);
  }

  function patchInspectionLabelSize() {
    const proto = window.$3Dmol?.GLViewer?.prototype;
    if (!proto?.addLabel || proto.addLabel.__rnaReadableInspectLabels) return Boolean(proto?.addLabel);
    const original = proto.addLabel;
    const wrapped = function(text, spec) {
      let next = spec;
      try {
        if (viewerBelongsToChem(this) && looksLikeInspectionLabel(text) && spec && typeof spec === "object") {
          next = {...spec, fontSize: Math.max(Number(spec.fontSize) || 0, isMobile() ? 14 : 13)};
        }
      } catch (_e) {}
      return original.call(this, text, next);
    };
    wrapped.__rnaReadableInspectLabels = true;
    wrapped.__rnaOriginal = original;
    proto.addLabel = wrapped;
    return true;
  }

  function inspectionSelectActive() {
    const prop = $("chemInspectPropertyV2")?.value;
    const scope = $("chemInspectScopeV2")?.value;
    return Boolean(prop && prop !== "off" && (prop === "dihedral" || scope === "select"));
  }

  function bindChem3DTapSelection() {
    const host = $("chem3DMolViewer");
    if (!host) return;
    const canvas = host.querySelector("canvas");
    if (!canvas || canvas.dataset.rnaTapSelectBound === "1") return;
    canvas.dataset.rnaTapSelectBound = "1";
    const touches = new Map();
    let multiTouch = false;

    canvas.addEventListener("pointerdown", event => {
      if (event.pointerType !== "touch") return;
      touches.set(event.pointerId, {x:event.clientX,y:event.clientY,t:performance.now(),moved:false});
      if (touches.size > 1) multiTouch = true;
    }, true);

    canvas.addEventListener("pointermove", event => {
      if (event.pointerType !== "touch") return;
      const p = touches.get(event.pointerId); if (!p) return;
      if (Math.hypot(event.clientX-p.x,event.clientY-p.y) > 9) p.moved = true;
      if (touches.size > 1) multiTouch = true;
    }, true);

    const finish = event => {
      if (event.pointerType !== "touch") return;
      const p = touches.get(event.pointerId);
      const wasMulti = multiTouch || touches.size > 1;
      touches.delete(event.pointerId);
      if (!touches.size) multiTouch = false;
      if (!p || wasMulti || p.moved || performance.now()-p.t > 700 || !inspectionSelectActive()) return;

      const target = canvas;
      const opts = {bubbles:true,cancelable:true,clientX:event.clientX,clientY:event.clientY,screenX:event.screenX||0,screenY:event.screenY||0,button:0,buttons:1,view:window};
      setTimeout(() => {
        try {
          target.dispatchEvent(new MouseEvent("mousedown", opts));
          target.dispatchEvent(new MouseEvent("mouseup", {...opts,buttons:0}));
          target.dispatchEvent(new MouseEvent("click", {...opts,buttons:0}));
        } catch (_e) {}
      }, 0);
    };
    canvas.addEventListener("pointerup", finish, true);
    canvas.addEventListener("pointercancel", event => { if(event.pointerType==="touch"){touches.delete(event.pointerId);if(!touches.size)multiTouch=false;} }, true);
  }

  function summaryText(details, text) {
    const s = details?.querySelector(":scope > summary");
    if (s && s.textContent !== text) s.textContent = text;
  }

  function mobileCollapse(details) {
    if (!details || details.dataset.rnaInitialOpenDone === "1") return;
    details.dataset.rnaInitialOpenDone = "1";
    if (isMobile()) details.open = false;
  }

  function makeCategory(id, title) {
    const d = document.createElement("details");
    d.id = id; d.className = "chem-category";
    const s = document.createElement("summary"); s.textContent = title;
    const b = document.createElement("div"); b.className = "chem-category-body";
    d.append(s,b); mobileCollapse(d); return d;
  }

  function organizeMolecularDrawing() {
    const dialog = $("chemEditorDialog"), toolbar = dialog?.querySelector(".chem-editor-toolbar");
    if (!dialog || !toolbar) return;

    const groups = [...toolbar.querySelectorAll(":scope > .chem-tool-group")];
    let history = groups.find(d => /history/i.test(d.querySelector("summary")?.textContent||""));
    let select = groups.find(d => /select/i.test(d.querySelector("summary")?.textContent||""));
    let build = groups.find(d => /build/i.test(d.querySelector("summary")?.textContent||""));
    let display = groups.find(d => /display/i.test(d.querySelector("summary")?.textContent||""));
    let view = groups.find(d => /view/i.test(d.querySelector("summary")?.textContent||""));

    if (build) {
      summaryText(build,"Build & Edit"); build.classList.add("chem-category");
      const body=build.querySelector(".chem-tool-group-body"); body?.classList.add("chem-category-body");
      if (history) {
        const hb=history.querySelector(".chem-tool-group-body");
        [...(hb?.children||[])].reverse().forEach(el=>body?.prepend(el));
        history.remove();
      }
      const pair = $("chemPairControls"); if (pair && !body?.contains(pair)) body?.append(pair);
      mobileCollapse(build);
    }
    if (select) { summaryText(select,"Select");select.classList.add("chem-category");select.querySelector(".chem-tool-group-body")?.classList.add("chem-category-body");mobileCollapse(select); }
    if (display) {
      summaryText(display,"Display"); display.classList.add("chem-category");display.querySelector(".chem-tool-group-body")?.classList.add("chem-category-body");mobileCollapse(display);
      const body=display.querySelector(".chem-tool-group-body");
      const text=dialog.querySelector(".chem-text-controls");if(text&&!body?.contains(text))body?.append(text);
      const iupac=$("chemIupacPanel");if(iupac&&!body?.contains(iupac))body?.append(iupac);
    }
    if (view) {
      summaryText(view,"View");view.classList.add("chem-category");view.querySelector(".chem-tool-group-body")?.classList.add("chem-category-body");mobileCollapse(view);
      const body=view.querySelector(".chem-tool-group-body"),toggle=$("chem3DToggle");if(toggle&&!body?.contains(toggle))body?.append(toggle);
    }

    let inspect = $("chemInspectCategory");
    const inspectPanel = $("chemInspectPanelV2");
    if (inspectPanel && !inspect) {
      inspect = makeCategory("chemInspectCategory","Inspect");
      toolbar.insertAdjacentElement("afterend",inspect);
      inspect.querySelector(".chem-category-body")?.append(inspectPanel);
    }

    let exportCat = $("chemExportCategory");
    const exportControls = dialog.querySelector(".chem-editor-export");
    if (exportControls && !exportCat) {
      exportCat = makeCategory("chemExportCategory","Export");
      (inspect || toolbar).insertAdjacentElement("afterend",exportCat);
      exportCat.querySelector(".chem-category-body")?.append(exportControls);
    }

    [build,select,display,view,inspect,exportCat].filter(Boolean).forEach(mobileCollapse);
  }

  function replacePyMolText(root=document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p=node.parentElement;if(!p||["SCRIPT","STYLE","CODE","PRE"].includes(p.tagName))return NodeFilter.FILTER_REJECT;
        return /pymol/i.test(node.nodeValue||"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }
    });
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      node.nodeValue=String(node.nodeValue||"")
        .replace(/PyMOL-style sticks/gi,"Sticks")
        .replace(/PyMOL-style/gi,"standard molecular")
        .replace(/PyMOL/gi,"molecular viewer");
    });
  }

  function normalizeWorkspaceCategories() {
    document.querySelectorAll("#scene-tertiary .te-controls > details").forEach(d=>{
      const s=d.querySelector(":scope > summary"),t=(s?.textContent||"").trim();if(!s)return;
      if(/measurement|measure|inspect/i.test(t))s.textContent="Inspect";
      else if(/^display/i.test(t))s.textContent="Display";
      else if(/export/i.test(t))s.textContent="Export";
      else if(/select/i.test(t))s.textContent="Select";
    });
  }

  function tertiaryViewer() {
    const host=$("tertiaryMolecularViewer");if(!host)return null;
    for(const c of host.querySelectorAll("canvas"))if(c._3dmol_viewer)return c._3dmol_viewer;
    return null;
  }

  function visibleTertiaryChains() {
    const v3=[...document.querySelectorAll('#teChainChoicesV3 input[type="checkbox"][data-chain]')];
    if(v3.length)return v3.filter(x=>x.checked).map(x=>String(x.dataset.chain??""));
    const old=[...document.querySelectorAll('#teChainFilterChoices input[type="checkbox"][data-chain-id]')];
    if(old.length)return old.filter(x=>x.checked).map(x=>String(x.dataset.chainId??""));
    const native=$("teChainSelect");return native?.value!==undefined?[String(native.value)]:[];
  }

  function localChainLength(chain) {
    try {
      const v=tertiaryViewer(),models=v?.getModels?.()||[],m=models[0]||v?.getModel?.();
      const atoms=m?.selectedAtoms?.({})||[],keys=new Set();
      atoms.filter(a=>String(a.chain??"")===String(chain??"")).forEach(a=>keys.add(`${String(a.resi??"")}|${String(a.icode??"")}`));
      return keys.size || null;
    } catch (_e) { return null; }
  }

  function currentPdbId() {
    const source=$("teStructureSource")?.textContent||"";
    let m=source.match(/\bPDB\s+([0-9][A-Za-z0-9]{3})\b/i);if(m)return m[1].toUpperCase();
    const input=$("tePdbId")?.value?.trim();if(/^[0-9][A-Za-z0-9]{3}$/.test(input||""))return input.toUpperCase();
    m=source.match(/\b([0-9][A-Za-z0-9]{3})\b/);return m?m[1].toUpperCase():null;
  }

  function parseKeyValueRecord(text, record) {
    const joined=text.split(/\r?\n/).filter(line=>line.startsWith(record)).map(line=>line.slice(10).trim()).join(" ");
    const blocks=new Map();let current=null;
    joined.split(/;\s*/).map(x=>x.trim()).filter(Boolean).forEach(token=>{
      const m=token.match(/^([A-Z0-9_]+):\s*(.*)$/);if(!m)return;
      const key=m[1],value=m[2].trim();
      if(key==="MOL_ID"){current=value;if(!blocks.has(current))blocks.set(current,{});return;}
      if(current){const obj=blocks.get(current);obj[key]=obj[key]?obj[key]+" "+value:value;}
    });
    return blocks;
  }

  function pdbChainMetadata(text, chain) {
    const comp=parseKeyValueRecord(text,"COMPND"),src=parseKeyValueRecord(text,"SOURCE");
    let molId=null,meta=null;
    for(const [id,obj] of comp.entries()){
      const chains=String(obj.CHAIN||"").split(",").map(x=>x.trim()).filter(Boolean);
      if(chains.includes(String(chain)) || (!String(chain)&&chains.includes("NULL"))){molId=id;meta=obj;break;}
    }
    const source=molId?src.get(molId)||{}:{};
    return {
      molecule:meta?.MOLECULE||meta?.SYNONYM||null,
      organism:source.ORGANISM_SCIENTIFIC||source.ORGANISM_COMMON||null,
      common:source.ORGANISM_COMMON||null,
      expression:source.EXPRESSION_SYSTEM||null
    };
  }

  let chainInfoRequest=0,lastChainInfoKey="";
  async function updateChainInfo(force=false) {
    const anchor=$("teChainFilterV3")||$("teChainFilter")||$("teChainSelect")?.closest("label");
    if(!anchor)return;
    let panel=$("teChainInfoPanel");
    if(!panel){panel=document.createElement("section");panel.id="teChainInfoPanel";panel.setAttribute("aria-live","polite");anchor.insertAdjacentElement("afterend",panel);}
    const chains=visibleTertiaryChains();
    if(chains.length!==1){lastChainInfoKey="";panel.innerHTML='<h4>Chain information</h4><p>Select exactly one chain to view chain-level information.</p>';return;}
    const chain=chains[0],pdb=currentPdbId(),length=localChainLength(chain),key=`${pdb||"local"}|${chain}|${length||""}`;
    if(!force&&key===lastChainInfoKey)return;lastChainInfoKey=key;
    const displayChain=chain||"(blank)";
    if(!pdb){
      panel.innerHTML=`<h4>Chain information · ${displayChain}</h4><dl><dt>Length</dt><dd>${length??"Not available"}${length?" residues":""}</dd><dt>Source</dt><dd>Local/uploaded structure</dd></dl><p>RCSB PDB molecule and organism metadata are available when the loaded structure has a recognized PDB ID.</p>`;
      return;
    }
    panel.innerHTML=`<h4>Chain information · ${displayChain}</h4><p>Loading metadata for PDB ${pdb}…</p>`;
    const request=++chainInfoRequest;
    try{
      const response=await fetch(`https://files.rcsb.org/download/${encodeURIComponent(pdb)}.pdb`,{cache:"force-cache"});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const text=await response.text();if(request!==chainInfoRequest)return;
      const meta=pdbChainMetadata(text,chain);
      panel.innerHTML=`<h4>Chain information · ${displayChain}</h4><dl>`+
        `<dt>PDB entry</dt><dd>${pdb}</dd>`+
        `<dt>Molecule</dt><dd>${meta.molecule||"Not available"}</dd>`+
        `<dt>Organism</dt><dd>${meta.organism||"Not available"}</dd>`+
        `<dt>Length</dt><dd>${length??"Not available"}${length?" residues":""}</dd>`+
        (meta.expression?`<dt>Expression system</dt><dd>${meta.expression}</dd>`:"")+
        `</dl>`;
    }catch(_e){
      if(request!==chainInfoRequest)return;
      panel.innerHTML=`<h4>Chain information · ${displayChain}</h4><dl><dt>PDB entry</dt><dd>${pdb}</dd><dt>Length</dt><dd>${length??"Not available"}${length?" residues":""}</dd></dl><p>RCSB PDB metadata could not be loaded right now.</p>`;
    }
  }

  function refresh() {
    ensureStyles();patchInspectionLabelSize();bindChem3DTapSelection();organizeMolecularDrawing();replacePyMolText();normalizeWorkspaceCategories();updateChainInfo(false);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh,{once:true});else refresh();
  const observer=new MutationObserver(()=>refresh());observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener("change",event=>{
    if(event.target?.matches?.('#teChainChoicesV3 input,#teChainFilterChoices input,#teChainSelect,#tePdbId'))setTimeout(()=>updateChainInfo(true),60);
  },true);
  document.addEventListener("click",event=>{
    if(event.target?.matches?.('#teLoadPdbId,#teRestoreStructure,.te-chain-show-all'))setTimeout(()=>updateChainInfo(true),500);
  },true);
  setInterval(refresh,700);
})();