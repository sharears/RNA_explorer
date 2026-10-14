(() => {
  "use strict";

  const DATA_MODES = {
    reactivity: { label: "Reactivity", valueHeaders: ["reactivity", "residueinformation", "value", "score"] },
    mapcc: { label: "Map-model CC", valueHeaders: ["mapmodelcc", "mapcc", "rscc", "cc", "value", "score", "residueinformation"] }
  };
  const PALETTES = {
    viridis:["#440154","#3b528b","#21918c","#5ec962","#fde725"],
    magma:["#000004","#51127c","#b73779","#fc8961","#fcfdbf"],
    cividis:["#00224e","#434e6c","#7d7c78","#bcae6c","#fee838"],
    blueRed:["#2166ac","#92c5de","#f7f7f7","#f4a582","#b2182b"]
  };
  const MISSING_COLOR = "#6f7f8f";

  let tertiaryViewer = null;
  let mainModel = null;
  let lastModel = null;
  let allChains = [];
  let visibleChains = new Set();
  let paletteName = "viridis";
  let customMode = null;
  let applyTimer = null;
  let captureTimer = null;
  let modelPollTimer = null;
  const datasets = { reactivity:new Map(), mapcc:new Map() };

  const $ = id => document.getElementById(id);
  const displayChain = id => id === "" ? "(blank)" : id;
  const chainKey = atom => String(atom?.chain ?? "");
  const residueKey = residue => `${String(residue.chain ?? "")}|${String(residue.resi ?? "")}|${String(residue.icode ?? "")}`;
  const normalizeHeader = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const isDataMode = value => Object.prototype.hasOwnProperty.call(DATA_MODES, value);

  function viewerElementFromArg(arg) {
    if (arg instanceof HTMLElement) return arg;
    if (typeof arg === "string") return document.getElementById(arg);
    return null;
  }

  function viewerBelongsToTertiary(viewer) {
    const target = $("tertiaryMolecularViewer");
    if (!target || !viewer) return false;
    try {
      const canvas = viewer.getCanvas?.();
      if (canvas && target.contains(canvas)) return true;
    } catch (_error) {}
    const container = viewer.container || viewer._container || viewer.getContainer?.();
    return container === target || (container instanceof HTMLElement && target.contains(container));
  }

  function captureViewer(viewer, element) {
    const target = $("tertiaryMolecularViewer");
    if (!target || !viewer) return;
    if (element && element !== target && !target.contains(element)) return;
    if (!element && !viewerBelongsToTertiary(viewer)) return;
    tertiaryViewer = viewer;
    scheduleApply(80);
  }

  function patch3Dmol() {
    const lib = window.$3Dmol;
    if (!lib) return false;

    if (typeof lib.createViewer === "function" && !lib.createViewer.__rnaExplorerChainCapture) {
      const original = lib.createViewer;
      const wrapped = function(element, config) {
        const viewer = original.apply(this, arguments);
        captureViewer(viewer, viewerElementFromArg(element));
        return viewer;
      };
      Object.assign(wrapped, original);
      wrapped.__rnaExplorerChainCapture = true;
      wrapped.__rnaExplorerOriginal = original;
      lib.createViewer = wrapped;
    }

    const proto = lib.GLViewer?.prototype;
    if (proto?.render && !proto.render.__rnaExplorerChainCapture) {
      const originalRender = proto.render;
      const wrappedRender = function() {
        const result = originalRender.apply(this, arguments);
        if (!tertiaryViewer && viewerBelongsToTertiary(this)) captureViewer(this, null);
        return result;
      };
      wrappedRender.__rnaExplorerChainCapture = true;
      wrappedRender.__rnaExplorerOriginal = originalRender;
      proto.render = wrappedRender;
    }

    try {
      const viewers = lib.viewers;
      if (!tertiaryViewer && viewers && typeof viewers === "object") {
        Object.values(viewers).forEach(v => { if (!tertiaryViewer && viewerBelongsToTertiary(v)) captureViewer(v, null); });
      }
    } catch (_error) {}
    return true;
  }

  function getMainModel() {
    if (!tertiaryViewer) return null;
    try {
      const models = tertiaryViewer.getModels?.();
      if (Array.isArray(models) && models.length) return models[0];
    } catch (_error) {}
    try { return tertiaryViewer.getModel?.() || null; } catch (_error) { return null; }
  }

  function modelAtoms(model) {
    try { return model?.selectedAtoms?.({}) || []; } catch (_error) { return []; }
  }

  function residuesForChain(chainId) {
    const atoms = modelAtoms(mainModel).filter(atom => chainKey(atom) === chainId);
    const residues = [], seen = new Map();
    atoms.forEach(atom => {
      const key = `${chainId}|${String(atom.resi ?? "")}|${String(atom.icode ?? "")}`;
      let residue = seen.get(key);
      if (!residue) {
        residue = { key, chain:chainId, resi:atom.resi, icode:atom.icode || "", resn:atom.resn || "", serials:[] };
        seen.set(key, residue);residues.push(residue);
      }
      if (atom.serial !== undefined && atom.serial !== null) residue.serials.push(atom.serial);
    });
    return residues;
  }

  function refreshModelAndChains() {
    const model = getMainModel();
    if (!model) return false;
    mainModel = model;
    if (model === lastModel && allChains.length) return true;

    lastModel = model;
    const ids = [];
    modelAtoms(model).forEach(atom => {
      const id = chainKey(atom);
      if (!ids.includes(id)) ids.push(id);
    });
    allChains = ids;
    visibleChains = new Set(ids);
    datasets.reactivity.clear();
    datasets.mapcc.clear();
    customMode = null;
    buildChainMenu();
    syncDataOptions();
    return true;
  }

  function addStyles() {
    if ($("teChainDataEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "teChainDataEnhancementStyles";
    style.textContent = `
      .te-chain-filter { margin:.7rem 0; }
      .te-chain-filter > span, .te-data-panel > span { display:block; font-size:.78rem; opacity:.8; margin-bottom:.3rem; }
      .te-chain-filter details { position:relative; }
      .te-chain-filter summary { cursor:pointer; border:1px solid rgba(135,169,204,.34); border-radius:8px; padding:.48rem .58rem; list-style:none; }
      .te-chain-filter summary::-webkit-details-marker { display:none; }
      .te-chain-menu { display:grid; gap:.35rem; padding:.55rem; margin-top:.3rem; border:1px solid rgba(135,169,204,.28); border-radius:8px; background:#0b1727; max-height:220px; overflow:auto; }
      .te-chain-menu label { display:flex; align-items:center; gap:.45rem; margin:0; }
      .te-data-panel { margin:.7rem 0; padding:.65rem; border:1px solid rgba(116,215,182,.24); border-radius:10px; background:rgba(8,24,43,.45); }
      .te-data-panel label { display:grid; gap:.25rem; margin:.45rem 0; }
      .te-data-panel input[type=file], .te-data-panel select { max-width:100%; }
      .te-data-help, .te-data-status { margin:.4rem 0 0; font-size:.76rem; line-height:1.4; opacity:.82; }
      .te-data-status[data-state="error"] { color:#f4a582; opacity:1; }
      .te-data-status[data-state="ready"] { color:#74d7b6; opacity:1; }
      #teTertiaryDataLegend { min-width:220px; }
      #teTertiaryDataLegend .te-custom-heat-bar { height:10px; border-radius:999px; margin:.35rem 0; }
      #teTertiaryDataLegend p { margin:.1rem 0 0; font-size:.75rem; opacity:.78; }
    `;
    document.head.appendChild(style);
  }

  function displayDetails() {
    return $("teColorMode")?.closest("details") || null;
  }

  function ensureUi() {
    addStyles();
    const details = displayDetails();
    const color = $("teColorMode");
    if (!details || !color) return false;

    if (!$("teChainFilter")) {
      const wrap = document.createElement("div");
      wrap.className = "te-chain-filter";wrap.id = "teChainFilter";
      wrap.innerHTML = '<span>Show chains</span><details id="teChainFilterMenu"><summary id="teChainFilterSummary">All chains</summary><div class="te-chain-menu" id="teChainFilterChoices"></div></details>';
      color.closest("label")?.insertAdjacentElement("beforebegin", wrap);
    }

    if (!$("teTertiaryDataPanel")) {
      const panel = document.createElement("div");
      panel.className = "te-data-panel";panel.id = "teTertiaryDataPanel";panel.hidden = true;
      panel.innerHTML = `
        <span id="teTertiaryDataTitle">Residue data</span>
        <label>Data file<input id="teTertiaryDataFile" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"></label>
        <label>Color palette<select id="teTertiaryDataPalette"><option value="viridis">Viridis</option><option value="cividis">Cividis</option><option value="magma">Magma</option><option value="blueRed">Blue–red</option></select></label>
        <p class="te-data-help" id="teTertiaryDataHelp"></p>
        <p class="te-data-status" id="teTertiaryDataStatus" role="status"></p>`;
      color.closest("label")?.insertAdjacentElement("afterend", panel);
      $("teTertiaryDataFile")?.addEventListener("change", handleDataFile);
      $("teTertiaryDataPalette")?.addEventListener("change", event => { paletteName = event.target.value; scheduleApply(0); });
    }

    if (!$("teTertiaryDataLegend")) {
      const row = document.querySelector("#scene-tertiary .te-legend-row");
      if (row) {
        const legend = document.createElement("div");
        legend.className = "te-heat-legend";legend.id = "teTertiaryDataLegend";legend.hidden = true;row.prepend(legend);
      }
    }

    if (color.dataset.tertiaryDataBound !== "1") {
      color.dataset.tertiaryDataBound = "1";
      color.addEventListener("change", () => {
        customMode = isDataMode(color.value) ? color.value : null;
        updateDataPanel();
        scheduleApply(30);
      });
    }
    return true;
  }

  function buildChainMenu() {
    if (!ensureUi()) return;
    const box = $("teChainFilterChoices");if (!box) return;
    box.replaceChildren();
    if (!allChains.length) {
      box.textContent = "No chains detected.";updateChainSummary();return;
    }

    const allLabel = document.createElement("label");
    const allInput = document.createElement("input");allInput.type = "checkbox";allInput.id = "teChainAll";
    allInput.checked = visibleChains.size === allChains.length;
    allInput.addEventListener("change", () => {
      visibleChains = new Set(allChains);
      buildChainMenu();onVisibleChainsChanged();
    });
    allLabel.append(allInput, document.createTextNode("All chains"));box.append(allLabel);

    allChains.forEach(id => {
      const label = document.createElement("label");
      const input = document.createElement("input");input.type = "checkbox";input.checked = visibleChains.has(id);input.dataset.chainId = id;
      input.addEventListener("change", () => {
        if (input.checked) visibleChains.add(id); else visibleChains.delete(id);
        if (!visibleChains.size) { visibleChains.add(id);input.checked = true; }
        buildChainMenu();onVisibleChainsChanged();
      });
      label.append(input, document.createTextNode("Chain "+displayChain(id)));box.append(label);
    });
    updateChainSummary();
  }

  function updateChainSummary() {
    const summary = $("teChainFilterSummary");if (!summary) return;
    if (!allChains.length) summary.textContent = "No chains";
    else if (visibleChains.size === allChains.length) summary.textContent = "All chains";
    else if (visibleChains.size === 1) summary.textContent = "Chain "+displayChain([...visibleChains][0]);
    else summary.textContent = visibleChains.size+" chains";
  }

  function syncActiveMappingChain() {
    if (visibleChains.size !== 1) return;
    const id = [...visibleChains][0], select = $("teChainSelect");
    if (!select || select.value === id) return;
    const option = [...select.options].find(o => o.value === id);
    if (!option) return;
    select.value = id;
    select.dispatchEvent(new Event("change", {bubbles:true}));
  }

  function onVisibleChainsChanged() {
    updateChainSummary();syncDataOptions();syncActiveMappingChain();
    try { if (typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render(); } catch (_error) {}
    scheduleApply(90);
  }

  function syncDataOptions() {
    const color = $("teColorMode");if (!color) return;
    const allowed = visibleChains.size === 1;
    Object.entries(DATA_MODES).forEach(([value, cfg]) => {
      let option = color.querySelector(`option[value="${value}"]`);
      if (allowed && !option) {
        option = new Option(cfg.label, value);option.dataset.tertiaryDataOption = "1";color.append(option);
      } else if (!allowed && option) option.remove();
    });
    if (!allowed && isDataMode(color.value)) {
      customMode = null;color.value = "element";color.dispatchEvent(new Event("change", {bubbles:true}));
    } else customMode = isDataMode(color.value) ? color.value : null;
    updateDataPanel();
  }

  function currentChain() { return visibleChains.size === 1 ? [...visibleChains][0] : null; }

  function updateDataPanel() {
    const panel = $("teTertiaryDataPanel"), title = $("teTertiaryDataTitle"), help = $("teTertiaryDataHelp"), status = $("teTertiaryDataStatus");
    const mode = isDataMode($("teColorMode")?.value) ? $("teColorMode").value : null;
    customMode = mode;
    if (!panel) return;
    panel.hidden = !mode || visibleChains.size !== 1;
    if (panel.hidden) { updateLegend();return; }
    const cfg = DATA_MODES[mode], chain = currentChain();
    if (title) title.textContent = cfg.label+" · chain "+displayChain(chain);
    if (help) help.textContent = mode === "reactivity"
      ? "CSV/TSV: Residue_Index plus Reactivity (or Residue_Information). Residue_Index is 1-based within the visible chain."
      : "CSV/TSV: Residue_Index plus Map_Model_CC (MapCC/RSCC also accepted). Residue_Index is 1-based within the visible chain.";
    const dataset = datasets[mode].get(chain);
    if (status && !dataset) { status.textContent = "Load a residue-level data file to color this chain.";status.dataset.state = "idle"; }
    updateLegend();
  }

  function parseDelimited(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim().length);
    if (!lines.length) return [];
    const delimiter = (lines[0].match(/\t/g)||[]).length > (lines[0].match(/,/g)||[]).length ? "\t" : ",";
    const parseLine = line => {
      const out=[];let cell="",quoted=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch==='"'){
          if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
        }else if(ch===delimiter&&!quoted){out.push(cell.trim());cell="";}else cell+=ch;
      }
      out.push(cell.trim());return out;
    };
    return lines.map(parseLine);
  }

  function findHeader(headers, candidates) {
    for (const candidate of candidates) {
      const index = headers.indexOf(candidate);if (index >= 0) return index;
    }
    return -1;
  }

  function parseDataset(text, mode, chain) {
    const rows = parseDelimited(text);if (rows.length < 2) throw new Error("The file needs a header row and at least one data row.");
    const headers = rows[0].map(normalizeHeader);
    let indexCol = findHeader(headers,["residueindex","index","position","sequenceindex"]);
    const resiCol = findHeader(headers,["residuenumber","pdbresidue","pdbresiduenumber","resi","resnum"]);
    const chainCol = findHeader(headers,["chain","chainid"]);
    const valueCol = findHeader(headers, DATA_MODES[mode].valueHeaders);
    if (indexCol < 0 && resiCol < 0) indexCol = 0;
    if (valueCol < 0) throw new Error("Could not find the data-value column for "+DATA_MODES[mode].label+".");

    const residues = residuesForChain(chain);if (!residues.length) throw new Error("No residues were found in the selected chain.");
    const byResi = new Map();residues.forEach(residue => { const n=Number(residue.resi);if(Number.isFinite(n)&&!byResi.has(n))byResi.set(n,residue); });
    const values = new Map();let skipped=0;
    for (let r=1;r<rows.length;r++) {
      const row = rows[r];
      if (chainCol >= 0 && row[chainCol] !== undefined && String(row[chainCol]).trim() !== "" && String(row[chainCol]).trim() !== chain) { skipped++;continue; }
      const value = Number(row[valueCol]);if (!Number.isFinite(value)) { skipped++;continue; }
      let residue = null;
      if (resiCol >= 0) {
        const resi = Number(row[resiCol]);if (Number.isFinite(resi)) residue = byResi.get(resi) || null;
      } else {
        const position = Number(row[indexCol]);if (Number.isInteger(position) && position >= 1 && position <= residues.length) residue = residues[position-1];
      }
      if (!residue) { skipped++;continue; }
      values.set(residue.key, value);
    }
    if (!values.size) throw new Error("No rows matched residues in chain "+displayChain(chain)+".");
    const finite = [...values.values()].sort((a,b)=>a-b);
    return { values, min:finite[0], max:finite[finite.length-1], matched:values.size, skipped };
  }

  async function handleDataFile(event) {
    const file = event.target.files?.[0];if (!file || !customMode) return;
    const chain = currentChain(), status = $("teTertiaryDataStatus");
    if (chain === null) return;
    try {
      if (status) { status.textContent = "Reading "+file.name+"…";status.dataset.state = "busy"; }
      const dataset = parseDataset(await file.text(), customMode, chain);
      dataset.name = file.name;datasets[customMode].set(chain, dataset);
      if (status) { status.textContent = `${file.name} · ${dataset.matched} residue${dataset.matched===1?"":"s"} mapped${dataset.skipped?` · ${dataset.skipped} row${dataset.skipped===1?"":"s"} skipped`:""}.`;status.dataset.state = "ready"; }
      scheduleApply(0);
    } catch (error) {
      if (status) { status.textContent = error?.message || String(error);status.dataset.state = "error"; }
    } finally { event.target.value = ""; }
  }

  function hexToRgb(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);if(!m)return [127,127,127];
    const n=parseInt(m[1],16);return [(n>>16)&255,(n>>8)&255,n&255];
  }
  function rgbToHex(rgb) { return "#"+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join(""); }
  function colorForValue(value,min,max) {
    const stops=PALETTES[paletteName]||PALETTES.viridis;
    if(!Number.isFinite(value))return MISSING_COLOR;
    const t=max===min?.5:Math.max(0,Math.min(1,(value-min)/(max-min)));
    const scaled=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(scaled)),u=scaled-i;
    const a=hexToRgb(stops[i]),b=hexToRgb(stops[i+1]);
    return rgbToHex(a.map((v,j)=>v+(b[j]-v)*u));
  }

  function representationStyle(color) {
    const rep = $("teRepresentation")?.value || "sticks";
    if (rep === "ballstick") return {stick:{radius:.12,color},sphere:{scale:.27,color}};
    if (rep === "wire") return {line:{linewidth:2,color}};
    if (rep === "spheres") return {sphere:{scale:.72,color}};
    if (rep === "cartoon") return {cartoon:{color}};
    if (rep === "backbone") return {line:{linewidth:3,color}};
    return {stick:{radius:.14,color}};
  }

  function hideUnselectedChains() {
    if (!mainModel || !allChains.length || visibleChains.size === allChains.length) return;
    const hidden = new Set(allChains.filter(id => !visibleChains.has(id)));
    if (!hidden.size) return;
    const serials = modelAtoms(mainModel).filter(atom => hidden.has(chainKey(atom))).map(atom => atom.serial).filter(v=>v!==undefined&&v!==null);
    if (serials.length) mainModel.setStyle({serial:serials}, {});
  }

  function applyDatasetColors() {
    const mode = isDataMode($("teColorMode")?.value) ? $("teColorMode").value : null;
    const chain = currentChain();if (!mode || chain === null || !mainModel) return;
    const dataset = datasets[mode].get(chain);if (!dataset) return;
    residuesForChain(chain).forEach(residue => {
      const value = dataset.values.get(residue.key);
      const color = value === undefined ? MISSING_COLOR : colorForValue(value,dataset.min,dataset.max);
      if (residue.serials.length) mainModel.setStyle({serial:residue.serials}, representationStyle(color));
    });
  }

  function updateLegend() {
    const legend = $("teTertiaryDataLegend");if (!legend) return;
    const mode = isDataMode($("teColorMode")?.value) ? $("teColorMode").value : null, chain=currentChain();
    const dataset = mode&&chain!==null?datasets[mode].get(chain):null;
    legend.hidden = !dataset;
    if (!dataset) { legend.replaceChildren();return; }
    const stops=PALETTES[paletteName]||PALETTES.viridis;
    legend.replaceChildren();
    const heading=document.createElement("strong");heading.textContent=DATA_MODES[mode].label+" · chain "+displayChain(chain);
    const bar=document.createElement("div");bar.className="te-custom-heat-bar";bar.style.background="linear-gradient(to right,"+stops.join(",")+")";
    const note=document.createElement("p");note.textContent=`${formatNumber(dataset.min)} → ${formatNumber(dataset.max)} · ${dataset.matched} residues`;
    legend.append(heading,bar,note);
  }

  function formatNumber(value) {
    const n=Number(value);if(!Number.isFinite(n))return "–";
    if(Math.abs(n)>=100||Math.abs(n)<.001&&n!==0)return n.toExponential(2);
    return String(Number(n.toFixed(3)));
  }

  function applyEnhancements() {
    applyTimer = null;
    patch3Dmol();ensureUi();
    if (!tertiaryViewer || !refreshModelAndChains()) return;
    syncDataOptions();
    hideUnselectedChains();
    applyDatasetColors();
    updateLegend();
    try { tertiaryViewer.render(); } catch (_error) {}
  }

  function scheduleApply(delay=40) {
    clearTimeout(applyTimer);applyTimer=setTimeout(applyEnhancements,delay);
  }

  function bindSceneEvents() {
    const scene = $("scene-tertiary");if (!scene || scene.dataset.chainDataEnhancementsBound === "1") return;
    scene.dataset.chainDataEnhancementsBound = "1";
    ["click","change","input"].forEach(type=>scene.addEventListener(type,()=>scheduleApply(90),false));
  }

  function initialize() {
    ensureUi();bindSceneEvents();patch3Dmol();
    captureTimer=setInterval(()=>{patch3Dmol();if(tertiaryViewer){clearInterval(captureTimer);captureTimer=null;scheduleApply(20);}},60);
    modelPollTimer=setInterval(()=>{
      bindSceneEvents();ensureUi();
      if(tertiaryViewer){const model=getMainModel();if(model&&model!==lastModel){mainModel=model;refreshModelAndChains();scheduleApply(20);}}
    },500);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();
