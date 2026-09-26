const SessionManager = (() => {
  const VERSION = 1;
  const PENDING_KEY = "rna-explorer-pending-project-v1";
  const SECONDARY_KEY = "rna-explorer-secondary-workspace-v1";
  let lastStructureUpload = null;

  const $ = id => document.getElementById(id);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const safeJson = value => JSON.parse(JSON.stringify(value));

  function currentPage(){
    const p=new URLSearchParams(location.search).get("page");
    if(p==="tertiary"||p==="secondary")return p;
    const active=document.querySelector(".scene.active")?.dataset?.scenePanel;
    return active==="tertiary"||active==="secondary"?active:"secondary";
  }

  function captureFormState(root){
    if(!root)return [];
    return [...root.querySelectorAll("input[id],select[id],textarea[id]")].filter(el=>el.type!=="file").map(el=>({
      id:el.id,
      type:el.type||el.tagName.toLowerCase(),
      value:el.value,
      checked:"checked" in el?Boolean(el.checked):undefined
    }));
  }

  function captureDetailsState(root){
    if(!root)return [];
    return [...root.querySelectorAll("details")].map((el,index)=>({index,open:el.open}));
  }

  function captureTertiary(){
    if(typeof TertiaryExplorer==="undefined")return null;
    const diagnostics=TertiaryExplorer.getDiagnostics?.()||{};
    const sequenceButtons=[...document.querySelectorAll("#teSequencePanel .te-seq-residue")];
    const selectedResidues=sequenceButtons.map((el,i)=>el.classList.contains("chosen")?i:null).filter(Number.isInteger);
    const activeIndex=Math.max(0,sequenceButtons.findIndex(el=>el.classList.contains("active")));
    const sourceText=$("teStructureSource")?.textContent||diagnostics.source||"";
    const pdbMatch=sourceText.match(/RCSB PDB\s*[·:-]?\s*([A-Z0-9]{4})/i);
    const controlsRoot=$("tertiaryControls");
    return {
      source:{
        label:diagnostics.source||sourceText,
        pdbId:pdbMatch?.[1]?.toUpperCase()||null,
        uploaded:lastStructureUpload?{...lastStructureUpload}:null
      },
      activeChain:$("teChainSelect")?.value??null,
      selectedResidues,
      activeIndex,
      selectedPairKeys:Array.isArray(diagnostics.selectedPairKeys)?diagnostics.selectedPairKeys:[],
      derivedSecondary:diagnostics.derivedSecondary?safeJson(diagnostics.derivedSecondary):null,
      controls:captureFormState(controlsRoot),
      controlDetails:captureDetailsState(controlsRoot),
      split:Boolean(diagnostics.split)
    };
  }

  function captureProject(){
    const secondary=typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.getWorkspaceSnapshot?SecondaryExplorer.getWorkspaceSnapshot():null;
    return {
      format:"RNA Structure Explorer Project",
      version:VERSION,
      savedAt:new Date().toISOString(),
      page:currentPage(),
      secondary:secondary?safeJson(secondary):null,
      tertiary:captureTertiary()
    };
  }

  function downloadProject(){
    const project=captureProject();
    const blob=new Blob([JSON.stringify(project,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    a.href=url;a.download="rna-explorer-project-"+stamp+".rnaexplorer.json";document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus("Project saved. Reopen this .rnaexplorer.json file later to continue your work.");
  }

  function setStatus(message,error=false){
    let el=$("projectSessionStatus");
    if(!el){el=document.createElement("span");el.id="projectSessionStatus";el.className="project-session-status";document.querySelector(".topbar-actions")?.append(el);}
    el.textContent=message;el.dataset.level=error?"error":"ok";
  }

  async function readProjectFile(file){
    if(!file)return;
    try{
      const project=JSON.parse(await file.text());
      if(project?.format!=="RNA Structure Explorer Project"||!Number.isInteger(project.version))throw new Error("This is not an RNA Explorer project file.");
      if(project.version>VERSION)throw new Error("This project was saved by a newer RNA Explorer version.");
      sessionStorage.setItem(PENDING_KEY,JSON.stringify(project));
      if(project.secondary)localStorage.setItem(SECONDARY_KEY,JSON.stringify(project.secondary));
      const page=project.page==="tertiary"?"tertiary":"secondary";
      location.href="?page="+page+"&restoreProject=1";
    }catch(error){setStatus("Open project failed: "+error.message,true);}
  }

  function dispatchControl(el,item){
    if(!el)return;
    if(item.checked!==undefined&&"checked" in el)el.checked=Boolean(item.checked);
    if(item.value!==undefined)el.value=item.value;
    el.dispatchEvent(new Event(el.type==="range"||el.type==="number"||el.type==="color"?"input":"change",{bubbles:true}));
  }

  async function loadTertiarySource(snapshot){
    if(!snapshot?.source)return;
    if(snapshot.source.uploaded?.text){
      const upload=snapshot.source.uploaded;
      const input=$("teStructureFile");
      if(input){
        const file=new File([upload.text],upload.name||("restored."+(upload.format||"pdb")),{type:"text/plain"});
        const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
        return;
      }
    }
    if(snapshot.source.pdbId&&typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.loadFromRcsbId){
      await TertiaryExplorer.loadFromRcsbId(snapshot.source.pdbId);
    }
  }

  async function waitForTertiaryReady(){
    for(let i=0;i<80;i++){
      const d=typeof TertiaryExplorer!=="undefined"?TertiaryExplorer.getDiagnostics?.():null;
      if(d?.viewerReady&&d?.modelReady)return true;
      await delay(125);
    }
    return false;
  }

  async function restoreTertiary(snapshot){
    if(!snapshot)return;
    await waitForTertiaryReady();
    await loadTertiarySource(snapshot);
    await delay(650);
    if(snapshot.activeChain&&$("teChainSelect")){$("teChainSelect").value=snapshot.activeChain;$("teChainSelect").dispatchEvent(new Event("change",{bubbles:true}));await delay(120);}
    if(snapshot.derivedSecondary&&$("teGenerateSecondary")){$("teGenerateSecondary").click();await delay(160);}
    (snapshot.controlDetails||[]).forEach(item=>{const details=$("tertiaryControls")?.querySelectorAll("details")?.[item.index];if(details)details.open=Boolean(item.open);});
    (snapshot.controls||[]).forEach(item=>dispatchControl($(item.id),item));
    await delay(120);
    const buttons=[...document.querySelectorAll("#teSequencePanel .te-seq-residue")];
    (snapshot.selectedResidues||[]).forEach(i=>{const b=buttons[i];if(b&&!b.classList.contains("chosen"))b.click();});
    if(Number.isInteger(snapshot.activeIndex)&&buttons[snapshot.activeIndex]&&!buttons[snapshot.activeIndex].classList.contains("active")){
      buttons[snapshot.activeIndex].click();
      if(!(snapshot.selectedResidues||[]).includes(snapshot.activeIndex))buttons[snapshot.activeIndex].click();
    }
    const pairKeys=snapshot.selectedPairKeys||[];
    if(pairKeys.length&&$("teSplit")&&!$("teSplit").checked){$("teSplit").click();await delay(120);}
    for(const key of pairKeys){
      const node=document.querySelector('#tertiaryMiniSvg [data-pair="'+CSS.escape(key)+'"]');
      if(node&&!node.classList.contains("te-linked-pair-selected"))node.dispatchEvent(new MouseEvent("click",{bubbles:true}));
    }
    if(!snapshot.split&&$("teSplit")?.checked)$("teSplit").click();
  }

  async function restorePending(){
    const raw=sessionStorage.getItem(PENDING_KEY);if(!raw)return;
    let project;try{project=JSON.parse(raw);}catch(_){sessionStorage.removeItem(PENDING_KEY);return;}
    sessionStorage.removeItem(PENDING_KEY);
    if(project.secondary){try{localStorage.setItem(SECONDARY_KEY,JSON.stringify(project.secondary));}catch(_){}}
    if(project.page==="tertiary")await restoreTertiary(project.tertiary);
    setStatus("Project restored from "+new Date(project.savedAt||Date.now()).toLocaleString()+".");
  }

  function trackUploads(){
    document.addEventListener("change",async event=>{
      const input=event.target;if(!(input instanceof HTMLInputElement)||input.id!=="teStructureFile")return;
      const file=input.files?.[0];if(!file||!/\.(pdb|ent|cif|mmcif)$/i.test(file.name))return;
      try{lastStructureUpload={name:file.name,format:/\.(cif|mmcif)$/i.test(file.name)?"cif":"pdb",text:await file.text()};}catch(_){}
    },true);
  }

  function installUi(){
    const actions=document.querySelector(".topbar-actions");if(!actions||$("projectSaveButton"))return;
    const save=document.createElement("button");save.id="projectSaveButton";save.type="button";save.className="site-search-button project-session-button";save.textContent="Save Project";save.addEventListener("click",downloadProject);
    const open=document.createElement("button");open.id="projectOpenButton";open.type="button";open.className="site-search-button project-session-button";open.textContent="Open Project";
    const input=document.createElement("input");input.id="projectOpenInput";input.type="file";input.accept=".json,.rnaexplorer.json,application/json";input.hidden=true;input.addEventListener("change",()=>{readProjectFile(input.files?.[0]);input.value="";});
    open.addEventListener("click",()=>input.click());actions.prepend(open);actions.prepend(save);actions.append(input);
  }

  installUi();trackUploads();
  window.addEventListener("load",()=>setTimeout(restorePending,250));
  return {captureProject,downloadProject,restorePending};
})();
