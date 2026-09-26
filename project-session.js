const ProjectSession = (() => {
  const SCHEMA="rna-explorer-project";
  const VERSION=1;
  const MAX_FILE_BYTES=40*1024*1024;
  const $=id=>document.getElementById(id);

  function currentPage(){
    const page=new URL(window.location.href).searchParams.get("page");
    return ["journey","example","secondary","tertiary"].includes(page)?page:"home";
  }
  function safeFilename(){
    const source=typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics?TertiaryExplorer.getDiagnostics().source:"";
    const base=String(source||"rna-explorer-project").replace(/\.[^.]+$/,"").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"rna-explorer-project";
    return base+"-session.rnaexplorer.json";
  }
  function getProjectSnapshot(){
    const tertiaryRaw=typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getWorkspaceSnapshot?TertiaryExplorer.getWorkspaceSnapshot():null;
    return {
      schema:SCHEMA,
      version:VERSION,
      app:"RNA Structure Explorer",
      savedAt:new Date().toISOString(),
      page:currentPage(),
      secondary:typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.getWorkspaceSnapshot?SecondaryExplorer.getWorkspaceSnapshot():null,
      tertiary:tertiaryRaw?.sourceText?tertiaryRaw:null,
      chemistry:typeof MoleculeEditor!=="undefined"&&MoleculeEditor.getSessionSnapshot?MoleculeEditor.getSessionSnapshot():null
    };
  }
  function validateProject(project){
    if(!project||typeof project!=="object")throw new Error("This file does not contain a valid RNA Explorer project.");
    if(project.schema!==SCHEMA)throw new Error("This is not an RNA Explorer project file.");
    if(!Number.isInteger(project.version)||project.version<1||project.version>VERSION)throw new Error("This project file uses an unsupported version.");
    if(!project.secondary&&!project.tertiary&&!project.chemistry)throw new Error("The project file does not contain any restorable workspace data.");
    return project;
  }
  function downloadProject(){
    const project=getProjectSnapshot();
    const text=JSON.stringify(project,null,2);
    if(typeof ExportTools!=="undefined"&&ExportTools.downloadText)ExportTools.downloadText(text,safeFilename(),"application/json;charset=utf-8");
    else {
      const blob=new Blob([text],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=safeFilename();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    setStatus("Project saved. Keep this .rnaexplorer.json file to continue the session later.","success");
    return project;
  }
  function navigateTo(page){
    if(!page||page==="home")return;
    const url=new URL(window.location.href);url.searchParams.set("page",page);history.replaceState({page},"",url);
    if(typeof applyPageMode==="function")applyPageMode();
  }
  async function restoreProjectSnapshot(raw){
    const project=validateProject(raw);
    setStatus("Restoring project…","working");
    if(project.chemistry&&typeof MoleculeEditor!=="undefined"&&MoleculeEditor.restoreSessionSnapshot)MoleculeEditor.restoreSessionSnapshot(project.chemistry);
    if(project.secondary&&typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.restoreWorkspaceSnapshot)SecondaryExplorer.restoreWorkspaceSnapshot(project.secondary);
    if(project.tertiary&&typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.restoreWorkspaceSnapshot)await TertiaryExplorer.restoreWorkspaceSnapshot(project.tertiary);
    navigateTo(project.page);
    setStatus("Project restored. You can continue from the saved workspace.","success");
    return project;
  }
  async function openFile(file){
    if(!file)return;
    if(file.size>MAX_FILE_BYTES)throw new Error("Project file is too large to open in the browser.");
    const text=await file.text();
    let project;try{project=JSON.parse(text);}catch(_){throw new Error("The project file is not valid JSON.");}
    return restoreProjectSnapshot(project);
  }
  function setStatus(message,kind="info"){
    const el=$("projectSessionStatus");if(!el)return;
    el.textContent=message||"";el.dataset.kind=kind;el.hidden=!message;
    if(message&&kind!=="working")setTimeout(()=>{if(el.textContent===message)el.hidden=true;},6000);
  }
  function setup(){
    document.querySelectorAll("#projectSaveButton,#projectOpenButton,#projectOpenInput").forEach(el=>el.remove());
    const save=$("saveProjectButton"),open=$("openProjectButton"),input=$("projectFileInput");
    if(!save||!open||!input)return;
    save.addEventListener("click",()=>{try{downloadProject();}catch(error){setStatus("Could not save project: "+error.message,"error");}});
    open.addEventListener("click",()=>{input.value="";input.click();});
    input.addEventListener("change",async()=>{
      const file=input.files?.[0];if(!file)return;
      open.disabled=true;save.disabled=true;
      try{await openFile(file);}catch(error){setStatus("Could not open project: "+error.message,"error");}
      finally{open.disabled=false;save.disabled=false;input.value="";}
    });
  }
  return {setup,getProjectSnapshot,restoreProjectSnapshot,downloadProject,openFile,validateProject};
})();
