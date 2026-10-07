const RNA_SEQUENCE = "GCGGAUUUAGCUCAGUUGGGAGAGCGCCAGACUGAAGAUCUGGAGGUCCUGUGUUCGAUCCACAGAAUUCGCACCA";
const TRNA_DOT_BRACKET = "(((((((..((((........)))).(((((.......))))).....(((((.......))))))))))))....";
const BASE_NAMES = { A: "Adenine", G: "Guanine", C: "Cytosine", U: "Uracil" };
const BASE_COLORS = { A: "#b55d6a", G: "#2f6b57", C: "#c89b4a", U: "#5d7fa3" };
const SCENES = ["blocks", "nucleoside", "nucleotide", "primary", "secondary", "tertiary"];
const SCENE_LABELS = ["Building blocks", "Nucleoside", "Nucleotide", "Primary", "Secondary", "Tertiary"];
const SITE_SEARCH_ITEMS = [
  {label:"Molecular Drawing",description:"Draw or edit nucleobases, ribose, phosphate, and base-pair chemistry",page:"drawing",scene:null,target:"#workspaceLauncher",keywords:"molecule molecular drawing chemistry editor atoms bonds charges chemdraw"},
  {label:"Building blocks",description:"RNA phosphate, ribose, and nucleobase basics",page:"journey",scene:"blocks",target:"#scene-blocks",keywords:"parts chemistry phosphate sugar ribose base"},
  {label:"Nucleoside",description:"Explore the sugar + base unit",page:"journey",scene:"nucleoside",target:"#scene-nucleoside",keywords:"nucleoside sugar base"},
  {label:"Nucleotide",description:"Explore phosphate + nucleoside",page:"journey",scene:"nucleotide",target:"#scene-nucleotide",keywords:"nucleotide phosphate"},
  {label:"Primary sequence",description:"RNA sequence and residue positions",page:"journey",scene:"primary",target:"#scene-primary",keywords:"primary sequence letters residues 5 prime 3 prime"},
  {label:"Secondary structure workspace",description:"2D RNA structure, dot-bracket, layouts, and styling",page:"secondary",scene:"secondary",target:"#scene-secondary",keywords:"2d secondary dot bracket dbn ct radial circular arc"},
  {label:"RNA sequence / dot-bracket input",description:"Enter or edit a 2D RNA structure",page:"secondary",scene:"secondary",target:"#secondarySequence",keywords:"sequence structure dot bracket input render"},
  {label:"Reactivity / residue metadata",description:"Color residues using uploaded numeric metadata",page:"secondary",scene:"secondary",target:"#seMetadataFile",keywords:"reactivity dms shape csv metadata coloring heatmap"},
  {label:"Base-pair probability",description:"Upload a matrix or sparse probability data",page:"secondary",scene:"secondary",target:"#sePairProbFile",keywords:"base pair probability matrix bpp confidence"},
  {label:"Base-pair display / Leontis–Westhof",description:"Change pair lines and LW annotations",page:"secondary",scene:"secondary",target:"#se-mode",keywords:"base pair style leontis westhof lw edge cis trans"},
  {label:"Secondary structure export",description:"Export 2D images or DBN/CT structure files",page:"secondary",scene:"secondary",target:"#seExportDialogButton",keywords:"download export png svg pdf dbn ct image"},
  {label:"Tertiary structure workspace",description:"Interactive all-atom 3D RNA viewer",page:"tertiary",scene:"tertiary",target:"#scene-tertiary",keywords:"3d tertiary molecular viewer pymol"},
  {label:"Import PDB / mmCIF",description:"Load a local 3D coordinate file",page:"tertiary",scene:"tertiary",target:"#teStructureFile",keywords:"upload structure pdb cif mmcif coordinates"},
  {label:"Load by PDB ID",description:"Fetch coordinates directly from RCSB PDB",page:"tertiary",scene:"tertiary",target:"#tePdbId",keywords:"rcsb pdb id fetch download structure"},
  {label:"RNA chain selection",description:"Choose the RNA chain from a 3D structure",page:"tertiary",scene:"tertiary",target:"#teChainSelect",keywords:"chain select polymer molecule"},
  {label:"Generate 2D from 3D",description:"Derive a secondary structure from the active 3D RNA chain",page:"tertiary",scene:"tertiary",target:"#teGenerateSecondary",keywords:"generate derive secondary 2d from 3d coordinates base pairs dot bracket"},
  {label:"Linked 2D + 3D view",description:"Show synchronized secondary and tertiary views",page:"tertiary",scene:"tertiary",target:"#teSplit",keywords:"linked synchronize sync 2d 3d highlight mapping"},
  {label:"Hydrogen bonds for selected base pairs",description:"Inspect geometry-supported H-bonds for selected pairs",page:"tertiary",scene:"tertiary",target:"#teContextPanel",keywords:"hydrogen bond hbond donor acceptor selected pair geometry"},
  {label:"Persistent residue selection",description:"Build an additive residue selection",page:"tertiary",scene:"tertiary",target:"#teSequencePanel",keywords:"select residue additive persistent multiple"},
  {label:"Molecular surface",description:"Toggle and adjust the molecular surface",page:"tertiary",scene:"tertiary",target:"#teSurface",keywords:"surface transparency"},
  {label:"Measurements and contacts",description:"Distances, angles, dihedrals, contacts, and proximity",page:"tertiary",scene:"tertiary",target:"#teMeasureMode",keywords:"measure distance angle dihedral contacts proximity analyze"},
  {label:"Compare / align structures",description:"Superimpose another structure and calculate RMSD",page:"tertiary",scene:"tertiary",target:"#teAlignFile",keywords:"compare align superimpose rmsd structures"},
  {label:"Tertiary structure export",description:"Export 3D images or coordinate files",page:"tertiary",scene:"tertiary",target:"#teOpenExport",keywords:"export png svg pdf pdb mmcif structure image"},
  {label:"Save Project",description:"Download the current RNA Explorer session so you can continue later",page:"secondary",scene:"secondary",target:"#saveProjectButton",keywords:"save project session workspace progress backup json resume"},
  {label:"Open Project",description:"Restore a previously saved RNA Explorer session",page:"secondary",scene:"secondary",target:"#openProjectButton",keywords:"open import project session workspace progress restore resume json"}
];
const NS = "http://www.w3.org/2000/svg";

