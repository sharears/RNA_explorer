(() => {
  "use strict";
  if (window.__rnaExplorerOct15UpdatesV2) return;
  window.__rnaExplorerOct15UpdatesV2 = true;

  const $ = id => document.getElementById(id);
  const mobile = () => matchMedia("(max-width:760px)").matches;
  const pdbCache = new Map();
  let chainKey = "", pendingKey = "";

  function styles() {
    if ($("oct15Styles")) return;
    const s=document.createElement("style"); s.id="oct15Styles"; s.textContent=`
      .chem-tool-group[data-oct15]{border:1px solid rgba(135,169,204,.22);border-radius:9px;padding:.15rem .55rem;margin:.3rem 0;background:rgba(255,255,255,.018)}
      .chem-tool-group[data-oct15]>summary{padding:.48rem .08rem;font-weight:750;cursor:pointer;color:var(--cream)}
      .chem-tool-group-body{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;padding:.2rem 0 .55rem}
      .chem-tool-group-body>.chem-text-controls,.chem-tool-group-body>.chem-inspect-panel,.chem-tool-group-body>.chem-pair-controls,.chem-tool-group-body>.chem-editor-export{width:100%;margin:0}
      .chem-tool-group-body>.chem-inspect-panel,.chem-tool-group-body>.chem-text-controls{border:0;padding:.2rem 0;background:transparent}
      .chem-3d-compact{width:100%;border-top:1px solid var(--line);padding-top:.4rem}.chem-3d-compact>summary{cursor:pointer;color:var(--cream);font-size:.74rem;font-weight:750}.chem-3d-compact-body{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem}.chem-3d-compact-body .chem-3d-help{width:100%}
      .te-chain-info-panel{margin:.65rem 0;padding:.72rem .78rem;border:1px solid rgba(116,215,182,.28);border-radius:10px;background:rgba(8,24,43,.46)}
      .te-chain-info-panel>strong{display:block;color:var(--cream);font-size:.82rem;margin-bottom:.4rem}.te-chain-info-grid{display:grid;grid-template-columns:110px minmax(0,1fr);gap:.3rem .65rem;font-size:.76rem;line-height:1.42}.te-chain-info-grid dt{color:var(--muted);font-weight:700}.te-chain-info-grid dd{margin:0;overflow-wrap:anywhere}.te-chain-info-source{font-size:.7rem!important;color:var(--muted)!important}.te-chain-info-source a{color:var(--mint)}
      @media(max-width:760px){#chemEditorDialog .chem-editor-toolbar{display:block}#chemEditorDialog .chem-tool-group[data-oct15]{width:100%;box-sizing:border-box}#chemEditorDialog .chem-tool-group-body{display:grid;grid-template-columns:1fr 1fr;align-items:stretch}#chemEditorDialog .chem-tool-group-body>*{min-width:0!important;width:100%!important;box-sizing:border-box}#chemEditorDialog .chem-tool-group-body>.chem-text-controls,#chemEditorDialog .chem-tool-group-body>.chem-inspect-panel,#chemEditorDialog .chem-tool-group-body>.chem-pair-controls,#chemEditorDialog .chem-tool-group-body>.chem-editor-export{grid-column:1/-1}#chemEditorDialog .chem-inspect-controls{display:grid;grid-template-columns:1fr 1fr}#chemEditorDialog .chem-inspect-controls button{grid-column:1/-1}.te-chain-info-grid{grid-template-columns:1fr;gap:.08rem}.te-chain-info-grid dd{margin-bottom:.35rem}}
    `; document.head.append(s);
  }

  const neutral = t => String(t||"")
    .replace(/PyMOL[-‑–— ]*style\s+sticks/gi,"element-colored sticks")
    .replace(/PyMOL[-‑–— ]*style\s+color(?:ing|s)?/gi,"element-based coloring")
    .replace(/PyMOL[-‑–— ]*style\s+visuali[sz]ation/gi,"molecular visualization")
    .replace(/PyMOL[-‑–— ]*style\s+viewer/gi,"interactive molecular viewer")
    .replace(/\bPyMOL\b/gi,"molecular viewer");
  function neutralize(root=document.body) {
    if (!root) return;
    const scan = n => {
      if(n.nodeType===Node.TEXT_NODE){if(!n.parentElement?.closest("script,style,pre,code,textarea")&&/pymol/i.test(n.nodeValue||""))n.nodeValue=neutral(n.nodeValue);return;}
      if(n.nodeType!==Node.ELEMENT_NODE||n.closest?.("script,style,pre,code,textarea"))return;
      ["title","aria-label","placeholder"].forEach(a=>{const v=n.getAttribute?.(a);if(v&&/pymol/i.test(v))n.setAttribute(a,neutral(v));});
    };
    scan(root); const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT); while(w.nextNode())scan(w.currentNode);
  }
  function wording() {
    neutralize(); if(document.documentElement.dataset.oct15Wording)return;
    document.documentElement.dataset.oct15Wording="1";
    new MutationObserver(rs=>rs.forEach(r=>{r.addedNodes.forEach(neutralize);if(r.type==="characterData")neutralize(r.target);})).observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  function group(toolbar,key,label,test) {
    let g=[...toolbar.querySelectorAll(":scope > details.chem-tool-group")].find(x=>test?.((x.querySelector(":scope > summary")?.textContent||"").toLowerCase()));
    if(!g){g=document.createElement("details");g.className="chem-tool-group";g.innerHTML='<summary></summary><div class="chem-tool-group-body"></div>';toolbar.append(g);}
    g.dataset.oct15=key; g.querySelector("summary").textContent=label; return g;
  }
  function organize() {
    const d=$("chemEditorDialog"),tb=d?.querySelector(".chem-editor-toolbar"); if(!d||!tb)return;
    const g={
      history:group(tb,"history","History",s=>s.startsWith("history")),
      build:group(tb,"build","Build & Edit",s=>s.startsWith("build")),
      select:group(tb,"select","Select",s=>s.startsWith("select")),
      display:group(tb,"display","Display",s=>s.startsWith("display")),
      inspect:group(tb,"inspect","Inspect",s=>s.startsWith("inspect")),
      view:group(tb,"view","View",s=>s.startsWith("view")),
      export:group(tb,"export","Export",s=>s.startsWith("export"))
    };
    const move=(node,k)=>{const body=g[k].querySelector(".chem-tool-group-body");if(node&&body&&node.parentElement!==body)body.append(node);};
    move(d.querySelector("#chemPairControls"),"build"); move(d.querySelector(".chem-text-controls"),"display"); move(d.querySelector("#chem3DToggle"),"view"); move(d.querySelector("#chemInspectPanelV2"),"inspect"); move(d.querySelector(".chem-editor-export"),"export");
    const ordered=["history","build","select","display","inspect","view","export"].map(k=>g[k]);
    ordered.forEach((node,index)=>{
      const current=[...tb.children].filter(el=>el.matches?.("details.chem-tool-group"));
      if(current[index]!==node)tb.insertBefore(node,current[index]||null);
    });
    if(!tb.dataset.oct15Open){tb.dataset.oct15Open="1";Object.entries(g).forEach(([k,v])=>v.open=!mobile()&&["build","select"].includes(k));}
    document.querySelectorAll('.rna-tool-tabs button[data-rna-tab="analyze"]').forEach(b=>b.textContent="Inspect");
    const h=d.querySelector(".chem-3d-heading"); if(h&&!h.querySelector(".chem-3d-compact")){
      const nodes=[h.querySelector(".chem-3d-mode-controls"),h.querySelector(".chem-3d-view-controls"),h.querySelector(".chem-3d-help")].filter(Boolean);
      if(nodes.length){const x=document.createElement("details");x.className="chem-3d-compact";x.open=!mobile();x.innerHTML='<summary>View</summary><div class="chem-3d-compact-body"></div>';nodes.forEach(n=>x.lastElementChild.append(n));h.append(x);}
    }
  }

  function chemViewer(){const h=$("chem3DMolViewer");if(!h)return null;for(const c of h.querySelectorAll("canvas"))if(c._3dmol_viewer)return c._3dmol_viewer;return null;}
  function labelPatch(){const p=window.$3Dmol?.GLViewer?.prototype;if(!p?.addLabel||p.addLabel.__oct15)return;const old=p.addLabel;p.addLabel=function(text,spec,...rest){let n=spec;try{const h=$("chem3DMolViewer"),c=this.container||this._container||this.getContainer?.(),on=$("chemInspectPropertyV2")?.value&&$("chemInspectPropertyV2").value!=="off";if(on&&h&&(c===h||h.contains?.(c))){n={...(spec||{})};n.fontSize=Math.max(Number(n.fontSize||12),mobile()?14:13);}}catch(_e){}return old.call(this,text,n,...rest);};p.addLabel.__oct15=1;}
  const pickSig=()=>[...document.querySelectorAll("#chemEditorSvg [data-atom-id].chem-inspect-selected")].map(x=>x.dataset.atomId).join("|");
  function pick3d(x,y,event){
    if($("chemInspectPropertyV2")?.value==="off"||$("chemInspectScopeV2")?.value!=="select")return;
    const v=chemViewer();if(!v)return;let m;try{const ms=v.getModels?.();m=Array.isArray(ms)&&ms.length?ms[0]:v.getModel?.();}catch(_e){}if(!m)return;
    let objs=[];try{objs=m.selectedAtoms?.({clickable:true})||[];}catch(_e){}if(!objs.length)return;
    const c=v.getCanvas?.()||$("chem3DMolViewer")?.querySelector("canvas"),r=c?.getBoundingClientRect();if(!r?.width||!r.height)return;
    let hits=[];try{hits=v.targetedObjects(((x-r.left)/r.width)*2-1,-(((y-r.top)/r.height)*2-1),objs)||[];}catch(_e){}const a=hits[0]?.clickable;if(typeof a?.callback==="function")a.callback(a,v,event,$("chem3DMolViewer"),hits);
  }
  function mobilePick(){
    const h=$("chem3DMolViewer");if(!h||h.dataset.oct15Tap)return;h.dataset.oct15Tap="1";const pts=new Map();
    h.addEventListener("pointerdown",e=>{if(e.pointerType!=="touch")return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,multi:pts.size>0,before:pickSig()});if(pts.size>1)pts.forEach(p=>p.multi=true);},true);
    h.addEventListener("pointermove",e=>{const p=pts.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.sx,p.y-p.sy)>12)p.moved=true;}},true);
    h.addEventListener("pointerup",e=>{const p=pts.get(e.pointerId);if(!p)return;pts.delete(e.pointerId);if(p.moved||p.multi)return;setTimeout(()=>{if(pickSig()===p.before)pick3d(p.x,p.y,e);},80);},true);
    h.addEventListener("pointercancel",e=>pts.delete(e.pointerId),true);
  }

  function chainPanel(){const s=$("teChainSelect");if(!s)return null;let p=$("teChainInfoPanel");if(p)return p;p=document.createElement("section");p.id="teChainInfoPanel";p.className="te-chain-info-panel";p.innerHTML='<strong>Chain information</strong><div class="te-chain-info-grid" id="teChainInfoGrid"></div><p class="te-chain-info-source" id="teChainInfoSource"></p>';s.closest("label")?.insertAdjacentElement("afterend",p);return p;}
  function visibleChain(){const bs=[...document.querySelectorAll("#teChainChoicesV3 input[data-chain]")];if(bs.length){const on=bs.filter(x=>x.checked).map(x=>String(x.dataset.chain??""));return on.length===1?on[0]:null;}const s=$("teChainSelect");return s&&!s.disabled?String(s.value??""):null;}
  function pdbId(){const t=$("teStructureSource")?.textContent||"";let m=t.match(/\bPDB\s+([0-9][A-Za-z0-9]{3})\b/i)||t.match(/\b([0-9][A-Za-z0-9]{3})\.(?:pdb|ent|cif|mmcif)\b/i);const v=String($("tePdbId")?.value||"").trim();if(!m&&/^[0-9][A-Za-z0-9]{3}$/.test(v))m=[v,v];return m?m[1].toUpperCase():null;}
  function tViewer(){const h=$("tertiaryMolecularViewer");if(!h)return null;for(const c of h.querySelectorAll("canvas"))if(c._3dmol_viewer)return c._3dmol_viewer;return null;}
  function modelAtoms(chain){const v=tViewer();let m;try{const ms=v?.getModels?.();m=Array.isArray(ms)&&ms.length?ms[0]:v?.getModel?.();return m?.selectedAtoms?.(chain===""?{chain:""}:{chain})||[];}catch(_e){return[];}}
  function observed(chain){return new Set(modelAtoms(chain).filter(a=>!["HOH","WAT","H2O","DOD"].includes(String(a.resn||"").toUpperCase())).map(a=>`${a.resi??""}|${a.icode??""}`)).size||null;}
  function polyType(chain){const rs=[...new Set(modelAtoms(chain).map(a=>String(a.resn||"").toUpperCase()))],aa=new Set("ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL SEC PYL".split(" ")),na=new Set("A C G U T DA DC DG DT DU ADE CYT GUA URA PSU H2U 5MU 4SU 1MA 1MG 2MG 7MG OMG".split(" ")),ac=rs.filter(x=>aa.has(x)).length,nc=rs.filter(x=>na.has(x)).length;return nc>ac&&nc?"Nucleic acid":ac>nc&&ac?"Protein":"Polymer";}
  function fields(text,name){const joined=String(text).split(/\r?\n/).filter(l=>l.startsWith(name)).map(l=>l.slice(10).trim()).join(" "),out=[],map=new Map();let cur=null,last="";joined.split(";").map(x=>x.trim()).filter(Boolean).forEach(part=>{const m=part.match(/^([A-Z0-9_]+)\s*:\s*(.*)$/i);if(m){const k=m[1].toUpperCase(),v=m[2].trim();if(k==="MOL_ID"){cur=map.get(v)||{id:v};if(!map.has(v)){map.set(v,cur);out.push(cur);}}else if(cur)cur[k]=v;last=k;}else if(cur&&last)cur[last]=`${cur[last]||""} ${part}`.trim();});return out;}
  function parsePdb(text){const comp=fields(text,"COMPND"),src=new Map(fields(text,"SOURCE").map(x=>[x.id,x])),lens=new Map();String(text).split(/\r?\n/).forEach(l=>{const m=l.match(/^SEQRES\s+\d+\s+(\S)\s+(\d+)/);if(m)lens.set(m[1],+m[2]);});return comp.map(c=>({id:c.id,chains:String(c.CHAIN||"").split(",").map(x=>x.trim()).filter(Boolean),molecule:c.MOLECULE||c.SYNONYM||"Not reported",organism:src.get(c.id)?.ORGANISM_SCIENTIFIC||src.get(c.id)?.ORGANISM_COMMON||"Not reported",lens}));}
  async function metadata(id){if(pdbCache.has(id))return pdbCache.get(id);const p=fetch(`https://files.rcsb.org/download/${encodeURIComponent(id)}.pdb`).then(r=>{if(!r.ok)throw Error(`RCSB request failed (${r.status})`);return r.text();}).then(parsePdb);pdbCache.set(id,p);try{return await p;}catch(e){pdbCache.delete(id);throw e;}}
  function render(rows,source=""){const g=$("teChainInfoGrid"),s=$("teChainInfoSource");if(!g)return;g.replaceChildren();rows.forEach(([a,b])=>{const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=a;dd.textContent=String(b??"Not available");g.append(dt,dd);});if(s){s.replaceChildren();if(source?.href){s.append("Source: ");const a=document.createElement("a");a.href=source.href;a.target="_blank";a.rel="noreferrer";a.textContent=source.label;s.append(a,".");}else s.textContent=String(source||"");}}
  async function chainInfo(force=false){
    if(!chainPanel())return;const c=visibleChain(),id=pdbId(),key=`${$("teStructureSource")?.textContent||""}|${c===null?"MULTI":c}|${id||"LOCAL"}`;if(!force&&(key===chainKey||key===pendingKey))return;pendingKey=key;chainKey="";
    if(c===null){render([["Chain","Select exactly one visible chain to view chain-level information."]]);chainKey=key;pendingKey="";return;}
    const obs=observed(c);if(!id){render([["Chain",c||"(blank)"],["Observed residues",obs||"Not available"],["Molecule","Not available without a PDB ID"],["Organism","Not available without a PDB ID"],["Polymer type",polyType(c)]],"Uploaded/local structure · coordinate-derived information only.");chainKey=key;pendingKey="";return;}
    render([["Chain",c||"(blank)"],["Observed residues",obs||"Calculating…"],["Molecule","Loading…"],["Organism","Loading…"]],`Fetching chain metadata from RCSB PDB ${id}…`);
    try{const es=await metadata(id);if(pendingKey!==key)return;const e=es.find(x=>x.chains.includes(c));if(!e)render([["Chain",c||"(blank)"],["Observed residues",obs||"Not available"],["Molecule","No matching PDB molecule record"],["Organism","Not available"],["Polymer type",polyType(c)]],`RCSB PDB ${id} · chain mapping unavailable.`);else render([["Chain",c||"(blank)"],["Molecule",e.molecule],["Organism",e.organism],["Sequence length",e.lens.get(c)||obs||"Not reported"],["Polymer type",polyType(c)],["Entity ID",e.id||"Not reported"]],{href:`https://www.rcsb.org/structure/${encodeURIComponent(id)}`,label:`RCSB PDB ${id}`});chainKey=key;}catch(e){if(pendingKey===key){render([["Chain",c||"(blank)"],["Observed residues",obs||"Not available"],["Molecule","Metadata unavailable"],["Organism","Metadata unavailable"],["Polymer type",polyType(c)]],`RCSB metadata could not be loaded: ${e.message||e}`);chainKey=key;}}finally{if(pendingKey===key)pendingKey="";}
  }
  function chainEvents(){const s=$("scene-tertiary");if(!s||s.dataset.oct15ChainEvents)return;s.dataset.oct15ChainEvents="1";s.addEventListener("change",e=>{if(e.target?.matches?.("#teChainSelect,#teChainChoicesV3 input[data-chain],#tePdbId,#teStructureFile"))setTimeout(()=>chainInfo(true),100);},true);s.addEventListener("click",e=>{if(e.target?.matches?.("#teLoadPdbId,#teRestoreStructure,.te-chain-show-all"))setTimeout(()=>chainInfo(true),500);},true);}

  function refresh(){styles();wording();organize();labelPatch();mobilePick();chainEvents();chainInfo();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{refresh();setInterval(refresh,400);},{once:true});else{refresh();setInterval(refresh,400);}
})();