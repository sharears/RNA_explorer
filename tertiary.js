const TertiaryExplorer = (() => {
  const PALETTES = {
    viridis:["#440154","#3b528b","#21918c","#5ec962","#fde725"],
    magma:["#000004","#51127c","#b73779","#fc8961","#fcfdbf"],
    blueRed:["#2166ac","#92c5de","#f7f7f7","#f4a582","#b2182b"],
    cividis:["#00224e","#434e6c","#7d7c78","#bcae6c","#fee838"]
  };
  const REGION_COLORS = {
    "Acceptor stem":"#74d7b6","D arm":"#d9808e","Anticodon arm":"#e8bb69",
    "Variable region":"#87a9cc","T arm":"#a78bfa","3′ CCA end":"#f0a36f","Connector":"#8fa2b3"
  };
  const SOURCES = [
    "https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js",
    "https://3Dmol.org/build/3Dmol-min.js"
  ];
  const PDB_URL="https://files.rcsb.org/download/1EHZ.pdb";

  const state={
    sequence:"",coords:[],structure:"",colors:{},names:{},onSelect:()=>{},selected:0,
    representation:"sticks",colorMode:"nucleotide",showPairs:true,showIndices:true,
    indexSelection:new Set(),metadata:{},heatEnabled:false,heatTheme:"viridis",heatRange:[0,1],
    secondaryIsDefault:true,proximityEnabled:false,proximityCutoff:12,
    measureEnabled:false,measureA:null,measureB:null,split:false
  };

  let viewer=null,model=null,viewerPromise=null,initialView=null,hoverLabel=null;
  let pairs=[],partner=[],setupDone=false;
  const $=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const c4=i=>({x:state.coords[i][0],y:state.coords[i][1],z:state.coords[i][2]});

  function parseStructure(structure,n){
    const stack=[],ps=[],pt=Array(n).fill(-1);
    [...structure].forEach((c,i)=>{
      if(c==="(")stack.push(i);
      else if(c===")"){
        const a=stack.pop(); if(a===undefined)return;
        ps.push([a,i]);pt[a]=i;pt[i]=a;
      }
    });
    return {pairs:ps.sort((a,b)=>a[0]-b[0]),partner:pt};
  }

  function regionFor(i){
    const p=i+1;
    if((p>=1&&p<=7)||(p>=66&&p<=72))return "Acceptor stem";
    if(p>=10&&p<=25)return "D arm";
    if(p>=26&&p<=44)return "Anticodon arm";
    if(p>=45&&p<=48)return "Variable region";
    if(p>=49&&p<=65)return "T arm";
    if(p>=73&&p<=76)return "3′ CCA end";
    return "Connector";
  }
  function regionIndices(r){return state.sequence.split("").map((_,i)=>i).filter(i=>regionFor(i)===r);}
  function distance3D(a,b){
    return Math.hypot(state.coords[a][0]-state.coords[b][0],state.coords[a][1]-state.coords[b][1],state.coords[a][2]-state.coords[b][2]);
  }
  function heatColor(value){
    const min=state.heatRange[0],max=state.heatRange[1];
    const t=max===min?0.5:clamp((value-min)/(max-min),0,1),stops=PALETTES[state.heatTheme]||PALETTES.viridis;
    const x=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(x)),f=x-i;
    return "#"+[1,3,5].map(k=>{
      const a=parseInt(stops[i].slice(k,k+2),16),b=parseInt(stops[i+1].slice(k,k+2),16);
      return Math.round(a*(1-f)+b*f).toString(16).padStart(2,"0");
    }).join("");
  }
  function residueColor(i){
    if(state.colorMode==="region")return REGION_COLORS[regionFor(i)];
    if(state.colorMode==="metadata"&&state.heatEnabled&&state.metadata[i]?.value!=null)return heatColor(state.metadata[i].value);
    return state.colors[state.sequence[i]]||"#8fa2b3";
  }
  function defaultIndices(){
    return new Set(state.sequence.split("").map((_,i)=>i).filter(i=>i===0||(i+1)%5===0||i===state.sequence.length-1));
  }
  function setStatus(message,kind){
    const el=$("teMolecularStatus"); if(!el)return;
    el.textContent=message||"";el.dataset.kind=kind||"info";el.hidden=!message;
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src=src;script.async=true;script.crossOrigin="anonymous";
      script.onload=resolve;script.onerror=()=>reject(new Error("Could not load "+src));
      document.head.append(script);
    });
  }
  async function load3Dmol(){
    if(window.$3Dmol)return window.$3Dmol;
    let error=null;
    for(const src of SOURCES){
      try{await loadScript(src);if(window.$3Dmol)return window.$3Dmol;}catch(e){error=e;}
    }
    throw error||new Error("3Dmol.js failed to load");
  }
  async function loadPdb(){
    const r=await fetch(PDB_URL,{mode:"cors",cache:"force-cache"});
    if(!r.ok)throw new Error("PDB download failed: "+r.status);
    return r.text();
  }

  function chooseResidue(index){
    if(state.measureEnabled){
      if(state.measureA==null||state.measureB!=null){state.measureA=index;state.measureB=null;}
      else if(index!==state.measureA)state.measureB=index;
    }
    state.onSelect(index);
  }

  function setupInteractions(){
    if(!viewer)return;
    viewer.setClickable({chain:"A"},true,atom=>{
      const i=Number(atom.resi)-1;
      if(Number.isInteger(i)&&i>=0&&i<state.sequence.length)chooseResidue(i);
    });
    viewer.setHoverDuration(80);
    viewer.setHoverable({chain:"A"},true,(atom,v)=>{
      const i=Number(atom.resi)-1;
      if(!Number.isInteger(i)||i<0||i>=state.sequence.length)return;
      if(hoverLabel)v.removeLabel(hoverLabel);
      const mate=partner[i]>=0?state.sequence[partner[i]]+(partner[i]+1):"none";
      const info=state.metadata[i]?.value;
      hoverLabel=v.addLabel(
        state.sequence[i]+(i+1)+" · "+regionFor(i)+" · pair "+mate+(info==null?"":" · info "+info),
        {position:atom,fontSize:13,fontColor:"#f7fbff",backgroundColor:"#08111e",backgroundOpacity:.9,
         borderColor:"#6f8798",borderThickness:1,inFront:true}
      );
      v.render();
    },(atom,v)=>{
      if(hoverLabel){v.removeLabel(hoverLabel);hoverLabel=null;v.render();}
    });
  }

  async function createViewer(){
    const container=$("tertiaryMolecularViewer");
    if(!container)throw new Error("Molecular viewer container missing");
    setStatus("Loading all-atom PDB 1EHZ…");
    const lib=await load3Dmol();
    viewer=lib.createViewer(container,{backgroundColor:"#08111e",antialias:true});
    viewer.setViewStyle({style:"outline",color:"#02060b",width:.08});
    try{
      const pdb=await loadPdb();
      model=viewer.addModel(pdb,"pdb",{keepH:false});
    }catch(error){
      setStatus("Direct loading failed; trying the 3Dmol/RCSB loader…");
      model=await new Promise((resolve,reject)=>{
        try{lib.download("pdb:1EHZ",viewer,{doAssembly:false},m=>m?resolve(m):reject(new Error("No PDB model returned")));}
        catch(e){reject(e);}
      });
    }
    setupInteractions();
    applyStyles(false);
    viewer.zoomTo({chain:"A"},0);viewer.render();
    initialView=viewer.getView?viewer.getView():null;
    setStatus("");
    return viewer;
  }

  function ensureViewer(){
    if(viewer)return Promise.resolve(viewer);
    if(!viewerPromise){
      viewerPromise=createViewer().catch(error=>{
        viewerPromise=null;setStatus("The molecular viewer could not load. Reload the page or check the network connection.","error");
        console.error("Tertiary viewer:",error);throw error;
      });
    }
    return viewerPromise;
  }

  function repStyle(color){
    if(state.representation==="ballstick")return {stick:{radius:.12,color},sphere:{radius:.24,color}};
    if(state.representation==="wire")return {line:{linewidth:2,color}};
    return {stick:{radius:.14,color}};
  }

  function addPairs(){
    if(!viewer||!state.showPairs||!state.secondaryIsDefault)return;
    const selectedMate=partner[state.selected];
    pairs.forEach(([a,b])=>{
      const active=(a===state.selected&&b===selectedMate)||(b===state.selected&&a===selectedMate);
      viewer.addCylinder({start:c4(a),end:c4(b),radius:active?.17:.065,color:active?"#74d7b6":"#71879a",
        opacity:active?.95:.55,fromCap:1,toCap:1});
    });
  }
  function addIndices(){
    if(!viewer||!state.showIndices)return;
    state.indexSelection.forEach(i=>{
      if(!state.coords[i])return;
      viewer.addLabel(String(i+1),{position:c4(i),fontSize:12,fontColor:"#e9f3f8",backgroundColor:"#08111e",
        backgroundOpacity:.65,borderColor:"#50677a",borderThickness:1,inFront:true});
    });
  }
  function nearby(i){
    if(!state.proximityEnabled)return [];
    return state.coords.map((_,j)=>j).filter(j=>j!==i&&Math.abs(j-i)>1&&distance3D(i,j)<=state.proximityCutoff);
  }
  function addProximity(){
    if(!viewer)return;
    const list=nearby(state.selected);
    list.forEach(i=>viewer.addSphere({center:c4(i),radius:.65,color:"#f2c66d",opacity:.32}));
    const s=$("teProximityStatus");if(!s)return;
    if(!state.proximityEnabled){s.textContent="Highlights C4′ spatial neighbors that are not immediate sequence neighbors.";return;}
    const ordered=[...list].sort((a,b)=>distance3D(state.selected,a)-distance3D(state.selected,b));
    s.textContent=ordered.length
      ? ordered.length+" non-neighboring residues within "+state.proximityCutoff+" Å of "+state.sequence[state.selected]+(state.selected+1)+": "+ordered.slice(0,8).map(i=>state.sequence[i]+(i+1)).join(", ")+(ordered.length>8?"…":"")
      : "No non-neighboring residues within "+state.proximityCutoff+" Å of "+state.sequence[state.selected]+(state.selected+1)+".";
  }
  function addMeasurement(){
    const s=$("teMeasureStatus");
    if(!state.measureEnabled){if(s)s.textContent="Select two residues to measure a C4′–C4′ distance.";return;}
    if(state.measureA==null){if(s)s.textContent="Measurement mode: choose the first residue.";return;}
    if(state.measureB==null){if(s)s.textContent="First residue: "+state.sequence[state.measureA]+(state.measureA+1)+". Choose the second residue.";return;}
    const a=state.measureA,b=state.measureB,d=distance3D(a,b);
    viewer.addCylinder({start:c4(a),end:c4(b),radius:.09,color:"#ffffff",opacity:.9,fromCap:1,toCap:1});
    viewer.addLabel(d.toFixed(1)+" Å",{position:{x:(state.coords[a][0]+state.coords[b][0])/2,y:(state.coords[a][1]+state.coords[b][1])/2,z:(state.coords[a][2]+state.coords[b][2])/2},
      fontSize:13,fontColor:"#fff",backgroundColor:"#08111e",backgroundOpacity:.85,inFront:true});
    if(s)s.textContent=state.sequence[a]+(a+1)+" ↔ "+state.sequence[b]+(b+1)+": "+d.toFixed(2)+" Å between C4′ atoms.";
  }

  function applyStyles(renderNow){
    if(!viewer||!model)return;
    viewer.removeAllShapes();viewer.removeAllLabels();hoverLabel=null;
    viewer.setStyle({},{});
    for(let i=0;i<state.sequence.length;i++)viewer.setStyle({chain:"A",resi:i+1},repStyle(residueColor(i)));

    const mate=partner[state.selected];
    if(mate>=0&&state.secondaryIsDefault){
      viewer.addStyle({chain:"A",resi:mate+1},{stick:{radius:.25,color:"#74d7b6"},sphere:{radius:.28,color:"#74d7b6",opacity:.38}});
    }
    viewer.addStyle({chain:"A",resi:state.selected+1},{stick:{radius:.34,color:"#ffffff"},sphere:{radius:.34,color:"#ffffff",opacity:.42}});
    addPairs();addIndices();addProximity();addMeasurement();
    if(renderNow!==false)viewer.render();
  }

  function updateCopy(){
    const p=document.querySelector("#scene-tertiary .selected-residue-copy");if(!p)return;
    const i=state.selected,m=partner[i],info=state.metadata[i]?.value;
    const pair=state.secondaryIsDefault?(m>=0?" Paired with "+state.sequence[m]+(m+1)+".":" Unpaired in the secondary structure.")
      :" Secondary-to-tertiary mapping is paused for the custom secondary structure.";
    p.textContent=regionFor(i)+"."+pair+(info==null?"":" Residue information: "+info+".")+" The molecular view shows the actual atoms from PDB 1EHZ.";
  }

  function heatLegend(){
    const box=$("teHeatLegend");if(!box)return;
    const active=state.colorMode==="metadata"&&state.heatEnabled;box.hidden=!active;if(!active)return;
    const stops=PALETTES[state.heatTheme]||PALETTES.viridis;
    box.innerHTML="<strong>Residue information · "+state.heatTheme+"</strong><div class=\"te-heat-bar\"></div><p>"+state.heatRange[0]+" → "+state.heatRange[1]+" · Same scale as Secondary.</p>";
    box.querySelector(".te-heat-bar").style.background="linear-gradient(to right,"+stops.join(",")+")";
  }
  function regionLegend(){
    [$("teRegionLegend"),$("teRegionLegendStage")].filter(Boolean).forEach(box=>{
      box.hidden=state.colorMode!=="region";if(box.hidden)return;box.replaceChildren();
      Object.entries(REGION_COLORS).forEach(([name,color])=>{
        const s=document.createElement("span"),i=document.createElement("i");i.style.background=color;s.append(i,document.createTextNode(name));box.append(s);
      });
    });
  }

  function miniSecondary(){
    const panel=$("tertiaryMiniPanel"),root=$("tertiaryMiniSvg");if(!panel||!root)return;
    panel.hidden=!state.split||!state.secondaryIsDefault;if(panel.hidden)return;root.replaceChildren();
    let pos;try{if(typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.radial)pos=SecondaryExplorer.radial(state.sequence.length,partner);}catch(_){}
    if(!pos?.length)return;
    const NS="http://www.w3.org/2000/svg",make=(name,attrs={})=>{const e=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;};
    const minX=Math.min(...pos.map(p=>p.x)),maxX=Math.max(...pos.map(p=>p.x)),minY=Math.min(...pos.map(p=>p.y)),maxY=Math.max(...pos.map(p=>p.y));
    const pad=34,scale=Math.min((340-2*pad)/Math.max(1,maxX-minX),(430-2*pad)/Math.max(1,maxY-minY));
    const map=pos.map(p=>({x:pad+(p.x-minX)*scale,y:pad+(p.y-minY)*scale}));
    pairs.forEach(([a,b])=>root.append(make("line",{x1:map[a].x,y1:map[a].y,x2:map[b].x,y2:map[b].y,class:"te-mini-pair"+(a===state.selected||b===state.selected?" selected":"")})));
    root.append(make("polyline",{points:map.map(p=>p.x+","+p.y).join(" "),class:"te-mini-backbone"}));
    map.forEach((p,i)=>{
      const g=make("g",{class:"te-mini-node"+(i===state.selected?" selected":"")+(partner[state.selected]===i?" paired-selected":""),
        transform:"translate("+p.x+" "+p.y+")",tabindex:"0",role:"button","aria-label":state.sequence[i]+(i+1)});
      g.append(make("circle",{r:i===state.selected?7:4.5,fill:residueColor(i)}));
      g.addEventListener("click",()=>state.onSelect(i));g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();state.onSelect(i);}});
      root.append(g);
    });
  }

  function buildIndexChoices(){
    const box=$("teIndexChoices");if(!box)return;box.replaceChildren();
    state.sequence.split("").forEach((base,i)=>{
      const label=document.createElement("label"),input=document.createElement("input");input.type="checkbox";input.checked=state.indexSelection.has(i);
      input.addEventListener("change",()=>{input.checked?state.indexSelection.add(i):state.indexSelection.delete(i);render();});
      label.append(input,document.createTextNode(base+(i+1)));box.append(label);
    });
  }
  function updateControls(){
    const c=$("teColorMode"),m=c?.querySelector('option[value="metadata"]');if(m)m.disabled=!state.heatEnabled;if(c)c.value=state.colorMode;
    if($("teSplit")){$("teSplit").checked=state.split&&state.secondaryIsDefault;$("teSplit").disabled=!state.secondaryIsDefault;}
    if($("teMappingStatus"))$("teMappingStatus").textContent=state.secondaryIsDefault
      ?"Secondary and tertiary selections are synchronized for the default 1EHZ tRNA."
      :"3D mapping paused: restore the default tRNA in Secondary to synchronize the views.";
    if($("teMeasureToggle")){$("teMeasureToggle").setAttribute("aria-pressed",String(state.measureEnabled));$("teMeasureToggle").textContent=state.measureEnabled?"Stop measuring":"Measure C4′ distance";}
  }

  function render(selected){
    if(selected!==undefined)state.selected=clamp(selected,0,state.sequence.length-1);
    miniSecondary();heatLegend();regionLegend();updateCopy();updateControls();
    const scene=$("scene-tertiary");if(!scene||scene.hidden)return;
    ensureViewer().then(()=>applyStyles()).catch(()=>{});
  }

  function resetView(){if(!viewer)return;if(initialView&&viewer.setView)viewer.setView(initialView);else viewer.zoomTo({chain:"A"},400);viewer.render();}
  function centerSelected(){if(viewer){viewer.zoomTo({chain:"A",resi:state.selected+1},450);viewer.render();}}
  function focus(indices){if(viewer&&indices.length){viewer.zoomTo({chain:"A",resi:indices.map(i=>i+1)},450);viewer.render();}}

  function setupControls(){
    const box=$("tertiaryControls");if(!box)return;
    box.innerHTML=
      '<div class="te-controls">'+
      '<details open><summary>3D molecular display</summary>'+
      '<label>Representation<select id="teRepresentation"><option value="sticks">PyMOL-style sticks</option><option value="ballstick">Ball &amp; stick</option><option value="wire">Wire</option></select></label>'+
      '<label>Color by<select id="teColorMode"><option value="nucleotide">Nucleotide</option><option value="region">Secondary element</option><option value="metadata" disabled>Residue information</option></select></label>'+
      '<label class="te-check"><input id="teShowPairs" type="checkbox" checked> Show mapped secondary-structure pair connections</label>'+
      '<label class="te-check"><input id="teShowIndices" type="checkbox" checked> Show residue indices</label></details>'+
      '<details><summary>Residue index</summary><p>Default labels: 1, every 5 residues, and the final residue.</p>'+
      '<details class="te-index-dropdown"><summary>Choose indices</summary><div id="teIndexChoices"></div></details>'+
      '<div class="te-button-row"><button type="button" id="teIndexDefault">Default</button><button type="button" id="teIndexAll">All</button><button type="button" id="teIndexNone">None</button></div></details>'+
      '<details open><summary>Explore structure</summary>'+
      '<label class="te-check"><input id="teProximity" type="checkbox"> Highlight 3D proximity</label>'+
      '<label>Proximity cutoff (Å)<input id="teProximityCutoff" type="number" min="6" max="30" step="0.5" value="12"></label>'+
      '<p id="teProximityStatus">Highlights C4′ spatial neighbors that are not immediate sequence neighbors.</p>'+
      '<button type="button" id="teMeasureToggle" aria-pressed="false">Measure C4′ distance</button><p id="teMeasureStatus">Select two residues to measure a C4′–C4′ distance.</p>'+
      '<label class="te-check"><input id="teSplit" type="checkbox"> 2D + 3D linked view</label><p id="teMappingStatus"></p></details>'+
      '<details><summary>Focus on structural region</summary><div class="te-button-row te-region-buttons">'+
      '<button type="button" data-te-region="Acceptor stem">Acceptor</button><button type="button" data-te-region="Anticodon arm">Anticodon</button>'+
      '<button type="button" data-te-region="elbow">D/T-loop elbow</button><button type="button" data-te-region="full">Full structure</button></div></details>'+
      '<div class="te-region-legend" id="teRegionLegend" hidden></div></div>';

    $("teRepresentation").value=state.representation;$("teColorMode").value=state.colorMode;$("teShowPairs").checked=state.showPairs;$("teShowIndices").checked=state.showIndices;
    $("teRepresentation").addEventListener("change",e=>{state.representation=e.target.value;render();});
    $("teColorMode").addEventListener("change",e=>{state.colorMode=e.target.value;render();});
    $("teShowPairs").addEventListener("change",e=>{state.showPairs=e.target.checked;render();});
    $("teShowIndices").addEventListener("change",e=>{state.showIndices=e.target.checked;render();});
    $("teProximity").addEventListener("change",e=>{state.proximityEnabled=e.target.checked;render();});
    $("teProximityCutoff").addEventListener("input",e=>{if(e.target.checkValidity()){state.proximityCutoff=Number(e.target.value);render();}});
    $("teMeasureToggle").addEventListener("click",()=>{state.measureEnabled=!state.measureEnabled;if(!state.measureEnabled){state.measureA=null;state.measureB=null;}render();});
    $("teSplit").addEventListener("change",e=>{state.split=e.target.checked&&state.secondaryIsDefault;render();});
    $("teIndexDefault").addEventListener("click",()=>{state.indexSelection=defaultIndices();buildIndexChoices();render();});
    $("teIndexAll").addEventListener("click",()=>{state.indexSelection=new Set(state.sequence.split("").map((_,i)=>i));buildIndexChoices();render();});
    $("teIndexNone").addEventListener("click",()=>{state.indexSelection.clear();buildIndexChoices();render();});
    box.querySelectorAll("[data-te-region]").forEach(b=>b.addEventListener("click",()=>{
      const r=b.dataset.teRegion;if(r==="full")resetView();else if(r==="elbow")focus([...regionIndices("D arm"),...regionIndices("T arm")]);else focus(regionIndices(r));
    }));
    buildIndexChoices();
  }

  function applyMetadata(detail){
    if(!detail?.isDefault){state.metadata={};state.heatEnabled=false;if(state.colorMode==="metadata")state.colorMode="nucleotide";render();return;}
    state.metadata=detail.metadata||{};state.heatEnabled=Boolean(detail.heatEnabled)&&Object.keys(state.metadata).length>0;
    state.heatTheme=detail.heatTheme||"viridis";state.heatRange=Array.isArray(detail.heatRange)?detail.heatRange:[0,1];
    if(!state.heatEnabled&&state.colorMode==="metadata")state.colorMode="nucleotide";render();
  }

  function setup(config){
    if(setupDone)return;setupDone=true;
    Object.assign(state,{sequence:config.sequence,coords:config.coords,structure:config.structure,colors:config.colors,names:config.names,onSelect:config.onSelect});
    const parsed=parseStructure(state.structure,state.sequence.length);pairs=parsed.pairs;partner=parsed.partner;state.indexSelection=defaultIndices();
    setupControls();
    $("teZoomIn")?.addEventListener("click",()=>{if(viewer){viewer.zoom(1.25,250);viewer.render();}});
    $("teZoomOut")?.addEventListener("click",()=>{if(viewer){viewer.zoom(.8,250);viewer.render();}});
    $("teResetView")?.addEventListener("click",resetView);$("teCenterSelected")?.addEventListener("click",centerSelected);
    $("followButton")?.addEventListener("click",()=>{let next=state.selected;while(next===state.selected)next=Math.floor(Math.random()*state.sequence.length);state.onSelect(next);});
    window.addEventListener("rna-metadata-change",e=>applyMetadata(e.detail));
    window.addEventListener("rna-secondary-context",e=>{state.secondaryIsDefault=Boolean(e.detail?.isDefault);if(!state.secondaryIsDefault)state.split=false;render();});
    render();
  }
  return {setup,render};
})();