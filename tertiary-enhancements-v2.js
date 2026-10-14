(() => {
  "use strict";

  const DATA_MODES = {
    reactivity:{
      label:"Reactivity",
      headers:["reactivity","residueinformation","value","score"],
      example:"data/rna_residue_reactivity.csv",
      exampleLabel:"Use example reactivity",
      help:"CSV/TSV: Residue_Index plus Reactivity (Residue_Information is also accepted). The built-in example is the same reactivity dataset used in the Secondary Structure workspace."
    },
    mapcc:{
      label:"Map-model CC",
      headers:["mapmodelcc","mapcc","rscc","cc","value","score","residueinformation"],
      example:"data/rna_map_model_cc_example.csv",
      exampleLabel:"Use example map-model CC",
      help:"CSV/TSV: Residue_Index plus Map_Model_CC (MapCC or RSCC are also accepted). The built-in values are illustrative example data for testing."
    },
    bfactor:{
      label:"Temperature factor (B-factor)",
      headers:["bfactor","temperaturefactor","tempfactor","b","value","score","residueinformation"],
      example:"data/rna_b_factor_example.csv",
      exampleLabel:"Use example B-factor",
      help:"CSV/TSV: Residue_Index plus B_Factor (Temperature_Factor is also accepted). The built-in values are illustrative example data for testing."
    }
  };

  const PALETTES={
    viridis:["#440154","#3b528b","#21918c","#5ec962","#fde725"],
    cividis:["#00224e","#434e6c","#7d7c78","#bcae6c","#fee838"],
    magma:["#000004","#51127c","#b73779","#fc8961","#fcfdbf"],
    blueRed:["#2166ac","#92c5de","#f7f7f7","#f4a582","#b2182b"]
  };
  const MISSING_COLOR="#6f7f8f";

  let viewer=null,model=null,lastModel=null;
  let chains=[],visibleChains=new Set();
  let palette="viridis",customMode=null;
  let applyTimer=null,pollTimer=null;
  const datasets={reactivity:new Map(),mapcc:new Map(),bfactor:new Map()};

  const $=id=>document.getElementById(id);
  const chainKey=a=>String(a?.chain??"");
  const chainLabel=id=>id===""?"(blank)":id;
  const norm=s=>String(s??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"");
  const isDataMode=v=>Object.prototype.hasOwnProperty.call(DATA_MODES,v);

  function getViewerFromCanvas(){
    const host=$("tertiaryMolecularViewer");
    if(!host)return null;
    for(const canvas of host.querySelectorAll("canvas")){
      if(canvas._3dmol_viewer)return canvas._3dmol_viewer;
    }
    return null;
  }

  function getMainModel(v){
    if(!v)return null;
    try{const models=v.getModels?.();if(Array.isArray(models)&&models.length)return models[0];}catch(_e){}
    try{return v.getModel?.()||null;}catch(_e){return null;}
  }

  function atoms(){
    try{return model?.selectedAtoms?.({})||[];}catch(_e){return [];}
  }

  function discoverChains(){
    const ids=[];
    atoms().forEach(a=>{const id=chainKey(a);if(!ids.includes(id))ids.push(id);});
    if(!ids.length){
      const native=$("teChainSelect");
      if(native){
        [...native.options].forEach(o=>{
          if(/^choose /i.test(o.textContent||""))return;
          const id=String(o.value??"");if(!ids.includes(id))ids.push(id);
        });
      }
    }
    return ids;
  }

  function refreshModel(){
    const v=getViewerFromCanvas();if(v)viewer=v;
    const m=getMainModel(viewer);if(m)model=m;
    if(!model)return false;

    if(model!==lastModel){
      lastModel=model;
      chains=discoverChains();
      visibleChains=new Set(chains);
      Object.values(datasets).forEach(map=>map.clear());
      customMode=null;
      buildChainMenu();syncDataOptions();
    }else if(!chains.length){
      chains=discoverChains();
      if(chains.length&&!visibleChains.size)visibleChains=new Set(chains);
      buildChainMenu();syncDataOptions();
    }
    return true;
  }

  function addStyles(){
    if($("teChainDataEnhancementStylesV3"))return;
    const s=document.createElement("style");s.id="teChainDataEnhancementStylesV3";
    s.textContent=`
      .te-chain-filter-v3{margin:.7rem 0}.te-chain-filter-v3>span,.te-data-panel-v3>span{display:block;font-size:.78rem;opacity:.82;margin-bottom:.3rem}
      .te-chain-filter-v3 details{position:relative}.te-chain-filter-v3 summary{cursor:pointer;border:1px solid rgba(135,169,204,.34);border-radius:8px;padding:.48rem .58rem;list-style:none}
      .te-chain-filter-v3 summary::-webkit-details-marker{display:none}.te-chain-menu-v3{display:grid;gap:.38rem;padding:.58rem;margin-top:.3rem;border:1px solid rgba(135,169,204,.28);border-radius:8px;background:#0b1727;max-height:240px;overflow:auto}
      .te-chain-menu-v3 label{display:flex;align-items:center;gap:.45rem;margin:0}.te-chain-show-all{width:100%;text-align:left;margin-bottom:.1rem}
      .te-data-panel-v3{margin:.7rem 0;padding:.65rem;border:1px solid rgba(116,215,182,.24);border-radius:10px;background:rgba(8,24,43,.45)}
      .te-data-panel-v3 label{display:grid;gap:.25rem;margin:.45rem 0}.te-data-panel-v3 input[type=file],.te-data-panel-v3 select{max-width:100%}
      .te-example-actions{display:flex;gap:.45rem;flex-wrap:wrap;margin:.5rem 0}.te-example-actions button,.te-example-actions a{font-size:.76rem}
      .te-data-help-v3,.te-data-status-v3,.te-data-note-v3{margin:.4rem 0 0;font-size:.76rem;line-height:1.4;opacity:.82}
      .te-data-status-v3[data-state=error]{color:#f4a582;opacity:1}.te-data-status-v3[data-state=ready]{color:#74d7b6;opacity:1}
      #teTertiaryDataLegendV3{min-width:220px}#teTertiaryDataLegendV3 .te-custom-heat-bar{height:10px;border-radius:999px;margin:.35rem 0}#teTertiaryDataLegendV3 p{margin:.1rem 0 0;font-size:.75rem;opacity:.78}
    `;
    document.head.appendChild(s);
  }

  function ensureUi(){
    addStyles();
    const color=$("teColorMode"),label=color?.closest("label");
    if(!color||!label)return false;

    ["teChainFilter","teTertiaryDataPanel","teTertiaryDataLegend","teChainFilterV2","teTertiaryDataPanelV2","teTertiaryDataLegendV2"].forEach(id=>$(id)?.remove());

    if(!$("teChainFilterV3")){
      const wrap=document.createElement("div");wrap.id="teChainFilterV3";wrap.className="te-chain-filter-v3";
      wrap.innerHTML='<span>Show chains</span><details id="teChainMenuV3"><summary id="teChainSummaryV3">Detecting chains…</summary><div class="te-chain-menu-v3" id="teChainChoicesV3"></div></details>';
      label.insertAdjacentElement("beforebegin",wrap);
    }

    if(!$("teTertiaryDataPanelV3")){
      const p=document.createElement("div");p.id="teTertiaryDataPanelV3";p.className="te-data-panel-v3";p.hidden=true;
      p.innerHTML=`
        <span id="teTertiaryDataTitleV3">Residue data</span>
        <div class="te-example-actions">
          <button type="button" id="teUseExampleDataV3">Use example data</button>
          <a id="teDownloadExampleV3" href="#" download>Example CSV</a>
        </div>
        <label>Upload your data<input id="teTertiaryDataFileV3" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"></label>
        <label>Color palette<select id="teTertiaryDataPaletteV3"><option value="viridis">Viridis</option><option value="cividis">Cividis</option><option value="magma">Magma</option><option value="blueRed">Blue–red</option></select></label>
        <p class="te-data-help-v3" id="teTertiaryDataHelpV3"></p>
        <p class="te-data-note-v3" id="teTertiaryDataNoteV3"></p>
        <p class="te-data-status-v3" id="teTertiaryDataStatusV3" role="status"></p>`;
      label.insertAdjacentElement("afterend",p);
      $("teTertiaryDataFileV3")?.addEventListener("change",handleFile);
      $("teTertiaryDataPaletteV3")?.addEventListener("change",e=>{palette=e.target.value;scheduleApply(0);});
      $("teUseExampleDataV3")?.addEventListener("click",()=>loadExampleData());
    }

    if(!$("teTertiaryDataLegendV3")){
      const row=document.querySelector("#scene-tertiary .te-legend-row");
      if(row){const l=document.createElement("div");l.id="teTertiaryDataLegendV3";l.className="te-heat-legend";l.hidden=true;row.prepend(l);}
    }

    if(color.dataset.chainDataV3!=="1"){
      color.dataset.chainDataV3="1";
      color.addEventListener("change",()=>{customMode=isDataMode(color.value)?color.value:null;updateDataPanel();scheduleApply(80);});
    }
    return true;
  }

  function buildChainMenu(){
    if(!ensureUi())return;
    const box=$("teChainChoicesV3");if(!box)return;
    box.replaceChildren();
    if(!chains.length){box.textContent="No chains detected yet.";updateSummary();return;}

    const all=document.createElement("button");all.type="button";all.className="te-chain-show-all";all.textContent="Show all chains";
    all.addEventListener("click",()=>{visibleChains=new Set(chains);buildChainMenu();chainsChanged();});box.append(all);

    chains.forEach(id=>{
      const lab=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.checked=visibleChains.has(id);cb.dataset.chain=id;
      cb.addEventListener("change",()=>{
        if(cb.checked)visibleChains.add(id);else visibleChains.delete(id);
        if(!visibleChains.size){visibleChains.add(id);cb.checked=true;}
        buildChainMenu();chainsChanged();
      });
      lab.append(cb,document.createTextNode("Chain "+chainLabel(id)));box.append(lab);
    });
    updateSummary();
  }

  function updateSummary(){
    const s=$("teChainSummaryV3");if(!s)return;
    if(!chains.length)s.textContent="No chains detected";
    else if(visibleChains.size===chains.length)s.textContent="All chains";
    else if(visibleChains.size===1)s.textContent="Chain "+chainLabel([...visibleChains][0]);
    else s.textContent=[...visibleChains].map(chainLabel).join(", ");
  }

  function syncNativeChain(){
    if(visibleChains.size!==1)return;
    const id=[...visibleChains][0],sel=$("teChainSelect");if(!sel)return;
    const option=[...sel.options].find(o=>String(o.value)===id);if(!option||sel.value===id)return;
    sel.value=id;sel.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function chainsChanged(){
    updateSummary();syncDataOptions();syncNativeChain();
    try{if(typeof TertiaryExplorer!=="undefined")TertiaryExplorer.render();}catch(_e){}
    scheduleApply(140);
  }

  function syncDataOptions(){
    const color=$("teColorMode");if(!color)return;
    const one=visibleChains.size===1;

    Object.entries(DATA_MODES).forEach(([value,cfg])=>{
      let option=color.querySelector(`option[value="${value}"]`);
      if(one&&!option){option=new Option(cfg.label,value);option.dataset.chainDataV3="1";color.append(option);}
      if(!one&&option&&(option.dataset.chainDataV3==="1"||isDataMode(option.value)))option.remove();
    });

    if(!one&&isDataMode(color.value)){
      customMode=null;color.value="element";color.dispatchEvent(new Event("change",{bubbles:true}));
    }else customMode=isDataMode(color.value)?color.value:null;
    updateDataPanel();
  }

  function currentChain(){return visibleChains.size===1?[...visibleChains][0]:null;}

  function updateDataPanel(){
    const p=$("teTertiaryDataPanelV3"),mode=isDataMode($("teColorMode")?.value)?$("teColorMode").value:null;
    customMode=mode;if(!p)return;p.hidden=!mode||visibleChains.size!==1;
    if(p.hidden){updateLegend();return;}

    const chain=currentChain(),cfg=DATA_MODES[mode];
    if($("teTertiaryDataTitleV3"))$("teTertiaryDataTitleV3").textContent=cfg.label+" · chain "+chainLabel(chain);
    if($("teTertiaryDataHelpV3"))$("teTertiaryDataHelpV3").textContent=cfg.help;
    if($("teTertiaryDataNoteV3"))$("teTertiaryDataNoteV3").textContent="Residue_Index is 1-based within the visible chain. Example files are provided so users can test the coloring and inspect the expected format.";
    const use=$("teUseExampleDataV3");if(use)use.textContent=cfg.exampleLabel;
    const link=$("teDownloadExampleV3");if(link){link.href=cfg.example;link.download=cfg.example.split("/").pop();link.textContent="Example CSV";}

    const ds=datasets[mode].get(chain),st=$("teTertiaryDataStatusV3");
    if(st&&!ds){st.textContent="Load your own file or use the built-in example.";st.dataset.state="idle";}
    updateLegend();
  }

  function residuesForChain(id){
    const out=[],seen=new Map();
    atoms().filter(a=>chainKey(a)===id).forEach(a=>{
      const key=`${id}|${String(a.resi??"")}|${String(a.icode??"")}`;
      let r=seen.get(key);if(!r){r={key,chain:id,resi:a.resi,icode:a.icode||"",serials:[]};seen.set(key,r);out.push(r);}
      if(a.serial!==undefined&&a.serial!==null)r.serials.push(a.serial);
    });
    return out;
  }

  function parseRows(text){
    const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return[];
    const delim=(lines[0].match(/\t/g)||[]).length>(lines[0].match(/,/g)||[]).length?"\t":",";
    return lines.map(line=>{const out=[];let cell="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cell+='"';i++;}else q=!q;}else if(ch===delim&&!q){out.push(cell.trim());cell="";}else cell+=ch;}out.push(cell.trim());return out;});
  }

  function findHeader(headers,cands){for(const c of cands){const i=headers.indexOf(c);if(i>=0)return i;}return-1;}

  function parseDataset(text,mode,chain){
    const rows=parseRows(text);if(rows.length<2)throw new Error("The file needs a header row and at least one data row.");
    const h=rows[0].map(norm);
    let idx=findHeader(h,["residueindex","index","position","sequenceindex"]);
    const resi=findHeader(h,["residuenumber","pdbresidue","pdbresiduenumber","resi","resnum"]);
    const chainCol=findHeader(h,["chain","chainid"]);
    const val=findHeader(h,DATA_MODES[mode].headers);
    if(idx<0&&resi<0)idx=0;
    if(val<0)throw new Error("Could not find the value column for "+DATA_MODES[mode].label+".");

    const residues=residuesForChain(chain);if(!residues.length)throw new Error("No residues were found in chain "+chainLabel(chain)+".");
    const byResi=new Map();residues.forEach(r=>{const n=Number(r.resi);if(Number.isFinite(n)&&!byResi.has(n))byResi.set(n,r);});
    const values=new Map();let skipped=0;

    for(let i=1;i<rows.length;i++){
      const row=rows[i];
      if(chainCol>=0&&String(row[chainCol]??"").trim()&&String(row[chainCol]).trim()!==chain){skipped++;continue;}
      const value=Number(row[val]);if(!Number.isFinite(value)){skipped++;continue;}
      let r=null;
      if(resi>=0){const n=Number(row[resi]);if(Number.isFinite(n))r=byResi.get(n)||null;}
      else{const n=Number(row[idx]);if(Number.isInteger(n)&&n>=1&&n<=residues.length)r=residues[n-1];}
      if(!r){skipped++;continue;}
      values.set(r.key,value);
    }

    if(!values.size)throw new Error("No rows matched residues in chain "+chainLabel(chain)+".");
    const nums=[...values.values()].sort((a,b)=>a-b);
    return{values,min:nums[0],max:nums[nums.length-1],matched:values.size,skipped};
  }

  async function loadTextAsDataset(text,name,mode,chain){
    const ds=parseDataset(text,mode,chain);ds.name=name;datasets[mode].set(chain,ds);
    const st=$("teTertiaryDataStatusV3");
    if(st){st.textContent=`${name} · ${ds.matched} residue${ds.matched===1?"":"s"} mapped${ds.skipped?` · ${ds.skipped} row${ds.skipped===1?"":"s"} skipped`:""}.`;st.dataset.state="ready";}
    scheduleApply(0);
  }

  async function handleFile(e){
    const file=e.target.files?.[0];if(!file||!customMode)return;
    const chain=currentChain(),st=$("teTertiaryDataStatusV3");if(chain===null)return;
    try{
      if(st){st.textContent="Reading "+file.name+"…";st.dataset.state="busy";}
      await loadTextAsDataset(await file.text(),file.name,customMode,chain);
    }catch(err){
      if(st){st.textContent=err?.message||String(err);st.dataset.state="error";}
    }finally{e.target.value="";}
  }

  async function loadExampleData(){
    const mode=isDataMode($("teColorMode")?.value)?$("teColorMode").value:null,chain=currentChain(),st=$("teTertiaryDataStatusV3");
    if(!mode||chain===null)return;
    const cfg=DATA_MODES[mode];
    try{
      if(st){st.textContent="Loading example data…";st.dataset.state="busy";}
      const response=await fetch(cfg.example,{cache:"no-store"});
      if(!response.ok)throw new Error("Could not load the example CSV.");
      await loadTextAsDataset(await response.text(),cfg.example.split("/").pop(),mode,chain);
    }catch(err){
      if(st){st.textContent=err?.message||String(err);st.dataset.state="error";}
    }
  }

  function hexToRgb(hex){
    const m=/^#([0-9a-f]{6})$/i.exec(hex);if(!m)return[127,127,127];
    const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255];
  }
  function rgbToHex(rgb){return"#"+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");}
  function colorForValue(value,min,max){
    const stops=PALETTES[palette]||PALETTES.viridis;
    if(!Number.isFinite(value))return MISSING_COLOR;
    const t=max===min?.5:Math.max(0,Math.min(1,(value-min)/(max-min)));
    const scaled=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(scaled)),u=scaled-i;
    const a=hexToRgb(stops[i]),b=hexToRgb(stops[i+1]);
    return rgbToHex(a.map((v,j)=>v+(b[j]-v)*u));
  }

  function representationStyle(color){
    const rep=$("teRepresentation")?.value||"sticks";
    if(rep==="ballstick")return{stick:{radius:.12,color},sphere:{scale:.27,color}};
    if(rep==="wire")return{line:{linewidth:2,color}};
    if(rep==="spheres")return{sphere:{scale:.72,color}};
    if(rep==="cartoon")return{cartoon:{color}};
    if(rep==="backbone")return{line:{linewidth:3,color}};
    return{stick:{radius:.14,color}};
  }

  function hideUnselectedChains(){
    if(!model||!chains.length||visibleChains.size===chains.length)return;
    const hidden=new Set(chains.filter(id=>!visibleChains.has(id)));
    const serials=atoms().filter(a=>hidden.has(chainKey(a))).map(a=>a.serial).filter(v=>v!==undefined&&v!==null);
    if(serials.length)model.setStyle({serial:serials},{});
  }

  function applyDatasetColors(){
    const mode=isDataMode($("teColorMode")?.value)?$("teColorMode").value:null,chain=currentChain();
    if(!mode||chain===null||!model)return;
    const ds=datasets[mode].get(chain);if(!ds)return;
    residuesForChain(chain).forEach(r=>{
      const value=ds.values.get(r.key),color=value===undefined?MISSING_COLOR:colorForValue(value,ds.min,ds.max);
      if(r.serials.length)model.setStyle({serial:r.serials},representationStyle(color));
    });
  }

  function updateLegend(){
    const l=$("teTertiaryDataLegendV3");if(!l)return;
    const mode=isDataMode($("teColorMode")?.value)?$("teColorMode").value:null,chain=currentChain(),ds=mode&&chain!==null?datasets[mode].get(chain):null;
    l.hidden=!ds;if(!ds){l.replaceChildren();return;}
    const stops=PALETTES[palette]||PALETTES.viridis;
    l.replaceChildren();
    const h=document.createElement("strong");h.textContent=DATA_MODES[mode].label+" · chain "+chainLabel(chain);
    const bar=document.createElement("div");bar.className="te-custom-heat-bar";bar.style.background="linear-gradient(to right,"+stops.join(",")+")";
    const p=document.createElement("p");p.textContent=`${fmt(ds.min)} → ${fmt(ds.max)} · ${ds.matched} residues`;
    l.append(h,bar,p);
  }

  function fmt(v){
    const n=Number(v);if(!Number.isFinite(n))return"–";
    if(Math.abs(n)>=100||(Math.abs(n)<.001&&n!==0))return n.toExponential(2);
    return String(Number(n.toFixed(3)));
  }

  function applyEnhancements(){
    applyTimer=null;ensureUi();
    if(!refreshModel())return;
    syncDataOptions();
    hideUnselectedChains();
    applyDatasetColors();
    updateLegend();
    try{viewer?.render?.();}catch(_e){}
  }

  function scheduleApply(delay=50){clearTimeout(applyTimer);applyTimer=setTimeout(applyEnhancements,delay);}

  function bindSceneEvents(){
    const scene=$("scene-tertiary");if(!scene||scene.dataset.chainDataEnhancementsV3==="1")return;
    scene.dataset.chainDataEnhancementsV3="1";
    ["click","change","input"].forEach(type=>scene.addEventListener(type,()=>scheduleApply(100),false));
  }

  function initialize(){
    ensureUi();bindSceneEvents();scheduleApply(100);
    pollTimer=setInterval(()=>{bindSceneEvents();ensureUi();scheduleApply(0);},500);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();