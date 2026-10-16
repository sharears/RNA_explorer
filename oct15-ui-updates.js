(() => {
  "use strict";

  if (window.__rnaExplorerOct15Updates) return;
  window.__rnaExplorerOct15Updates = true;

  const $ = id => document.getElementById(id);
  const isMobile = () => window.matchMedia?.("(max-width: 760px)")?.matches ?? window.innerWidth <= 760;
  const pdbCache = new Map();
  let chainInfoKey = "";
  let pendingChainInfoKey = "";

  function addStyles() {
    if ($("rnaOct15UpdateStyles")) return;
    const style = document.createElement("style");
    style.id = "rnaOct15UpdateStyles";
    style.textContent = `
      .chem-tool-group[data-oct15-category]{border:1px solid rgba(135,169,204,.22);border-radius:9px;padding:.15rem .55rem;margin:.28rem 0;background:rgba(255,255,255,.018)}
      .chem-tool-group[data-oct15-category]>summary{padding:.48rem .08rem;font-weight:750;cursor:pointer;color:var(--cream)}
      .chem-tool-group-body{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;padding:.2rem 0 .55rem}
      .chem-tool-group-body>.chem-text-controls,.chem-tool-group-body>.chem-inspect-panel,.chem-tool-group-body>.chem-pair-controls,.chem-tool-group-body>.chem-editor-export{width:100%;margin:0}
      .chem-tool-group-body>.chem-inspect-panel,.chem-tool-group-body>.chem-text-controls{border:0;padding:.2rem 0;background:transparent}
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
      .te-chain-info-source{margin:.5rem 0 0!important;font-size:.7rem!important;color:var(--muted)!important}.te-chain-info-source a{color:var(--mint)}
      @media(max-width:760px){
        #chemEditorDialog .chem-editor-toolbar{display:block}
        #chemEditorDialog .chem-tool-group[data-oct15-category]{width:100%;box-sizing:border-box;margin:.32rem 0}
        #chemEditorDialog .chem-tool-group-body{display:grid;grid-template-columns:1fr 1fr;align-items:stretch}
        #chemEditorDialog .chem-tool-group-body>*{min-width:0!important;width:100%!important;box-sizing:border-box}
        #chemEditorDialog .chem-tool-group-body>label{display:grid!important;gap:.22rem!important}
        #chemEditorDialog .chem-tool-group-body>.chem-text-controls,#chemEditorDialog .chem-tool-group-body>.chem-inspect-panel,#chemEditorDialog .chem-tool-group-body>.chem-pair-controls,#chemEditorDialog .chem-tool-group-body>.chem-editor-export{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:.45rem}
        #chemEditorDialog .chem-inspect-heading,#chemEditorDialog .chem-inspect-result,#chemEditorDialog .chem-inspect-note,#chemEditorDialog .chem-text-controls>strong,#chemEditorDialog .chem-text-help{grid-column:1/-1}
        #chemEditorDialog .chem-3d-heading{align-items:flex-start;flex-wrap:wrap}
        #chemEditorDialog .chem-3d-mobile-controls{width:100%;margin-left:0;border-top:1px solid var(--line);padding-top:.45rem}
        .te-chain-info-grid{grid-template-columns:1fr;gap:.08rem}.te-chain-info-grid dd{margin-bottom:.38rem}
      }
    `;
    document.head.appendChild(style);
  }

  function textReplacement(text) {
    return String(text || "")
      .replace(/PyMOL[-‑–— ]*style\s+sticks/gi, "element-colored sticks")
      .replace(/PyMOL[-‑–— ]*style\s+color(?:ing|s)?/gi, "element-based coloring")
      .replace(/PyMOL[-‑–— ]*style\s+visuali[sz]ation/gi, "molecular visualization")
      .replace(/PyMOL[-‑–— ]*style\s+viewer/gi, "interactive molecular viewer")
      .replace(/\bPyMOL\b/gi, "molecular viewer");
  }

  function neutralizeNode(node) {
    if (!node) return;
    const skip = el => el?.closest?.("script,style,pre,code,textarea");
    if (node.nodeType === Node.TEXT_NODE) {
      if (!skip(node.parentElement) && /pymol/i.test(node.nodeValue || "")) node.nodeValue = textReplacement(node.nodeValue);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || skip(node)) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(text => { if (!skip(text.parentElement) && /pymol/i.test(text.nodeValue || "")) text.nodeValue = textReplacement(text.nodeValue); });
    const nodes=[node,...node.querySelectorAll?.("[title],[aria-label],[placeholder]")||[]];
    nodes.forEach(el=>["title","aria-label","placeholder"].forEach(attr=>{const value=el.getAttribute?.(attr);if(value&&/pymol/i.test(value))el.setAttribute(attr,textReplacement(value));}));
  }

  function installNeutralWording() {
    neutralizeNode(document.body);
    if (document.documentElement.dataset.neutralMolecularWording === "1") return;
    document.documentElement.dataset.neutralMolecularWording = "1";
    const observer = new MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(neutralizeNode);
      if (record.type === "characterData") neutralizeNode(record.target);
    }));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  function findToolGroup(toolbar,test){return [...toolbar.querySelectorAll(":scope > .chem-tool-group")].find(group=>test((group.querySelector(":scope > summary")?.textContent||"").trim().toLowerCase()))||null;}
  function ensureToolGroup(toolbar,category,label){
    let group=toolbar.querySelector(`:scope > .chem-tool-group[data-oct15-category="${category}"]`);
    if(!group){group=document.createElement("details");group.className="chem-tool-group";group.dataset.oct15Category=category;const summary=document.createElement("summary"),body=document.createElement("div");summary.textContent=label;body.className="chem-tool-group-body";group.append(summary,body);toolbar.append(group);}return group;
  }

  function organizeMolecularDrawing(){
    const dialog=$("chemEditorDialog"),toolbar=dialog?.querySelector(".chem-editor-toolbar");if(!dialog||!toolbar)return false;
    const categories={},mapping=[["history","History",s=>s.startsWith("history")],["select","Select",s=>s.startsWith("select")],["build","Build & Edit",s=>s.startsWith("build")],["display","Display",s=>s.startsWith("display")],["view","View",s=>s.startsWith("view")]];
    mapping.forEach(([key,label,test])=>{const group=findToolGroup(toolbar,test)||ensureToolGroup(toolbar,key,label);group.dataset.oct15Category=key;const summary=group.querySelector(":scope > summary");if(summary)summary.textContent=label;categories[key]=group;});
    categories.inspect=ensureToolGroup(toolbar,"inspect","Inspect");categories.export=ensureToolGroup(toolbar,"export","Export");
    const move=(node,category)=>{if(!node||!categories[category])return;const body=categories[category].querySelector(":scope > .chem-tool-group-body");if(body&&node.parentElement!==body)body.append(node);};
    move(dialog.querySelector("#chemPairControls"),"build");move(dialog.querySelector(".chem-text-controls"),"display");move(dialog.querySelector("#chem3DToggle"),"view");move(dialog.querySelector("#chemInspectPanelV2"),"inspect");move(dialog.querySelector(".chem-editor-export"),"export");
    const order=["history","build","select","display","inspect","view","export"];order.forEach(key=>toolbar.append(categories[key]));
    if(toolbar.dataset.oct15InitialOpen!=="1"){toolbar.dataset.oct15InitialOpen="1";order.forEach(key=>{categories[key].open=isMobile()?false:["build","select"].includes(key);});}
    document.querySelectorAll('.rna-tool-tabs button[data-rna-tab="analyze"]').forEach(button=>{if(button.textContent!=="Inspect")button.textContent="Inspect";});
    const heading=dialog.querySelector(".chem-3d-heading");
    if(heading&&!heading.querySelector(".chem-3d-mobile-controls")){
      const mode=heading.querySelector(".chem-3d-mode-controls"),view=heading.querySelector(".chem-3d-view-controls"),help=heading.querySelector(".chem-3d-help");
      if(mode||view||help){const details=document.createElement("details");details.className="chem-3d-mobile-controls";details.open=!isMobile();const summary=document.createElement("summary"),body=document.createElement("div");summary.textContent="View";body.className="chem-3d-mobile-controls-body";[mode,view,help].forEach(node=>{if(node)body.append(node);});details.append(summary,body);heading.append(details);}
    }
    return true;
  }

  function getChemViewer(){const host=$("chem3DMolViewer");if(!host)return null;for(const canvas of host.querySelectorAll("canvas"))if(canvas._3dmol_viewer)return canvas._3dmol_viewer;return null;}
  function installLabelPatch(){
    const proto=window.$3Dmol?.GLViewer?.prototype;if(!proto?.addLabel)return false;if(proto.addLabel.__rnaExplorerReadableInspectLabels)return true;const original=proto.addLabel;
    const wrapped=function(text,spec,...rest){let next=spec;try{const container=this.container||this._container||this.getContainer?.(),chemHost=$("chem3DMolViewer"),inspectOn=$("chemInspectPropertyV2")?.value&&$("chemInspectPropertyV2").value!=="off";if(inspectOn&&chemHost&&(container===chemHost||chemHost.contains?.(container))){next={...(spec||{})};next.fontSize=Math.max(Number(next.fontSize||12),isMobile()?14:13);}}catch(_error){}return original.call(this,text,next,...rest);};
    wrapped.__rnaExplorerReadableInspectLabels=true;wrapped.__rnaExplorerOriginal=original;proto.addLabel=wrapped;return true;
  }

  function selected2DSignature(){return [...document.querySelectorAll("#chemEditorSvg [data-atom-id].chem-inspect-selected")].map(el=>el.dataset.atomId).join("|");}
  function fallbackPickChemAtom(clientX,clientY,originalEvent){
    const property=$("chemInspectPropertyV2")?.value,scope=$("chemInspectScopeV2")?.value;if(!property||property==="off"||scope!=="select")return false;
    const viewer=getChemViewer();if(!viewer)return false;let model=null;try{const models=viewer.getModels?.();model=Array.isArray(models)&&models.length?models[0]:viewer.getModel?.();}catch(_error){}if(!model)return false;
    let clickable=[];try{clickable=model.selectedAtoms?.({clickable:true})||[];}catch(_error){}if(!clickable.length){try{viewer.render?.();clickable=model.selectedAtoms?.({clickable:true})||[];}catch(_error){}}
    if(!clickable.length||typeof viewer.targetedObjects!=="function")return false;const canvas=viewer.getCanvas?.()||$("chem3DMolViewer")?.querySelector("canvas");if(!canvas)return false;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return false;
    const x=((clientX-rect.left)/rect.width)*2-1,y=-(((clientY-rect.top)/rect.height)*2-1);let intersections=[];try{intersections=viewer.targetedObjects(x,y,clickable)||[];}catch(_error){return false;}if(!intersections.length)return false;
    const atom=intersections[0].clickable||intersections[0].object||intersections[0].atom||null;if(!atom||typeof atom.callback!=="function")return false;try{atom.callback(atom,viewer,originalEvent,$("chem3DMolViewer"),intersections);return true;}catch(_error){return false;}
  }
  function bindMobileChem3DSelection(){
    const host=$("chem3DMolViewer");if(!host||host.dataset.mobileInspectTap==="1")return false;host.dataset.mobileInspectTap="1";const touches=new Map();
    host.addEventListener("pointerdown",event=>{if(event.pointerType!=="touch")return;touches.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,multi:touches.size>0,before:selected2DSignature()});if(touches.size>1)touches.forEach(t=>t.multi=true);},true);
    host.addEventListener("pointermove",event=>{const touch=touches.get(event.pointerId);if(!touch)return;touch.x=event.clientX;touch.y=event.clientY;if(Math.hypot(touch.x-touch.startX,touch.y-touch.startY)>12)touch.moved=true;},true);
    const finish=event=>{const touch=touches.get(event.pointerId);if(!touch)return;touches.delete(event.pointerId);if(touch.moved||touch.multi)return;const before=touch.before;setTimeout(()=>{if(selected2DSignature()!==before)return;fallbackPickChemAtom(touch.x,touch.y,event);},80);};
    host.addEventListener("pointerup",finish,true);host.addEventListener("pointercancel",event=>touches.delete(event.pointerId),true);return true;
  }

  function ensureChainInfoPanel(){const select=$("teChainSelect");if(!select)return null;let panel=$("teChainInfoPanel");if(panel)return panel;panel=document.createElement("section");panel.id="teChainInfoPanel";panel.className="te-chain-info-panel";panel.setAttribute("aria-live","polite");panel.innerHTML='<strong>Chain information</strong><div class="te-chain-info-grid" id="teChainInfoGrid"><dt>Chain</dt><dd>Select one chain to view its information.</dd></div><p class="te-chain-info-source" id="teChainInfoSource"></p>';select.closest("label")?.insertAdjacentElement("afterend",panel);return panel;}
  function selectedVisibleChain(){const boxes=[...document.querySelectorAll("#teChainChoicesV3 input[data-chain]")];if(boxes.length){const selected=boxes.filter(box=>box.checked).map(box=>String(box.dataset.chain??""));return selected.length===1?selected[0]:null;}const select=$("teChainSelect");return select&&!select.disabled&&select.value!==""?String(select.value):(select?.value===""&&select?.options?.length===1?"":null);}
  function pdbIdFromUi(){const source=$("teStructureSource")?.textContent||"";let match=source.match(/\bPDB\s+([0-9][A-Za-z0-9]{3})\b/i);if(!match)match=source.match(/\b([0-9][A-Za-z0-9]{3})\.(?:pdb|ent|cif|mmcif)\b/i);if(!match){const value=String($("tePdbId")?.value||"").trim();if(/^[0-9][A-Za-z0-9]{3}$/.test(value))match=[value,value];}return match?match[1].toUpperCase():null;}
  function observedChainLength(chain){const host=$("tertiaryMolecularViewer");if(!host)return null;let viewer=null;for(const canvas of host.querySelectorAll("canvas"))if(canvas._3dmol_viewer){viewer=canvas._3dmol_viewer;break;}if(!viewer)return null;let model=null;try{const models=viewer.getModels?.();model=Array.isArray(models)&&models.length?models[0]:viewer.getModel?.();}catch(_error){}if(!model)return null;try{const atoms=model.selectedAtoms?.(chain===""?{chain:""}:{chain})||[],residues=new Set(atoms.filter(a=>!["HOH","WAT","H2O","DOD"].includes(String(a.resn||"").toUpperCase())).map(a=>`${String(a.resi??"")}|${String(a.icode??"")}`));return residues.size||null;}catch(_error){return null;}}
  async function fetchPdbEntities(pdbId){if(pdbCache.has(pdbId))return pdbCache.get(pdbId);const promise=(async()=>{const base="https://data.rcsb.org/rest/v1/core",entryResponse=await fetch(`${base}/entry/${encodeURIComponent(pdbId)}`,{headers:{Accept:"application/json"}});if(!entryResponse.ok)throw new Error(`RCSB metadata request failed (${entryResponse.status}).`);const entry=await entryResponse.json(),ids=entry?.rcsb_entry_container_identifiers?.polymer_entity_ids||[];const entities=await Promise.all(ids.map(async entityId=>{const response=await fetch(`${base}/polymer_entity/${encodeURIComponent(pdbId)}/${encodeURIComponent(entityId)}`,{headers:{Accept:"application/json"}});if(!response.ok)return null;return response.json();}));return entities.filter(Boolean);})();pdbCache.set(pdbId,promise);try{return await promise;}catch(error){pdbCache.delete(pdbId);throw error;}}
  function entityForChain(entities,chain){const wanted=String(chain??"");return(entities||[]).find(entity=>{const ids=entity?.rcsb_polymer_entity_container_identifiers||{};return[...(ids.auth_asym_ids||[]),...(ids.asym_ids||[])].map(String).includes(wanted);})||null;}
  function organismName(entity){const source=entity?.rcsb_entity_source_organism,list=Array.isArray(source)?source:source?[source]:[],names=list.map(item=>item?.scientific_name||item?.common_name).filter(Boolean);return[...new Set(names)].join("; ")||"Not reported";}
  function entityDescription(entity){const value=entity?.rcsb_polymer_entity?.pdbx_description||entity?.entity?.pdbx_description;return Array.isArray(value)?value.filter(Boolean).join("; "):(value||"Not reported");}
  function entityLength(entity,fallback){const direct=Number(entity?.entity_poly?.rcsb_sample_sequence_length);if(Number.isFinite(direct)&&direct>0)return direct;const sequence=String(entity?.entity_poly?.pdbx_seq_one_letter_code_can||"").replace(/\s+/g,"");return sequence.length||fallback||null;}
  function polymerType(entity){const type=entity?.entity_poly?.type||entity?.entity_poly?.rcsb_entity_polymer_type||"";return type?String(type).replace(/_/g," "):"Not reported";}
  function renderChainInfo(rows,sourceHtml=""){const grid=$("teChainInfoGrid"),source=$("teChainInfoSource");if(!grid)return;grid.replaceChildren();rows.forEach(([label,value])=>{const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=String(value??"Not available");grid.append(dt,dd);});if(source)source.innerHTML=sourceHtml;}
  async function updateChainInfo(force=false){
    if(!ensureChainInfoPanel())return;const chain=selectedVisibleChain(),sourceText=$("teStructureSource")?.textContent||"",pdbId=pdbIdFromUi(),key=`${sourceText}|${chain===null?"MULTI":chain}|${pdbId||"LOCAL"}`;if(!force&&(key===chainInfoKey||key===pendingChainInfoKey))return;chainInfoKey="";pendingChainInfoKey=key;
    if(chain===null){renderChainInfo([["Chain","Select exactly one visible chain to view chain-level information."]],"");chainInfoKey=key;pendingChainInfoKey="";return;}
    const observed=observedChainLength(chain);renderChainInfo([["Chain",chain||"(blank)"],["Observed residues",observed||"Calculating…"],["Molecule","Loading metadata…"],["Organism","Loading metadata…"]],pdbId?`Fetching chain metadata from RCSB PDB ${pdbId}…`:"This structure does not currently expose a PDB ID, so only information available from the loaded coordinates can be shown.");
    if(!pdbId){renderChainInfo([["Chain",chain||"(blank)"],["Observed residues",observed||"Not available"],["Molecule","Not available without PDB metadata"],["Organism","Not available without PDB metadata"]],"Uploaded/local structure · no RCSB PDB metadata request was made.");chainInfoKey=key;pendingChainInfoKey="";return;}
    try{const entities=await fetchPdbEntities(pdbId);if(key!==pendingChainInfoKey)return;const entity=entityForChain(entities,chain);if(!entity)renderChainInfo([["Chain",chain||"(blank)"],["Observed residues",observed||"Not available"],["Molecule","No matching polymer entity found"],["Organism","Not available"]],`RCSB PDB ${pdbId} · chain mapping could not be resolved.`);else{const ids=entity.rcsb_polymer_entity_container_identifiers||{},length=entityLength(entity,observed);renderChainInfo([["Chain",chain||"(blank)"],["Molecule",entityDescription(entity)],["Organism",organismName(entity)],["Sequence length",length||"Not reported"],["Polymer type",polymerType(entity)],["Entity ID",ids.entity_id||"Not reported"]],`Source: <a href="https://www.rcsb.org/structure/${encodeURIComponent(pdbId)}" target="_blank" rel="noreferrer">RCSB PDB ${pdbId}</a>.`);}chainInfoKey=key;}catch(error){if(key!==pendingChainInfoKey)return;renderChainInfo([["Chain",chain||"(blank)"],["Observed residues",observed||"Not available"],["Molecule","Metadata unavailable"],["Organism","Metadata unavailable"]],`RCSB metadata could not be loaded right now. ${String(error?.message||error)}`);chainInfoKey=key;}finally{if(pendingChainInfoKey===key)pendingChainInfoKey="";}
  }
  function bindChainInfoEvents(){const scene=$("scene-tertiary");if(!scene||scene.dataset.chainInfoEvents==="1")return;scene.dataset.chainInfoEvents="1";scene.addEventListener("change",event=>{if(event.target?.matches?.("#teChainSelect,#teChainChoicesV3 input[data-chain],#tePdbId,#teStructureFile"))setTimeout(()=>updateChainInfo(true),80);},true);scene.addEventListener("click",event=>{if(event.target?.matches?.("#teLoadPdbId,#teRestoreStructure,.te-chain-show-all"))setTimeout(()=>updateChainInfo(true),450);},true);}

  function refresh(){addStyles();installNeutralWording();organizeMolecularDrawing();installLabelPatch();bindMobileChem3DSelection();bindChainInfoEvents();updateChainInfo(false);}
  function initialize(){refresh();setInterval(refresh,350);window.addEventListener("resize",()=>{organizeMolecularDrawing();installLabelPatch();},{passive:true});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
})();