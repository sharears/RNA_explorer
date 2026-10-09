(() => {
  "use strict";

  const CATEGORY_ORDER=["select","display","analyze"];

  function categoryFor(summary){
    const lower=String(summary||"").trim().toLowerCase();
    if(lower.startsWith("select")||lower.includes("saved object")||lower.includes("focus on structural"))return "select";
    if(lower.startsWith("analyze")||lower.includes("compare / align"))return "analyze";
    if(lower==="display"||lower.includes("residue index")||lower==="clipping"||lower.includes("saved camera"))return "display";
    return null;
  }

  function tidy(details,category){
    const summary=details.querySelector(":scope > summary");if(!summary)return;
    const text=summary.textContent.trim();
    const cleaned=text.replace(new RegExp("^"+category+"\\s*[·:-]?\\s*","i"),"").trim();
    const next=cleaned?cleaned.charAt(0).toUpperCase()+cleaned.slice(1):text;
    if(summary.textContent!==next)summary.textContent=next;
  }

  function fixTertiaryCategories(){
    const controls=document.querySelector("#tertiaryControls .te-controls"),shell=document.getElementById("teWorkspaceCategories");
    if(!controls||!shell)return false;
    const panels=Object.fromEntries(CATEGORY_ORDER.map(key=>[key,shell.querySelector(`[data-workspace-panel="${key}"]`)]));

    // The tertiary controls can be wrapped by an Advanced-controls <details>.
    // Categorize the actual tool groups even when they have already been moved
    // inside that wrapper or inside the initial Display panel.
    [...controls.querySelectorAll("details")].forEach(details=>{
      const summary=details.querySelector(":scope > summary")?.textContent.trim()||"";
      if(!summary||summary.toLowerCase().includes("import structure"))return;
      const category=categoryFor(summary);if(!category||!panels[category])return;
      tidy(details,category);
      if(details.parentElement!==panels[category])panels[category].append(details);
    });

    // Opening the first Select group makes residue selection immediately usable
    // when the user switches to Select without another nested disclosure click.
    const firstSelect=panels.select?.querySelector(":scope > details");
    if(firstSelect&&!panels.select.dataset.defaultOpenApplied){
      panels.select.dataset.defaultOpenApplied="true";
      firstSelect.open=true;
    }
    return true;
  }

  function init(){
    fixTertiaryCategories();
    const observer=new MutationObserver(()=>fixTertiaryCategories());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
