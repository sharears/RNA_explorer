(() => {
  "use strict";

  const CATEGORY_ORDER=["select","display","analyze"];

  function categoryFor(summary){
    const lower=String(summary||"").trim().toLowerCase();
    if(lower.startsWith("select")||lower.includes("saved object")||lower.includes("focus on structural"))return "select";
    if(lower.startsWith("analyze")||lower.includes("compare / align"))return "analyze";
    return "display";
  }

  function tidy(details,category){
    const summary=details.querySelector(":scope > summary");if(!summary)return;
    const text=summary.textContent.trim();
    const cleaned=text.replace(new RegExp("^"+category+"\\s*[·:-]?\\s*","i"),"").trim();
    if(cleaned)summary.textContent=cleaned.charAt(0).toUpperCase()+cleaned.slice(1);
  }

  function fixTertiaryCategories(){
    const controls=document.querySelector("#tertiaryControls .te-controls"),shell=document.getElementById("teWorkspaceCategories");
    if(!controls||!shell)return false;
    const panels=Object.fromEntries(CATEGORY_ORDER.map(key=>[key,shell.querySelector(`[data-workspace-panel="${key}"]`)]));
    [...controls.children].filter(el=>el.tagName==="DETAILS").forEach(details=>{
      const summary=details.querySelector(":scope > summary")?.textContent.trim()||"";
      const lower=summary.toLowerCase();
      if(lower.includes("import structure"))return;
      const category=categoryFor(summary);
      tidy(details,category);
      panels[category]?.append(details);
    });
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