// C4′ coordinates from the experimentally determined yeast tRNA-Phe structure, PDB 1EHZ.
const TERTIARY_COORDS = [
  [50.968,49.231,54.309],[56.836,48.075,56.049],[62.769,46.443,54.422],[66.749,44.634,50.114],
  [67.927,42.844,44.191],[66.579,44.400,38.565],[64.055,47.852,34.101],[66.105,52.236,29.628],
  [64.531,52.215,22.904],[59.058,48.375,20.709],[60.091,42.608,23.221],[64.121,39.544,26.594],
  [69.102,41.516,29.762],[74.612,43.815,30.626],[78.274,48.248,31.867],[80.514,52.486,33.353],
  [84.176,55.886,36.150],[80.100,59.412,35.902],[80.105,62.508,30.407],[80.529,60.879,23.849],
  [75.622,58.001,23.580],[76.292,51.916,21.581],[76.705,45.975,20.257],[74.313,40.622,18.747],
  [69.170,38.275,16.491],[63.938,40.267,14.143],[61.594,44.378,10.321],[62.918,48.099,5.246],
  [67.384,49.009,1.027],[72.933,47.996,-1.281],[77.346,43.848,-2.300],[72.103,39.570,-2.726],
  [74.457,33.095,-5.870],[70.295,33.326,-11.163],[65.999,34.348,-7.216],[65.801,33.698,-1.565],
  [66.976,32.279,4.107],[71.783,31.310,7.804],[76.728,36.038,4.591],[80.351,38.970,7.985],
  [80.498,45.168,6.953],[77.769,50.433,7.372],[73.059,54.264,8.204],[67.971,56.191,10.523],
  [64.255,55.158,15.248],[63.911,55.833,21.859],[62.482,60.255,26.545],[66.046,56.424,30.251],
  [61.796,55.006,32.810],[59.218,60.444,34.331],[59.365,65.668,37.334],[62.118,69.559,40.905],
  [67.174,70.724,43.912],[72.524,67.496,40.026],[75.687,68.934,38.291],[79.735,74.239,36.678],
  [76.829,69.964,33.385],[74.279,63.972,33.383],[70.618,58.472,33.026],[73.252,56.436,38.285],
  [75.643,58.316,43.840],[71.882,60.684,48.244],[66.263,61.750,50.244],[60.204,61.569,49.339],
  [55.988,59.170,46.060],[53.671,55.677,41.542],[53.319,50.645,38.320],[55.168,44.940,37.012],
  [57.582,39.880,39.400],[59.348,35.925,43.805],[59.688,34.434,49.701],[57.653,35.834,55.450],
  [53.508,38.772,58.837],[47.463,40.541,58.985],[42.564,38.194,56.568],[37.607,38.379,58.569]
];

const state = {
  sceneIndex: 0,
  selectedResidue: 0,
  selectedBase: "A",
  rotationX: -0.28,
  rotationY: -0.6,
  dragging: false,
  dragMoved: false,
  lastPointer: null,
  secondarySequence: RNA_SEQUENCE,
  secondaryStructure: TRNA_DOT_BRACKET,
  secondaryLayout: "radial",
  secondarySelectedResidue: 0
};

