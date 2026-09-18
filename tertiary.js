const TertiaryExplorer = (() => {
  const PALETTES = {
    viridis:["#440154","#3b528b","#21918c","#5ec962","#fde725"],
    magma:["#000004","#51127c","#b73779","#fc8961","#fcfdbf"],
    blueRed:["#2166ac","#92c5de","#f7f7f7","#f4a582","#b2182b"],
    cividis:["#00224e","#434e6c","#7d7c78","#bcae6c","#fee838"]
  };
  const REGION_COLORS = {
    "Acceptor stem":"#74d7b6","D arm":"#d9808e","Anticodon arm":"#e8bb69",
    "Variable region":"#87a9cc","T arm":"#a78bfa","3′ CCA end":"#f0a36f",
    "Connector":"#8fa2b3","Paired":"#74d7b6","Unpaired":"#e8bb69"
  };
  const SOURCES = [
    "https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js",
    "https://3Dmol.org/build/3Dmol-min.js"
  ];
  const PDB_URL="https://files.rcsb.org/download/1EHZ.pdb";
  const MOD_BASES = {
    A:"A",ADE:"A",RA:"A","1MA":"A","M1A":"A","6MA":"A","RIA":"A",
    C:"C",CYT:"C",RC:"C","5MC":"C","OMC":"C","M5C":"C",
    G:"G",GUA:"G",RG:"G","1MG":"G","M1G":"G","2MG":"G","M2G":"G","7MG":"G","M7G":"G","OMG":"G","YG":"G","YYG":"G",
    U:"U",URA:"U",RU:"U","PSU":"U","H2U":"U","5MU":"U","4SU":"U","T":"U"
  };

  const state = {
    defaultSequence:"",defaultStructure:"",secondarySequence:"",structure:"",
    colors:{},names:{},onSelect:()=>{},selected:0,
    representation:"sticks",colorMode:"nucleotide",showPairs:true,showIndices:true,
    indexSelection:new Set(),metadata:{},heatEnabled:false,heatTheme:"viridis",heatRange:[0,1],
    secondaryIsDefault:true,sourceIsDefault:true,sameMoleculeConfirmed:false,
    proximityEnabled:false,proximityCutoff:12,measureEnabled:false,measureA:null,measureB:null,
    split:false,exportScale:2,currentFileName:"PDB 1EHZ",currentFormat:"pdb",
    chains:[],activeChain:null,chainNeedsChoice:false,residueIndexByKey:new Map(),
    mapping:{enabled:false,level:"pending",message:""}
  };

  let viewer=null,model=null,viewerPromise=null,initialView=null,hoverLabel=null;
  let pairs=[],partner=[],setupDone=false;

  const $=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const residueKey=(chain,resi,icode="")=>String(chain||"")+"|"+String(resi)+"|"+String(icode||"");
  const selectorForResidue=r=>{
    const sel={resi:r.resi};
    if(r.chain!==undefined&&r.chain!==null&&r.chain!=="")sel.chain=r.chain;
    if(r.icode)sel.icode=r.icode;
    return sel;
  };

  function normalizeBase(resn){
    const key=String(resn||"").trim().toUpperCase();
    if(MOD_BASES[key])return MOD_BASES[key];
    if(/^[ACGU]$/.test(key))return key;
    return "?";
  }

  function parseStructure(structure,n){
    const stack=[],ps=[],pt=Array(n).fill(-1);
    [...structure].forEach((c,i)=>{
      if(c==="(")stack.push(i);
      else if(c===")"){
        const a=stack.pop();if(a===undefined)return;
        ps.push([a,i]);pt[a]=i;pt[i]=a;
      }
    });
    return {pairs:ps.sort((a,b)=>a[0]-b[0]),partner:pt};
  }

  function regionFor(i){
    if(!state.secondaryIsDefault)return partner[i]>=0?"Paired":"Unpaired";
    const p=i+1;
    if((p>=1&&p<=7)||(p>=66&&p<=72))return "Acceptor stem";
    if(p>=10&&p<=25)return "D arm";
    if(p>=26&&p<=44)return "Anticodon arm";
    if(p>=45&&p<=48)return "Variable region";
    if(p>=49&&p<=65)return "T arm";
    if(p>=73&&p<=76)return "3′ CCA end";
    return "Connector";
  }
  function regionIndices(r){return state.secondarySequence.split("").map((_,i)=>i).filter(i=>regionFor(i)===r);}

  function activeResidues(){
    const chain=state.chains.find(c=>c.id===state.activeChain);
    return chain?chain.residues:[];
  }
  function coordFor(i){
    const r=activeResidues()[i];
    return r?r.coord:null;
  }
  function distance3D(a,b){
    const x=coordFor(a),y=coordFor(b);
    if(!x||!y)return NaN;
    return Math.hypot(x.x-y.x,x.y-y.y,x.z-y.z);
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
  function baseAt(i){
    if(state.mapping.enabled&&state.secondarySequence[i])return state.secondarySequence[i];
    return activeResidues()[i]?.base||"?";
  }
  function residueColor(i){
    if(state.colorMode==="region"&&state.mapping.enabled)return REGION_COLORS[regionFor(i)]||"#8fa2b3";
    if(state.colorMode==="metadata"&&state.mapping.enabled&&state.heatEnabled&&state.metadata[i]?.value!=null)return heatColor(state.metadata[i].value);
    return state.colors[baseAt(i)]||"#8fa2b3";
  }
  function defaultIndices(){
    const n=state.mapping.enabled?state.secondarySequence.length:activeResidues().length;
    return new Set(Array.from({length:n},(_,i)=>i).filter(i=>i===0||(i+1)%5===0||i===n-1));
  }

  function setStatus(message,kind){
    const el=$("teMolecularStatus");if(!el)return;
    el.textContent=message||"";el.dataset.kind=kind||"info";el.hidden=!message;
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){
        if(window.$3Dmol)return resolve();
        existing.addEventListener("load",resolve,{once:true});
        existing.addEventListener("error",reject,{once:true});
        return;
      }
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
  async function fetchDefaultPdb(){
    const r=await fetch(PDB_URL,{mode:"cors",cache:"force-cache"});
    if(!r.ok)throw new Error("PDB download failed: "+r.status);
    return r.text();
  }

  function extractChains(){
    const atoms=model?.selectedAtoms?model.selectedAtoms({}):[];
    const residues=new Map();
    atoms.forEach((atom,index)=>{
      const key=residueKey(atom.chain,atom.resi,atom.icode);
      let r=residues.get(key);
      if(!r){
        r={chain:atom.chain||"",resi:atom.resi,icode:atom.icode||"",resn:atom.resn||"",base:normalizeBase(atom.resn),
          first:index,atoms:[],coord:null,coordRank:-1,hasSugar:false,hasP:false,sum:{x:0,y:0,z:0,n:0}};
        residues.set(key,r);
      }
      r.atoms.push(atom);
      const atomName=String(atom.atom||"").toUpperCase();
      if(atomName==="C4'"||atomName==="C4*")r.hasSugar=true;
      if(atomName==="C1'"||atomName==="C1*"||atomName==="O4'"||atomName==="O4*")r.hasSugar=true;
      if(atomName==="P")r.hasP=true;
      r.sum.x+=Number(atom.x)||0;r.sum.y+=Number(atom.y)||0;r.sum.z+=Number(atom.z)||0;r.sum.n++;
      const rank=(atomName==="C4'"||atomName==="C4*")?4:atomName==="P"?3:(atomName==="C1'"||atomName==="C1*")?2:0;
      if(rank>r.coordRank){r.coord={x:atom.x,y:atom.y,z:atom.z};r.coordRank=rank;}
    });
    const byChain=new Map();
    [...residues.values()].sort((a,b)=>a.first-b.first).forEach(r=>{
      if(r.base==="?"&&!r.hasSugar)return;
      if(!r.coord&&r.sum.n)r.coord={x:r.sum.x/r.sum.n,y:r.sum.y/r.sum.n,z:r.sum.z/r.sum.n};
      if(!byChain.has(r.chain))byChain.set(r.chain,[]);
      byChain.get(r.chain).push(r);
    });
    state.chains=[...byChain.entries()].map(([id,list])=>({
      id,residues:list,sequence:list.map(r=>r.base).join(""),
      recognized:list.filter(r=>r.base!=="?").length
    })).filter(c=>c.residues.length);
  }

  function compareChain(chain,sequence){
    if(!chain)return {lengthMatch:false,mismatches:[],unknown:0,exact:false};
    const lengthMatch=chain.residues.length===sequence.length;
    const mismatches=[];
    const n=Math.min(chain.residues.length,sequence.length);
    let unknown=0;
    for(let i=0;i<n;i++){
      const base=chain.residues[i].base;
      if(base==="?"){unknown++;continue;}
      if(base!==sequence[i])mismatches.push(i);
    }
    return {lengthMatch,mismatches,unknown,exact:lengthMatch&&mismatches.length===0&&unknown===0};
  }

  function chooseBestChain(){
    const sequence=state.secondarySequence;
    if(!state.chains.length){state.activeChain=null;return;}
    state.chainNeedsChoice=false;
    if(state.sourceIsDefault){
      const chainA=state.chains.find(c=>c.id==="A");
      state.activeChain=(chainA||state.chains[0]).id;return;
    }
    const scored=state.chains.map(chain=>{
      const cmp=compareChain(chain,sequence);
      const score=Math.abs(chain.residues.length-sequence.length)*1000+cmp.mismatches.length*100+cmp.unknown;
      return {chain,cmp,score};
    }).sort((a,b)=>a.score-b.score);
    if(scored.length>1&&scored[0].score===scored[1].score){
      state.activeChain=null;state.chainNeedsChoice=true;
    }else state.activeChain=scored[0].chain.id;
  }

  function populateChainSelect(){
    const select=$("teChainSelect");if(!select)return;
    select.replaceChildren();
    if(state.chainNeedsChoice)select.append(new Option("Choose an RNA chain…",""));
    state.chains.forEach(chain=>{
      const label=(chain.id||"(blank)")+" · "+chain.residues.length+" RNA-like residues · "+chain.recognized+" recognized";
      select.append(new Option(label,chain.id));
    });
    if(state.activeChain!=null)select.value=state.activeChain;else select.value="";
    select.disabled=state.chains.length<=1;
  }

  function isCuratedDefaultPair(){
    return state.secondaryIsDefault&&state.sourceIsDefault;
  }

  function evaluateMapping(){
    const chain=state.chains.find(c=>c.id===state.activeChain);
    const sequence=state.secondarySequence;
    let level="error",message="",enabled=false;
    if(!chain){
      message=state.chainNeedsChoice?"Multiple RNA chains are equally compatible with the Secondary sequence. Choose the intended RNA chain before linking.":"No RNA-like chain is available for 2D/3D mapping.";
    }else if(isCuratedDefaultPair()){
      if(chain.residues.length===sequence.length){
        enabled=true;level="verified";
        message="Linked: the default Secondary example and PDB 1EHZ use the curated 76-residue tRNA mapping.";
      }else{
        message="The default 1EHZ RNA chain length does not match the default Secondary sequence.";
      }
    }else{
      const cmp=compareChain(chain,sequence);
      if(!cmp.lengthMatch){
        message="Not linked: Secondary has "+sequence.length+" residues but 3D chain "+(chain.id||"(blank)")+" has "+chain.residues.length+".";
      }else if(cmp.mismatches.length){
        const shown=cmp.mismatches.slice(0,6).map(i=>(i+1)+":"+sequence[i]+"≠"+chain.residues[i].base).join(", ");
        message="Not linked: residue identities disagree at "+cmp.mismatches.length+" position"+(cmp.mismatches.length===1?"":"s")+" ("+shown+(cmp.mismatches.length>6?", …":"")+").";
      }else if(!state.sameMoleculeConfirmed){
        level="pending";
        message=cmp.unknown
          ?"Sequence length matches and all recognizable residues agree; "+cmp.unknown+" modified/unrecognized residue"+(cmp.unknown===1?"":"s")+" remain. Confirm that the 2D and 3D inputs describe the same molecule to enable linking."
          :"Sequence and length match. Confirm that the 2D and 3D inputs describe the same molecule to enable linking.";
      }else{
        enabled=true;level=cmp.unknown?"warning":"verified";
        message=cmp.unknown
          ?"Linked with caution: length matches and all recognizable residues agree; "+cmp.unknown+" modified/unrecognized residue"+(cmp.unknown===1?"":"s")+" were mapped by residue order."
          :"Linked: sequence identity and residue count match, and you confirmed that the 2D and 3D inputs describe the same molecule.";
      }
    }
    state.mapping={enabled,level,message};
    if(!enabled)state.split=false;
    const status=$("teMappingStatus");
    if(status){status.textContent=message;status.dataset.level=level;}
    const confirm=$("teSameMolecule");
    if(confirm){
      confirm.disabled=isCuratedDefaultPair();
      confirm.checked=isCuratedDefaultPair()||state.sameMoleculeConfirmed;
    }
    const pairToggle=$("teShowPairs");if(pairToggle)pairToggle.disabled=!enabled;
    const split=$("teSplit");if(split){split.disabled=!enabled;split.checked=state.split&&enabled;}
    const color=$("teColorMode");
    if(color){
      const region=color.querySelector('option[value="region"]');
      const metadata=color.querySelector('option[value="metadata"]');
      if(region)region.disabled=!enabled;
      if(metadata)metadata.disabled=!enabled||!state.heatEnabled;
      if(!enabled&&(state.colorMode==="region"||state.colorMode==="metadata"))state.colorMode="nucleotide";
      color.value=state.colorMode;
    }
    const n=enabled?sequence.length:(chain?.residues.length||0);
    state.selected=clamp(state.selected,0,Math.max(0,n-1));
    buildIndexChoices();
    return state.mapping;
  }

  function buildResidueLookup(){
    state.residueIndexByKey=new Map();
    activeResidues().forEach((r,i)=>state.residueIndexByKey.set(residueKey(r.chain,r.resi,r.icode),i));
  }

  function setupInteractions(){
    if(!viewer)return;
    viewer.setClickable({},false);
    viewer.setHoverable({},false);
    const chain=state.chains.find(c=>c.id===state.activeChain);
    if(!chain)return;
    const chainSel=chain.id?{chain:chain.id}:{};
    viewer.setClickable(chainSel,true,atom=>{
      const i=state.residueIndexByKey.get(residueKey(atom.chain,atom.resi,atom.icode));
      if(Number.isInteger(i))chooseResidue(i);
    });
    viewer.setHoverDuration(80);
    viewer.setHoverable(chainSel,true,(atom,v)=>{
      const i=state.residueIndexByKey.get(residueKey(atom.chain,atom.resi,atom.icode));
      if(!Number.isInteger(i))return;
      if(hoverLabel)v.removeLabel(hoverLabel);
      const base=baseAt(i),mate=state.mapping.enabled&&partner[i]>=0?baseAt(partner[i])+(partner[i]+1):"not mapped";
      const info=state.mapping.enabled?state.metadata[i]?.value:null;
      hoverLabel=v.addLabel(
        base+(i+1)+" · "+(state.mapping.enabled?regionFor(i):"3D residue")+" · pair "+mate+(info==null?"":" · info "+info),
        {position:atom,fontSize:13,fontColor:"#f7fbff",backgroundColor:"#08111e",backgroundOpacity:.9,
         borderColor:"#6f8798",borderThickness:1,inFront:true}
      );
      v.render();
    },(atom,v)=>{
      if(hoverLabel){v.removeLabel(hoverLabel);hoverLabel=null;v.render();}
    });
  }

  function resetModelState(){
    hoverLabel=null;initialView=null;state.measureA=null;state.measureB=null;state.selected=0;
  }

  async function setModelFromText(text,format,sourceIsDefault,fileName){
    if(!viewer)throw new Error("3D viewer is not ready.");
    resetModelState();
    viewer.removeAllModels();viewer.removeAllShapes();viewer.removeAllLabels();
    model=viewer.addModel(text,format,{keepH:false});
    if(!model||!model.selectedAtoms({}).length)throw new Error("No atoms could be parsed from this structure file.");
    state.sourceIsDefault=sourceIsDefault;state.currentFileName=fileName;state.currentFormat=format;
    state.sameMoleculeConfirmed=false;
    extractChains();chooseBestChain();populateChainSelect();buildResidueLookup();evaluateMapping();state.indexSelection=defaultIndices();buildIndexChoices();setupInteractions();
    applyStyles(false);viewer.zoomTo({},0);viewer.render();initialView=viewer.getView?viewer.getView():null;
    updateSourceCopy();
  }

  async function loadDefaultStructure(){
    setStatus("Loading all-atom PDB 1EHZ…");
    const pdb=await fetchDefaultPdb();
    await setModelFromText(pdb,"pdb",true,"PDB 1EHZ");
    setStatus("");
  }

  async function createViewer(){
    const container=$("tertiaryMolecularViewer");
    if(!container)throw new Error("Molecular viewer container missing");
    const lib=await load3Dmol();
    viewer=lib.createViewer(container,{backgroundColor:"#08111e",antialias:true});
    viewer.setViewStyle({style:"outline",color:"#02060b",width:.08});
    await loadDefaultStructure();
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
    if(!viewer||!state.showPairs||!state.mapping.enabled)return;
    const residues=activeResidues(),selectedMate=partner[state.selected];
    pairs.forEach(([a,b])=>{
      const x=residues[a]?.coord,y=residues[b]?.coord;if(!x||!y)return;
      const active=(a===state.selected&&b===selectedMate)||(b===state.selected&&a===selectedMate);
      viewer.addCylinder({start:x,end:y,radius:active?.17:.065,color:active?"#74d7b6":"#71879a",
        opacity:active?.95:.55,fromCap:1,toCap:1});
    });
  }

  function addIndices(){
    if(!viewer||!state.showIndices)return;
    const residues=activeResidues();
    state.indexSelection.forEach(i=>{
      const r=residues[i];if(!r?.coord)return;
      viewer.addLabel(String(i+1),{position:r.coord,fontSize:12,fontColor:"#e9f3f8",backgroundColor:"#08111e",
        backgroundOpacity:.65,borderColor:"#50677a",borderThickness:1,inFront:true});
    });
  }

  function nearby(i){
    if(!state.proximityEnabled)return [];
    return activeResidues().map((_,j)=>j).filter(j=>j!==i&&Math.abs(j-i)>1&&distance3D(i,j)<=state.proximityCutoff);
  }

  function addProximity(){
    if(!viewer)return;
    const residues=activeResidues(),list=nearby(state.selected);
    list.forEach(i=>{if(residues[i]?.coord)viewer.addSphere({center:residues[i].coord,radius:.65,color:"#f2c66d",opacity:.32});});
    const s=$("teProximityStatus");if(!s)return;
    if(!state.proximityEnabled){s.textContent="Highlights C4′ spatial neighbors that are not immediate sequence neighbors.";return;}
    const ordered=[...list].sort((a,b)=>distance3D(state.selected,a)-distance3D(state.selected,b));
    s.textContent=ordered.length
      ? ordered.length+" non-neighboring residues within "+state.proximityCutoff+" Å of "+baseAt(state.selected)+(state.selected+1)+": "+ordered.slice(0,8).map(i=>baseAt(i)+(i+1)).join(", ")+(ordered.length>8?"…":"")
      : "No non-neighboring residues within "+state.proximityCutoff+" Å of "+baseAt(state.selected)+(state.selected+1)+".";
  }

  function addMeasurement(){
    const s=$("teMeasureStatus");
    if(!state.measureEnabled){if(s)s.textContent="Select two residues to measure a C4′–C4′ distance.";return;}
    if(state.measureA==null){if(s)s.textContent="Measurement mode: choose the first residue.";return;}
    if(state.measureB==null){if(s)s.textContent="First residue: "+baseAt(state.measureA)+(state.measureA+1)+". Choose the second residue.";return;}
    const a=state.measureA,b=state.measureB,x=coordFor(a),y=coordFor(b),d=distance3D(a,b);
    if(!x||!y||!Number.isFinite(d))return;
    viewer.addCylinder({start:x,end:y,radius:.09,color:"#ffffff",opacity:.9,fromCap:1,toCap:1});
    viewer.addLabel(d.toFixed(1)+" Å",{position:{x:(x.x+y.x)/2,y:(x.y+y.y)/2,z:(x.z+y.z)/2},
      fontSize:13,fontColor:"#fff",backgroundColor:"#08111e",backgroundOpacity:.85,inFront:true});
    if(s)s.textContent=baseAt(a)+(a+1)+" ↔ "+baseAt(b)+(b+1)+": "+d.toFixed(2)+" Å between C4′ atoms.";
  }

  function applyStyles(renderNow=true){
    if(!viewer||!model)return;
    viewer.removeAllShapes();viewer.removeAllLabels();hoverLabel=null;
    viewer.setStyle({},{line:{color:"#425466",opacity:.18}});
    const residues=activeResidues();
    residues.forEach((r,i)=>viewer.setStyle(selectorForResidue(r),repStyle(residueColor(i))));
    if(state.mapping.enabled){
      const mate=partner[state.selected];
      if(mate>=0&&residues[mate])viewer.addStyle(selectorForResidue(residues[mate]),{stick:{radius:.25,color:"#74d7b6"},sphere:{radius:.28,color:"#74d7b6",opacity:.38}});
    }
    if(residues[state.selected])viewer.addStyle(selectorForResidue(residues[state.selected]),{stick:{radius:.34,color:"#ffffff"},sphere:{radius:.34,color:"#ffffff",opacity:.42}});
    addPairs();addIndices();addProximity();addMeasurement();
    if(renderNow)viewer.render();
  }

  function chooseResidue(index){
    state.selected=clamp(index,0,Math.max(0,activeResidues().length-1));
    if(state.measureEnabled){
      if(state.measureA==null||state.measureB!=null){state.measureA=state.selected;state.measureB=null;}
      else if(state.selected!==state.measureA)state.measureB=state.selected;
    }
    if(state.mapping.enabled){
      if(isCuratedDefaultPair())state.onSelect(state.selected);
      else if(typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.followExternal)SecondaryExplorer.followExternal(state.selected);
    }
    render();
  }

  function updateSourceCopy(){
    const source=$("teStructureSource");if(source)source.textContent=state.currentFileName+" · "+(state.activeChain==null?"no RNA chain selected":"chain "+(state.activeChain||"(blank)"));
  }

  function updateCopy(){
    const title=document.querySelector("#scene-tertiary .selected-residue-title");
    const p=document.querySelector("#scene-tertiary .selected-residue-copy");if(!p)return;
    const i=state.selected,base=baseAt(i),m=state.mapping.enabled?partner[i]:-1,info=state.mapping.enabled?state.metadata[i]?.value:null;
    if(title)title.textContent=(state.names[base]||base||"Residue")+" · "+base+(i+1);
    const pair=state.mapping.enabled?(m>=0?" Paired with "+baseAt(m)+(m+1)+".":" Unpaired in the Secondary structure."):" 2D/3D linking is not active.";
    p.textContent=(state.mapping.enabled?regionFor(i)+".":"3D residue "+(i+1)+".")+pair+(info==null?"":" Residue information: "+info+".")+" Source: "+state.currentFileName+".";
  }

  function heatLegend(){
    const box=$("teHeatLegend");if(!box)return;
    const active=state.mapping.enabled&&state.colorMode==="metadata"&&state.heatEnabled;box.hidden=!active;if(!active)return;
    const stops=PALETTES[state.heatTheme]||PALETTES.viridis;
    box.innerHTML="<strong>Residue information · "+state.heatTheme+"</strong><div class=\"te-heat-bar\"></div><p>"+state.heatRange[0]+" → "+state.heatRange[1]+" · Same scale as Secondary.</p>";
    box.querySelector(".te-heat-bar").style.background="linear-gradient(to right,"+stops.join(",")+")";
  }

  function regionLegend(){
    [$("teRegionLegend"),$("teRegionLegendStage")].filter(Boolean).forEach(box=>{
      box.hidden=!(state.mapping.enabled&&state.colorMode==="region");if(box.hidden)return;box.replaceChildren();
      const entries=state.secondaryIsDefault
        ? Object.entries(REGION_COLORS).filter(([k])=>!["Paired","Unpaired"].includes(k))
        : [["Paired",REGION_COLORS.Paired],["Unpaired",REGION_COLORS.Unpaired]];
      entries.forEach(([name,color])=>{const s=document.createElement("span"),i=document.createElement("i");i.style.background=color;s.append(i,document.createTextNode(name));box.append(s);});
    });
  }

  function miniSecondary(){
    const panel=$("tertiaryMiniPanel"),root=$("tertiaryMiniSvg");if(!panel||!root)return;
    panel.hidden=!state.split||!state.mapping.enabled;if(panel.hidden)return;root.replaceChildren();
    let pos;try{if(typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.radial)pos=SecondaryExplorer.radial(state.secondarySequence.length,partner);}catch(_){}
    if(!pos?.length)return;
    if(pos.length>1){
      const first=pos[0],last=pos[pos.length-1],dx=last.x-first.x,dy=last.y-first.y;
      if(Math.hypot(dx,dy)>1e-6){
        const angle=-Math.atan2(dy,dx),cx=(first.x+last.x)/2,cy=(first.y+last.y)/2;
        pos=pos.map(p=>{const x=p.x-cx,y=p.y-cy;return {x:cx+x*Math.cos(angle)-y*Math.sin(angle),y:cy+x*Math.sin(angle)+y*Math.cos(angle)};});
      }
    }
    const NS="http://www.w3.org/2000/svg",make=(name,attrs={})=>{const e=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;};
    const minX=Math.min(...pos.map(p=>p.x)),maxX=Math.max(...pos.map(p=>p.x)),minY=Math.min(...pos.map(p=>p.y)),maxY=Math.max(...pos.map(p=>p.y));
    const pad=34,scale=Math.min((340-2*pad)/Math.max(1,maxX-minX),(430-2*pad)/Math.max(1,maxY-minY));
    const map=pos.map(p=>({x:pad+(p.x-minX)*scale,y:pad+(p.y-minY)*scale}));
    pairs.forEach(([a,b])=>root.append(make("line",{x1:map[a].x,y1:map[a].y,x2:map[b].x,y2:map[b].y,class:"te-mini-pair"+(a===state.selected||b===state.selected?" selected":"")})));
    root.append(make("polyline",{points:map.map(p=>p.x+","+p.y).join(" "),class:"te-mini-backbone"}));
    map.forEach((p,i)=>{
      const g=make("g",{class:"te-mini-node"+(i===state.selected?" selected":"")+(partner[state.selected]===i?" paired-selected":""),
        transform:"translate("+p.x+" "+p.y+")",tabindex:"0",role:"button","aria-label":state.secondarySequence[i]+(i+1)});
      g.append(make("circle",{r:i===state.selected?7:4.5,fill:residueColor(i)}));
      g.addEventListener("click",()=>chooseResidue(i));g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();chooseResidue(i);}});
      root.append(g);
    });
  }

  function buildIndexChoices(){
    const box=$("teIndexChoices");if(!box)return;box.replaceChildren();
    const n=state.mapping.enabled?state.secondarySequence.length:activeResidues().length;
    for(let i=0;i<n;i++){
      const label=document.createElement("label"),input=document.createElement("input");input.type="checkbox";input.checked=state.indexSelection.has(i);
      input.addEventListener("change",()=>{input.checked?state.indexSelection.add(i):state.indexSelection.delete(i);render();});
      label.append(input,document.createTextNode(baseAt(i)+(i+1)));box.append(label);
    }
  }

  function updateControls(){
    evaluateMapping();
    const focusDetails=$("teFocusDetails");
    if(focusDetails)focusDetails.hidden=!state.secondaryIsDefault||!state.mapping.enabled;
    updateSourceCopy();
  }

  function render(selected){
    if(selected!==undefined)state.selected=clamp(selected,0,Math.max(0,(state.mapping.enabled?state.secondarySequence.length:activeResidues().length)-1));
    miniSecondary();heatLegend();regionLegend();updateCopy();updateControls();
    const scene=$("scene-tertiary");if(!scene||scene.hidden)return;
    ensureViewer().then(()=>applyStyles()).catch(()=>{});
  }

  function resetView(){if(!viewer)return;if(initialView&&viewer.setView)viewer.setView(initialView);else viewer.zoomTo({},400);viewer.render();}
  function centerSelected(){const r=activeResidues()[state.selected];if(viewer&&r){viewer.zoomTo(selectorForResidue(r),450);viewer.render();}}
  function focus(indices){
    if(!viewer||!indices.length)return;
    const sels=indices.map(i=>activeResidues()[i]).filter(Boolean);
    if(!sels.length)return;
    const chain=state.activeChain,resi=sels.map(r=>r.resi);
    viewer.zoomTo(chain?{chain,resi}:{resi},450);viewer.render();
  }

  async function exportPng(){
    const button=$("teDownload"),status=$("teExportStatus");if(!viewer||!button||!status)return;
    button.disabled=true;status.textContent="Rendering PNG…";
    const viewport=$("tertiaryViewport"),view=viewer.getView?viewer.getView():null;
    const baseW=Math.max(1,Math.round(viewport.clientWidth||720)),baseH=Math.max(1,Math.round(viewport.clientHeight||560));
    const scale=Math.min(state.exportScale,4096/baseW,4096/baseH,Math.sqrt(16000000/(baseW*baseH)));
    const width=Math.max(1,Math.round(baseW*scale)),height=Math.max(1,Math.round(baseH*scale));
    try{
      viewer.setWidth(width);viewer.setHeight(height);if(view)viewer.setView(view);viewer.render();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const uri=viewer.pngURI(),link=document.createElement("a");
      link.href=uri;link.download="rna-tertiary-"+(state.currentFileName.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"structure")+".png";
      document.body.append(link);link.click();link.remove();
      status.textContent="PNG downloaded ("+width+" × "+height+").";
    }catch(error){status.textContent="Export failed: "+error.message;}
    finally{
      viewer.setWidth(baseW);viewer.setHeight(baseH);if(view)viewer.setView(view);viewer.render();button.disabled=false;
    }
  }

  async function handleStructureUpload(file){
    if(!file)return;
    if(file.size>25*1024*1024)throw new Error("3D structure file must be smaller than 25 MB.");
    const name=file.name||"uploaded structure";
    const lower=name.toLowerCase();
    const format=lower.endsWith(".cif")||lower.endsWith(".mmcif")?"cif":lower.endsWith(".pdb")||lower.endsWith(".ent")?"pdb":null;
    if(!format)throw new Error("Upload a PDB (.pdb/.ent) or mmCIF (.cif/.mmcif) file.");
    const text=await file.text();
    if(!text.trim())throw new Error("The uploaded structure file is empty.");
    await ensureViewer();
    await setModelFromText(text,format,false,name);
    viewer.zoomTo({},250);viewer.render();initialView=viewer.getView?viewer.getView():null;
  }

  function setupControls(){
    const box=$("tertiaryControls");if(!box)return;
    box.innerHTML=
      '<div class="te-controls">'+
      '<details open><summary>3D structure &amp; 2D/3D mapping</summary>'+
      '<p id="teStructureSource">PDB 1EHZ</p>'+
      '<label>Upload 3D structure<input id="teStructureFile" type="file" accept=".pdb,.ent,.cif,.mmcif,chemical/x-pdb,chemical/x-cif"></label>'+
      '<button type="button" id="teRestoreStructure">Restore example 1EHZ</button>'+
      '<label>RNA chain<select id="teChainSelect"></select></label>'+
      '<label class="te-check"><input id="teSameMolecule" type="checkbox"> I confirm that the Secondary and 3D inputs describe the same RNA molecule</label>'+
      '<p id="teMappingStatus" class="te-mapping-status" role="status"></p></details>'+
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
      '<label class="te-check"><input id="teSplit" type="checkbox"> 2D + 3D linked view</label></details>'+
      '<details id="teFocusDetails"><summary>Focus on structural region</summary><div class="te-button-row te-region-buttons">'+
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
    $("teSplit").addEventListener("change",e=>{state.split=e.target.checked&&state.mapping.enabled;render();});
    $("teSameMolecule").addEventListener("change",e=>{state.sameMoleculeConfirmed=e.target.checked;evaluateMapping();render();});
    $("teChainSelect").addEventListener("change",e=>{state.activeChain=e.target.value;state.chainNeedsChoice=false;state.sameMoleculeConfirmed=false;buildResidueLookup();evaluateMapping();state.indexSelection=defaultIndices();buildIndexChoices();setupInteractions();render();});
    $("teStructureFile").addEventListener("change",async e=>{
      const file=e.target.files[0];if(!file)return;
      setStatus("Loading "+file.name+"…");
      try{await handleStructureUpload(file);setStatus("");}
      catch(error){setStatus("Upload failed: "+error.message,"error");}
    });
    $("teRestoreStructure").addEventListener("click",async()=>{
      $("teStructureFile").value="";setStatus("Restoring PDB 1EHZ…");
      try{await ensureViewer();await loadDefaultStructure();render();}
      catch(error){setStatus("Restore failed: "+error.message,"error");}
    });
    $("teIndexDefault").addEventListener("click",()=>{state.indexSelection=defaultIndices();buildIndexChoices();render();});
    $("teIndexAll").addEventListener("click",()=>{const n=state.mapping.enabled?state.secondarySequence.length:activeResidues().length;state.indexSelection=new Set(Array.from({length:n},(_,i)=>i));buildIndexChoices();render();});
    $("teIndexNone").addEventListener("click",()=>{state.indexSelection.clear();buildIndexChoices();render();});
    box.querySelectorAll("[data-te-region]").forEach(b=>b.addEventListener("click",()=>{
      const r=b.dataset.teRegion;if(r==="full")resetView();else if(r==="elbow")focus([...regionIndices("D arm"),...regionIndices("T arm")]);else focus(regionIndices(r));
    }));
  }

  function setupToolbar(){
    const toolbar=document.querySelector("#scene-tertiary .te-toolbar");if(!toolbar)return;
    toolbar.insertAdjacentHTML("beforeend",'<label class="te-resolution-control">Export resolution <input id="teExportScale" type="range" min="1" max="4" step=".5" value="2"><output id="teExportScaleValue">2×</output></label><button id="teDownload" type="button">Download PNG</button>');
    const status=document.createElement("p");status.id="teExportStatus";status.className="te-export-status";status.setAttribute("role","status");toolbar.insertAdjacentElement("afterend",status);
    $("teExportScale").addEventListener("input",e=>{state.exportScale=Number(e.target.value);$("teExportScaleValue").textContent=state.exportScale+"×";});
    $("teDownload").addEventListener("click",exportPng);
    $("teZoomIn")?.addEventListener("click",()=>{if(viewer){viewer.zoom(1.25,250);viewer.render();}});
    $("teZoomOut")?.addEventListener("click",()=>{if(viewer){viewer.zoom(.8,250);viewer.render();}});
    $("teResetView")?.addEventListener("click",resetView);$("teCenterSelected")?.addEventListener("click",centerSelected);
  }

  function applyMetadata(detail){
    if(!detail||detail.sequence!==state.secondarySequence){
      state.metadata={};state.heatEnabled=false;if(state.colorMode==="metadata")state.colorMode="nucleotide";render();return;
    }
    state.metadata=detail.metadata||{};state.heatEnabled=Boolean(detail.heatEnabled)&&Object.keys(state.metadata).length>0;
    state.heatTheme=detail.heatTheme||"viridis";state.heatRange=Array.isArray(detail.heatRange)?detail.heatRange:[0,1];
    if(!state.heatEnabled&&state.colorMode==="metadata")state.colorMode="nucleotide";render();
  }

  function handleSecondaryContext(detail){
    if(!detail)return;
    const changed=detail.sequence!==state.secondarySequence||detail.structure!==state.structure;
    state.secondarySequence=detail.sequence;state.structure=detail.structure;state.secondaryIsDefault=Boolean(detail.isDefault);
    const parsed=parseStructure(state.structure,state.secondarySequence.length);pairs=parsed.pairs;partner=parsed.partner;
    if(changed&&!isCuratedDefaultPair()){state.sameMoleculeConfirmed=false;state.metadata={};state.heatEnabled=false;}
    evaluateMapping();
    if(changed){state.indexSelection=defaultIndices();buildIndexChoices();}
    render();
  }

  function setup(config){
    if(setupDone)return;setupDone=true;
    state.defaultSequence=config.sequence;state.defaultStructure=config.structure;
    state.secondarySequence=config.sequence;state.structure=config.structure;state.colors=config.colors;state.names=config.names;state.onSelect=config.onSelect;
    const parsed=parseStructure(state.structure,state.secondarySequence.length);pairs=parsed.pairs;partner=parsed.partner;
    setupControls();setupToolbar();
    $("followButton")?.addEventListener("click",()=>{const n=activeResidues().length;if(n<2)return;let next=state.selected;while(next===state.selected)next=Math.floor(Math.random()*n);chooseResidue(next);});
    window.addEventListener("rna-metadata-change",e=>applyMetadata(e.detail));
    window.addEventListener("rna-secondary-context",e=>handleSecondaryContext(e.detail));
    window.addEventListener("rna-secondary-select",e=>{if(state.mapping.enabled&&e.detail?.sequence===state.secondarySequence){state.selected=clamp(e.detail.index,0,state.secondarySequence.length-1);render();}});
    render();
  }

  return {setup,render,compareChain,normalizeBase};
})();