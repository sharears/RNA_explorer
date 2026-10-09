(() => {
  "use strict";

  const CATEGORY_ORDER = ["select", "display", "analyze"];
  const RNA_BASES = new Set([
    "A","ADE","RA","1MA","M1A","6MA","RIA",
    "C","CYT","RC","5MC","OMC","M5C",
    "G","GUA","RG","1MG","M1G","2MG","M2G","7MG","M7G","OMG","YG","YYG",
    "U","URA","RU","PSU","H2U","5MU","4SU","T"
  ]);

  let tertiaryHistory = null;

  function isVisibleScene(scene) {
    return Boolean(scene && !scene.hidden && getComputedStyle(scene).display !== "none");
  }

  function installStyles() {
    if (document.getElementById("workspace-tools-style")) return;
    const style = document.createElement("style");
    style.id = "workspace-tools-style";
    style.textContent = `
      .workspace-category-shell{margin:.8rem 0 1rem;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.018);overflow:hidden}
      .workspace-category-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-bottom:1px solid var(--line);background:rgba(255,255,255,.018)}
      .workspace-category-tab{appearance:none;border:0;border-right:1px solid var(--line);border-radius:0;background:transparent;color:var(--muted);padding:.7rem .8rem;font:700 .78rem/1.2 "DM Mono",monospace;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
      .workspace-category-tab:last-child{border-right:0}.workspace-category-tab:hover{background:rgba(116,215,182,.06);color:var(--text)}
      .workspace-category-tab.active{background:rgba(116,215,182,.11);color:var(--mint);box-shadow:inset 0 -2px 0 var(--mint)}
      .workspace-category-panel{padding:.55rem}.workspace-category-panel[hidden]{display:none!important}
      .workspace-category-panel>details{margin:.35rem 0}.workspace-category-panel>details:first-child{margin-top:0}.workspace-category-panel>details:last-child{margin-bottom:0}
      .workspace-history-cluster{display:inline-flex;gap:.35rem;align-items:center;flex-wrap:wrap}
      .workspace-history-button{min-height:34px}.workspace-history-button:disabled{opacity:.42;cursor:not-allowed}
      .te-sequence-dock{margin:.55rem 0 .7rem;padding:.55rem .65rem .65rem;border:1px solid var(--line);border-radius:10px;background:rgba(5,15,27,.72);min-width:0}
      .te-sequence-dock-head{display:flex;gap:.75rem;align-items:baseline;justify-content:space-between;flex-wrap:wrap;margin-bottom:.35rem}
      .te-sequence-dock-head strong{font-size:.83rem;color:var(--text)}.te-sequence-dock-head span{font:600 .72rem/1.2 "DM Mono",monospace;color:var(--muted)}
      .te-sequence-dock .te-sequence-panel{display:flex!important;flex-wrap:nowrap!important;gap:.22rem;max-height:none!important;overflow-x:auto!important;overflow-y:hidden!important;padding:.2rem .05rem .38rem!important;scrollbar-width:thin}
      .te-sequence-dock .te-seq-residue{display:grid!important;grid-template-rows:auto auto;place-items:center;gap:.08rem;min-width:2rem!important;padding:.25rem .32rem!important;border-radius:.42rem!important;line-height:1!important}
      .te-sequence-dock .te-seq-index{font:600 .58rem/1 "DM Mono",monospace;color:var(--muted)}
      .te-sequence-dock .te-seq-base{font:800 .88rem/1.05 "DM Mono",monospace;color:inherit}
      .te-sequence-dock .te-seq-residue.active .te-seq-index,.te-sequence-dock .te-seq-residue.chosen .te-seq-index{color:inherit}
      .workspace-category-select-note{font-size:.77rem;color:var(--muted);margin:.3rem 0 .55rem}
      @media(max-width:720px){.workspace-category-tab{padding:.6rem .4rem;font-size:.7rem}.te-sequence-dock{margin:.45rem 0}.te-sequence-dock .te-seq-residue{min-width:1.85rem!important}}
    `;
    document.head.append(style);
  }

  function categoryShell(id, defaultCategory = "select") {
    let shell = document.getElementById(id);
    if (shell) return shell;
    shell = document.createElement("section");
    shell.id = id;
    shell.className = "workspace-category-shell";
    shell.innerHTML = `
      <div class="workspace-category-nav" role="tablist" aria-label="Workspace tool categories">
        <button type="button" class="workspace-category-tab" data-workspace-category="select" role="tab">Select</button>
        <button type="button" class="workspace-category-tab" data-workspace-category="display" role="tab">Display</button>
        <button type="button" class="workspace-category-tab" data-workspace-category="analyze" role="tab">Analyze</button>
      </div>
      <div class="workspace-category-panel" data-workspace-panel="select" role="tabpanel"></div>
      <div class="workspace-category-panel" data-workspace-panel="display" role="tabpanel" hidden></div>
      <div class="workspace-category-panel" data-workspace-panel="analyze" role="tabpanel" hidden></div>`;
    const activate = category => {
      CATEGORY_ORDER.forEach(key => {
        const tab = shell.querySelector(`[data-workspace-category="${key}"]`);
        const panel = shell.querySelector(`[data-workspace-panel="${key}"]`);
        const active = key === category;
        if (tab) { tab.classList.toggle("active", active); tab.setAttribute("aria-selected", String(active)); }
        if (panel) panel.hidden = !active;
      });
      shell.dataset.activeCategory = category;
    };
    shell.querySelectorAll("[data-workspace-category]").forEach(button => button.addEventListener("click", () => activate(button.dataset.workspaceCategory)));
    activate(defaultCategory);
    return shell;
  }

  function tidySummary(details, prefix) {
    const summary = details?.querySelector(":scope > summary");
    if (!summary) return;
    const text = summary.textContent.trim();
    const re = new RegExp("^" + prefix + "\\s*[·:-]?\\s*", "i");
    const cleaned = text.replace(re, "").trim();
    if (cleaned) summary.textContent = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  function setupSecondaryCategories() {
    const scene = document.getElementById("scene-secondary");
    const controls = scene?.querySelector(".se-controls");
    if (!scene || !controls || controls.dataset.categoryOrganized === "true") return false;
    const shell = categoryShell("seWorkspaceCategories", "select");
    controls.prepend(shell);
    const panels = Object.fromEntries(CATEGORY_ORDER.map(k => [k, shell.querySelector(`[data-workspace-panel="${k}"]`)]));

    [...controls.children].filter(el => el.tagName === "DETAILS" && !shell.contains(el)).forEach(details => {
      const summary = details.querySelector(":scope > summary")?.textContent.trim() || "";
      const lower = summary.toLowerCase();
      const category = lower.startsWith("analyze") ? "analyze" : lower.startsWith("display") ? "display" : "select";
      tidySummary(details, category);
      panels[category].append(details);
    });

    const transformToolbar = document.getElementById("seTransformToolbar");
    if (transformToolbar) {
      const groups = [...transformToolbar.querySelectorAll(":scope > details")];
      const historyGroup = groups.find(d => /history/i.test(d.querySelector("summary")?.textContent || ""));
      const selectGroup = groups.find(d => /select/i.test(d.querySelector("summary")?.textContent || ""));
      const stage = scene.querySelector(".secondary-stage");
      let history = document.getElementById("seWorkspaceHistory");
      if (!history && stage) {
        history = document.createElement("div"); history.id = "seWorkspaceHistory"; history.className = "workspace-history-cluster";
        const anchor = stage.querySelector("#seTransformToolbar,.se-toolbar");
        if (anchor) anchor.insertAdjacentElement("beforebegin", history); else stage.prepend(history);
      }
      ["seUndo","seRedo"].forEach(id => { const b = document.getElementById(id); if (b && history) { b.classList.add("workspace-history-button"); history.append(b); } });
      if (selectGroup) { tidySummary(selectGroup, "select"); panels.select.prepend(selectGroup); }
      historyGroup?.remove();
      if (!transformToolbar.children.length) transformToolbar.remove();
    }

    const rotationDock = scene.querySelector(".se-whole-rotation-dock");
    if (rotationDock) panels.display.prepend(rotationDock);
    controls.dataset.categoryOrganized = "true";
    return true;
  }

  function setupTertiaryCategories() {
    const box = document.getElementById("tertiaryControls");
    const controls = box?.querySelector(".te-controls");
    if (!controls || controls.dataset.categoryOrganized === "true") return false;
    const directDetails = [...controls.children].filter(el => el.tagName === "DETAILS");
    if (!directDetails.length) return false;
    const shell = categoryShell("teWorkspaceCategories", "select");
    const context = document.getElementById("teContextPanel");
    if (context) context.insertAdjacentElement("afterend", shell); else controls.prepend(shell);
    const panels = Object.fromEntries(CATEGORY_ORDER.map(k => [k, shell.querySelector(`[data-workspace-panel="${k}"]`)]));

    directDetails.forEach((details, index) => {
      const summary = details.querySelector(":scope > summary")?.textContent.trim() || "";
      const lower = summary.toLowerCase();
      if (index === 0 || lower.includes("import structure")) return; // global load/mapping controls
      let category = "display";
      if (lower.startsWith("select") || lower.includes("saved object") || lower.includes("focus on structural")) category = "select";
      else if (lower.startsWith("analyze") || lower.includes("compare / align")) category = "analyze";
      else if (lower.includes("display") || lower.includes("residue index") || lower.includes("clipping") || lower.includes("saved camera")) category = "display";
      tidySummary(details, category);
      panels[category].append(details);
    });
    controls.dataset.categoryOrganized = "true";
    return true;
  }

  function formatSequenceButtons(panel) {
    if (!panel || panel.dataset.formatting === "true") return;
    panel.dataset.formatting = "true";
    try {
      [...panel.querySelectorAll(".te-seq-residue")].forEach((button, i) => {
        if (button.querySelector(".te-seq-index")) return;
        const raw = button.textContent.trim();
        const base = (raw.match(/[ACGU?]/i)?.[0] || raw.charAt(0) || "?").toUpperCase();
        button.replaceChildren();
        const index = document.createElement("span"); index.className = "te-seq-index"; index.textContent = String(i + 1);
        const letter = document.createElement("span"); letter.className = "te-seq-base"; letter.textContent = base;
        button.append(index, letter);
        button.setAttribute("aria-label", `${base} residue ${i + 1}`);
      });
    } finally { delete panel.dataset.formatting; }
  }

  function setupTertiarySequenceDock() {
    const scene = document.getElementById("scene-tertiary");
    const stage = document.getElementById("tertiaryStage");
    const panel = document.getElementById("teSequencePanel");
    const split = document.getElementById("tertiarySplitShell");
    if (!scene || !stage || !panel || !split) return false;
    let dock = document.getElementById("teSequenceDock");
    if (!dock) {
      dock = document.createElement("section"); dock.id = "teSequenceDock"; dock.className = "te-sequence-dock";
      dock.innerHTML = '<div class="te-sequence-dock-head"><strong>Residue selection</strong><span id="teSequenceChainLabel">RNA chain</span></div><p class="workspace-category-select-note">Residue index is shown above the nucleotide. Click a residue here or in the 3D structure; both views stay linked.</p>';
      split.insertAdjacentElement("beforebegin", dock);
      dock.append(panel);
      const observer = new MutationObserver(() => formatSequenceButtons(panel));
      observer.observe(panel, {childList:true, subtree:false});
    } else if (!dock.contains(panel)) dock.append(panel);

    const updateChain = () => {
      const select = document.getElementById("teChainSelect"), label = document.getElementById("teSequenceChainLabel");
      if (!label) return;
      const text = select?.selectedOptions?.[0]?.textContent?.trim();
      const value = select?.value;
      label.textContent = text ? `Chain ${value || text}` : "RNA chain";
    };
    const chainSelect = document.getElementById("teChainSelect");
    if (chainSelect && chainSelect.dataset.sequenceDockReady !== "true") {
      chainSelect.dataset.sequenceDockReady = "true";
      chainSelect.addEventListener("change", () => queueMicrotask(() => { updateChain(); formatSequenceButtons(panel); }));
    }
    updateChain(); formatSequenceButtons(panel);
    return true;
  }

  function setupSharedHistoryAppearance() {
    const configs = [
      ["chemUndoButton", "Undo (Ctrl+Z / ⌘Z)"], ["chemRedoButton", "Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)"],
      ["seUndo", "Undo (Ctrl+Z / ⌘Z)"], ["seRedo", "Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)"],
      ["teUndo", "Undo (Ctrl+Z / ⌘Z)"], ["teRedo", "Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)"]
    ];
    configs.forEach(([id,title]) => { const b = document.getElementById(id); if (b) { b.classList.add("workspace-history-button"); b.title = title; } });
  }

  function makeTertiaryHistoryManager() {
    if (tertiaryHistory) return tertiaryHistory;
    const sourceStore = new Map(), reverseSource = new Map();
    let sourceSerial = 1, undoStack = [], redoStack = [], restoring = false;
    const LIMIT = 80;

    const stash = text => {
      if (!text) return null;
      if (reverseSource.has(text)) return reverseSource.get(text);
      const key = "s" + sourceSerial++;
      reverseSource.set(text,key); sourceStore.set(key,text); return key;
    };
    const compact = snapshot => {
      const s = JSON.parse(JSON.stringify(snapshot));
      if (s.sourceText) { s.__sourceKey = stash(s.sourceText); delete s.sourceText; }
      if (s.comparison?.structureText) { s.comparison.__sourceKey = stash(s.comparison.structureText); delete s.comparison.structureText; }
      return JSON.stringify(s);
    };
    const expand = raw => {
      const s = JSON.parse(raw);
      if (s.__sourceKey) { s.sourceText = sourceStore.get(s.__sourceKey) || ""; delete s.__sourceKey; }
      if (s.comparison?.__sourceKey) { s.comparison.structureText = sourceStore.get(s.comparison.__sourceKey) || ""; delete s.comparison.__sourceKey; }
      return s;
    };
    const current = () => {
      try { return compact(TertiaryExplorer.getWorkspaceSnapshot()); } catch (_) { return null; }
    };
    const sync = () => {
      const u = document.getElementById("teUndo"), r = document.getElementById("teRedo");
      if (u) u.disabled = restoring || undoStack.length === 0;
      if (r) r.disabled = restoring || redoStack.length === 0;
    };
    const remember = () => {
      if (restoring || typeof TertiaryExplorer === "undefined") return;
      const snap = current(); if (!snap) return;
      if (undoStack.at(-1) !== snap) undoStack.push(snap);
      if (undoStack.length > LIMIT) undoStack.shift();
      redoStack = []; sync();
    };
    const restore = async (raw, message) => {
      if (!raw || restoring) return false;
      restoring = true; sync();
      try {
        await TertiaryExplorer.restoreWorkspaceSnapshot(expand(raw));
        setupTertiarySequenceDock(); setupTertiaryCategories();
        const status = document.getElementById("teExportStatus"); if (status) status.textContent = message;
        return true;
      } finally { restoring = false; sync(); }
    };
    const undo = async () => {
      if (!undoStack.length || restoring) return false;
      const now = current(); let previous = null;
      while (undoStack.length) { const candidate = undoStack.pop(); if (candidate !== now) { previous = candidate; break; } }
      if (!previous) { sync(); return false; }
      if (now) redoStack.push(now); if (redoStack.length > LIMIT) redoStack.shift();
      return restore(previous, "Undid the last tertiary workspace change.");
    };
    const redo = async () => {
      if (!redoStack.length || restoring) return false;
      const now = current(); let next = null;
      while (redoStack.length) { const candidate = redoStack.pop(); if (candidate !== now) { next = candidate; break; } }
      if (!next) { sync(); return false; }
      if (now) undoStack.push(now); if (undoStack.length > LIMIT) undoStack.shift();
      return restore(next, "Redid the tertiary workspace change.");
    };
    const reset = () => { undoStack = []; redoStack = []; sync(); };
    tertiaryHistory = {remember,undo,redo,reset,sync,isRestoring:()=>restoring};
    return tertiaryHistory;
  }

  function setupTertiaryHistory() {
    const scene = document.getElementById("scene-tertiary"), toolbar = scene?.querySelector(".te-toolbar");
    if (!scene || !toolbar || typeof TertiaryExplorer === "undefined") return false;
    const manager = makeTertiaryHistoryManager();
    let cluster = document.getElementById("teWorkspaceHistory");
    if (!cluster) {
      cluster = document.createElement("div"); cluster.id = "teWorkspaceHistory"; cluster.className = "workspace-history-cluster";
      cluster.innerHTML = '<button id="teUndo" type="button" disabled aria-label="Undo last tertiary workspace change">Undo</button><button id="teRedo" type="button" disabled aria-label="Redo tertiary workspace change">Redo</button>';
      toolbar.prepend(cluster);
      document.getElementById("teUndo").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); manager.undo(); });
      document.getElementById("teRedo").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); manager.redo(); });
    }
    setupSharedHistoryAppearance(); manager.sync();
    if (scene.dataset.historyCaptureReady === "true") return true;
    scene.dataset.historyCaptureReady = "true";

    let pointerTransaction = false;
    const excluded = target => Boolean(target.closest?.("#teUndo,#teRedo,.workspace-category-tab,summary,.workspace-controls-toggle,.workspace-help-button,#teOpenExport,#teExportDialog"));
    scene.addEventListener("pointerdown", event => {
      if (excluded(event.target)) return;
      pointerTransaction = true; manager.remember();
    }, true);
    document.addEventListener("pointerup", () => { pointerTransaction = false; }, true);
    document.addEventListener("pointercancel", () => { pointerTransaction = false; }, true);
    scene.addEventListener("click", event => { if (!pointerTransaction && !excluded(event.target)) manager.remember(); }, true);
    scene.addEventListener("keydown", event => {
      if (excluded(event.target)) return;
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown","Enter"," "].includes(event.key)) manager.remember();
    }, true);

    document.addEventListener("keydown", event => {
      if (!isVisibleScene(scene) || document.getElementById("chemEditorDialog")?.open) return;
      const target = event.target, typing = target?.matches?.("input:not([type=range]),textarea,[contenteditable=true]");
      if (typing) return;
      const mod = event.ctrlKey || event.metaKey; if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z") { event.preventDefault(); event.stopImmediatePropagation(); event.shiftKey ? manager.redo() : manager.undo(); }
      else if (event.ctrlKey && key === "y") { event.preventDefault(); event.stopImmediatePropagation(); manager.redo(); }
    }, true);
    return true;
  }

  function cifTokens(line) {
    const out = []; const re = /'(?:[^']|'')*'|"(?:[^"]|"")*"|\S+/g; let m;
    while ((m = re.exec(line))) { let v = m[0]; if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1,-1); out.push(v); }
    return out;
  }

  function parsePdbResidues(text) {
    const chains = new Map(), seen = new Map();
    String(text||"").split(/\r?\n/).forEach(line => {
      if (!/^(ATOM  |HETATM)/.test(line)) return;
      const resn = line.slice(17,20).trim().toUpperCase(); if (!RNA_BASES.has(resn)) return;
      const chain = line.slice(21,22).trim(), resi = line.slice(22,26).trim(), icode = line.slice(26,27).trim();
      const x=Number(line.slice(30,38)),y=Number(line.slice(38,46)),z=Number(line.slice(46,54)); if (![x,y,z].every(Number.isFinite)) return;
      const key = `${chain}|${resi}|${icode}`; let residue = seen.get(key);
      if (!residue) { residue = {chain,resi,icode,resn,atoms:[]}; seen.set(key,residue); if (!chains.has(chain)) chains.set(chain,[]); chains.get(chain).push(residue); }
      residue.atoms.push({x,y,z});
    });
    return chains;
  }

  function parseCifResidues(text) {
    const lines = String(text||"").split(/\r?\n/), chains = new Map(), seen = new Map();
    for (let i=0;i<lines.length;i++) {
      if (lines[i].trim() !== "loop_") continue;
      let j=i+1, headers=[];
      while (j<lines.length && lines[j].trim().startsWith("_")) { headers.push(lines[j].trim()); j++; }
      if (!headers.some(h=>h.startsWith("_atom_site."))) continue;
      const index = Object.fromEntries(headers.map((h,k)=>[h,k]));
      const col = (...names) => { for (const name of names) if (index[name] !== undefined) return index[name]; return -1; };
      const cGroup=col("_atom_site.group_PDB"),cChain=col("_atom_site.auth_asym_id","_atom_site.label_asym_id"),cSeq=col("_atom_site.auth_seq_id","_atom_site.label_seq_id"),cIns=col("_atom_site.pdbx_PDB_ins_code"),cResn=col("_atom_site.auth_comp_id","_atom_site.label_comp_id"),cX=col("_atom_site.Cartn_x"),cY=col("_atom_site.Cartn_y"),cZ=col("_atom_site.Cartn_z");
      while (j<lines.length) {
        const t = lines[j].trim(); if (!t || t.startsWith("#")) { j++; if (t.startsWith("#")) break; continue; }
        if (t === "loop_" || t.startsWith("_")) break;
        let tokens = cifTokens(lines[j]);
        while (tokens.length < headers.length && j+1<lines.length) { j++; tokens = tokens.concat(cifTokens(lines[j])); }
        if (tokens.length >= headers.length) {
          if (cGroup<0 || /^(ATOM|HETATM)$/i.test(tokens[cGroup]||"")) {
            const resn=String(tokens[cResn]||"").toUpperCase();
            if (RNA_BASES.has(resn)) {
              const clean=v=>v==="?"||v==="."?"":String(v||"");
              const chain=clean(tokens[cChain]),resi=clean(tokens[cSeq]),icode=clean(tokens[cIns]);
              const x=Number(tokens[cX]),y=Number(tokens[cY]),z=Number(tokens[cZ]);
              if ([x,y,z].every(Number.isFinite)) {
                const key=`${chain}|${resi}|${icode}`;let residue=seen.get(key);
                if(!residue){residue={chain,resi,icode,resn,atoms:[]};seen.set(key,residue);if(!chains.has(chain))chains.set(chain,[]);chains.get(chain).push(residue);}
                residue.atoms.push({x,y,z});
              }
            }
          }
        }
        j++;
      }
      if (chains.size) break;
    }
    return chains;
  }

  function activeParsedResidues(snapshot) {
    const chains = snapshot.currentFormat === "cif" ? parseCifResidues(snapshot.sourceText) : parsePdbResidues(snapshot.sourceText);
    const key = String(snapshot.activeChain ?? "");
    if (chains.has(key)) return chains.get(key);
    const expected = document.querySelectorAll("#teSequencePanel .te-seq-residue").length;
    return [...chains.values()].sort((a,b)=>Math.abs(a.length-expected)-Math.abs(b.length-expected))[0] || [];
  }

  function selectResiduesWithinCutoff() {
    const button=document.getElementById("teSelectNearButton"), input=document.getElementById("teSelectNearCutoff");
    if (!button || !input || button.dataset.multiSelectionCutoff === "true") return false;
    button.dataset.multiSelectionCutoff = "true";
    input.min="1"; input.max="25"; input.step="0.1";
    const label=input.closest("label"); if(label) label.firstChild.textContent="Residues within cutoff (Å)";
    button.textContent="Select residues around selection";
    let status=document.getElementById("teSelectionProximityStatus");
    if(!status){status=document.createElement("p");status.id="teSelectionProximityStatus";status.className="te-tool-note";button.insertAdjacentElement("afterend",status);}
    status.textContent="Enter any cutoff from 1 to 25 Å. Distance is the closest atom-to-atom distance from the current residue selection.";

    button.addEventListener("click", async event => {
      event.preventDefault(); event.stopImmediatePropagation();
      const cutoff=Math.max(1,Math.min(25,Number(input.value)||5)); input.value=String(cutoff);
      const snapshot=TertiaryExplorer.getWorkspaceSnapshot();
      const residues=activeParsedResidues(snapshot);
      if(!residues.length){status.textContent="Could not read RNA residue coordinates from the loaded structure.";return;}
      const seeds=(Array.isArray(snapshot.selectionIndices)&&snapshot.selectionIndices.length?snapshot.selectionIndices:[snapshot.selected]).filter(i=>Number.isInteger(i)&&i>=0&&i<residues.length);
      if(!seeds.length){status.textContent="Select at least one residue first.";return;}
      const seedAtoms=seeds.flatMap(i=>residues[i]?.atoms||[]),cut2=cutoff*cutoff,seedSet=new Set(seeds);
      const selected=[];
      for(let i=0;i<residues.length;i++){
        if(seedSet.has(i)){selected.push(i);continue;}
        let hit=false;
        outer:for(const a of residues[i].atoms){for(const b of seedAtoms){const dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;if(dx*dx+dy*dy+dz*dz<=cut2){hit=true;break outer;}}}
        if(hit)selected.push(i);
      }
      tertiaryHistory?.remember();
      const next={...snapshot,selectionIndices:selected};
      try{await TertiaryExplorer.restoreWorkspaceSnapshot(next);setupTertiarySequenceDock();status.textContent=`Selected ${selected.length} residue${selected.length===1?"":"s"} within ${cutoff} Å of ${seeds.length} starting residue${seeds.length===1?"":"s"} (closest-atom distance).`;}
      catch(error){status.textContent="Proximity selection failed: "+error.message;}
    }, true);
    return true;
  }

  function initializeWorkspaceTools() {
    installStyles();
    setupSecondaryCategories();
    setupTertiaryCategories();
    setupTertiarySequenceDock();
    setupTertiaryHistory();
    setupSharedHistoryAppearance();
    selectResiduesWithinCutoff();

    const observer = new MutationObserver(() => {
      setupSecondaryCategories(); setupTertiaryCategories(); setupTertiarySequenceDock(); setupTertiaryHistory(); setupSharedHistoryAppearance(); selectResiduesWithinCutoff();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initializeWorkspaceTools,{once:true});
  else initializeWorkspaceTools();
})();
