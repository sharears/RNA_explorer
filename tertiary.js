const TertiaryExplorer = (() => {
  const PALETTES = {
    viridis:["#440154","#3b528b","#21918c","#5ec962","#fde725"],
    magma:["#000004","#51127c","#b73779","#fc8961","#fcfdbf"],
    blueRed:["#2166ac","#92c5de","#f7f7f7","#f4a582","#b2182b"],
    cividis:["#00224e","#434e6c","#7d7c78","#bcae6c","#fee838"]
  };
  const CHAIN_COLORS=["#74d7b6","#e8bb69","#87a9cc","#d9808e","#a78bfa","#f0a36f","#7fd3e8","#d6a3e8"];
  const REGION_COLORS={
    "Acceptor stem":"#74d7b6","D arm":"#d9808e","Anticodon arm":"#e8bb69",
    "Variable region":"#87a9cc","T arm":"#a78bfa","3′ CCA end":"#f0a36f",
    "Connector":"#8fa2b3","Paired":"#74d7b6","Unpaired":"#e8bb69"
  };
  const SOURCES=[
    "https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js",
    "https://3Dmol.org/build/3Dmol-min.js"
  ];
  const PDB_URL="https://files.rcsb.org/download/1EHZ.pdb";
  const MOD_BASES={
    A:"A",ADE:"A",RA:"A","1MA":"A","M1A":"A","6MA":"A","RIA":"A",
    C:"C",CYT:"C",RC:"C","5MC":"C","OMC":"C","M5C":"C",
    G:"G",GUA:"G",RG:"G","1MG":"G","M1G":"G","2MG":"G","M2G":"G","7MG":"G","M7G":"G","OMG":"G","YG":"G","YYG":"G",
    U:"U",URA:"U",RU:"U","PSU":"U","H2U":"U","5MU":"U","4SU":"U","T":"U"
  };
  const WATER=new Set(["HOH","WAT","H2O","DOD"]);
  const IONS=new Set(["NA","K","MG","CA","ZN","CL","MN","FE","CO","CU","NI","SR","CS","BA","CD","HG","PB","BR","IOD","F"]);
  const AMINO=new Set(["ALA","ARG","ASN","ASP","CYS","GLN","GLU","GLY","HIS","ILE","LEU","LYS","MET","PHE","PRO","SER","THR","TRP","TYR","VAL","SEC","PYL"]);
  const BACKBONE_ATOMS=["P","OP1","OP2","O1P","O2P","O5'","O5*","C5'","C5*","C4'","C4*","C3'","C3*","O3'","O3*"];
  const HBOND_CHEM={
    A:{donors:new Set(["N6"]),acceptors:new Set(["N1","N3","N7"])},
    G:{donors:new Set(["N1","N2"]),acceptors:new Set(["O6","N3","N7"])},
    C:{donors:new Set(["N4"]),acceptors:new Set(["N3","O2"])},
    U:{donors:new Set(["N3"]),acceptors:new Set(["O2","O4"])}
  };

  const state={
    defaultSequence:"",defaultStructure:"",secondarySequence:"",structure:"",
    colors:{},names:{},onSelect:()=>{},selected:0,
    representation:"sticks",colorMode:"nucleotide",showPairs:true,showIndices:true,showSelectedLabel:true,
    indexSelection:new Set(),metadata:{},heatEnabled:false,heatTheme:"viridis",heatRange:[0,1],
    secondaryIsDefault:true,sourceIsDefault:true,sameMoleculeConfirmed:false,
    proximityEnabled:false,proximityCutoff:12,contactEnabled:false,contactCutoff:4.0,
    measurementMode:"off",measurementPicks:[],measurements:[],measurementSerial:1,
    split:false,exportScale:2,currentFileName:"PDB 1EHZ",currentFormat:"pdb",
    chains:[],activeChain:null,chainNeedsChoice:false,residueIndexByKey:new Map(),
    mapping:{enabled:false,level:"pending",message:""},
    surfaceEnabled:false,surfaceOpacity:0.35,uniformColor:"#74d7b6",backgroundColor:"#07111c",orthographic:false,
    visibility:{rna:true,protein:true,solvent:false,ions:true,other:true,hydrogen:false},
    selectionIndices:new Set(),selectionLabels:false,
    selectionStyle:{color:"#f2c66d",radius:.24,opacity:.28},
    selectedPairs:new Set(),hbondStyles:{},hbondCutoff:3.5,
    savedObjects:[],objectSerial:1,isolateObjectId:null,
    savedViews:[],viewSerial:1,
    comparison:{model:null,name:"",rmsd:null,count:0,visible:true,status:""},
    clipEnabled:false,clipNear:-40,clipFar:40,
    secondaryLayoutPositions:null
  };

  let viewer=null,model=null,viewerPromise=null,initialView=null,hoverLabel=null;
  let pairs=[],partner=[],setupDone=false,surfaceToken=0,resizeTicket=0;
  function scheduleViewerResize(preserveView=true){
    if(!viewer)return;
    const ticket=++resizeTicket,view=preserveView&&viewer.getView?viewer.getView():null;
    const run=()=>{if(ticket!==resizeTicket||!viewer)return;try{viewer.resize?.();if(view&&viewer.setView)viewer.setView(view);viewer.render();}catch(error){console.warn("Tertiary viewer resize:",error);}};
    if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>requestAnimationFrame(run));else setTimeout(run,0);
  }

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
  function normalizeElement(atom){
    const e=String(atom?.elem||"").trim().toUpperCase();
    if(e)return e;
    const name=String(atom?.atom||"").replace(/[^A-Za-z]/g,"").toUpperCase();
    return name.slice(0,name.startsWith("CL")||name.startsWith("BR")?2:1);
  }
  function parseStructure(structure,n){
    const stack=[],ps=[],pt=Array(n).fill(-1);
    [...structure].forEach((c,i)=>{
      if(c==="(")stack.push(i);
      else if(c===")"){const a=stack.pop();if(a===undefined)return;ps.push([a,i]);pt[a]=i;pt[i]=a;}
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
  function coordFor(i){return activeResidues()[i]?.coord||null;}
  function distance3D(a,b){
    const x=coordFor(a),y=coordFor(b);if(!x||!y)return NaN;
    return Math.hypot(x.x-y.x,x.y-y.y,x.z-y.z);
  }
  function baseAt(i){
    if(state.mapping.enabled&&state.secondarySequence[i])return state.secondarySequence[i];
    return activeResidues()[i]?.base||"?";
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
  function chainColor(chainId){
    const ids=state.chains.map(c=>c.id);
    const idx=Math.max(0,ids.indexOf(chainId));
    return CHAIN_COLORS[idx%CHAIN_COLORS.length];
  }
  function residueColor(i,r){
    if(state.colorMode==="uniform")return state.uniformColor;
    if(state.colorMode==="region"&&state.mapping.enabled)return REGION_COLORS[regionFor(i)]||"#8fa2b3";
    if(state.colorMode==="metadata"&&state.mapping.enabled&&state.heatEnabled&&state.metadata[i]?.value!=null)return heatColor(state.metadata[i].value);
    if(state.colorMode==="chain")return chainColor(r?.chain||state.activeChain);
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
      const scripts=document.scripts?[...document.scripts]:[];const existing=scripts.find(s=>s.src===src);
      if(existing){
        if(window.$3Dmol)return resolve();
        existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return;
      }
      const script=document.createElement("script");script.src=src;script.async=true;script.crossOrigin="anonymous";
      script.onload=resolve;script.onerror=()=>reject(new Error("Could not load "+src));document.head.append(script);
    });
  }
  async function load3Dmol(){
    if(window.$3Dmol)return window.$3Dmol;
    let error=null;
    for(const src of SOURCES){try{await loadScript(src);if(window.$3Dmol)return window.$3Dmol;}catch(e){error=e;}}
    throw error||new Error("3Dmol.js failed to load");
  }
  async function fetchDefaultPdb(){
    const r=await fetch(PDB_URL,{mode:"cors",cache:"force-cache"});
    if(!r.ok)throw new Error("PDB download failed: "+r.status);
    return r.text();
  }

  function residuesFromAtoms(atoms){
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
      if(["C4'","C4*","C1'","C1*","O4'","O4*"].includes(atomName))r.hasSugar=true;
      if(atomName==="P")r.hasP=true;
      r.sum.x+=Number(atom.x)||0;r.sum.y+=Number(atom.y)||0;r.sum.z+=Number(atom.z)||0;r.sum.n++;
      const rank=(atomName==="C4'"||atomName==="C4*")?4:atomName==="P"?3:(atomName==="C1'"||atomName==="C1*")?2:0;
      if(rank>r.coordRank){r.coord={x:Number(atom.x),y:Number(atom.y),z:Number(atom.z)};r.coordRank=rank;}
    });
    return [...residues.values()].sort((a,b)=>a.first-b.first).map(r=>{
      if(!r.coord&&r.sum.n)r.coord={x:r.sum.x/r.sum.n,y:r.sum.y/r.sum.n,z:r.sum.z/r.sum.n};
      return r;
    });
  }
  function rnaChainsFromAtoms(atoms){
    const byChain=new Map();
    residuesFromAtoms(atoms).forEach(r=>{
      if(r.base==="?"&&!r.hasSugar)return;
      if(!byChain.has(r.chain))byChain.set(r.chain,[]);
      byChain.get(r.chain).push(r);
    });
    return [...byChain.entries()].map(([id,list])=>({
      id,residues:list,sequence:list.map(r=>r.base).join(""),recognized:list.filter(r=>r.base!=="?").length
    })).filter(c=>c.residues.length);
  }
  function extractChains(){state.chains=rnaChainsFromAtoms(model?.selectedAtoms?model.selectedAtoms({}):[]);}
  function compareChain(chain,sequence){
    if(!chain)return {lengthMatch:false,mismatches:[],unknown:0,exact:false};
    const lengthMatch=chain.residues.length===sequence.length,mismatches=[];
    const n=Math.min(chain.residues.length,sequence.length);let unknown=0;
    for(let i=0;i<n;i++){const base=chain.residues[i].base;if(base==="?"){unknown++;continue;}if(base!==sequence[i])mismatches.push(i);}
    return {lengthMatch,mismatches,unknown,exact:lengthMatch&&mismatches.length===0&&unknown===0};
  }
  function chooseBestChain(){
    const sequence=state.secondarySequence;if(!state.chains.length){state.activeChain=null;return;}
    state.chainNeedsChoice=false;
    if(state.sourceIsDefault){const a=state.chains.find(c=>c.id==="A");state.activeChain=(a||state.chains[0]).id;return;}
    const scored=state.chains.map(chain=>{
      const cmp=compareChain(chain,sequence);
      return {chain,score:Math.abs(chain.residues.length-sequence.length)*1000+cmp.mismatches.length*100+cmp.unknown};
    }).sort((a,b)=>a.score-b.score);
    if(scored.length>1&&scored[0].score===scored[1].score){state.activeChain=null;state.chainNeedsChoice=true;}
    else state.activeChain=scored[0].chain.id;
  }
  function populateChainSelect(){
    const select=$("teChainSelect");if(!select)return;select.replaceChildren();
    if(state.chainNeedsChoice)select.append(new Option("Choose an RNA chain…",""));
    state.chains.forEach(chain=>{
      select.append(new Option((chain.id||"(blank)")+" · "+chain.residues.length+" RNA-like residues · "+chain.recognized+" recognized",chain.id));
    });
    select.value=state.activeChain??"";select.disabled=state.chains.length<=1;
  }
  function isCuratedDefaultPair(){return state.secondaryIsDefault&&state.sourceIsDefault;}
  function evaluateMapping(){
    const chain=state.chains.find(c=>c.id===state.activeChain),sequence=state.secondarySequence;
    let level="error",message="",enabled=false;
    if(!chain){
      message=state.chainNeedsChoice?"Multiple RNA chains are equally compatible with the Secondary sequence. Choose the intended RNA chain before linking.":"No RNA-like chain is available for 2D/3D mapping.";
    }else if(isCuratedDefaultPair()){
      if(chain.residues.length===sequence.length){enabled=true;level="verified";message="Linked: the default Secondary example and PDB 1EHZ use the curated 76-residue tRNA mapping.";}
      else message="The default 1EHZ RNA chain length does not match the default Secondary sequence.";
    }else{
      const cmp=compareChain(chain,sequence);
      if(!cmp.lengthMatch)message="Not linked: Secondary has "+sequence.length+" residues but 3D chain "+(chain.id||"(blank)")+" has "+chain.residues.length+".";
      else if(cmp.mismatches.length){
        const shown=cmp.mismatches.slice(0,6).map(i=>(i+1)+":"+sequence[i]+"≠"+chain.residues[i].base).join(", ");
        message="Not linked: residue identities disagree at "+cmp.mismatches.length+" position"+(cmp.mismatches.length===1?"":"s")+" ("+shown+(cmp.mismatches.length>6?", …":"")+").";
      }else if(!state.sameMoleculeConfirmed){
        level="pending";
        message=cmp.unknown?"Sequence length matches and all recognizable residues agree; "+cmp.unknown+" modified/unrecognized residues remain. Confirm the same molecule to enable linking.":"Sequence and length match. Confirm that the 2D and 3D inputs describe the same molecule to enable linking.";
      }else{
        enabled=true;level=cmp.unknown?"warning":"verified";
        message=cmp.unknown?"Linked with caution: recognizable residues agree; modified/unrecognized residues were mapped by residue order.":"Linked: sequence identity and residue count match, and you confirmed that the 2D and 3D inputs describe the same molecule.";
      }
    }
    state.mapping={enabled,level,message};if(!enabled)state.split=false;
    const status=$("teMappingStatus");if(status){status.textContent=message;status.dataset.level=level;}
    const confirm=$("teSameMolecule");if(confirm){confirm.disabled=isCuratedDefaultPair();confirm.checked=isCuratedDefaultPair()||state.sameMoleculeConfirmed;}
    const pairToggle=$("teShowPairs");if(pairToggle)pairToggle.disabled=!enabled;
    const split=$("teSplit");if(split){split.disabled=!enabled;split.checked=state.split&&enabled;}
    const color=$("teColorMode");
    if(color){
      const region=color.querySelector('option[value="region"]'),metadata=color.querySelector('option[value="metadata"]');
      if(region)region.disabled=!enabled;if(metadata)metadata.disabled=!enabled||!state.heatEnabled;
      if(!enabled&&(state.colorMode==="region"||state.colorMode==="metadata"))state.colorMode="nucleotide";
      color.value=state.colorMode;
    }
    const n=enabled?sequence.length:(chain?.residues.length||0);
    state.selected=clamp(state.selected,0,Math.max(0,n-1));buildIndexChoices();renderSequencePanel();return state.mapping;
  }
  function buildResidueLookup(){
    state.residueIndexByKey=new Map();
    activeResidues().forEach((r,i)=>state.residueIndexByKey.set(residueKey(r.chain,r.resi,r.icode),i));
  }

  function setupInteractions(){
    if(!viewer)return;viewer.setClickable({},false);viewer.setHoverable({},false);
    const chain=state.chains.find(c=>c.id===state.activeChain);if(!chain)return;
    const chainSel=chain.id?{chain:chain.id}:{};
    viewer.setClickable(chainSel,true,atom=>{
      const i=state.residueIndexByKey.get(residueKey(atom.chain,atom.resi,atom.icode));
      if(Number.isInteger(i))state.selected=i;
      if(state.measurementMode!=="off"){handleAtomMeasurementClick(atom);return;}
      if(Number.isInteger(i))chooseResidue(i);
    });
    viewer.setHoverDuration(80);
    viewer.setHoverable(chainSel,true,(atom,v)=>{
      const i=state.residueIndexByKey.get(residueKey(atom.chain,atom.resi,atom.icode));if(!Number.isInteger(i))return;
      if(hoverLabel)v.removeLabel(hoverLabel);
      const base=baseAt(i),mate=state.mapping.enabled&&partner[i]>=0?baseAt(partner[i])+(partner[i]+1):"not mapped";
      const info=state.mapping.enabled?state.metadata[i]?.value:null;
      hoverLabel=v.addLabel(base+(i+1)+" · "+(state.mapping.enabled?regionFor(i):"3D residue")+" · pair "+mate+(info==null?"":" · info "+info),
        {position:atom,fontSize:13,fontColor:"#f7fbff",backgroundColor:"#08111e",backgroundOpacity:.9,borderColor:"#6f8798",borderThickness:1,inFront:true});
      v.render();
    },(_,v)=>{if(hoverLabel){v.removeLabel(hoverLabel);hoverLabel=null;v.render();}});
  }
  function resetModelState(){
    hoverLabel=null;initialView=null;state.selected=0;state.measurementPicks=[];state.measurements=[];state.measurementMode="off";
    state.selectionIndices.clear();state.selectedPairs.clear();state.hbondStyles={};state.savedObjects=[];state.isolateObjectId=null;state.savedViews=[];clearComparison(false);
  }
  async function setModelFromText(text,format,sourceIsDefault,fileName){
    if(!viewer)throw new Error("3D viewer is not ready.");
    resetModelState();viewer.removeAllModels();viewer.removeAllShapes();viewer.removeAllLabels();if(viewer.removeAllSurfaces)viewer.removeAllSurfaces();
    model=viewer.addModel(text,format,{keepH:true});
    if(!model||!model.selectedAtoms({}).length)throw new Error("No atoms could be parsed from this structure file.");
    state.sourceIsDefault=sourceIsDefault;state.currentFileName=fileName;state.currentFormat=format;state.sameMoleculeConfirmed=false;
    extractChains();chooseBestChain();populateChainSelect();buildResidueLookup();evaluateMapping();
    state.indexSelection=defaultIndices();buildIndexChoices();setupInteractions();renderSequencePanel();renderObjectList();renderSavedViews();
    try{applyStyles(false);}catch(error){console.warn("Initial 3D styling:",error);}
    viewer.zoomTo({},0);viewer.render();scheduleViewerResize(false);initialView=viewer.getView?viewer.getView():null;updateSourceCopy();setStatus("");
  }
  async function loadDefaultStructure(){
    setStatus("Loading all-atom PDB 1EHZ…");const pdb=await fetchDefaultPdb();await setModelFromText(pdb,"pdb",true,"PDB 1EHZ");setStatus("");
  }
  async function createViewer(){
    const container=$("tertiaryMolecularViewer");if(!container)throw new Error("Molecular viewer container missing");
    const lib=await load3Dmol();
    viewer=lib.createViewer(container,{backgroundColor:state.backgroundColor||"#08111e",antialias:true});
    try{viewer.setViewStyle?.({style:"outline",color:"#02060b",width:.08});}catch(_){}
    try{await loadDefaultStructure();}
    catch(error){
      console.error("Default 3D structure:",error);
      setStatus("The 3D viewer loaded, but the default 1EHZ structure could not be loaded: "+error.message,"error");
    }
    scheduleViewerResize(false);return viewer;
  }
  function ensureViewer(){
    if(viewer)return Promise.resolve(viewer);
    if(!viewerPromise) viewerPromise=createViewer().catch(error=>{
      viewerPromise=null;viewer=null;
      const message=/3dmol|script|load/i.test(String(error?.message||""))
        ?"The 3Dmol viewer library could not be loaded. Check the network connection and reload the page."
        :"The molecular viewer could not initialize: "+(error?.message||"unknown error");
      setStatus(message,"error");console.error("Tertiary viewer:",error);throw error;
    });
    return viewerPromise;
  }

  function styleFor(color,elementMode=false){
    const colorSpec=elementMode?{colorscheme:"Jmol"}:{color};
    if(state.representation==="ballstick")return {stick:{radius:.12,...colorSpec},sphere:{radius:.24,...colorSpec}};
    if(state.representation==="wire")return {line:{linewidth:2,...colorSpec}};
    if(state.representation==="spheres")return {sphere:{scale:.34,...colorSpec}};
    if(state.representation==="cartoon")return {cartoon:{...colorSpec,thickness:.4}};
    return {stick:{radius:.14,...colorSpec}};
  }
  function applyResidueRepresentation(r,i){
    const elementMode=state.colorMode==="element",color=residueColor(i,r),sel=selectorForResidue(r);
    if(state.representation==="backbone"){
      const b={...sel,atom:BACKBONE_ATOMS};
      model.setStyle(b,{stick:{radius:.14,...(elementMode?{colorscheme:"Jmol"}:{color})}});
    }else model.setStyle(sel,styleFor(color,elementMode));
  }
  function isVisibleIndex(i){
    if(state.isolateObjectId==null)return true;
    const object=state.savedObjects.find(o=>o.id===state.isolateObjectId);
    return object?object.indices.has(i):true;
  }
  function applyCategoryStyles(){
    const atoms=model?.selectedAtoms?model.selectedAtoms({}):[];if(!atoms.length)return;
    const activeKeys=new Set(activeResidues().map(r=>residueKey(r.chain,r.resi,r.icode)));
    const protein=[],water=[],ions=[],other=[];
    atoms.forEach(a=>{
      const resn=String(a.resn||"").toUpperCase(),key=residueKey(a.chain,a.resi,a.icode);
      if(activeKeys.has(key))return;
      if(WATER.has(resn))water.push(a.serial);
      else if(IONS.has(resn))ions.push(a.serial);
      else if(AMINO.has(resn))protein.push(a.serial);
      else other.push(a.serial);
    });
    if(state.visibility.protein&&protein.length)model.setStyle({serial:protein},{cartoon:{color:"#8092a2",opacity:.72}});
    if(state.visibility.solvent&&water.length)model.setStyle({serial:water},{sphere:{radius:.16,color:"#8fc7e8",opacity:.5}});
    if(state.visibility.ions&&ions.length)model.setStyle({serial:ions},{sphere:{radius:.42,colorscheme:"Jmol"}});
    if(state.visibility.other&&other.length)model.setStyle({serial:other},{stick:{radius:.1,colorscheme:"Jmol",opacity:.75}});
    if(!state.visibility.hydrogen)model.setStyle({elem:"H"},{});
  }
  function pairStyleFor(key){
    state.hbondStyles[key]??={...defaultLineStyle(),bonds:{}};
    return state.hbondStyles[key];
  }
  function renderPairHbondPanel(){
    const box=$("tePairHbondPanel");if(!box)return;box.replaceChildren();
    if(!state.selectedPairs.size){box.textContent="Select a base pair in the linked 2D view to inspect its 3D hydrogen bonds.";return;}
    [...state.selectedPairs].forEach(key=>{
      const [a,b]=key.split(":").map(Number),hits=pairHydrogenBonds(a,b),style=pairStyleFor(key);
      const card=document.createElement("div");card.className="te-hbond-card";
      const title=document.createElement("strong");title.textContent=baseAt(a)+(a+1)+" — "+baseAt(b)+(b+1);
      const note=document.createElement("p");note.className="te-tool-note";
      note.textContent=hits.length?hits.length+" donor–acceptor contact"+(hits.length===1?"":"s")+" ≤ "+state.hbondCutoff.toFixed(1)+" Å.":"No donor–acceptor hydrogen bond meets the current "+state.hbondCutoff.toFixed(1)+" Å threshold.";
      const group=document.createElement("div");group.className="te-hbond-group-style";
      group.innerHTML='<label>Line<select data-hb-group="lineStyle"><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="solid">Solid</option></select></label><label>Thickness<input data-hb-group="radius" type="range" min="0.02" max="0.2" step="0.01"></label><label>Opacity<input data-hb-group="opacity" type="range" min="0.05" max="1" step="0.05"></label><label>Color<input data-hb-group="color" type="color"></label>';
      group.querySelector('[data-hb-group="lineStyle"]').value=style.lineStyle;group.querySelector('[data-hb-group="radius"]').value=style.radius;group.querySelector('[data-hb-group="opacity"]').value=style.opacity;group.querySelector('[data-hb-group="color"]').value=style.color;
      group.querySelectorAll("[data-hb-group]").forEach(input=>input.addEventListener("input",()=>{
        const k=input.dataset.hbGroup;style[k]=input.type==="range"?Number(input.value):input.value;render();
      }));
      card.append(title,note,group);
      hits.forEach((hit,idx)=>{
        const bs=style.bonds[hit.key]??={visible:true};
        const row=document.createElement("div");row.className="te-hbond-row";
        const toggle=document.createElement("input");toggle.type="checkbox";toggle.checked=bs.visible!==false;toggle.setAttribute("aria-label","Show hydrogen bond "+(idx+1));
        toggle.addEventListener("change",()=>{bs.visible=toggle.checked;style.bonds[hit.key]=bs;render();});
        const label=document.createElement("span");label.textContent=atomName(hit.a)+" ↔ "+atomName(hit.b)+" · "+hit.d.toFixed(2)+" Å";
        const individual=document.createElement("button");individual.type="button";individual.textContent="Style";individual.addEventListener("click",()=>{
          const color=prompt("Hydrogen-bond color",bs.color||style.color);if(color&&/^#[0-9a-f]{6}$/i.test(color))bs.color=color;
          const line=prompt("Line style: solid, dashed, or dotted",bs.lineStyle||style.lineStyle);if(["solid","dashed","dotted"].includes(line))bs.lineStyle=line;
          const thick=Number(prompt("Thickness",String(bs.radius||style.radius)));if(Number.isFinite(thick))bs.radius=clamp(thick,.02,.2);
          const op=Number(prompt("Opacity 0–1",String(bs.opacity??style.opacity)));if(Number.isFinite(op))bs.opacity=clamp(op,.05,1);
          style.bonds[hit.key]=bs;render();
        });
        row.append(toggle,label,individual);card.append(row);
      });
      box.append(card);
    });
  }
  function addSelectedPairHbonds(){
    if(!viewer||!state.mapping.enabled||!state.showPairs){renderPairHbondPanel();return;}
    [...state.selectedPairs].forEach(key=>{
      const [a,b]=key.split(":").map(Number);if(!isVisibleIndex(a)||!isVisibleIndex(b))return;
      const pairStyle=pairStyleFor(key),hits=pairHydrogenBonds(a,b);
      hits.forEach(hit=>{
        const local={...pairStyle,...(pairStyle.bonds[hit.key]||{})};
        if(local.visible===false)return;
        addStyledLine(hit.a,hit.b,local);
        if(local.labelVisible){
          viewer.addLabel(hit.d.toFixed(2)+" Å",{position:{x:(hit.a.x+hit.b.x)/2,y:(hit.a.y+hit.b.y)/2,z:(hit.a.z+hit.b.z)/2},fontSize:11,fontColor:"#fff",backgroundColor:"#08111e",backgroundOpacity:.8,inFront:true});
        }
      });
    });
    renderPairHbondPanel();
  }
  function addIndices(){
    if(!viewer||!state.showIndices)return;
    const residues=activeResidues();
    state.indexSelection.forEach(i=>{
      if(!isVisibleIndex(i))return;const r=residues[i];if(!r?.coord)return;
      viewer.addLabel(String(i+1),{position:r.coord,fontSize:12,fontColor:"#e9f3f8",backgroundColor:"#08111e",backgroundOpacity:.65,borderColor:"#50677a",borderThickness:1,inFront:true});
    });
  }
  function addSelectedLabel(){
    if(!state.showSelectedLabel)return;
    const r=activeResidues()[state.selected];if(!r?.coord||!isVisibleIndex(state.selected))return;
    viewer.addLabel(baseAt(state.selected)+(state.selected+1)+(r.chain?" · "+r.chain:""),{position:r.coord,fontSize:13,fontColor:"#07111c",backgroundColor:"#ffffff",backgroundOpacity:.92,borderColor:"#d7e2e8",borderThickness:1,inFront:true});
  }
  function nearby(i){
    if(!state.proximityEnabled)return [];
    return activeResidues().map((_,j)=>j).filter(j=>j!==i&&Math.abs(j-i)>1&&distance3D(i,j)<=state.proximityCutoff);
  }
  function addProximity(){
    if(!viewer)return;
    const residues=activeResidues(),list=nearby(state.selected);
    list.forEach(i=>{if(residues[i]?.coord&&isVisibleIndex(i))viewer.addSphere({center:residues[i].coord,radius:.65,color:"#f2c66d",opacity:.32});});
    const s=$("teProximityStatus");if(!s)return;
    if(!state.proximityEnabled){s.textContent="Highlights C4′ spatial neighbors that are not immediate sequence neighbors.";return;}
    const ordered=[...list].sort((a,b)=>distance3D(state.selected,a)-distance3D(state.selected,b));
    s.textContent=ordered.length?ordered.length+" non-neighboring residues within "+state.proximityCutoff+" Å of "+baseAt(state.selected)+(state.selected+1)+": "+ordered.slice(0,8).map(i=>baseAt(i)+(i+1)).join(", ")+(ordered.length>8?"…":""):"No non-neighboring residues within "+state.proximityCutoff+" Å of "+baseAt(state.selected)+(state.selected+1)+".";
  }
  function addContacts(){
    const status=$("teContactStatus");if(!status)return;
    if(!state.contactEnabled){status.textContent="Shows close atom contacts; N/O pairs ≤3.5 Å are flagged as possible hydrogen-bond contacts.";return;}
    const r=activeResidues()[state.selected];if(!r){status.textContent="Select an RNA residue first.";return;}
    const all=model.selectedAtoms({}),own=new Set(r.atoms),contacts=[];
    r.atoms.forEach(a=>all.forEach(b=>{
      if(own.has(b))return;
      const dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z,d=Math.hypot(dx,dy,dz);
      if(d<=state.contactCutoff&&d>0.4){
        const ea=normalizeElement(a),eb=normalizeElement(b),hbond=(ea==="N"||ea==="O")&&(eb==="N"||eb==="O")&&d<=3.5;
        contacts.push({a,b,d,hbond});
      }
    }));
    contacts.sort((x,y)=>x.d-y.d);
    const unique=[],seen=new Set();
    contacts.forEach(c=>{const k=[c.a.serial,c.b.serial].sort().join("|");if(!seen.has(k)){seen.add(k);unique.push(c);}});
    unique.slice(0,40).forEach(c=>viewer.addCylinder({start:c.a,end:c.b,radius:c.hbond?.055:.035,color:c.hbond?"#74d7b6":"#f2c66d",opacity:c.hbond?.9:.48,fromCap:1,toCap:1,dashed:true}));
    const hb=unique.filter(c=>c.hbond).length;
    status.textContent=unique.length+" atom contacts within "+state.contactCutoff+" Å; "+hb+" N/O pairs meet the simple ≤3.5 Å possible H-bond screen.";
    const list=$("teContactList");if(list){list.replaceChildren();unique.slice(0,20).forEach(c=>{const row=document.createElement("div");row.textContent=atomLabel(c.a)+" ↔ "+atomLabel(c.b)+" · "+c.d.toFixed(2)+" Å"+(c.hbond?" · possible H-bond":"");list.append(row);});if(unique.length>20){const more=document.createElement("div");more.textContent="… "+(unique.length-20)+" more contacts";list.append(more);}}
  }

  function atomSnapshot(atom){return {x:Number(atom.x),y:Number(atom.y),z:Number(atom.z),atom:String(atom.atom||"atom"),resn:String(atom.resn||""),resi:atom.resi,chain:String(atom.chain||""),icode:String(atom.icode||"")};}
  function atomLabel(a){return a.atom+" · "+(a.resn||"res")+" "+String(a.resi??"")+(a.chain?" · chain "+a.chain:"");}
  const vsub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const vdot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const vcross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const vnorm=a=>Math.hypot(a.x,a.y,a.z);
  function atomDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
  function atomName(a){return String(a?.atom||"").trim().toUpperCase().replace(/\*/g,"'");}
  function pairKey(a,b){return Math.min(a,b)+":"+Math.max(a,b);}
  function bondKey(a,b){return String(a.serial??atomName(a))+"|"+String(b.serial??atomName(b));}
  function pairHydrogenBonds(a,b){
    const ra=activeResidues()[a],rb=activeResidues()[b];if(!ra||!rb)return [];
    const ca=HBOND_CHEM[baseAt(a)],cb=HBOND_CHEM[baseAt(b)];if(!ca||!cb)return [];
    const hits=[],seen=new Set();
    const scan=(donorResidue,donorChem,acceptorResidue,acceptorChem)=>{
      donorResidue.atoms.filter(x=>donorChem.donors.has(atomName(x))).forEach(d=>{
        acceptorResidue.atoms.filter(x=>acceptorChem.acceptors.has(atomName(x))).forEach(acc=>{
          const dist=atomDistance(d,acc);
          if(dist>=2.2&&dist<=state.hbondCutoff){
            const k=bondKey(d,acc);if(!seen.has(k)){seen.add(k);hits.push({key:k,a:d,b:acc,d:dist});}
          }
        });
      });
    };
    scan(ra,ca,rb,cb);scan(rb,cb,ra,ca);return hits.sort((x,y)=>x.d-y.d);
  }
  function defaultLineStyle(){return {visible:true,lineStyle:"dashed",radius:.055,color:"#74d7b6",opacity:.92,labelVisible:false};}
  function addStyledLine(start,end,style){
    if(!viewer||style?.visible===false)return;
    const st={...defaultLineStyle(),...(style||{})},radius=Math.max(.012,Number(st.radius)||.055),opacity=clamp(Number(st.opacity),0,1);
    if(st.lineStyle==="solid"){viewer.addCylinder({start,end,radius,color:st.color,opacity,fromCap:1,toCap:1});return;}
    const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z,len=Math.hypot(dx,dy,dz)||1;
    const segments=st.lineStyle==="dotted"?Math.max(3,Math.ceil(len/.42)):Math.max(4,Math.ceil(len/.55));
    for(let i=0;i<segments;i++){
      if(st.lineStyle==="dotted"){
        const t=(i+.5)/segments;viewer.addSphere({center:{x:start.x+dx*t,y:start.y+dy*t,z:start.z+dz*t},radius:radius*1.25,color:st.color,opacity});
      }else if(i%2===0){
        const t1=i/segments,t2=Math.min(1,(i+.72)/segments);
        viewer.addCylinder({start:{x:start.x+dx*t1,y:start.y+dy*t1,z:start.z+dz*t1},end:{x:start.x+dx*t2,y:start.y+dy*t2,z:start.z+dz*t2},radius,color:st.color,opacity,fromCap:1,toCap:1});
      }
    }
  }
  function atomAngle(a,b,c){const u=vsub(a,b),v=vsub(c,b),den=vnorm(u)*vnorm(v);if(!den)return NaN;return Math.acos(clamp(vdot(u,v)/den,-1,1))*180/Math.PI;}
  function atomDihedral(a,b,c,d){
    const b0=vsub(b,a),b1=vsub(c,b),b2=vsub(d,c),n1=vcross(b0,b1),n2=vcross(b1,b2),b1n=vnorm(b1);
    if(!vnorm(n1)||!vnorm(n2)||!b1n)return NaN;
    const ub1={x:b1.x/b1n,y:b1.y/b1n,z:b1.z/b1n},m1=vcross(n1,ub1);
    return Math.atan2(vdot(m1,n2),vdot(n1,n2))*180/Math.PI;
  }
  function measurementValue(type,p){if(type==="distance")return atomDistance(p[0],p[1]);if(type==="angle")return atomAngle(p[0],p[1],p[2]);if(type==="dihedral")return atomDihedral(p[0],p[1],p[2],p[3]);return NaN;}
  function measurementUnit(type){return type==="distance"?"Å":"°";}
  function requiredPicks(type){return type==="distance"?2:type==="angle"?3:type==="dihedral"?4:0;}
  function handleAtomMeasurementClick(atom){
    const type=state.measurementMode,required=requiredPicks(type);if(!required)return;
    state.measurementPicks.push(atomSnapshot(atom));
    if(state.measurementPicks.length>=required){
      const points=state.measurementPicks.slice(0,required),value=measurementValue(type,points);
      if(Number.isFinite(value))state.measurements.push({id:state.measurementSerial++,type,points,value,style:{visible:true,lineStyle:"solid",radius:.07,color:"#ffffff",opacity:.82,labelVisible:true}});
      state.measurementPicks=[];
    }
    render();
  }
  function measurementCentroid(points){return points.reduce((o,p)=>({x:o.x+p.x/points.length,y:o.y+p.y/points.length,z:o.z+p.z/points.length}),{x:0,y:0,z:0});}
  function renderMeasurementList(){
    const box=$("teMeasurementList");if(!box)return;box.replaceChildren();
    if(!state.measurements.length){box.textContent="No saved measurements.";return;}
    state.measurements.forEach(m=>{
      m.style??={visible:true,lineStyle:"solid",radius:.07,color:"#ffffff",opacity:.82,labelVisible:true};
      const row=document.createElement("div");row.className="te-measurement-row";
      const head=document.createElement("div");head.className="te-measurement-head";
      const visible=document.createElement("input");visible.type="checkbox";visible.checked=m.style.visible!==false;visible.setAttribute("aria-label","Show measurement");
      visible.addEventListener("change",()=>{m.style.visible=visible.checked;render();});
      const label=document.createElement("span");label.textContent=m.type[0].toUpperCase()+m.type.slice(1)+" "+m.value.toFixed(2)+" "+measurementUnit(m.type);
      const del=document.createElement("button");del.type="button";del.textContent="Delete";del.addEventListener("click",()=>{state.measurements=state.measurements.filter(x=>x.id!==m.id);render();});
      head.append(visible,label,del);
      const style=document.createElement("div");style.className="te-measurement-style";
      style.innerHTML='<label>Line<select data-ms="lineStyle"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label><label>Thickness<input data-ms="radius" type="range" min="0.02" max="0.2" step="0.01"></label><label>Opacity<input data-ms="opacity" type="range" min="0.05" max="1" step="0.05"></label><label>Color<input data-ms="color" type="color"></label><label class="te-check"><input data-ms="labelVisible" type="checkbox"> Label</label>';
      style.querySelector('[data-ms="lineStyle"]').value=m.style.lineStyle;style.querySelector('[data-ms="radius"]').value=m.style.radius;style.querySelector('[data-ms="opacity"]').value=m.style.opacity;style.querySelector('[data-ms="color"]').value=m.style.color;style.querySelector('[data-ms="labelVisible"]').checked=m.style.labelVisible!==false;
      style.querySelectorAll("[data-ms]").forEach(input=>input.addEventListener("input",()=>{
        const k=input.dataset.ms;m.style[k]=input.type==="range"?Number(input.value):input.type==="checkbox"?input.checked:input.value;render();
      }));
      const atoms=document.createElement("small");atoms.textContent=m.points.map(atomLabel).join(" → ");
      row.append(head,style,atoms);box.append(row);
    });
  }
  function addMeasurements(){
    const status=$("teMeasureStatus"),type=state.measurementMode,required=requiredPicks(type);
    state.measurements.forEach(m=>{
      m.style??={visible:true,lineStyle:"solid",radius:.07,color:"#ffffff",opacity:.82,labelVisible:true};
      if(m.style.visible===false)return;
      m.points.forEach(p=>viewer.addSphere({center:p,radius:.22,color:m.style.color,opacity:clamp(m.style.opacity,0,1)}));
      for(let i=0;i<m.points.length-1;i++)addStyledLine(m.points[i],m.points[i+1],m.style);
      if(m.style.labelVisible!==false){
        const c=measurementCentroid(m.points);viewer.addLabel(m.value.toFixed(2)+" "+measurementUnit(m.type),{position:c,fontSize:13,fontColor:"#fff",backgroundColor:"#08111e",backgroundOpacity:.88,borderColor:m.style.color,borderThickness:1,inFront:true});
      }
    });
    state.measurementPicks.forEach(p=>viewer.addSphere({center:p,radius:.3,color:"#f2c66d",opacity:.75}));
    renderMeasurementList();if(!status)return;
    if(type==="off"){status.textContent="Choose distance, angle, or dihedral, then click atoms in the 3D structure.";return;}
    const left=required-state.measurementPicks.length;
    status.textContent=state.measurementPicks.length?type[0].toUpperCase()+type.slice(1)+": "+state.measurementPicks.length+" atoms selected · choose "+left+" more.":type[0].toUpperCase()+type.slice(1)+" mode: choose "+required+" atoms.";
  }

  function addSelectionHighlights(){
    const residues=activeResidues();
    state.selectionIndices.forEach(i=>{
      if(!isVisibleIndex(i)||!residues[i])return;
      const st=state.selectionStyle;
      model.addStyle(selectorForResidue(residues[i]),{stick:{radius:st.radius,color:st.color,opacity:st.opacity},sphere:{radius:st.radius*1.18,color:st.color,opacity:Math.min(.45,st.opacity)}});
      if(state.selectionLabels&&residues[i].coord)viewer.addLabel(baseAt(i)+(i+1),{position:residues[i].coord,fontSize:11,fontColor:"#07111c",backgroundColor:"#f2c66d",backgroundOpacity:.9,inFront:true});
    });
  }
  function addObjectHighlights(){
    const residues=activeResidues();
    state.savedObjects.filter(o=>o.visible&&state.isolateObjectId==null).forEach((o,oi)=>{
      o.style??={color:CHAIN_COLORS[(oi+2)%CHAIN_COLORS.length],radius:.2,opacity:.22};
      const st=o.style;
      o.indices.forEach(i=>{if(residues[i])model.addStyle(selectorForResidue(residues[i]),{stick:{radius:st.radius,color:st.color,opacity:st.opacity},sphere:{radius:st.radius*1.2,color:st.color,opacity:Math.min(.4,st.opacity)}});});
    });
  }
  function updateSurface(){
    if(!viewer)return;
    if(viewer.removeAllSurfaces)viewer.removeAllSurfaces();
    if(!state.surfaceEnabled||!state.visibility.rna)return;
    const token=++surfaceToken,chain=state.chains.find(c=>c.id===state.activeChain);if(!chain)return;
    const sel=chain.id?{chain:chain.id}:{};
    try{
      const result=viewer.addSurface(window.$3Dmol?.SurfaceType?.VDW??1,{opacity:state.surfaceOpacity,color:"#8fa2b3"},sel,sel);
      if(result&&typeof result.then==="function")result.then(()=>{if(token===surfaceToken)viewer.render();}).catch(()=>{});
    }catch(_){}
  }
  function applyClipping(){
    if(!viewer||typeof viewer.setSlab!=="function")return;
    try{if(state.clipEnabled)viewer.setSlab(state.clipNear,state.clipFar);else viewer.setSlab(-999,999);}catch(error){console.warn("3D clipping:",error);}
  }
  function applyStyles(renderNow=true){
    if(!viewer||!model)return;
    const safe=(label,fn)=>{try{fn();}catch(error){console.warn("3D "+label+":",error);}};
    safe("shape cleanup",()=>viewer.removeAllShapes());safe("label cleanup",()=>viewer.removeAllLabels());hoverLabel=null;
    safe("base style reset",()=>model.setStyle({},{}));
    if(state.comparison.model)safe("comparison reset",()=>state.comparison.model.setStyle({},{}));
    const residues=activeResidues();
    if(state.visibility.rna)residues.forEach((r,i)=>{if(isVisibleIndex(i))safe("residue style "+(i+1),()=>applyResidueRepresentation(r,i));});
    safe("component styles",applyCategoryStyles);
    if(state.comparison.model&&state.comparison.visible)safe("comparison style",()=>state.comparison.model.setStyle({},{line:{linewidth:2,color:"#f0a36f",opacity:.8}}));
    if(residues[state.selected]&&isVisibleIndex(state.selected))safe("selected highlight",()=>model.addStyle(selectorForResidue(residues[state.selected]),{stick:{radius:.34,color:"#ffffff"},sphere:{radius:.34,color:"#ffffff",opacity:.42}}));
    safe("selection highlights",addSelectionHighlights);safe("object highlights",addObjectHighlights);safe("selected pair hydrogen bonds",addSelectedPairHbonds);
    safe("indices",addIndices);safe("selected label",addSelectedLabel);safe("proximity",addProximity);safe("contacts",addContacts);
    safe("measurements",addMeasurements);safe("surface",updateSurface);safe("clipping",applyClipping);
    if(renderNow)safe("render",()=>viewer.render());
  }

  function chooseResidue(index,syncSecondary=true){
    state.selected=clamp(index,0,Math.max(0,activeResidues().length-1));
    if(state.selectionIndices.has(state.selected))state.selectionIndices.delete(state.selected);else state.selectionIndices.add(state.selected);
    if(state.mapping.enabled&&syncSecondary){
      if(typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.toggleExternalResidue)SecondaryExplorer.toggleExternalResidue(state.selected);
      else if(isCuratedDefaultPair())state.onSelect(state.selected);
    }
    render();
  }
  function togglePairSelection3D(a,b,syncSecondary=true){
    const key=pairKey(a,b),on=!state.selectedPairs.has(key);
    if(on){state.selectedPairs.add(key);state.selectionIndices.add(a);state.selectionIndices.add(b);}else state.selectedPairs.delete(key);
    state.selected=a;
    if(state.mapping.enabled&&syncSecondary&&typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.toggleExternalPair)SecondaryExplorer.toggleExternalPair(a,b);
    render();
  }
  function applySecondarySelection(detail){
    if(!detail||detail.sequence!==state.secondarySequence||detail.structure!==state.structure)return;
    state.selectionIndices=new Set((detail.selectedResidues||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<activeResidues().length));
    state.selectedPairs=new Set((detail.selectedPairs||[]).map(p=>pairKey(Number(p[0]),Number(p[1]))));
    if(Number.isInteger(detail.index))state.selected=clamp(detail.index,0,Math.max(0,activeResidues().length-1));
    render();
  }
  function updateSourceCopy(){
    const source=$("teStructureSource");if(source)source.textContent=state.currentFileName+" · "+(state.activeChain==null?"no RNA chain selected":"chain "+(state.activeChain||"(blank)"));
  }
  function updateCopy(){
    const title=document.querySelector("#scene-tertiary .selected-residue-title"),p=document.querySelector("#scene-tertiary .selected-residue-copy");if(!p)return;
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
      const entries=state.secondaryIsDefault?Object.entries(REGION_COLORS).filter(([k])=>!["Paired","Unpaired"].includes(k)):[["Paired",REGION_COLORS.Paired],["Unpaired",REGION_COLORS.Unpaired]];
      entries.forEach(([name,color])=>{const s=document.createElement("span"),i=document.createElement("i");i.style.background=color;s.append(i,document.createTextNode(name));box.append(s);});
    });
  }
  function miniSecondary(){
    const panel=$("tertiaryMiniPanel"),root=$("tertiaryMiniSvg");if(!panel||!root)return;
    panel.hidden=!state.split||!state.mapping.enabled;
    const shell=$("tertiarySplitShell");if(shell)shell.classList.toggle("linked",!panel.hidden);
    if(panel.hidden){scheduleViewerResize(true);return;}
    root.replaceChildren();
    const source=$("secondarySvg");
    let context=null;try{context=typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.getContext?SecondaryExplorer.getContext():null;}catch(_){}
    if(source&&source.children.length&&context?.sequence===state.secondarySequence&&context?.structure===state.structure){
      const vb=source.dataset.fullViewBox||source.getAttribute("viewBox");if(vb)root.setAttribute("viewBox",vb);
      [...source.children].forEach(child=>root.append(child.cloneNode(true)));
      root.querySelectorAll("[data-export-remove]").forEach(el=>el.remove());
      root.querySelectorAll("[tabindex]").forEach(el=>el.removeAttribute("tabindex"));
      root.querySelectorAll("[data-residue-index]").forEach(node=>{
        const i=Number(node.getAttribute("data-residue-index"));node.style.cursor="pointer";
        node.addEventListener("click",()=>chooseResidue(i));
      });
      scheduleViewerResize(true);return;
    }
    let pos=Array.isArray(state.secondaryLayoutPositions)&&state.secondaryLayoutPositions.length===state.secondarySequence.length
      ?state.secondaryLayoutPositions.map(p=>({x:Number(p.x),y:Number(p.y)})):null;
    try{
      if(!pos?.length&&typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.getCurrentPositions)pos=SecondaryExplorer.getCurrentPositions();
      if(!pos?.length&&typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.radial){
        pos=SecondaryExplorer.radial(state.secondarySequence.length,partner);
        if(SecondaryExplorer.orientEndsBottom)pos=SecondaryExplorer.orientEndsBottom(pos);
      }
    }catch(_){}
    if(!pos?.length){scheduleViewerResize(true);return;}
    const NS="http://www.w3.org/2000/svg",make=(name,attrs={})=>{const e=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;};
    const minX=Math.min(...pos.map(p=>p.x)),maxX=Math.max(...pos.map(p=>p.x)),minY=Math.min(...pos.map(p=>p.y)),maxY=Math.max(...pos.map(p=>p.y));
    const pad=34,scale=Math.min((340-2*pad)/Math.max(1,maxX-minX),(430-2*pad)/Math.max(1,maxY-minY));
    const map=pos.map(p=>({x:pad+(p.x-minX)*scale,y:pad+(p.y-minY)*scale}));root.setAttribute("viewBox","0 0 340 430");
    pairs.forEach(([a,b])=>root.append(make("line",{x1:map[a].x,y1:map[a].y,x2:map[b].x,y2:map[b].y,class:"te-mini-pair"+(a===state.selected||b===state.selected?" selected":"")})));
    root.append(make("polyline",{points:map.map(p=>p.x+","+p.y).join(" "),class:"te-mini-backbone"}));
    map.forEach((p,i)=>{
      const g=make("g",{class:"te-mini-node"+(i===state.selected?" selected":"")+(partner[state.selected]===i?" paired-selected":""),transform:"translate("+p.x+" "+p.y+")",role:"button","data-residue-index":i,"aria-label":state.secondarySequence[i]+(i+1)});
      g.append(make("circle",{r:11,fill:residueColor(i,activeResidues()[i]),stroke:"#d5e2e9","stroke-width":1}));
      const label=make("text",{x:0,y:1,fill:"#07111c","font-size":10,"font-family":"monospace","text-anchor":"middle","dominant-baseline":"central"});label.textContent=state.secondarySequence[i];g.append(label);
      g.addEventListener("click",()=>chooseResidue(i));root.append(g);
    });
    scheduleViewerResize(true);
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
  function renderSequencePanel(){
    const box=$("teSequencePanel");if(!box)return;box.replaceChildren();
    activeResidues().forEach((r,i)=>{
      const b=document.createElement("button");b.type="button";b.className="te-seq-residue"+(i===state.selected?" active":"")+(state.selectionIndices.has(i)?" chosen":"");
      b.textContent=baseAt(i)+(i+1);b.title=(r.resn||baseAt(i))+(r.chain?" · chain "+r.chain:"");b.addEventListener("click",()=>chooseResidue(i));box.append(b);
    });
  }
  function renderObjectList(){
    const box=$("teObjectList");if(!box)return;box.replaceChildren();
    if(!state.savedObjects.length){box.textContent="No saved objects.";return;}
    state.savedObjects.forEach(o=>{
      const row=document.createElement("div");row.className="te-object-row";
      const name=document.createElement("input");name.value=o.name;name.setAttribute("aria-label","Object name");
      name.addEventListener("change",()=>{o.name=name.value.trim()||o.name;});
      const show=document.createElement("button");show.type="button";show.textContent=o.visible?"Hide":"Show";show.addEventListener("click",()=>{o.visible=!o.visible;renderObjectList();refreshExportObjectOptions();render();});
      const isolate=document.createElement("button");isolate.type="button";isolate.textContent=state.isolateObjectId===o.id?"Show all":"Isolate";isolate.addEventListener("click",()=>{state.isolateObjectId=state.isolateObjectId===o.id?null:o.id;renderObjectList();refreshExportObjectOptions();render();});
      const pdb=document.createElement("button");pdb.type="button";pdb.textContent="PDB";pdb.addEventListener("click",()=>downloadStructure("pdb",o.indices,o.name));
      const cif=document.createElement("button");cif.type="button";cif.textContent="mmCIF";cif.addEventListener("click",()=>downloadStructure("cif",o.indices,o.name));
      const del=document.createElement("button");del.type="button";del.textContent="Delete";del.addEventListener("click",()=>{state.savedObjects=state.savedObjects.filter(x=>x.id!==o.id);if(state.isolateObjectId===o.id)state.isolateObjectId=null;renderObjectList();refreshExportObjectOptions();render();});
      row.append(name,show,isolate,pdb,cif,del);box.append(row);
    });
  }
  function renderSavedViews(){
    const box=$("teSavedViews");if(!box)return;box.replaceChildren();
    if(!state.savedViews.length){box.textContent="No saved views.";return;}
    state.savedViews.forEach(v=>{
      const row=document.createElement("div");row.className="te-view-row";
      const label=document.createElement("span");label.textContent=v.name;
      const restore=document.createElement("button");restore.type="button";restore.textContent="Restore";restore.addEventListener("click",()=>{if(viewer?.setView){viewer.setView(v.view);viewer.render();}});
      const del=document.createElement("button");del.type="button";del.textContent="Delete";del.addEventListener("click",()=>{state.savedViews=state.savedViews.filter(x=>x.id!==v.id);renderSavedViews();});
      row.append(label,restore,del);box.append(row);
    });
  }
  function updateControls(){
    evaluateMapping();const focusDetails=$("teFocusDetails");if(focusDetails)focusDetails.hidden=!state.secondaryIsDefault||!state.mapping.enabled;updateSourceCopy();
  }
  function render(selected){
    if(selected!==undefined)state.selected=clamp(selected,0,Math.max(0,(state.mapping.enabled?state.secondarySequence.length:activeResidues().length)-1));
    miniSecondary();heatLegend();regionLegend();updateCopy();updateControls();renderSequencePanel();renderObjectList();renderSavedViews();
    const scene=$("scene-tertiary");if(!scene||scene.hidden)return;
    ensureViewer().then(()=>{scheduleViewerResize(true);applyStyles();}).catch(error=>console.error("Tertiary render:",error));
  }

  function resetView(){if(!viewer)return;if(initialView&&viewer.setView)viewer.setView(initialView);else viewer.zoomTo({},400);viewer.render();}
  function centerSelected(){const r=activeResidues()[state.selected];if(viewer&&r){viewer.zoomTo(selectorForResidue(r),450);viewer.render();}}
  function focus(indices){
    if(!viewer||!indices.length)return;const sels=indices.map(i=>activeResidues()[i]).filter(Boolean);if(!sels.length)return;
    const chain=state.activeChain,resi=sels.map(r=>r.resi);viewer.zoomTo(chain?{chain,resi}:{resi},450);viewer.render();
  }
  function focusSelection(){focus([...state.selectionIndices]);}
  function saveView(){
    if(!viewer?.getView)return;const name=prompt("Name this view","View "+state.viewSerial);if(name===null)return;
    state.savedViews.push({id:state.viewSerial,name:name.trim()||("View "+state.viewSerial),view:viewer.getView().slice()});state.viewSerial++;renderSavedViews();
  }

  function indicesFromRange(start,end){
    const n=activeResidues().length,a=clamp(Math.floor(Number(start)||1),1,n),b=clamp(Math.floor(Number(end)||a),1,n),lo=Math.min(a,b),hi=Math.max(a,b);
    return new Set(Array.from({length:hi-lo+1},(_,k)=>lo-1+k));
  }
  function selectRange(){state.selectionIndices=indicesFromRange($("teSelectStart")?.value,$("teSelectEnd")?.value);render();}
  function selectBase(){
    const base=$("teSelectBase")?.value||"A";state.selectionIndices=new Set(activeResidues().map((_,i)=>i).filter(i=>baseAt(i)===base));render();
  }
  function selectNearby(){
    const cutoff=clamp(Number($("teSelectNearCutoff")?.value)||5,1,30),center=state.selected;
    state.selectionIndices=new Set(activeResidues().map((_,i)=>i).filter(i=>i===center||distance3D(center,i)<=cutoff));render();
  }
  function addCurrentToSelection(){state.selectionIndices.add(state.selected);render();}
  function subtractCurrentFromSelection(){state.selectionIndices.delete(state.selected);render();}
  function invertSelection(){const all=new Set(activeResidues().map((_,i)=>i));state.selectionIndices=new Set([...all].filter(i=>!state.selectionIndices.has(i)));render();}
  function selectActiveChain(){state.selectionIndices=new Set(activeResidues().map((_,i)=>i));render();}
  function createObject(){
    const indices=state.selectionIndices.size?new Set(state.selectionIndices):new Set([state.selected]);
    const name=prompt("Object name","object_"+state.objectSerial);if(name===null)return;
    state.savedObjects.push({id:state.objectSerial,name:name.trim()||("object_"+state.objectSerial),indices,visible:true,style:{color:CHAIN_COLORS[(state.objectSerial+1)%CHAIN_COLORS.length],radius:.2,opacity:.22}});state.objectSerial++;renderObjectList();refreshExportObjectOptions();render();
  }

  function atomLinePdb(atom,serial){
    const rec=atom.hetflag?"HETATM":"ATOM  ",name=String(atom.atom||atom.elem||"X").slice(0,4).padStart(4),resn=String(atom.resn||"UNK").slice(0,3).padStart(3);
    const chain=String(atom.chain||" ").slice(0,1),resi=String(atom.resi??1).slice(-4).padStart(4),icode=String(atom.icode||" ").slice(0,1);
    const x=Number(atom.x||0).toFixed(3).padStart(8),y=Number(atom.y||0).toFixed(3).padStart(8),z=Number(atom.z||0).toFixed(3).padStart(8);
    const occ=Number(atom.occupancy??atom.occ??1).toFixed(2).padStart(6),b=Number(atom.b??atom.bfactor??0).toFixed(2).padStart(6),elem=normalizeElement(atom).padStart(2);
    return rec+String(serial).padStart(5)+" "+name+" "+resn+" "+chain+resi+icode+"   "+x+y+z+occ+b+"          "+elem;
  }
  function serializePdb(atoms){return atoms.map((a,i)=>atomLinePdb(a,i+1)).join("\n")+"\nEND\n";}
  function cifToken(value){const s=String(value??"?");return /\s|['"]/.test(s)?"'"+s.replace(/'/g,"''")+"'":s||"?";}
  function serializeCif(atoms){
    const headers=["group_PDB","id","type_symbol","label_atom_id","label_comp_id","label_asym_id","label_seq_id","Cartn_x","Cartn_y","Cartn_z","occupancy","B_iso_or_equiv"];
    const lines=["data_rna_explorer","#","loop_",...headers.map(h=>"_atom_site."+h)];
    atoms.forEach((a,i)=>lines.push([
      a.hetflag?"HETATM":"ATOM",i+1,normalizeElement(a)||"?",cifToken(a.atom||"?"),cifToken(a.resn||"UNK"),cifToken(a.chain||"A"),a.resi??i+1,
      Number(a.x||0).toFixed(3),Number(a.y||0).toFixed(3),Number(a.z||0).toFixed(3),Number(a.occupancy??a.occ??1).toFixed(2),Number(a.b??a.bfactor??0).toFixed(2)
    ].join(" ")));
    lines.push("#");return lines.join("\n")+"\n";
  }
  function atomsForIndices(indices){
    const residues=activeResidues();return [...indices].sort((a,b)=>a-b).flatMap(i=>residues[i]?.atoms||[]);
  }
  function downloadText(text,name,type){
    const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadStructure(format,indices=null,label="structure"){
    if(!model)return;const atoms=indices?atomsForIndices(indices):model.selectedAtoms({});
    if(!atoms.length){setStatus("Nothing is selected for structure export.","error");return;}
    const safe=String(label||"structure").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"structure";
    if(format==="cif")downloadText(serializeCif(atoms),safe+".cif","chemical/x-cif");
    else downloadText(serializePdb(atoms),safe+".pdb","chemical/x-pdb");
    setStatus("Exported "+atoms.length+" atoms as "+(format==="cif"?"mmCIF":"PDB")+".");
  }

  async function exportPng(){
    const button=$("teDownload"),status=$("teExportStatus");if(!viewer||!button||!status)return;
    button.disabled=true;status.textContent="Rendering PNG…";
    const viewport=$("tertiaryViewport"),view=viewer.getView?viewer.getView():null;
    const baseW=Math.max(1,Math.round(viewport.clientWidth||720)),baseH=Math.max(1,Math.round(viewport.clientHeight||560));
    const scale=Math.min(state.exportScale,4096/baseW,4096/baseH,Math.sqrt(16000000/(baseW*baseH))),width=Math.max(1,Math.round(baseW*scale)),height=Math.max(1,Math.round(baseH*scale));
    try{
      viewer.setWidth(width);viewer.setHeight(height);if(view)viewer.setView(view);viewer.render();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const uri=viewer.pngURI(),link=document.createElement("a");link.href=uri;link.download="rna-tertiary-"+(state.currentFileName.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"structure")+".png";
      document.body.append(link);link.click();link.remove();status.textContent="PNG downloaded ("+width+" × "+height+").";
    }catch(error){status.textContent="Export failed: "+error.message;}
    finally{viewer.setWidth(baseW);viewer.setHeight(baseH);if(view)viewer.setView(view);viewer.render();button.disabled=false;}
  }

  function centroid(points){return points.reduce((c,p)=>({x:c.x+p.x/points.length,y:c.y+p.y/points.length,z:c.z+p.z/points.length}),{x:0,y:0,z:0});}
  function hornFit(moving,reference){
    if(moving.length!==reference.length||moving.length<3)throw new Error("At least three matched points are required.");
    const cm=centroid(moving),cr=centroid(reference);let Sxx=0,Sxy=0,Sxz=0,Syx=0,Syy=0,Syz=0,Szx=0,Szy=0,Szz=0;
    for(let i=0;i<moving.length;i++){
      const q={x:moving[i].x-cm.x,y:moving[i].y-cm.y,z:moving[i].z-cm.z},p={x:reference[i].x-cr.x,y:reference[i].y-cr.y,z:reference[i].z-cr.z};
      Sxx+=q.x*p.x;Sxy+=q.x*p.y;Sxz+=q.x*p.z;Syx+=q.y*p.x;Syy+=q.y*p.y;Syz+=q.y*p.z;Szx+=q.z*p.x;Szy+=q.z*p.y;Szz+=q.z*p.z;
    }
    const N=[
      [Sxx+Syy+Szz,Syz-Szy,Szx-Sxz,Sxy-Syx],
      [Syz-Szy,Sxx-Syy-Szz,Sxy+Syx,Szx+Sxz],
      [Szx-Sxz,Sxy+Syx,-Sxx+Syy-Szz,Syz+Szy],
      [Sxy-Syx,Szx+Sxz,Syz+Szy,-Sxx-Syy+Szz]
    ];
    let q=[1,0,0,0];
    for(let k=0;k<40;k++){
      const nq=N.map(row=>row.reduce((s,v,j)=>s+v*q[j],0)),norm=Math.hypot(...nq)||1;q=nq.map(v=>v/norm);
    }
    const [w,x,y,z]=q,R=[
      [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
      [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
      [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]
    ];
    const transform=p=>{
      const a=[p.x-cm.x,p.y-cm.y,p.z-cm.z];
      return {x:R[0][0]*a[0]+R[0][1]*a[1]+R[0][2]*a[2]+cr.x,y:R[1][0]*a[0]+R[1][1]*a[1]+R[1][2]*a[2]+cr.y,z:R[2][0]*a[0]+R[2][1]*a[1]+R[2][2]*a[2]+cr.z};
    };
    let ss=0;moving.forEach((p,i)=>{const t=transform(p),r=reference[i];ss+=(t.x-r.x)**2+(t.y-r.y)**2+(t.z-r.z)**2;});
    return {transform,rmsd:Math.sqrt(ss/moving.length)};
  }
  function clearComparison(doRender=true){
    if(viewer&&state.comparison.model){try{viewer.removeModel(state.comparison.model);}catch(_){}}
    state.comparison={model:null,name:"",rmsd:null,count:0,visible:true,status:""};if(doRender){updateComparisonStatus();render();}
  }
  function updateComparisonStatus(){
    const s=$("teAlignmentStatus");if(!s)return;
    s.textContent=state.comparison.model?state.comparison.name+" aligned on "+state.comparison.count+" matched RNA residues · RMSD "+state.comparison.rmsd.toFixed(3)+" Å.":(state.comparison.status||"Upload a second PDB/mmCIF structure to superimpose it on the active RNA chain.");
  }
  async function alignComparison(file){
    if(!file)return;await ensureViewer();clearComparison(false);
    const lower=file.name.toLowerCase(),format=lower.endsWith(".cif")||lower.endsWith(".mmcif")?"cif":lower.endsWith(".pdb")||lower.endsWith(".ent")?"pdb":null;
    if(!format)throw new Error("Comparison structure must be PDB or mmCIF.");const text=await file.text();
    let temp=viewer.addModel(text,format,{keepH:true});if(!temp?.selectedAtoms({}).length)throw new Error("No atoms could be parsed from the comparison file.");
    const chains=rnaChainsFromAtoms(temp.selectedAtoms({})),ref=activeResidues();
    if(!chains.length||ref.length<3){viewer.removeModel(temp);throw new Error("Could not find comparable RNA residues.");}
    const cmp=chains.slice().sort((a,b)=>Math.abs(a.residues.length-ref.length)-Math.abs(b.residues.length-ref.length))[0],n=Math.min(ref.length,cmp.residues.length);
    let indices=Array.from({length:n},(_,i)=>i);
    if($("teAlignScope")?.value==="selection"){indices=[...state.selectionIndices].filter(i=>i<n).sort((a,b)=>a-b);if(indices.length<3)throw new Error("Select at least three corresponding residues for selection-based alignment.");}
    const mov=indices.map(i=>cmp.residues[i].coord),target=indices.map(i=>ref[i].coord);
    const fit=hornFit(mov,target),alignedAtoms=temp.selectedAtoms({});
    alignedAtoms.forEach(a=>{const p=fit.transform(a);a.x=p.x;a.y=p.y;a.z=p.z;});
    const alignedPdb=serializePdb(alignedAtoms);viewer.removeModel(temp);temp=viewer.addModel(alignedPdb,"pdb",{keepH:true});
    state.comparison={model:temp,name:file.name,rmsd:fit.rmsd,count:indices.length,visible:true,status:""};updateComparisonStatus();render();
  }

  async function loadFromRcsbId(rawId){
    const id=String(rawId||"").trim().toUpperCase();
    if(!/^[A-Z0-9]{4}$/.test(id))throw new Error("Enter a four-character PDB ID, for example 1EHZ.");
    const url="https://files.rcsb.org/download/"+encodeURIComponent(id)+".cif";
    let response;try{response=await fetch(url,{mode:"cors",cache:"no-store"});}catch(_){throw new Error("RCSB PDB could not be reached. Check the network connection and try again.");}
    if(response.status===404)throw new Error("PDB ID "+id+" was not found at RCSB PDB.");
    if(!response.ok)throw new Error("RCSB PDB returned HTTP "+response.status+" for "+id+".");
    const text=await response.text();if(!text.trim())throw new Error("RCSB returned an empty structure file for "+id+".");
    await ensureViewer();await setModelFromText(text,"cif",id==="1EHZ","RCSB PDB · "+id);
    if(!state.chains.length)throw new Error("Structure "+id+" loaded, but no RNA-like chain was detected.");
    scheduleViewerResize(false);return id;
  }

    async function handleStructureUpload(file){
    if(!file)return;if(file.size>25*1024*1024)throw new Error("3D structure file must be smaller than 25 MB.");
    const name=file.name||"uploaded structure",lower=name.toLowerCase(),format=lower.endsWith(".cif")||lower.endsWith(".mmcif")?"cif":lower.endsWith(".pdb")||lower.endsWith(".ent")?"pdb":null;
    if(!format)throw new Error("Upload a PDB (.pdb/.ent) or mmCIF (.cif/.mmcif) file.");
    const text=await file.text();if(!text.trim())throw new Error("The uploaded structure file is empty.");
    await ensureViewer();await setModelFromText(text,format,false,name);viewer.zoomTo({},250);viewer.render();initialView=viewer.getView?viewer.getView():null;
  }
  function ensureEnhancementStyles(){
    if(document.getElementById("teEnhancementStyles"))return;
    const style=document.createElement("style");style.id="teEnhancementStyles";style.textContent=`
      .te-sequence-panel{display:flex;flex-wrap:wrap;gap:.28rem;max-height:9rem;overflow:auto;padding:.45rem 0}
      .te-seq-residue{font:inherit;font-size:.75rem;padding:.28rem .38rem;min-width:2.3rem;border-radius:.45rem}
      .te-seq-residue.active{outline:2px solid #fff}.te-seq-residue.chosen{box-shadow:inset 0 0 0 2px #f2c66d}
      .te-object-row,.te-view-row{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;margin:.4rem 0}
      .te-object-row input{min-width:8rem;flex:1}.te-visibility-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.3rem}
      .te-inline-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem}
      .te-tool-note{font-size:.78rem;opacity:.8}.te-object-row button,.te-view-row button{padding:.35rem .5rem}
    `;document.head.append(style);
  }
  function setupControls(){
    const box=$("tertiaryControls");if(!box)return;ensureEnhancementStyles();
    box.innerHTML=
      '<div class="te-controls">'+
      '<details open><summary>Import structure &amp; 2D/3D mapping</summary>'+
      '<p id="teStructureSource">PDB 1EHZ</p>'+
      '<label>Import PDB / mmCIF<input id="teStructureFile" type="file" accept=".pdb,.ent,.cif,.mmcif,chemical/x-pdb,chemical/x-cif"></label>'+
      '<div class="te-pdb-id-row"><label>PDB ID<input id="tePdbId" type="text" inputmode="text" maxlength="4" placeholder="1EHZ" autocomplete="off"></label><button type="button" id="teLoadPdbId">Load from RCSB PDB</button></div><p class="te-tool-note" id="tePdbIdStatus">Enter a four-character PDB ID to fetch its mmCIF coordinates directly from RCSB PDB.</p>'+
      '<button type="button" id="teRestoreStructure">Restore example 1EHZ</button>'+
      '<label>RNA chain<select id="teChainSelect"></select></label>'+
      '<label class="te-check"><input id="teSameMolecule" type="checkbox"> I confirm that the Secondary and 3D inputs describe the same RNA molecule</label>'+
      '<p id="teMappingStatus" class="te-mapping-status" role="status"></p></details>'+
      '<details open><summary>Display</summary>'+
      '<label>Representation<select id="teRepresentation"><option value="sticks">PyMOL-style sticks</option><option value="ballstick">Ball &amp; stick</option><option value="wire">Wire</option><option value="spheres">Spheres</option><option value="backbone">RNA backbone</option><option value="cartoon">Cartoon</option></select></label>'+
      '<label>Color by<select id="teColorMode"><option value="nucleotide">Nucleotide / residue type</option><option value="chain">Chain</option><option value="element">Element</option><option value="uniform">Uniform custom color</option><option value="region">Secondary element</option><option value="metadata" disabled>Residue information</option></select></label>'+
      '<label>Uniform color<input id="teUniformColor" type="color" value="#74d7b6"></label>'+
      '<label>Background color<input id="teBackgroundColor" type="color" value="#07111c"></label>'+
      '<label class="te-check"><input id="teOrthographic" type="checkbox"> Orthographic projection</label>'+
      '<button type="button" id="teFullscreen">Full-screen viewer</button>'+
      '<label class="te-check"><input id="teShowPairs" type="checkbox" checked> Show mapped secondary-structure pair connections</label>'+
      '<label class="te-check"><input id="teShowIndices" type="checkbox" checked> Show residue indices</label>'+
      '<label class="te-check"><input id="teShowSelectedLabel" type="checkbox" checked> Label selected residue</label>'+
      '<div class="te-visibility-grid"><label class="te-check"><input id="teShowRNA" type="checkbox" checked> RNA</label><label class="te-check"><input id="teShowProtein" type="checkbox" checked> Protein</label><label class="te-check"><input id="teShowSolvent" type="checkbox"> Solvent</label><label class="te-check"><input id="teShowIons" type="checkbox" checked> Ions</label><label class="te-check"><input id="teShowOther" type="checkbox" checked> Other ligands</label><label class="te-check"><input id="teShowHydrogen" type="checkbox"> Hydrogens</label></div>'+
      '<label class="te-check"><input id="teSurface" type="checkbox"> Molecular surface</label>'+
      '<label>Surface transparency<input id="teSurfaceOpacity" type="range" min="0.05" max="0.9" step="0.05" value="0.35"></label></details>'+
      '<details open><summary>Sequence-linked selection</summary><p class="te-tool-note">Click a residue here or in 3D; selection is shared with the Secondary view when mapping is active.</p><div id="teSequencePanel" class="te-sequence-panel"></div>'+
      '<div class="te-inline-grid"><label>From residue<input id="teSelectStart" type="number" min="1" value="1"></label><label>To residue<input id="teSelectEnd" type="number" min="1" value="10"></label></div>'+
      '<div class="te-button-row"><button type="button" id="teSelectRange">Select range</button><button type="button" id="teSelectCurrent">Add current</button><button type="button" id="teSelectSubtract">Subtract current</button><button type="button" id="teSelectChain">Select RNA chain</button><button type="button" id="teSelectInvert">Invert</button><button type="button" id="teSelectClear">Clear selection</button></div>'+
      '<label>Nucleotide type<select id="teSelectBase"><option>A</option><option>C</option><option>G</option><option>U</option></select></label><button type="button" id="teSelectBaseButton">Select nucleotide type</button>'+
      '<label>Within distance (Å)<input id="teSelectNearCutoff" type="number" min="1" max="30" step="0.5" value="5"></label><button type="button" id="teSelectNearButton">Select around current residue</button>'+
      '<div class="te-button-row"><button type="button" id="teFocusSelection">Center / zoom selection</button><label class="te-check"><input id="teSelectionLabels" type="checkbox"> Label selection</label></div></details>'+
      '<details><summary>Saved objects</summary><p class="te-tool-note">Create a named object from the current selection, then show, hide, isolate, or export it.</p><button type="button" id="teCreateObject">Create object from selection</button><div id="teObjectList">No saved objects.</div></details>'+
      '<details><summary>Residue index</summary><p>Default labels: 1, every 5 residues, and the final residue.</p><details class="te-index-dropdown"><summary>Choose indices</summary><div id="teIndexChoices"></div></details><div class="te-button-row"><button type="button" id="teIndexDefault">Default</button><button type="button" id="teIndexAll">All</button><button type="button" id="teIndexNone">None</button></div></details>'+
      '<details open><summary>Analyze</summary>'+
      '<label class="te-check"><input id="teProximity" type="checkbox"> Highlight 3D proximity</label><label>Proximity cutoff (Å)<input id="teProximityCutoff" type="number" min="6" max="30" step="0.5" value="12"></label><p id="teProximityStatus">Highlights C4′ spatial neighbors that are not immediate sequence neighbors.</p>'+
      '<label class="te-check"><input id="teContacts" type="checkbox"> Show close atom contacts / possible H-bond contacts</label><label>Contact cutoff (Å)<input id="teContactCutoff" type="number" min="2.5" max="8" step="0.1" value="4.0"></label><p id="teContactStatus">Shows close atom contacts; N/O pairs ≤3.5 Å are flagged as possible hydrogen-bond contacts.</p><div id="teContactList" class="te-contact-list"></div>'+
      '<fieldset class="te-measure-tools"><legend>Atom measurements</legend><label>Measurement<select id="teMeasureMode"><option value="off">Off</option><option value="distance">Distance · 2 atoms</option><option value="angle">Angle · 3 atoms</option><option value="dihedral">Dihedral · 4 atoms</option></select></label><div class="te-button-row"><button type="button" id="teMeasureUndo">Undo pick</button><button type="button" id="teMeasureClear">Clear all</button></div><p id="teMeasureStatus">Choose distance, angle, or dihedral, then click atoms in the 3D structure.</p><div id="teMeasurementList" class="te-measurement-list">No saved measurements.</div></fieldset>'+
      '<label class="te-check"><input id="teSplit" type="checkbox"> 2D + 3D linked view</label></details>'+
      '<details><summary>Clipping</summary><label class="te-check"><input id="teClipEnabled" type="checkbox"> Enable clipping slab</label><div class="te-inline-grid"><label>Near<input id="teClipNear" type="range" min="-100" max="0" step="1" value="-40"></label><label>Far<input id="teClipFar" type="range" min="0" max="100" step="1" value="40"></label></div><p class="te-tool-note">Clipping changes only what is visible; it does not delete atoms.</p></details>'+
      '<details><summary>Compare / align structures</summary><label>Alignment scope<select id="teAlignScope"><option value="full">Whole active RNA chain</option><option value="selection">Current residue selection</option></select></label><label>Comparison PDB / mmCIF<input id="teAlignFile" type="file" accept=".pdb,.ent,.cif,.mmcif"></label><label class="te-check"><input id="teCompareVisible" type="checkbox" checked> Show aligned comparison</label><button type="button" id="teClearAlignment">Clear comparison</button><p id="teAlignmentStatus">Upload a second PDB/mmCIF structure to superimpose it on the active RNA chain.</p></details>'+
      '<details><summary>Saved camera views</summary><button type="button" id="teSaveView">Save current view</button><div id="teSavedViews">No saved views.</div></details>'+

      '<details id="teFocusDetails"><summary>Focus on structural region</summary><div class="te-button-row te-region-buttons"><button type="button" data-te-region="Acceptor stem">Acceptor</button><button type="button" data-te-region="Anticodon arm">Anticodon</button><button type="button" data-te-region="elbow">D/T-loop elbow</button><button type="button" data-te-region="full">Full structure</button></div></details>'+
      '<div class="te-region-legend" id="teRegionLegend" hidden></div></div>';

    $("teRepresentation").value=state.representation;$("teColorMode").value=state.colorMode;$("teShowPairs").checked=state.showPairs;$("teShowIndices").checked=state.showIndices;
    $("teRepresentation").addEventListener("change",e=>{state.representation=e.target.value;render();});
    $("teColorMode").addEventListener("change",e=>{state.colorMode=e.target.value;render();});
    $("teUniformColor").addEventListener("input",e=>{state.uniformColor=e.target.value;if(state.colorMode==="uniform")render();});
    $("teBackgroundColor").addEventListener("input",e=>{state.backgroundColor=e.target.value;if(viewer){viewer.setBackgroundColor(state.backgroundColor,1);viewer.render();}});
    $("teOrthographic").addEventListener("change",e=>{state.orthographic=e.target.checked;if(viewer?.setCameraParameters){viewer.setCameraParameters({orthographic:state.orthographic});viewer.render();}});
    $("teFullscreen").addEventListener("click",()=>{$("tertiaryStage")?.requestFullscreen?.();});
    $("teShowPairs").addEventListener("change",e=>{state.showPairs=e.target.checked;render();});
    $("teShowIndices").addEventListener("change",e=>{state.showIndices=e.target.checked;render();});
    $("teShowSelectedLabel").addEventListener("change",e=>{state.showSelectedLabel=e.target.checked;render();});
    ["RNA","Protein","Solvent","Ions","Other","Hydrogen"].forEach(k=>$("teShow"+k).addEventListener("change",e=>{state.visibility[k.toLowerCase()]=e.target.checked;render();}));
    $("teSurface").addEventListener("change",e=>{state.surfaceEnabled=e.target.checked;render();});
    $("teSurfaceOpacity").addEventListener("input",e=>{state.surfaceOpacity=Number(e.target.value);render();});
    $("teProximity").addEventListener("change",e=>{state.proximityEnabled=e.target.checked;render();});
    $("teProximityCutoff").addEventListener("input",e=>{if(e.target.checkValidity()){state.proximityCutoff=Number(e.target.value);render();}});
    $("teContacts").addEventListener("change",e=>{state.contactEnabled=e.target.checked;render();});
    $("teContactCutoff").addEventListener("input",e=>{if(e.target.checkValidity()){state.contactCutoff=Number(e.target.value);render();}});
    $("teMeasureMode").addEventListener("change",e=>{state.measurementMode=e.target.value;state.measurementPicks=[];render();});
    $("teMeasureUndo").addEventListener("click",()=>{state.measurementPicks.pop();render();});
    $("teMeasureClear").addEventListener("click",()=>{state.measurementPicks=[];state.measurements=[];render();});
    $("teSplit").addEventListener("change",e=>{state.split=e.target.checked&&state.mapping.enabled;render();scheduleViewerResize(true);});
    $("teSameMolecule").addEventListener("change",e=>{state.sameMoleculeConfirmed=e.target.checked;evaluateMapping();render();});
    $("teChainSelect").addEventListener("change",e=>{state.activeChain=e.target.value;state.chainNeedsChoice=false;state.sameMoleculeConfirmed=false;buildResidueLookup();evaluateMapping();state.indexSelection=defaultIndices();buildIndexChoices();setupInteractions();render();});
    $("teStructureFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;setStatus("Loading "+file.name+"…");try{await handleStructureUpload(file);setStatus("");}catch(error){setStatus("Upload failed: "+error.message,"error");}});
    const loadPdbId=async()=>{const status=$("tePdbIdStatus"),button=$("teLoadPdbId");button.disabled=true;status.textContent="Loading from RCSB PDB…";setStatus("Fetching structure from RCSB PDB…");try{const id=await loadFromRcsbId($("tePdbId").value);status.textContent="Loaded RCSB PDB · "+id+" as mmCIF.";setStatus("");render();}catch(error){status.textContent=error.message;setStatus("RCSB import failed: "+error.message,"error");}finally{button.disabled=false;}};
    $("teLoadPdbId").addEventListener("click",loadPdbId);$("tePdbId").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadPdbId();}});
    $("teRestoreStructure").addEventListener("click",async()=>{$("teStructureFile").value="";setStatus("Restoring PDB 1EHZ…");try{await ensureViewer();await loadDefaultStructure();render();}catch(error){setStatus("Restore failed: "+error.message,"error");}});
    $("teIndexDefault").addEventListener("click",()=>{state.indexSelection=defaultIndices();buildIndexChoices();render();});
    $("teIndexAll").addEventListener("click",()=>{const n=state.mapping.enabled?state.secondarySequence.length:activeResidues().length;state.indexSelection=new Set(Array.from({length:n},(_,i)=>i));buildIndexChoices();render();});
    $("teIndexNone").addEventListener("click",()=>{state.indexSelection.clear();buildIndexChoices();render();});
    $("teSelectRange").addEventListener("click",selectRange);$("teSelectCurrent").addEventListener("click",addCurrentToSelection);$("teSelectSubtract").addEventListener("click",subtractCurrentFromSelection);$("teSelectChain").addEventListener("click",selectActiveChain);$("teSelectInvert").addEventListener("click",invertSelection);$("teSelectClear").addEventListener("click",()=>{state.selectionIndices.clear();state.selectedPairs.clear();if(typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.clearLinkedSelection)SecondaryExplorer.clearLinkedSelection(false);render();});
    $("teSelectBaseButton").addEventListener("click",selectBase);$("teSelectNearButton").addEventListener("click",selectNearby);$("teFocusSelection").addEventListener("click",focusSelection);
    $("teSelectionLabels").addEventListener("change",e=>{state.selectionLabels=e.target.checked;render();});$("teCreateObject").addEventListener("click",createObject);
    $("teClipEnabled").addEventListener("change",e=>{state.clipEnabled=e.target.checked;render();});$("teClipNear").addEventListener("input",e=>{state.clipNear=Number(e.target.value);render();});$("teClipFar").addEventListener("input",e=>{state.clipFar=Number(e.target.value);render();});
    $("teAlignFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;state.comparison.status="Aligning "+f.name+"…";updateComparisonStatus();try{await alignComparison(f);}catch(err){state.comparison.status="Alignment failed: "+err.message;updateComparisonStatus();}});
    $("teCompareVisible").addEventListener("change",e=>{state.comparison.visible=e.target.checked;render();});$("teClearAlignment").addEventListener("click",()=>clearComparison());
    $("teSaveView").addEventListener("click",saveView);
    box.querySelectorAll("[data-te-region]").forEach(b=>b.addEventListener("click",()=>{const r=b.dataset.teRegion;if(r==="full")resetView();else if(r==="elbow")focus([...regionIndices("D arm"),...regionIndices("T arm")]);else focus(regionIndices(r));}));
  }
  async function exportViewerImage(format,scale,background){
    if(!viewer)throw new Error("3D viewer is not ready.");
    const status=$("teExportStatus"),viewport=$("tertiaryViewport"),view=viewer.getView?viewer.getView():null;
    const baseW=Math.max(1,Math.round(viewport.clientWidth||720)),baseH=Math.max(1,Math.round(viewport.clientHeight||560));
    const actual=Math.min(Number(scale)||2,4096/baseW,4096/baseH,Math.sqrt(16000000/(baseW*baseH))),width=Math.max(1,Math.round(baseW*actual)),height=Math.max(1,Math.round(baseH*actual));
    const oldBg=state.backgroundColor;
    try{
      viewer.setWidth(width);viewer.setHeight(height);if(view)viewer.setView(view);
      if(background==="transparent")viewer.setBackgroundColor("#000000",0);else viewer.setBackgroundColor(background,1);
      viewer.render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const dataUrl=viewer.pngURI(),base="rna-tertiary-"+(state.currentFileName.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"structure");
      if(format==="pdf")await ExportTools.exportRasterPdf(dataUrl,width,height,base);
      else if(format==="svg"){
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><image href="'+dataUrl+'" width="'+width+'" height="'+height+'"/></svg>';
        ExportTools.downloadText(svg,base+".svg","image/svg+xml;charset=utf-8");
      } else {const response=await fetch(dataUrl);ExportTools.downloadBlob(await response.blob(),base+".png");}
      if(status)status.textContent=(format==="pdf"?"PDF":format==="svg"?"SVG":"PNG")+" exported · "+width+" × "+height+".";
    } finally {
      viewer.setWidth(baseW);viewer.setHeight(baseH);if(view)viewer.setView(view);viewer.setBackgroundColor(oldBg,1);viewer.render();
    }
  }
  function refreshExportObjectOptions(){
    const select=$("teExportScope");if(!select)return;const current=select.value;select.replaceChildren(new Option("Entire loaded structure","full"),new Option("Current RNA selection","selection"));
    state.savedObjects.forEach(o=>select.append(new Option("Saved object · "+o.name,"object:"+o.id)));if([...select.options].some(o=>o.value===current))select.value=current;
  }
  function setupToolbar(){
    const toolbar=document.querySelector("#scene-tertiary .te-toolbar");if(!toolbar)return;
    toolbar.insertAdjacentHTML("beforeend",'<button id="teFitAll" type="button">Fit all</button><button id="teOpenExport" type="button">Export…</button>');
    const status=document.createElement("p");status.id="teExportStatus";status.className="te-export-status";status.setAttribute("role","status");toolbar.insertAdjacentElement("afterend",status);
    const dialog=document.createElement("dialog");dialog.id="teExportDialog";dialog.className="te-export-dialog";
    dialog.innerHTML='<button type="button" class="dialog-close" id="teExportClose" aria-label="Close">×</button><h3>Export Tertiary Structure</h3><label>Export type<select id="teExportType"><option value="image">Image</option><option value="structure">Structure</option></select></label><div id="teImageExportOptions"><label>Format<select id="teImageFormat"><option value="png">PNG</option><option value="pdf">PDF</option><option value="svg">SVG (raster embedded)</option></select></label><label>Resolution / scale<input id="teImageScale" type="range" min="1" max="5" step=".5" value="2"><output id="teImageScaleValue">2×</output></label><label>DPI target<select id="teImageDpi"><option value="96">96</option><option value="150">150</option><option value="300" selected>300</option><option value="600">600</option></select></label><label>Background<select id="teImageBackground"><option value="#ffffff">White</option><option value="#07111c">Dark</option><option value="transparent">Transparent</option></select></label><p class="te-tool-note">The 3D viewer is WebGL. SVG export contains the rendered view as an embedded raster image.</p></div><div id="teStructureExportOptions" hidden><label>Scope<select id="teExportScope"><option value="full">Entire loaded structure</option><option value="selection">Current RNA selection</option></select></label><label>Format<select id="teExportFormat"><option value="pdb">PDB</option><option value="cif">mmCIF</option></select></label></div><button type="button" id="teExportNow" class="primary-action">Export</button><p id="teExportDialogStatus" role="status"></p>';
    document.body.append(dialog);refreshExportObjectOptions();
    $("teOpenExport").addEventListener("click",()=>{refreshExportObjectOptions();dialog.showModal();});$("teExportClose").addEventListener("click",()=>dialog.close());
    $("teExportType").addEventListener("change",e=>{$("teImageExportOptions").hidden=e.target.value!=="image";$("teStructureExportOptions").hidden=e.target.value!=="structure";});
    $("teImageScale").addEventListener("input",e=>$("teImageScaleValue").textContent=e.target.value+"×");
    $("teExportNow").addEventListener("click",async()=>{
      const out=$("teExportDialogStatus");out.textContent="Preparing export…";
      try{
        if($("teExportType").value==="image"){const dpi=Number($("teImageDpi").value)||96,scale=(Number($("teImageScale").value)||1)*(dpi/96);await exportViewerImage($("teImageFormat").value,scale,$("teImageBackground").value);out.textContent="Image exported.";}
        else{
          const scope=$("teExportScope").value,fmt=$("teExportFormat").value;let indices=null,label=state.currentFileName.replace(/\.[^.]+$/,"");
          if(scope==="selection")indices=state.selectionIndices;
          else if(scope.startsWith("object:")){const o=state.savedObjects.find(x=>x.id===Number(scope.split(":")[1]));if(!o)throw new Error("Saved object is no longer available.");indices=o.indices;label=o.name;}
          downloadStructure(fmt,indices,label);out.textContent=(fmt==="cif"?"mmCIF":"PDB")+" structure exported.";
        }
      }catch(error){out.textContent="Export failed: "+error.message;}
    });
    $("teFitAll").addEventListener("click",()=>{if(viewer){viewer.zoomTo({},350);viewer.render();}});
    $("teZoomIn")?.addEventListener("click",()=>{if(viewer){viewer.zoom(1.25,250);viewer.render();}});
    $("teZoomOut")?.addEventListener("click",()=>{if(viewer){viewer.zoom(.8,250);viewer.render();}});
    $("teResetView")?.addEventListener("click",resetView);$("teCenterSelected")?.addEventListener("click",centerSelected);
  }
  function applyMetadata(detail){
    if(!detail||detail.sequence!==state.secondarySequence){state.metadata={};state.heatEnabled=false;if(state.colorMode==="metadata")state.colorMode="nucleotide";render();return;}
    state.metadata=detail.metadata||{};state.heatEnabled=Boolean(detail.heatEnabled)&&Object.keys(state.metadata).length>0;
    state.heatTheme=detail.heatTheme||"viridis";state.heatRange=Array.isArray(detail.heatRange)?detail.heatRange:[0,1];
    if(!state.heatEnabled&&state.colorMode==="metadata")state.colorMode="nucleotide";render();
  }
  function handleSecondaryLayout(detail){
    if(!detail||detail.sequence!==state.secondarySequence||detail.structure!==state.structure)return;
    if(Array.isArray(detail.positions)&&detail.positions.length===state.secondarySequence.length)state.secondaryLayoutPositions=detail.positions.map(p=>({x:Number(p.x),y:Number(p.y)}));
    if(state.split)miniSecondary();
  }
  function handleSecondaryContext(detail){
    if(!detail)return;const changed=detail.sequence!==state.secondarySequence||detail.structure!==state.structure;
    state.secondarySequence=detail.sequence;state.structure=detail.structure;state.secondaryIsDefault=Boolean(detail.isDefault);if(changed)state.secondaryLayoutPositions=null;
    const parsed=parseStructure(state.structure,state.secondarySequence.length);pairs=parsed.pairs;partner=parsed.partner;
    if(changed&&!isCuratedDefaultPair()){state.sameMoleculeConfirmed=false;state.metadata={};state.heatEnabled=false;}
    evaluateMapping();if(changed){state.indexSelection=defaultIndices();buildIndexChoices();}render();
  }
  function setup(config){
    if(setupDone)return;setupDone=true;
    state.defaultSequence=config.sequence;state.defaultStructure=config.structure;state.secondarySequence=config.sequence;state.structure=config.structure;state.colors=config.colors;state.names=config.names;state.onSelect=config.onSelect;
    const parsed=parseStructure(state.structure,state.secondarySequence.length);pairs=parsed.pairs;partner=parsed.partner;
    setupControls();setupToolbar();
    $("followButton")?.addEventListener("click",()=>{const n=activeResidues().length;if(n<2)return;let next=state.selected;while(next===state.selected)next=Math.floor(Math.random()*n);chooseResidue(next);});
    window.addEventListener("rna-metadata-change",e=>applyMetadata(e.detail));
    window.addEventListener("rna-secondary-context",e=>handleSecondaryContext(e.detail));
    window.addEventListener("rna-secondary-layout",e=>handleSecondaryLayout(e.detail));
    window.addEventListener("rna-secondary-select",e=>{if(state.mapping.enabled&&e.detail?.sequence===state.secondarySequence){state.selected=clamp(e.detail.index,0,state.secondarySequence.length-1);render();}});
    window.addEventListener("resize",()=>scheduleViewerResize(true));
    if(typeof ResizeObserver!=="undefined"){const viewport=$("tertiaryViewport");if(viewport)new ResizeObserver(()=>scheduleViewerResize(true)).observe(viewport);}
    try{const p=typeof SecondaryExplorer!=="undefined"&&SecondaryExplorer.getCurrentPositions?SecondaryExplorer.getCurrentPositions():null;if(Array.isArray(p)&&p.length===state.secondarySequence.length)state.secondaryLayoutPositions=p.map(x=>({x:Number(x.x),y:Number(x.y)}));}catch(_){}
    render();
  }

  return {setup,render,compareChain,normalizeBase,hornFit,serializePdb,serializeCif,loadFromRcsbId,
    getDiagnostics(){return {viewerReady:!!viewer,modelReady:!!model,atomCount:model?.selectedAtoms?model.selectedAtoms({}).length:0,representation:state.representation,colorMode:state.colorMode,split:state.split,mappingEnabled:state.mapping.enabled,source:state.currentFileName,
      surfaceEnabled:state.surfaceEnabled,proximityEnabled:state.proximityEnabled,contactEnabled:state.contactEnabled,clipEnabled:state.clipEnabled,measurementMode:state.measurementMode,
      selectionCount:state.selectionIndices.size,savedObjectCount:state.savedObjects.length,isolateObjectId:state.isolateObjectId,savedViewCount:state.savedViews.length,
      comparisonRmsd:state.comparison.rmsd,comparisonCount:state.comparison.count};}
  };
})();