const blockFacts = {
  phosphate: {
    title: "Phosphate group",
    copy: "Phosphate links one ribose to the next and becomes part of RNA's repeating backbone."
  },
  ribose: {
    title: "Ribose sugar",
    copy: "Ribose is a five-carbon sugar. Its 2′-OH group helps give RNA its distinct chemistry."
  },
  base: {
    title: "Nitrogenous base",
    copy: "A, G, C, or U carries chemical information and can interact with bases elsewhere in the chain."
  }
};

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function selectResidue(index) {
  state.selectedResidue = Math.max(0, Math.min(RNA_SEQUENCE.length - 1, index));
  updateResiduePanels();
  document.querySelectorAll(".nt").forEach((node, i) => node.classList.toggle("selected", i === state.selectedResidue));
  SecondaryExplorer.followDefault(state.selectedResidue);
  if (typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render(state.selectedResidue);
}

function updateResiduePanels() {
  const base = RNA_SEQUENCE[state.selectedResidue];
  const position = state.selectedResidue + 1;
  document.querySelectorAll(".selected-residue-title").forEach(node => {
    node.textContent = `${BASE_NAMES[base]} · ${base}${position}`;
  });
  document.querySelectorAll(".selected-residue-copy").forEach(node => {
    if (node.closest("#scene-primary")) node.textContent = `Position ${position} of ${RNA_SEQUENCE.length} in this tRNA sequence.`;
    if (node.closest("#scene-secondary")) node.textContent = `Position ${position} is highlighted in the cloverleaf map.`;
    if (node.closest("#scene-tertiary")) node.textContent = `Position ${position} is highlighted in the experimental residue trace. Drag to change the view.`;
  });
}

function showScene(index) {
  cancelChemicalAnimation();
  cancelPrimaryAnimation();
  state.sceneIndex = Math.max(0, Math.min(SCENES.length - 1, index));
  const activeName = SCENES[state.sceneIndex];
  const homePaths=document.querySelector(".home-paths");
  if(homePaths)homePaths.hidden=state.sceneIndex!==0;

  document.querySelectorAll("[data-scene-panel]").forEach(panel => {
    const active = panel.dataset.scenePanel === activeName;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });

  const learningMode = document.body.dataset.pageMode === "journey";
  document.querySelectorAll(".scale-step").forEach((button, i) => {
    const active = i === state.sceneIndex;
    button.classList.toggle("active", active);
    button.classList.toggle("completed", learningMode && i < state.sceneIndex);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });

  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");
  previousButton.disabled = state.sceneIndex === 0;
  nextButton.disabled = state.sceneIndex === SCENES.length - 1;
  previousButton.innerHTML = state.sceneIndex > 0 ? `<span>←</span> ${SCENE_LABELS[state.sceneIndex - 1]}` : "<span>←</span> Previous";
  nextButton.innerHTML = state.sceneIndex < SCENES.length - 1 ? `Next: ${SCENE_LABELS[state.sceneIndex + 1]} <span>→</span>` : `Journey complete <span>✓</span>`;
  document.getElementById("progressText").textContent = `Checkpoint ${state.sceneIndex + 1} of ${SCENES.length}`;

  if (activeName === "tertiary" && typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render(state.selectedResidue);
  enterChemicalScene(activeName);
  if (activeName === 'primary') enterPrimaryAnimation();
  if (typeof GuidedStructureTransitions !== "undefined") GuidedStructureTransitions.enter(activeName);
}

function setupNavigation() {
  document.querySelectorAll(".scale-step").forEach((button, index) => {
    button.addEventListener("click", () => showScene(index));
  });
  document.getElementById("previousButton").addEventListener("click", () => showScene(state.sceneIndex - 1));
  document.getElementById("nextButton").addEventListener("click", () => showScene(state.sceneIndex + 1));
}

function setupHomePaths() {
  const homeToggles=[...document.querySelectorAll("[data-home-path-toggle]")];
  homeToggles.forEach(button=>{
    button.addEventListener("click",()=>{
      const name=button.dataset.homePathToggle;
      const panel=document.getElementById(name==="learn"?"homeLearnPanel":"homeExplorePanel");
      const willOpen=button.getAttribute("aria-expanded")!=="true";
      homeToggles.forEach(other=>{
        const otherName=other.dataset.homePathToggle;
        const otherPanel=document.getElementById(otherName==="learn"?"homeLearnPanel":"homeExplorePanel");
        other.setAttribute("aria-expanded","false");
        if(otherPanel)otherPanel.hidden=true;
      });
      button.setAttribute("aria-expanded",String(willOpen));
      if(panel)panel.hidden=!willOpen;
      if(willOpen)panel?.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
  });

  // Workspace navigation menus use the same progressive-disclosure pattern.
  document.querySelectorAll(".nav-menu > button").forEach(button=>{
    button.addEventListener("click",()=>{
      const open=button.getAttribute("aria-expanded")==="true";
      document.querySelectorAll(".nav-menu > button").forEach(b=>b.setAttribute("aria-expanded","false"));
      button.setAttribute("aria-expanded",String(!open));
    });
  });
  document.addEventListener("click",event=>{
    if(!event.target.closest(".nav-menu"))document.querySelectorAll(".nav-menu > button").forEach(b=>b.setAttribute("aria-expanded","false"));
  });
}


function searchRank(item, query) {
  const q=String(query||"").trim().toLowerCase();
  if(!q)return 1;
  const terms=q.split(/\s+/).filter(Boolean);
  const hay=(item.label+" "+item.description+" "+item.keywords).toLowerCase();
  if(!terms.every(term=>hay.includes(term)))return 0;
  let score=terms.length*10;
  if(item.label.toLowerCase().includes(q))score+=20;
  if(item.label.toLowerCase().startsWith(q))score+=10;
  return score;
}

function revealSearchTarget(item) {
  if(item.scene){
    const sceneIndex=SCENES.indexOf(item.scene);
    if(sceneIndex>=0)showScene(sceneIndex);
  }
  requestAnimationFrame(()=>setTimeout(()=>{
    const target=document.querySelector(item.target)||document.querySelector("[data-scene-panel='"+item.scene+"']");
    if(!target)return;
    let node=target;
    while(node&&node!==document.body){
      if(node.tagName==="DETAILS")node.open=true;
      node=node.parentElement;
    }
    const highlight=target.matches("input,select,button,textarea")?(target.closest("label,fieldset,details")||target):(target.closest("details")||target);
    document.querySelectorAll(".search-target-highlight").forEach(el=>el.classList.remove("search-target-highlight"));
    highlight.classList.add("search-target-highlight");
    target.scrollIntoView({behavior:"smooth",block:"center"});
    if(typeof target.focus==="function"&&target.matches("input,select,button,textarea"))target.focus({preventScroll:true});
    setTimeout(()=>highlight.classList.remove("search-target-highlight"),3000);
  },90));
}

function navigateToSearchItem(item) {
  const url=new URL(window.location.href);
  url.searchParams.set("page",item.page);
  if(item.page==="secondary"||item.page==="tertiary")url.searchParams.set("start","example");
  else url.searchParams.delete("start");
  history.pushState({page:item.page},"",url);
  applyPageMode();
  revealSearchTarget(item);
}

function setupSiteSearch() {
  const openButton=document.getElementById("siteSearchButton"),dialog=document.getElementById("siteSearchDialog");
  const closeButton=document.getElementById("siteSearchClose"),input=document.getElementById("siteSearchInput"),results=document.getElementById("siteSearchResults");
  if(!openButton||!dialog||!input||!results)return;
  const renderResults=()=>{
    const ranked=SITE_SEARCH_ITEMS.map(item=>({item,score:searchRank(item,input.value)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.item.label.localeCompare(b.item.label)).slice(0,12);
    results.replaceChildren();
    if(!ranked.length){
      const empty=document.createElement("p");empty.className="site-search-empty";empty.textContent="No matching tool found. Try a broader term such as “2D”, “3D”, “PDB”, “hydrogen bond”, or “export”.";results.append(empty);return;
    }
    ranked.forEach(({item})=>{
      const button=document.createElement("button");button.type="button";button.className="site-search-result";button.setAttribute("role","option");
      const title=document.createElement("strong");title.textContent=item.label;
      const description=document.createElement("span");description.textContent=item.description;
      button.append(title,description);
      button.addEventListener("click",()=>{dialog.close();navigateToSearchItem(item);});
      results.append(button);
    });
  };
  const open=()=>{renderResults();dialog.showModal();setTimeout(()=>{input.focus();input.select();},0);};
  openButton.addEventListener("click",open);
  closeButton?.addEventListener("click",()=>dialog.close());
  input.addEventListener("input",renderResults);
  input.addEventListener("keydown",event=>{
    if(event.key==="Enter"){
      const first=results.querySelector(".site-search-result");if(first){event.preventDefault();first.click();}
    }
  });
  dialog.addEventListener("click",event=>{
    const bounds=dialog.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
  });
  document.addEventListener("keydown",event=>{
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||"");
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();open();}
    else if(event.key==="/"&&!typing&&!dialog.open){event.preventDefault();open();}
  });
  window.addEventListener("popstate",applyPageMode);
}

function arrangeTopbar(page){
  const inner=document.getElementById("innerNav"),actions=document.getElementById("topbarActions");
  if(!inner||!actions)return;
  // Keep the primary navigation stable everywhere. The logo is the Home action;
  // Learn and Explore remain visible, while project/about/feedback live in More.
  inner.hidden=false;actions.hidden=false;
  const home=document.getElementById("workspaceHomeLink");
  if(home)home.hidden=true;
  const utility=document.getElementById("utilityMenu");
  if(utility&&page==="home")utility.removeAttribute("open");
}

function hideWorkspaceLauncher(){
  const launcher=document.getElementById("workspaceLauncher");
  if(launcher)launcher.hidden=true;
  delete document.body.dataset.workspaceHub;
}

function renderWorkspaceLauncher(page){
  const launcher=document.getElementById("workspaceLauncher");
  const title=document.getElementById("workspaceLauncherTitle");
  const description=document.getElementById("workspaceLauncherDescription");
  const actions=document.getElementById("workspaceLauncherActions");
  if(!launcher||!title||!description||!actions)return;
  document.body.dataset.workspaceHub="true";
  launcher.hidden=false;
  actions.replaceChildren();
  launcher.querySelector(".workspace-tutorial-button")?.remove();
  const tutorialButton=document.createElement("button");tutorialButton.type="button";tutorialButton.className="workspace-tutorial-button secondary-action";tutorialButton.dataset.rnaTutorial=page; tutorialButton.textContent="? Quick tutorial";
  description.insertAdjacentElement("afterend",tutorialButton);

  if(page==="drawing"){
    title.textContent="Molecular Drawing";
    description.textContent="New to molecular drawing? Load a template first and explore it. When you are ready, start from a blank canvas.";
    actions.innerHTML=`
      <article class="workspace-launch-card">
        <span class="workspace-launch-number">01</span>
        <h2>Load a template</h2>
        <p>Begin with a nucleobase, ribose, phosphate, or a common RNA base pair, then edit atoms, bonds, bond orders, and charges.</p>
        <label class="workspace-template-label">Template
          <select id="drawingTemplateSelect">
            <option value="A">Adenine</option>
            <option value="G">Guanine</option>
            <option value="C">Cytosine</option>
            <option value="U">Uracil</option>
            <option value="T">Thymine</option>
            <option value="RIBOSE">Ribose</option>
            <option value="PHOSPHATE">Phosphate group</option>
            <option value="pair:GC">G–C Watson–Crick pair</option>
            <option value="pair:AU">A–U Watson–Crick pair</option>
            <option value="pair:GU">G–U wobble pair</option>
          </select>
        </label>
        <button class="primary-action" id="drawingOpenTemplate" type="button">Open template</button>
      </article>
      <article class="workspace-launch-card">
        <span class="workspace-launch-number">02</span>
        <h2>Draw your own</h2>
        <p>Open an empty molecular canvas and build the structure yourself from atoms and bonds.</p>
        <button class="primary-action" id="drawingOpenBlank" type="button">Start with a blank canvas</button>
      </article>`;
    document.getElementById("drawingOpenTemplate")?.addEventListener("click",()=>{
      const value=document.getElementById("drawingTemplateSelect")?.value||"A";
      if(value.startsWith("pair:")){
        const pair=value.slice(5);
        MoleculeEditor.openPair(pair[0],pair[1]);
      }else MoleculeEditor.openBase(value);
    });
    document.getElementById("drawingOpenBlank")?.addEventListener("click",()=>MoleculeEditor.openBlank());
    return;
  }

  if(page==="secondary"){
    title.textContent="Secondary Structure";
    description.textContent="New to RNA secondary structure? Load the example first and explore it. When you are ready, open an empty workspace for your own RNA.";
    actions.innerHTML=`
      <a class="workspace-launch-card" href="?page=secondary&start=example">
        <span class="workspace-launch-number">01</span><h2>Load example</h2>
        <p>Open the default 76-residue tRNA secondary structure associated with PDB 1EHZ. You can edit it after loading.</p>
        <strong>Open example tRNA →</strong>
      </a>
      <a class="workspace-launch-card" href="?page=secondary&start=custom">
        <span class="workspace-launch-number">02</span><h2>Build your own</h2>
        <p>Start with an empty 2D canvas, then enter your own RNA sequence and dot-bracket structure.</p>
        <strong>Start empty →</strong>
      </a>`;
    return;
  }

  title.textContent="Tertiary Structure";
  description.textContent="New to 3D RNA? Open the 1EHZ example first and rotate, zoom, and inspect it. When you are ready, load your own coordinates.";
  actions.innerHTML=`
    <a class="workspace-launch-card" href="?page=tertiary&start=example">
      <span class="workspace-launch-number">01</span><h2>Load example</h2>
      <p>Open the experimentally determined yeast tRNA-Phe structure from PDB 1EHZ.</p>
      <strong>Open 1EHZ →</strong>
    </a>
    <a class="workspace-launch-card" href="?page=tertiary&start=custom">
      <span class="workspace-launch-number">02</span><h2>Load your own</h2>
      <p>Start without a visible structure, then upload a PDB/mmCIF file or enter a PDB ID.</p>
      <strong>Start empty →</strong>
    </a>`;
}

function clearSecondaryBlankState(){
  if(document.body.dataset.workspaceBlank!=="secondary")return;
  delete document.body.dataset.workspaceBlank;
  document.querySelector(".secondary-layout-picker")?.removeAttribute("hidden");
  document.querySelector("#scene-secondary .workspace-empty-note")?.remove();
}

function prepareSecondaryCustomStart(){
  document.body.dataset.workspaceBlank="secondary";
  const sequence=document.getElementById("secondarySequence");
  const structure=document.getElementById("secondaryDotBracket");
  const svg=document.getElementById("secondarySvg");
  const picker=document.querySelector(".secondary-layout-picker");
  const stage=document.querySelector("#scene-secondary .secondary-stage");
  const status=document.getElementById("secondaryInputStatus");
  if(sequence)sequence.value="";
  if(structure)structure.value="";
  if(svg)svg.replaceChildren();
  if(picker)picker.hidden=true;
  document.querySelector("#scene-secondary .workspace-empty-note")?.remove();
  if(stage){
    const note=document.createElement("div");
    note.className="workspace-empty-note";
    note.innerHTML="<strong>Start with your RNA</strong><span>Enter a sequence and matching dot-bracket structure, then choose Render structure.</span>";
    stage.append(note);
  }
  if(status){status.textContent="Enter your RNA sequence and dot-bracket structure to begin.";status.classList.remove("error");}
}

function clearTertiaryBlankState(){
  if(document.body.dataset.workspaceBlank!=="tertiary")return;
  delete document.body.dataset.workspaceBlank;
  ["#scene-tertiary .te-toolbar","#tertiarySplitShell","#scene-tertiary .te-legend-row","#scene-tertiary .te-interaction-help","#scene-tertiary .stage-note"].forEach(selector=>document.querySelector(selector)?.removeAttribute("hidden"));
  document.querySelector("#scene-tertiary .workspace-empty-note")?.remove();
  if(typeof TertiaryExplorer!=="undefined")TertiaryExplorer.render();
}

function prepareTertiaryCustomStart(){
  document.body.dataset.workspaceBlank="tertiary";
  ["#scene-tertiary .te-toolbar","#tertiarySplitShell","#scene-tertiary .te-legend-row","#scene-tertiary .te-interaction-help","#scene-tertiary .stage-note"].forEach(selector=>{
    const el=document.querySelector(selector);if(el)el.hidden=true;
  });
  const stage=document.getElementById("tertiaryStage");
  document.querySelector("#scene-tertiary .workspace-empty-note")?.remove();
  if(stage){
    const note=document.createElement("div");
    note.className="workspace-empty-note";
    note.innerHTML="<strong>Load a 3D RNA structure</strong><span>Use the import controls to upload PDB/mmCIF coordinates or enter a PDB ID.</span>";
    stage.append(note);
  }
}

function setupExploreWorkspaceHooks(){
  document.getElementById("renderSecondaryButton")?.addEventListener("click",()=>setTimeout(()=>{
    const status=document.getElementById("secondaryInputStatus");
    if(status&&!status.classList.contains("error")&&document.getElementById("secondarySvg")?.childNodes.length)clearSecondaryBlankState();
  },0));
  document.getElementById("restoreTrnaButton")?.addEventListener("click",()=>setTimeout(clearSecondaryBlankState,0));
  document.getElementById("teStructureFile")?.addEventListener("change",event=>{
    if(event.target.files?.length)setTimeout(clearTertiaryBlankState,120);
  });
  document.getElementById("teLoadPdbId")?.addEventListener("click",()=>setTimeout(clearTertiaryBlankState,220));
  document.getElementById("teRestoreStructure")?.addEventListener("click",()=>setTimeout(clearTertiaryBlankState,120));
}

function setupModernWorkspaceUi(){
  document.querySelectorAll("[data-controls-toggle]").forEach(button=>{
    const scene=document.getElementById("scene-"+button.dataset.controlsToggle);
    if(!scene)return;
    const sync=()=>{
      const collapsed=scene.classList.contains("controls-collapsed");
      button.setAttribute("aria-expanded",String(!collapsed));
      const icon=button.querySelector("span"),label=button.querySelector("b");
      if(icon)icon.textContent=collapsed?"›":"‹";
      if(label)label.textContent=collapsed?"Show":"Controls";
    };
    button.addEventListener("click",()=>{scene.classList.toggle("controls-collapsed");sync();});
    sync();
  });

  const secondaryControls=document.querySelector("#scene-secondary .se-controls");
  if(secondaryControls&&!secondaryControls.closest(".workspace-advanced-panel")){
    const advanced=document.createElement("details");advanced.className="workspace-advanced-panel";advanced.open=false;
    const summary=document.createElement("summary");summary.textContent="Controls · Structure, display & analysis";
    secondaryControls.before(advanced);advanced.append(summary,secondaryControls);
  }

  const tertiaryControls=document.querySelector("#scene-tertiary .te-controls");
  if(tertiaryControls&&!tertiaryControls.querySelector(":scope > .workspace-advanced-panel")){
    const details=[...tertiaryControls.children].filter(el=>el.tagName==="DETAILS");
    details.slice(0,2).forEach(el=>el.open=false);
    if(details.length>2){
      const advanced=document.createElement("details");advanced.className="workspace-advanced-panel";advanced.open=true;
      const summary=document.createElement("summary");summary.textContent="More · Selection, analysis & view";advanced.append(summary);
      details.slice(2).forEach(el=>advanced.append(el));tertiaryControls.append(advanced);
    }
  }

  const renameSummaries=(root,map)=>{
    if(!root)return;
    root.querySelectorAll("summary").forEach(summary=>{
      const key=summary.textContent.trim();if(map[key])summary.textContent=map[key];
    });
  };
  renameSummaries(secondaryControls,{
    "Analyze · Data layers":"Analyze · Data layers",
    "Display · Backbone":"Display · Backbone",
    "Display · Residues":"Display · Residues",
    "Analyze · Base pairs":"Analyze · Base pairs",
    "Display · Residue index":"Display · Residue index"
  });
  renameSummaries(tertiaryControls,{
    "Import structure & 2D/3D mapping":"Import · Structure & mapping",
    "Display":"Display · Structure",
    "Select · sequence & ranges":"Select · Residues & ranges",
    "Saved objects":"Select · Saved objects",
    "Residue index":"Display · Residue index",
    "Analyze · measurements & contacts":"Analyze · Measurements & contacts",
    "Clipping":"View · Clipping",
    "Compare / align structures":"Analyze · Compare / align structures",
    "Saved camera views":"View · Saved camera views",
    "Focus on structural region":"View · Focus on structural region"
  });

  const addControlNavigator=(root,labels)=>{
    if(!root||root.querySelector(":scope > .workspace-control-map"))return;
    const nav=document.createElement("nav");nav.className="workspace-control-map";nav.setAttribute("aria-label","Control categories");
    labels.forEach(label=>{
      const button=document.createElement("button");button.type="button";button.textContent=label;
      button.addEventListener("click",()=>{
        const summary=[...root.querySelectorAll("summary")].find(s=>s.textContent.trim().startsWith(label+" ·"));
        if(!summary)return;
        let node=summary.parentElement;while(node&&node!==root){if(node.tagName==="DETAILS")node.open=true;node=node.parentElement;}
        summary.parentElement.open=true;summary.scrollIntoView({behavior:"smooth",block:"nearest"});
      });nav.append(button);
    });
    root.prepend(nav);
  };
  addControlNavigator(secondaryControls,["Display","Analyze"]);
  addControlNavigator(tertiaryControls,["Import","Select","Display","Analyze","View"]);
}

function applyPageMode() {
  const url=new URL(window.location.href);
  const mode=url.searchParams.get("page")||"home";
  const valid=["home","journey","example","drawing","secondary","tertiary"];
  const page=valid.includes(mode)?mode:"home";
  const start=url.searchParams.get("start")||"";
  document.body.dataset.pageMode=page;
  delete document.body.dataset.workspaceBlank;
  hideWorkspaceLauncher();
  arrangeTopbar(page);

  if(page==="home"){
    showScene(0);
    return;
  }
  if(page==="journey"){
    const requested=url.searchParams.get("scene");
    const index=SCENES.indexOf(requested);
    showScene(index>=0?index:0);
    return;
  }
  if(page==="drawing"){
    renderWorkspaceLauncher("drawing");
    if(start==="blank")requestAnimationFrame(()=>MoleculeEditor.openBlank());
    return;
  }
  if(page==="example"){
    showScene(4);
    document.getElementById("restoreTrnaButton")?.click();
    return;
  }
  if(page==="secondary"){
    if(!start){renderWorkspaceLauncher("secondary");return;}
    showScene(4);
    const advanced=document.querySelector("#scene-secondary .workspace-advanced-panel");if(advanced)advanced.open=true;
    if(start==="custom")prepareSecondaryCustomStart();
    else document.getElementById("restoreTrnaButton")?.click();
    return;
  }
  if(page==="tertiary"){
    if(!start){renderWorkspaceLauncher("tertiary");return;}
    showScene(5);
    if(start==="custom")prepareTertiaryCustomStart();
    return;
  }
}


function renderPrimary() {
  const container = document.getElementById("primarySequence");
  RNA_SEQUENCE.split("").forEach((base, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nt nt-${base.toLowerCase()}${index === state.selectedResidue ? " selected" : ""}`;
    button.textContent = base;
    button.setAttribute("aria-label", `${BASE_NAMES[base]}, position ${index + 1}`);
    button.addEventListener("click", () => selectResidue(index));
    container.appendChild(button);
  });
}

function setupSecondaryWorkspace() {
  SecondaryExplorer.setup(RNA_SEQUENCE, TRNA_DOT_BRACKET, index => selectResidue(index));
}
function renderSecondary() { SecondaryExplorer.render(); }

const center3D = TERTIARY_COORDS.reduce((acc, point) => acc.map((value, i) => value + point[i] / TERTIARY_COORDS.length), [0, 0, 0]);

function projectPoint(point) {
  let [x, y, z] = point.map((value, i) => value - center3D[i]);
  const cy = Math.cos(state.rotationY), sy = Math.sin(state.rotationY);
  const cx = Math.cos(state.rotationX), sx = Math.sin(state.rotationX);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y1 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const scale = 7.0;
  return { x: 360 + x1 * scale, y: 265 + y1 * scale, z: z2 };
}

function renderTertiary() {
  const svg = document.getElementById("tertiarySvg");
  svg.replaceChildren();
  const projected = TERTIARY_COORDS.map(projectPoint);

  for (let i = 0; i < projected.length - 1; i++) {
    svg.appendChild(svgElement("line", {
      class: "tertiary-bond", x1: projected[i].x, y1: projected[i].y,
      x2: projected[i + 1].x, y2: projected[i + 1].y,
      opacity: Math.max(.35, Math.min(.9, .62 + projected[i].z / 90))
    }));
  }

  projected.map((point, index) => ({ ...point, index })).sort((a, b) => a.z - b.z).forEach(point => {
    const base = RNA_SEQUENCE[point.index];
    const selected = point.index === state.selectedResidue;
    const radius = selected ? 12 : Math.max(5.5, Math.min(9, 7 + point.z / 25));
    const group = svgElement("g", {
      class: `tertiary-node${selected ? " selected" : ""}`,
      transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,
      tabindex: "0", role: "button", "aria-label": `${BASE_NAMES[base]}, position ${point.index + 1}`
    });
    group.appendChild(svgElement("circle", { r: radius, fill: BASE_COLORS[base], opacity: Math.max(.62, Math.min(1, .82 + point.z / 80)) }));
    if (selected) {
      const text = svgElement("text", { y: .5 });
      text.textContent = base;
      group.appendChild(text);
    }
    group.addEventListener("pointerdown", event => event.stopPropagation());
    group.addEventListener("click", () => selectResidue(point.index));
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectResidue(point.index);
      }
    });
    svg.appendChild(group);
  });
}

function setupTertiaryControls() {
  const stage = document.getElementById("tertiaryStage");
  const svg = document.getElementById("tertiarySvg");
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("aria-label", "Rotatable residue trace of yeast phenylalanine tRNA. Use arrow keys or drag to rotate.");

  stage.addEventListener("pointerdown", event => {
    state.dragging = true;
    state.dragMoved = false;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    stage.classList.add("dragging");
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", event => {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastPointer.x;
    const dy = event.clientY - state.lastPointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.dragMoved = true;
    state.rotationY += dx * .011;
    state.rotationX += dy * .011;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    renderTertiary();
  });
  const endDrag = () => { state.dragging = false; stage.classList.remove("dragging"); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  svg.addEventListener("keydown", event => {
    const step = .12;
    if (event.key === "ArrowLeft") state.rotationY -= step;
    else if (event.key === "ArrowRight") state.rotationY += step;
    else if (event.key === "ArrowUp") state.rotationX -= step;
    else if (event.key === "ArrowDown") state.rotationX += step;
    else return;
    event.preventDefault();
    renderTertiary();
  });
  document.getElementById("followButton").addEventListener("click", () => {
    let next = state.selectedResidue;
    while (next === state.selectedResidue) next = Math.floor(Math.random() * RNA_SEQUENCE.length);
    selectResidue(next);
  });
}

function setupDialog() {
  const dialog=document.getElementById("aboutDialog"),open=document.getElementById("aboutButton"),close=document.getElementById("dialogClose");
  if(!dialog||!open||!close)return;
  open.addEventListener("click",()=>dialog.showModal());
  close.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

function registerWebMCPTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = tool => {
    try {
      Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error);
    } catch (error) {
      console.error(error);
    }
  };

  register({
    name: "navigate_rna_scale",
    title: "Navigate RNA scale",
    description: "Open one of the six visible RNA learning views.",
    inputSchema: {
      type: "object",
      properties: { scale: { type: "string", enum: SCENES } },
      required: ["scale"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const index = SCENES.indexOf(input?.scale);
      if (index < 0) throw new Error("Choose a valid RNA scale.");
      showScene(index);
      return { scale: SCENES[state.sceneIndex], step: state.sceneIndex + 1 };
    }
  });

  register({
    name: "select_rna_residue",
    title: "Select RNA residue",
    description: "Highlight one residue in the sequence, secondary structure, and tertiary structure views.",
    inputSchema: {
      type: "object",
      properties: { position: { type: "integer", minimum: 1, maximum: 76 } },
      required: ["position"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!Number.isInteger(input?.position) || input.position < 1 || input.position > 76) throw new Error("Position must be an integer from 1 to 76.");
      selectResidue(input.position - 1);
      const base = RNA_SEQUENCE[state.selectedResidue];
      return { position: input.position, base, name: BASE_NAMES[base] };
    }
  });
}

function initialize() {
  if (RNA_SEQUENCE.length !== 76 || TERTIARY_COORDS.length !== RNA_SEQUENCE.length) {
    console.error("RNA data length mismatch.");
  }
  setupNavigation();
  setupHomePaths();
  setupSiteSearch();
  if(typeof ProjectSession!=="undefined")ProjectSession.setup();
  setupChemicalJourney();
  MoleculeEditor.setup();
  renderPrimary();
  setupPrimaryAnimation();
  if(typeof GuidedStructureTransitions!=="undefined")GuidedStructureTransitions.setup();
  setupSecondaryWorkspace();
  renderSecondary();
  TertiaryExplorer.setup({
    sequence: RNA_SEQUENCE,
    structure: TRNA_DOT_BRACKET,
    coords: TERTIARY_COORDS,
    colors: BASE_COLORS,
    names: BASE_NAMES,
    onSelect: index => selectResidue(index)
  });
  setupExploreWorkspaceHooks();
  setupModernWorkspaceUi();
  setupDialog();
  registerWebMCPTools();
  selectResidue(0);
  applyPageMode();
}

initialize();
