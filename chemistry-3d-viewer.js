(() => {
  "use strict";

  const THREEDMOL_SOURCE="https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js";
  const ELEMENT_COLORS={
    H:"#f7f7f7",C:"#33e04f",N:"#3c6fff",O:"#ff3333",P:"#ff9d2e",S:"#ffd43b",
    F:"#7ee787",Cl:"#38d66b",Br:"#a85b3f",I:"#9c62d9",B:"#ffb5a7",Si:"#d9a066"
  };
  const BACKGROUND="#07111c";
  const HBOND_COLOR="#f2c66d";
  let loaderPromise=null;
  let viewer=null,host=null,panel=null,legacyCanvas=null,statusNode=null;
  let mode="ideal",lastSignature="",lastTopology="",requestSerial=0,initialView=null,ready=false;
  let pollTimer=null,resizeObserver=null,statusMessage="";

  function getEditor(){
    try{return typeof MoleculeEditor!=="undefined"?MoleculeEditor:null;}catch(_error){return null;}
  }

  function load3Dmol(){
    if(window.$3Dmol?.createViewer)return Promise.resolve(window.$3Dmol);
    if(loaderPromise)return loaderPromise;
    loaderPromise=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>String(s.src||"").includes("3Dmol-min.js"));
      if(existing){
        const wait=()=>window.$3Dmol?.createViewer?resolve(window.$3Dmol):setTimeout(wait,40);
        existing.addEventListener("error",()=>reject(new Error("3Dmol.js failed to load.")),{once:true});
        wait();return;
      }
      const script=document.createElement("script");
      script.src=THREEDMOL_SOURCE;script.async=true;script.dataset.rnaChem3dmol="1";
      script.onload=()=>window.$3Dmol?.createViewer?resolve(window.$3Dmol):reject(new Error("3Dmol.js loaded without a viewer API."));
      script.onerror=()=>reject(new Error("3Dmol.js failed to load."));
      document.head.appendChild(script);
    }).catch(error=>{loaderPromise=null;throw error;});
    return loaderPromise;
  }

  function graphSignature(graph){
    return JSON.stringify({
      a:(graph.atoms||[]).map(a=>[a.id,a.element,Number(a.x||0).toFixed(2),Number(a.y||0).toFixed(2),Number(a.charge||0)]),
      b:(graph.bonds||[]).map(b=>[b.a,b.b,Number(b.order||1)]),
      h:(graph.hbonds||[]).map(h=>[h.a,h.b])
    });
  }
  function topologySignature(graph){
    return JSON.stringify({
      a:(graph.atoms||[]).map(a=>[a.id,a.element]),
      b:(graph.bonds||[]).map(b=>[b.a,b.b,Number(b.order||1)]),
      h:(graph.hbonds||[]).map(h=>[h.a,h.b])
    });
  }

  function chargeRecords(model,graph,idToIndex){
    const graphById=new Map((graph.atoms||[]).map(a=>[a.id,a]));
    const charged=(model.atoms||[]).map(atom=>[idToIndex.get(atom.id),Number(graphById.get(atom.id)?.charge||0)]).filter(([idx,charge])=>idx&&charge!==0);
    const lines=[];
    for(let i=0;i<charged.length;i+=8){
      const chunk=charged.slice(i,i+8);
      lines.push("M  CHG"+String(chunk.length).padStart(3," ")+chunk.map(([idx,charge])=>String(idx).padStart(4," ")+String(charge).padStart(4," ")).join(""));
    }
    return lines;
  }

  function modelToSDF(model,graph){
    const atoms=Array.isArray(model?.atoms)?model.atoms:[],bonds=Array.isArray(model?.bonds)?model.bonds:[];
    if(!atoms.length)return "";
    if(atoms.length>999||bonds.length>999)throw new Error("The molecular preview currently supports up to 999 atoms and bonds.");
    const idToIndex=new Map(atoms.map((a,i)=>[a.id,i+1]));
    const lines=["RNA Explorer","  RNAExplorer3D","",String(atoms.length).padStart(3," ")+String(bonds.length).padStart(3," ")+"  0  0  0  0            999 V2000"];
    atoms.forEach(atom=>{
      const element=String(atom.element||"C").slice(0,3);
      lines.push(Number(atom.x||0).toFixed(4).padStart(10," ")+Number(atom.y||0).toFixed(4).padStart(10," ")+Number(atom.z||0).toFixed(4).padStart(10," ")+" "+element.padEnd(3," ")+" 0  0  0  0  0  0  0  0  0  0  0  0");
    });
    bonds.forEach(bond=>{
      const a=idToIndex.get(bond.a),b=idToIndex.get(bond.b);if(!a||!b)return;
      const order=Math.max(1,Math.min(3,Number(bond.order||1)));
      lines.push(String(a).padStart(3," ")+String(b).padStart(3," ")+String(order).padStart(3," ")+"  0  0  0  0");
    });
    lines.push(...chargeRecords(model,graph,idToIndex));
    lines.push("M  END","$$$$","");
    return lines.join("\n");
  }

  function setStatus(text,state="ready"){
    statusMessage=text;
    if(!statusNode)return;
    statusNode.textContent=text;statusNode.dataset.state=state;statusNode.dataset.renderer="3dmol";
  }

  function addDashedHbond(a,b){
    if(!viewer||!a||!b)return;
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,length=Math.hypot(dx,dy,dz);if(!Number.isFinite(length)||length<.05)return;
    const ux=dx/length,uy=dy/length,uz=dz/length;
    const dash=.22,gap=.14,step=dash+gap;
    for(let s=.05;s<length-.04;s+=step){
      const e=Math.min(length-.04,s+dash);if(e<=s)break;
      viewer.addCylinder({
        start:{x:a.x+ux*s,y:a.y+uy*s,z:a.z+uz*s},
        end:{x:a.x+ux*e,y:a.y+uy*e,z:a.z+uz*e},
        radius:.035,color:HBOND_COLOR,opacity:.95
      });
    }
  }

  function applyPyMolStickStyle(){
    if(!viewer)return;
    viewer.setStyle({}, {stick:{radius:.155,color:"#b7c2cc"}});
    Object.entries(ELEMENT_COLORS).forEach(([elem,color])=>{
      viewer.setStyle({elem},{stick:{radius:elem==="H"?.10:.155,color}});
    });
  }

  function drawExplicitInteractions(model,graph){
    const byId=new Map((model.atoms||[]).map(a=>[a.id,a]));
    const hbonds=Array.isArray(model.hbonds)&&model.hbonds.length?model.hbonds:(graph.hbonds||[]);
    hbonds.forEach(h=>addDashedHbond(byId.get(h.a),byId.get(h.b)));
  }

  function updateHelpText(){
    const help=panel?.querySelector(".chem-3d-help");
    if(help)help.textContent="Left drag: rotate · Middle drag or Ctrl/⌘ + drag: pan · Right drag or wheel: zoom · Touch: drag to rotate; pinch to zoom";
  }

  async function renderCurrent(force=false){
    if(!ready||!viewer||!panel||panel.hidden)return;
    const editor=getEditor();if(!editor?.getCurrentGraph)return;
    const graph=editor.getCurrentGraph();
    if(!graph?.atoms?.length){
      lastSignature="";lastTopology="";viewer.removeAllModels();viewer.removeAllShapes();viewer.render();setStatus("Draw a molecule to generate 3D geometry.","idle");return;
    }
    const signature=graphSignature(graph),topology=topologySignature(graph),key=mode+"|"+signature;
    if(!force&&key===lastSignature)return;
    const request=++requestSerial;
    setStatus(mode==="optimized"?"Minimizing covalent geometry with MMFF94…":"Generating drawing-faithful ideal 3D geometry…","busy");
    const engine=window.Chemistry3DForceField;
    const generate=mode==="optimized"?(engine?.generateOptimized||engine?.generate):engine?.generateIdeal;
    if(!generate){setStatus("3D geometry engine unavailable.","warning");return;}
    try{
      const model=await generate.call(engine,graph);
      if(request!==requestSerial)return;
      const sdf=modelToSDF(model,graph);if(!sdf)throw new Error("No atoms were generated.");
      const preserveView=topology===lastTopology&&initialView;
      const prior=preserveView&&viewer.getView?viewer.getView():null;
      viewer.removeAllModels();viewer.removeAllShapes();
      viewer.addModel(sdf,"sdf");
      applyPyMolStickStyle();
      drawExplicitInteractions(model,graph);
      if(prior&&viewer.setView)viewer.setView(prior);
      else{
        viewer.zoomTo();
        viewer.render();
        initialView=viewer.getView?viewer.getView():null;
      }
      viewer.render();
      lastSignature=key;lastTopology=topology;
      const interactionCount=(model.hbonds||graph.hbonds||[]).length;
      if(mode==="optimized"){
        setStatus("MMFF94-minimized covalent components · drawn interaction layout retained"+(interactionCount?` · ${interactionCount} explicit H-bond${interactionCount===1?"":"s"}`:"")+" · PyMOL-style sticks","ready");
      }else{
        setStatus("Ideal 3D · drawing arrangement preserved"+(interactionCount?` · ${interactionCount} explicit H-bond${interactionCount===1?"":"s"}`:"")+" · PyMOL-style sticks","ready");
      }
    }catch(error){
      if(request!==requestSerial)return;
      console.warn("RNA Explorer enhanced molecular 3D viewer:",error);
      setStatus((mode==="optimized"?"Energy-minimized":"Ideal")+" 3D generation unavailable: "+(error?.message||error),"warning");
    }
  }

  function bindButton(id,handler){
    const button=panel?.querySelector("#"+id)||document.getElementById(id);if(!button||button.dataset.enhanced3dBound==="1")return;
    button.dataset.enhanced3dBound="1";button.addEventListener("click",handler);
  }

  function bindControls(){
    bindButton("chem3DIdealMode",()=>{mode="ideal";lastSignature="";setTimeout(()=>renderCurrent(true),0);});
    bindButton("chem3DOptimizeMode",()=>{mode="optimized";lastSignature="";setTimeout(()=>renderCurrent(true),0);});
    bindButton("chem3DZoomIn",()=>{if(viewer){viewer.zoom(1.22);viewer.render();}});
    bindButton("chem3DZoomOut",()=>{if(viewer){viewer.zoom(.82);viewer.render();}});
    bindButton("chem3DResetView",()=>{if(viewer){if(initialView&&viewer.setView)viewer.setView(initialView);else viewer.zoomTo();viewer.render();}});
    bindButton("chem3DCenter",()=>{if(viewer){viewer.zoomTo();viewer.render();}});
    bindButton("chem3DFullscreen",()=>setTimeout(()=>{viewer?.resize?.();viewer?.render?.();},80));
    const toggle=document.getElementById("chem3DToggle");
    if(toggle&&toggle.dataset.enhanced3dBound!=="1"){
      toggle.dataset.enhanced3dBound="1";
      toggle.addEventListener("click",()=>setTimeout(()=>{if(panel&&!panel.hidden){viewer?.resize?.();renderCurrent(true);}},0));
    }
  }

  async function attach(panelNode,canvas){
    panel=panelNode;legacyCanvas=canvas;statusNode=panel.querySelector("#chem3DStatus")||document.getElementById("chem3DStatus");
    if(panel.dataset.enhanced3dReady==="1")return;
    panel.dataset.enhanced3dReady="1";
    legacyCanvas.setAttribute("aria-hidden","true");legacyCanvas.style.display="none";
    host=document.createElement("div");host.id="chem3DMolViewer";host.setAttribute("role","img");host.setAttribute("aria-label","Interactive three-dimensional molecular structure");
    host.style.width="100%";host.style.height="min(56vh, 560px)";host.style.minHeight="360px";host.style.borderRadius="12px";host.style.overflow="hidden";host.style.position="relative";host.style.touchAction="none";
    legacyCanvas.insertAdjacentElement("afterend",host);
    updateHelpText();
    try{
      const lib=await load3Dmol();
      viewer=lib.createViewer(host,{backgroundColor:BACKGROUND,antialias:true});
      ready=true;bindControls();
      if(typeof ResizeObserver!=="undefined"){
        resizeObserver=new ResizeObserver(()=>{if(!viewer)return;viewer.resize();viewer.render();});resizeObserver.observe(host);
      }
      renderCurrent(true);
      if(!pollTimer)pollTimer=setInterval(()=>{
        if(!panel||!document.body.contains(panel)){clearInterval(pollTimer);pollTimer=null;return;}
        if(!panel.hidden){viewer?.resize?.();renderCurrent(false);}
      },220);
    }catch(error){
      console.warn("RNA Explorer could not start 3Dmol.js for molecular drawing:",error);
      legacyCanvas.style.display="";host.remove();panel.dataset.enhanced3dReady="0";
      setStatus("PyMOL-style viewer unavailable · using the built-in preview","warning");
    }
  }

  function scan(){
    const panelNode=document.getElementById("chem3DPanel"),canvas=document.getElementById("chem3DCanvas");
    if(panelNode&&canvas&&panelNode.dataset.enhanced3dReady!=="1")attach(panelNode,canvas);
  }

  const observer=new MutationObserver(scan);
  if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  scan();
  setInterval(scan,700);
})();
