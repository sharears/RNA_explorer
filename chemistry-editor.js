const MoleculeEditor = (() => {
  const NS="http://www.w3.org/2000/svg";
  const savedBases={};
  const standardValence={H:1,C:4,N:3,O:2,P:5,S:6,F:1,Cl:1,Br:1,I:1};
  const DEFAULT_TEXT_STYLE={font:"DM Mono",color:"#ffffff",size:17,bold:true,italic:false};
  const IUPAC_NAMES={
    A:"9H-purin-6-amine",
    G:"2-amino-1,7-dihydropurin-6-one",
    C:"4-aminopyrimidin-2(1H)-one",
    U:"1H-pyrimidine-2,4-dione",
    T:"5-methyl-1H-pyrimidine-2,4-dione",
    RIBOSE:null
  };
  const RING_NAMES={five:"cyclopentane",six:"cyclohexane",aromatic6:"benzene",fused56:null};

  const BASES={
    A:{
      name:"Adenine",
      atoms:[
        ["N9","N",215,260,0],["C8","C",175,205,0],["N7","N",210,150,0],["C5","C",280,165,0],["C4","C",285,235,0],
        ["C6","C",345,130,0],["N1","N",405,165,0],["C2","C",400,235,0],["N3","N",340,270,0],["N6","N",350,65,0]
      ],
      bonds:[["N9","C8",1],["C8","N7",2],["N7","C5",1],["C5","C4",2],["C4","N9",1],["C5","C6",1],["C6","N1",2],["N1","C2",1],["C2","N3",2],["N3","C4",1],["C6","N6",1]]
    },
    G:{
      name:"Guanine",
      atoms:[
        ["N9","N",215,260,0],["C8","C",175,205,0],["N7","N",210,150,0],["C5","C",280,165,0],["C4","C",285,235,0],
        ["C6","C",345,130,0],["N1","N",405,165,0],["C2","C",400,235,0],["N3","N",340,270,0],["O6","O",350,65,0],["N2","N",465,265,0]
      ],
      bonds:[["N9","C8",1],["C8","N7",2],["N7","C5",1],["C5","C4",2],["C4","N9",1],["C5","C6",1],["C6","N1",1],["N1","C2",1],["C2","N3",2],["N3","C4",1],["C6","O6",2],["C2","N2",1]]
    },
    C:{
      name:"Cytosine",
      atoms:[["N1","N",220,245,0],["C2","C",290,280,0],["N3","N",355,245,0],["C4","C",355,170,0],["C5","C",290,135,0],["C6","C",220,170,0],["O2","O",295,350,0],["N4","N",420,135,0]],
      bonds:[["N1","C2",1],["C2","N3",1],["N3","C4",2],["C4","C5",1],["C5","C6",2],["C6","N1",1],["C2","O2",2],["C4","N4",1]]
    },
    U:{
      name:"Uracil",
      atoms:[["N1","N",220,245,0],["C2","C",290,280,0],["N3","N",355,245,0],["C4","C",355,170,0],["C5","C",290,135,0],["C6","C",220,170,0],["O2","O",295,350,0],["O4","O",420,135,0]],
      bonds:[["N1","C2",1],["C2","N3",1],["N3","C4",1],["C4","C5",1],["C5","C6",2],["C6","N1",1],["C2","O2",2],["C4","O4",2]]
    },
    T:{
      name:"Thymine",
      atoms:[["N1","N",220,245,0],["C2","C",290,280,0],["N3","N",355,245,0],["C4","C",355,170,0],["C5","C",290,135,0],["C6","C",220,170,0],["O2","O",295,350,0],["O4","O",420,135,0],["C5M","C",275,62,0]],
      bonds:[["N1","C2",1],["C2","N3",1],["N3","C4",1],["C4","C5",1],["C5","C6",2],["C6","N1",1],["C2","O2",2],["C4","O4",2],["C5","C5M",1]]
    },
    RIBOSE:{
      name:"Ribose",
      atoms:[["O4'","O",270,125,0],["C1'","C",345,170,0],["C2'","C",330,255,0],["C3'","C",245,280,0],["C4'","C",195,205,0],["C5'","C",125,190,0],["O2'","O",390,305,0],["O3'","O",220,355,0],["O5'","O",65,160,0]],
      bonds:[["O4'","C1'",1],["C1'","C2'",1],["C2'","C3'",1],["C3'","C4'",1],["C4'","O4'",1],["C4'","C5'",1],["C5'","O5'",1],["C2'","O2'",1],["C3'","O3'",1]]
    },
    PHOSPHATE:{
      name:"Phosphate group",
      atoms:[["P","P",300,220,0],["O1","O",300,125,0],["O2","O",390,220,-1],["O3","O",300,315,-1],["O4","O",210,220,0]],
      bonds:[["P","O1",2],["P","O2",1],["P","O3",1],["P","O4",1]]
    }
  };

  function clone(obj){return JSON.parse(JSON.stringify(obj));}
  function sanitizeTextStyle(raw={}){
    const font=["DM Mono","Manrope","Arial","Times New Roman","Courier New"].includes(raw.font)?raw.font:DEFAULT_TEXT_STYLE.font;
    const color=/^#[0-9a-f]{6}$/i.test(String(raw.color||""))?String(raw.color):DEFAULT_TEXT_STYLE.color;
    const size=Math.max(8,Math.min(42,Number(raw.size)||DEFAULT_TEXT_STYLE.size));
    return {font,color,size,bold:Boolean(raw.bold),italic:Boolean(raw.italic)};
  }
  function sanitizeSavedBase(value,base){
    if(!value||typeof value!=="object"||!Array.isArray(value.atoms)||!Array.isArray(value.bonds))throw new Error("Saved "+base+" chemistry is invalid.");
    if(value.atoms.length<1||value.atoms.length>500||value.bonds.length>1200)throw new Error("Saved "+base+" chemistry is too large.");
    const atoms=[],ids=new Set();
    value.atoms.forEach((raw,index)=>{
      if(!Array.isArray(raw)||raw.length<4)throw new Error("Saved "+base+" atom "+(index+1)+" is invalid.");
      const id=String(raw[0]??"");
      const element=String(raw[1]??"");
      const x=Number(raw[2]),y=Number(raw[3]),charge=Number(raw[4]??0);
      if(!/^[A-Za-z0-9_+'*.-]{1,32}$/.test(id)||ids.has(id))throw new Error("Saved "+base+" atom identifier is invalid.");
      if(!Object.prototype.hasOwnProperty.call(standardValence,element))throw new Error("Saved "+base+" atom element is invalid.");
      if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>100000||Math.abs(y)>100000)throw new Error("Saved "+base+" atom coordinates are invalid.");
      if(!Number.isInteger(charge)||charge<-8||charge>8)throw new Error("Saved "+base+" atom charge is invalid.");
      ids.add(id);atoms.push([id,element,x,y,charge]);
    });
    const bonds=value.bonds.map((raw,index)=>{
      if(!Array.isArray(raw)||raw.length<2)throw new Error("Saved "+base+" bond "+(index+1)+" is invalid.");
      const a=String(raw[0]??""),b=String(raw[1]??""),order=Number(raw[2]??1);
      if(!ids.has(a)||!ids.has(b)||a===b||![1,2,3].includes(order))throw new Error("Saved "+base+" bond "+(index+1)+" is invalid.");
      return [a,b,order];
    });
    const textStyles={};
    Object.entries(value.textStyles||{}).forEach(([id,style])=>{if(ids.has(id))textStyles[id]=sanitizeTextStyle(style);});
    return {name:(BASES[base]||{}).name||base,atoms,bonds,textStyles};
  }
  function graphFromBase(base){
    const custom=Boolean(savedBases[base]),src=savedBases[base]||BASES[base]||BASES.A;
    return {
      atoms:src.atoms.map(a=>{
        const id=a[0]||a.id;
        return {id,element:a[1]||a.element,x:a[2]??a.x,y:a[3]??a.y,charge:a[4]??a.charge??0,label:id,textStyle:src.textStyles?.[id]?sanitizeTextStyle(src.textStyles[id]):null};
      }),
      bonds:src.bonds.map((b,i)=>({id:"b"+i,a:b[0]||b.a,b:b[1]||b.b,order:b[2]||b.order||1})),
      hbonds:[],
      iupac:custom?null:(IUPAC_NAMES[base]||null)
    };
  }
  function storeBase(base,graph){
    const textStyles={};graph.atoms.forEach(a=>{if(a.textStyle)textStyles[a.id]=sanitizeTextStyle(a.textStyle);});
    savedBases[base]={
      name:(BASES[base]||{}).name||base,
      atoms:graph.atoms.map(a=>[a.id,a.element,a.x,a.y,a.charge||0]),
      bonds:graph.bonds.map(b=>[b.a,b.b,b.order]),
      textStyles
    };
  }
  function mergePair(left,right){
    const L=graphFromBase(left),R=graphFromBase(right);
    const leftIds=new Map(),rightIds=new Map();
    const atoms=[];
    L.atoms.forEach(a=>{const id="L_"+a.id;leftIds.set(a.id,id);atoms.push({...a,id,label:a.id,x:a.x-80,y:a.y+35});});
    R.atoms.forEach(a=>{const id="R_"+a.id;rightIds.set(a.id,id);atoms.push({...a,id,label:a.id,x:700-a.x+80,y:a.y+35});});
    const bonds=[
      ...L.bonds.map((b,i)=>({id:"Lb"+i,a:leftIds.get(b.a),b:leftIds.get(b.b),order:b.order})),
      ...R.bonds.map((b,i)=>({id:"Rb"+i,a:rightIds.get(b.a),b:rightIds.get(b.b),order:b.order}))
    ];
    const leftName=!savedBases[left]&&IUPAC_NAMES[left]?IUPAC_NAMES[left]:null,rightName=!savedBases[right]&&IUPAC_NAMES[right]?IUPAC_NAMES[right]:null;
    return {atoms,bonds,hbonds:[],leftIds,rightIds,iupac:leftName&&rightName?leftName+" + "+rightName+" (noncovalent base pair)":null};
  }
  function piecewiseY(value,anchors){
    const a=anchors.slice().sort((x,y)=>x[0]-y[0]);
    if(a.length<2)return value;
    let lo=a[0],hi=a[1];
    if(value>=a[a.length-1][0]){lo=a[a.length-2];hi=a[a.length-1];}
    else if(value>a[0][0]){
      for(let i=0;i<a.length-1;i++)if(value>=a[i][0]&&value<=a[i+1][0]){lo=a[i];hi=a[i+1];break;}
    }
    const span=hi[0]-lo[0]||1,t=(value-lo[0])/span;
    return lo[1]+t*(hi[1]-lo[1]);
  }
  function alignPairTemplate(p,kind,left,right){
    const targets={
      AU:{A:[["N6",165],["N1",285]],U:[["O4",165],["N3",285]]},
      GC:{G:[["O6",130],["N1",235],["N2",340]],C:[["N4",130],["N3",235],["O2",340]]},
      GU:{G:[["O6",175],["N1",295]],U:[["N3",175],["O2",295]]}
    }[kind]||{};
    const apply=(side,baseName,idMap)=>{
      const specs=targets[baseName];if(!specs||!idMap)return;
      const anchors=specs.map(([name,target])=>{
        const atom=p.atoms.find(a=>a.id===idMap.get(name));
        return atom?[atom.y,target]:null;
      }).filter(Boolean);
      if(anchors.length<2)return;
      p.atoms.filter(a=>a.id.startsWith(side+"_")).forEach(a=>a.y=piecewiseY(a.y,anchors));
    };
    apply("L",left,p.leftIds);apply("R",right,p.rightIds);
    if(kind==="GU"){
      const shift=left==="U"?45:-45;
      p.atoms.filter(a=>a.id.startsWith(left==="U"?"L_":"R_")).forEach(a=>a.x+=shift);
    }
    return p;
  }
  function pairTemplate(kind,left,right){
    const p=alignPairTemplate(mergePair(left,right),kind,left,right);
    const sideFor=baseName=>left===baseName?p.leftIds:right===baseName?p.rightIds:null;
    const add=(baseA,atomA,baseB,atomB)=>{
      const sa=sideFor(baseA),sb=sideFor(baseB);
      const a=sa?.get(atomA),b=sb?.get(atomB);
      if(a&&b)p.hbonds.push({id:"h"+p.hbonds.length,a,b});
    };
    if(kind==="AU"){
      add("A","N6","U","O4");add("A","N1","U","N3");
    } else if(kind==="GC"){
      add("G","O6","C","N4");add("G","N1","C","N3");add("G","N2","C","O2");
    } else if(kind==="GU"){
      add("G","O6","U","N3");add("G","N1","U","O2");
    }
    return p;
  }

  let dialog=null,svg=null,status=null,title=null,mode="base",base="A",leftBase="G",rightBase="C";
  let graph={atoms:[],bonds:[],hbonds:[]},tool="select",element="C",bondOrder=1,selectedAtom=null,selectedAtoms=new Set(),pendingAtom=null,drag=null,selectionBox=null,lasso=null,transformDrag=null,pendingFuseBond=null,onSave=null;
  let atomSerial=1,bondSerial=1,hbondSerial=1,showAtomCircles=false,showAtomLabels=true,showAtomNumbers=false;
  let textDefaults={...DEFAULT_TEXT_STYLE};
  let undoStack=[];
  const UNDO_LIMIT=80;

  function historySnapshot(){
    return JSON.stringify({graph,atomSerial,bondSerial,hbondSerial,textDefaults});
  }
  function syncUndoButton(){
    const button=dialog?.querySelector("#chemUndoButton");
    if(button)button.disabled=undoStack.length===0;
  }
  function resetUndoHistory(){undoStack=[];syncUndoButton();}
  function pushUndo(){
    const snapshot=historySnapshot();
    if(undoStack.at(-1)!==snapshot)undoStack.push(snapshot);
    if(undoStack.length>UNDO_LIMIT)undoStack.splice(0,undoStack.length-UNDO_LIMIT);
    syncUndoButton();
  }
  function undo(){
    if(!undoStack.length){status.textContent="Nothing to undo.";syncUndoButton();return false;}
    const current=historySnapshot();
    let snapshot=null;
    while(undoStack.length){
      const candidate=undoStack.pop();
      if(candidate!==current){snapshot=candidate;break;}
    }
    if(!snapshot){status.textContent="Nothing to undo.";syncUndoButton();return false;}
    const state=JSON.parse(snapshot);
    graph=state.graph;atomSerial=state.atomSerial;bondSerial=state.bondSerial;hbondSerial=state.hbondSerial;textDefaults=state.textDefaults||{...DEFAULT_TEXT_STYLE};
    selectedAtom=null;selectedAtoms.clear();pendingAtom=null;pendingFuseBond=null;drag=null;transformDrag=null;selectionBox=null;lasso=null;
    syncTextControls(textDefaults);render();validate();syncUndoButton();status.textContent="Undid the last molecular drawing change.";return true;
  }

  const atomById=id=>graph.atoms.find(a=>a.id===id);
  const bondBetween=(a,b)=>graph.bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));

  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement("dialog");dialog.id="chemEditorDialog";dialog.className="chem-editor-dialog";
    dialog.innerHTML=`
      <div class="chem-editor-shell">
        <header><div><p class="eyebrow">RNA chemistry editor</p><h2 id="chemEditorTitle">Nucleobase editor</h2></div><button id="chemEditorClose" class="chem-editor-close" type="button" aria-label="Close">×</button></header>
        <div class="chem-editor-toolbar" role="toolbar" aria-label="Molecular drawing tools">
          <button type="button" id="chemUndoButton" title="Undo (Ctrl+Z / ⌘Z)" aria-label="Undo last molecular drawing change" disabled>Undo</button>
          <button type="button" data-chem-tool="select" class="active">Select / move</button>
          <button type="button" data-chem-tool="lasso">Lasso select</button>
          <button type="button" id="chemSelectAll">Select all</button>
          <button type="button" data-chem-tool="atom">Add atom</button>
          <button type="button" data-chem-tool="bond">Add bond</button><button type="button" data-chem-tool="fuse">Fuse rings</button>
          <button type="button" data-chem-tool="hbond">H-bond</button>
          <button type="button" data-chem-tool="delete">Delete</button>
          <label>Ring<select id="chemRingTemplate"><option value="five">5-membered</option><option value="six">6-membered</option><option value="aromatic6">Aromatic 6-membered</option><option value="fused56">Fused 5+6</option></select></label>
          <button type="button" id="chemInsertRing">Insert ring</button>
          <button type="button" id="chemAtomCirclesToggle" aria-pressed="false">Atom circles: off</button>
          <button type="button" id="chemAtomLabelsToggle" aria-pressed="true" title="On shows every element symbol; off uses skeletal convention with carbon vertices implicit.">Atom labels: on</button>
          <button type="button" id="chemAtomNumbersToggle" aria-pressed="false">Atom numbering: off</button>
          <label>Element<select id="chemElement"><option>C</option><option>N</option><option>O</option><option>H</option><option>P</option><option>S</option><option>F</option><option>Cl</option><option>Br</option><option>I</option></select></label>
          <label>Bond order<select id="chemBondOrder"><option value="1">Single</option><option value="2">Double</option><option value="3">Triple</option></select></label>
          <button type="button" id="chemChargeMinus">Charge −</button><button type="button" id="chemChargePlus">Charge +</button>
          <button type="button" id="chemIupacButton">IUPAC name</button>
        </div>
        <div class="chem-text-controls" aria-label="Molecular drawing text formatting">
          <strong>Text</strong>
          <label>Font<select id="chemTextFont"><option>DM Mono</option><option>Manrope</option><option>Arial</option><option>Times New Roman</option><option>Courier New</option></select></label>
          <label>Color<input id="chemTextColor" type="color" value="#ffffff"></label>
          <label>Size<input id="chemTextSize" type="number" min="8" max="42" step="1" value="17"></label>
          <button type="button" id="chemTextBold" aria-pressed="true"><strong>B</strong></button>
          <button type="button" id="chemTextItalic" aria-pressed="false"><em>I</em></button>
          <button type="button" id="chemApplyTextStyle">Apply to selected text</button>
          <span class="chem-text-help">No atom selected → applies to all atom text.</span>
        </div>
        <div class="chem-iupac-panel" id="chemIupacPanel" hidden aria-live="polite"></div>
        <div class="chem-pair-controls" id="chemPairControls" hidden>
          <label>Left base<select id="chemLeftBase"><option>A</option><option>G</option><option>C</option><option>U</option></select></label>
          <label>Right base<select id="chemRightBase"><option>A</option><option>G</option><option>C</option><option>U</option></select></label>
          <button type="button" id="chemLoadPair">Load bases</button>
          <button type="button" id="chemSelectLeft">Select left base</button>
          <button type="button" id="chemSelectRight">Select right base</button>
          <button type="button" id="chemSelectPair">Select whole pair</button>
          <button type="button" data-pair-template="GC">G–C WCF</button>
          <button type="button" data-pair-template="AU">A–U WCF</button>
          <button type="button" data-pair-template="GU">G–U wobble</button>
        </div>
        <div class="chem-editor-canvas-wrap">
          <svg id="chemEditorSvg" viewBox="0 0 820 470" aria-label="Editable molecular structure"></svg>
        </div>
        <div class="chem-editor-footer">
          <p id="chemEditorStatus" role="status"></p>
          <div class="chem-editor-export">
            <label>Export image<select id="chemExportFormat"><option value="svg">SVG</option><option value="png">PNG</option><option value="pdf">PDF</option></select></label>
            <label>Scale<input id="chemExportScale" type="range" min="1" max="6" step=".5" value="2"><output id="chemExportScaleValue">2×</output></label>
            <label>Background<select id="chemExportBackground"><option value="transparent">Transparent</option><option value="#ffffff">White</option><option value="#0b1220">Dark</option></select></label>
            <button type="button" id="chemExportButton">Export</button>
          </div>
          <div><button type="button" id="chemEditorReset">Reset</button><button type="button" id="chemEditorExport">Export image…</button><button type="button" id="chemEditorSave" class="primary-action">Save structure</button></div>
        </div>
      </div>`;
    document.body.append(dialog);
    const exportDialog=document.createElement("dialog");exportDialog.id="chemExportDialog";exportDialog.className="chem-export-dialog";
    exportDialog.innerHTML='<button type="button" class="dialog-close" id="chemExportClose" aria-label="Close">×</button><h3>Export Chemical Drawing</h3>'+
      '<label>Format<select id="chemExportFormat"><option value="svg">SVG</option><option value="png">PNG</option><option value="pdf">PDF</option></select></label>'+
      '<label>Resolution / scale<input id="chemExportScale" type="range" min="1" max="6" step=".5" value="2"><output id="chemExportScaleValue">2×</output></label>'+
      '<label>DPI target<select id="chemExportDpi"><option value="96">96</option><option value="150">150</option><option value="300" selected>300</option><option value="600">600</option></select></label>'+
      '<label>Background<select id="chemExportBackground"><option value="transparent">Transparent</option><option value="#ffffff">White</option><option value="#0b1220">Dark</option></select></label>'+
      '<button type="button" class="primary-action" id="chemExportNow">Export</button><p id="chemExportStatus" role="status"></p>';
    document.body.append(exportDialog);
    svg=dialog.querySelector("#chemEditorSvg");status=dialog.querySelector("#chemEditorStatus");title=dialog.querySelector("#chemEditorTitle");
    dialog.querySelector("#chemEditorClose").addEventListener("click",()=>dialog.close());
    dialog.querySelector("#chemUndoButton").addEventListener("click",undo);
    dialog.querySelectorAll("[data-chem-tool]").forEach(b=>b.addEventListener("click",()=>{
      tool=b.dataset.chemTool;pendingAtom=null;pendingFuseBond=null;transformDrag=null;selectionBox=null;lasso=null;
      dialog.querySelectorAll("[data-chem-tool]").forEach(x=>x.classList.toggle("active",x===b));render();
    }));
    dialog.querySelector("#chemSelectAll").addEventListener("click",()=>{selectAtoms(graph.atoms.map(a=>a.id));render();});
    dialog.querySelector("#chemSelectLeft").addEventListener("click",()=>{selectAtoms(graph.atoms.filter(a=>a.id.startsWith("L_")).map(a=>a.id));render();});
    dialog.querySelector("#chemSelectRight").addEventListener("click",()=>{selectAtoms(graph.atoms.filter(a=>a.id.startsWith("R_")).map(a=>a.id));render();});
    dialog.querySelector("#chemSelectPair").addEventListener("click",()=>{selectAtoms(graph.atoms.map(a=>a.id));render();});
    dialog.querySelector("#chemElement").addEventListener("change",e=>{
      element=e.target.value;
      if(selectedAtom){const a=atomById(selectedAtom);if(a){pushUndo();a.element=element;a.label=element;invalidateIupac();render();validate();}}
    });
    dialog.querySelector("#chemBondOrder").addEventListener("change",e=>bondOrder=Number(e.target.value));
    dialog.querySelector("#chemChargeMinus").addEventListener("click",()=>changeCharge(-1));
    dialog.querySelector("#chemChargePlus").addEventListener("click",()=>changeCharge(1));
    dialog.querySelector("#chemAtomCirclesToggle").addEventListener("click",()=>{
      showAtomCircles=!showAtomCircles;syncDisplayButtons();render();
    });
    dialog.querySelector("#chemAtomLabelsToggle").addEventListener("click",()=>{
      showAtomLabels=!showAtomLabels;syncDisplayButtons();render();
    });
    dialog.querySelector("#chemAtomNumbersToggle").addEventListener("click",()=>{
      showAtomNumbers=!showAtomNumbers;syncDisplayButtons();render();
    });
    dialog.querySelector("#chemInsertRing").addEventListener("click",()=>{pushUndo();insertRing(dialog.querySelector("#chemRingTemplate").value);});
    dialog.querySelector("#chemIupacButton").addEventListener("click",showIupacName);
    dialog.querySelector("#chemTextBold").addEventListener("click",e=>toggleTextStyleButton(e.currentTarget));
    dialog.querySelector("#chemTextItalic").addEventListener("click",e=>toggleTextStyleButton(e.currentTarget));
    dialog.querySelector("#chemApplyTextStyle").addEventListener("click",()=>{pushUndo();applyTextStyleFromControls();});
    dialog.querySelector("#chemExportScale").addEventListener("input",e=>dialog.querySelector("#chemExportScaleValue").textContent=e.target.value+"×");
    dialog.querySelector("#chemExportButton").addEventListener("click",async()=>{status.textContent="Preparing export…";try{await exportCurrentDrawing();}catch(error){status.textContent="Export failed: "+error.message;}});
    dialog.querySelector("#chemEditorReset").addEventListener("click",()=>{pushUndo();loadCurrent();});
    dialog.querySelector("#chemEditorExport").addEventListener("click",()=>exportDialog.showModal());
    exportDialog.querySelector("#chemExportClose").addEventListener("click",()=>exportDialog.close());
    exportDialog.querySelector("#chemExportScale").addEventListener("input",e=>exportDialog.querySelector("#chemExportScaleValue").textContent=e.target.value+"×");
    exportDialog.querySelector("#chemExportNow").addEventListener("click",async()=>{
      const out=exportDialog.querySelector("#chemExportStatus");out.textContent="Preparing export…";
      try{
        const dpi=Number(exportDialog.querySelector("#chemExportDpi").value)||96;
        const scale=(Number(exportDialog.querySelector("#chemExportScale").value)||1)*(dpi/96);
        const format=exportDialog.querySelector("#chemExportFormat").value,background=exportDialog.querySelector("#chemExportBackground").value;
        const filename=mode==="pair"?"rna-base-pair-chemistry":mode==="blank"?"rna-molecular-drawing":"rna-"+base.toLowerCase()+"-chemistry";
        const result=await ExportTools.exportSvgElement(svg,{format,filename,scale,background,viewBox:svg.getAttribute("viewBox")||"0 0 820 470"});
        out.textContent=format.toUpperCase()+" exported"+(result?.width?" · "+result.width+" × "+result.height:"")+".";
      }catch(error){out.textContent="Export failed: "+error.message;}
    });
    dialog.querySelector("#chemEditorSave").addEventListener("click",()=>{
      if(mode==="base")storeBase(base,graph);
      if(onSave)onSave(clone(graph));
      status.textContent=mode==="base"?"Saved edited "+base+" structure for this session.":mode==="pair"?"Saved custom base-pair drawing for this session.":"Drawing is ready in this session.";
    });
    dialog.querySelector("#chemLeftBase").addEventListener("change",e=>leftBase=e.target.value);
    dialog.querySelector("#chemRightBase").addEventListener("change",e=>rightBase=e.target.value);
    dialog.querySelector("#chemLoadPair").addEventListener("click",()=>{pushUndo();graph=mergePair(leftBase,rightBase);renumber();render();validate();});
    dialog.querySelectorAll("[data-pair-template]").forEach(b=>b.addEventListener("click",()=>{
      const k=b.dataset.pairTemplate;
      if(k==="GC"){leftBase="G";rightBase="C";}
      if(k==="AU"){leftBase="A";rightBase="U";}
      if(k==="GU"){leftBase="G";rightBase="U";}
      dialog.querySelector("#chemLeftBase").value=leftBase;dialog.querySelector("#chemRightBase").value=rightBase;
      pushUndo();graph=pairTemplate(k,leftBase,rightBase);renumber();render();validate();
    }));
    svg.addEventListener("pointerdown",canvasPointerDown);
    svg.addEventListener("pointermove",canvasPointerMove);
    svg.addEventListener("pointerup",canvasPointerUp);
    svg.addEventListener("pointercancel",canvasPointerUp);
    svg.addEventListener("dblclick",e=>{
      const atomEl=e.target.closest?.("[data-atom-id]");if(!atomEl||tool!=="select")return;
      e.preventDefault();selectAtoms(covalentComponent(atomEl.dataset.atomId));render();validate();
    });
    dialog.addEventListener("keydown",e=>{
      const modifier=e.metaKey||e.ctrlKey;
      if(modifier&&!e.altKey&&String(e.key).toLowerCase()==="z"){e.preventDefault();undo();return;}
      if(e.key==="Escape"&&lasso){lasso=null;render();return;}
      if(e.key==="Escape"&&selectedAtoms.size){selectedAtoms.clear();selectedAtom=null;render();return;}
      if((e.key==="Delete"||e.key==="Backspace")&&(selectedAtoms.size||selectedAtom)){
        e.preventDefault();pushUndo();deleteAtoms(selectedAtoms.size?[...selectedAtoms]:[selectedAtom]);selectedAtom=null;render();validate();
      }
    });
  }

  function renumber(){
    atomSerial=graph.atoms.length+1;bondSerial=graph.bonds.length+1;hbondSerial=graph.hbonds.length+1;
    selectedAtom=null;selectedAtoms.clear();pendingAtom=null;pendingFuseBond=null;drag=null;transformDrag=null;selectionBox=null;lasso=null;
  }
  function selectAtoms(ids,activeId=null){
    selectedAtoms=new Set(ids.filter(id=>atomById(id)));
    selectedAtom=activeId&&selectedAtoms.has(activeId)?activeId:(selectedAtoms.values().next().value||null);
    if(selectedAtom){
      const a=atomById(selectedAtom);element=a?.element||element;
      if(dialog&&a&&dialog.querySelector("#chemElement"))dialog.querySelector("#chemElement").value=element;
      if(a)syncTextControls(a.textStyle||textDefaults);
    }
  }
  function toggleAtom(id){
    if(selectedAtoms.has(id))selectedAtoms.delete(id);else selectedAtoms.add(id);
    selectedAtom=selectedAtoms.has(id)?id:(selectedAtoms.values().next().value||null);
  }
  function covalentComponent(startId){
    const seen=new Set([startId]),queue=[startId];
    while(queue.length){
      const id=queue.shift();
      graph.bonds.forEach(b=>{
        let next=null;if(b.a===id)next=b.b;else if(b.b===id)next=b.a;
        if(next&&!seen.has(next)){seen.add(next);queue.push(next);}
      });
    }
    return [...seen];
  }
  function invalidateIupac(){graph.iupac=null;const panel=dialog?.querySelector("#chemIupacPanel");if(panel)panel.hidden=true;}
  function toggleTextStyleButton(button){
    const on=button.getAttribute("aria-pressed")!=="true";button.setAttribute("aria-pressed",String(on));button.classList.toggle("active",on);
  }
  function syncTextControls(style={}){
    if(!dialog)return;const s=sanitizeTextStyle({...textDefaults,...style});
    const font=dialog.querySelector("#chemTextFont"),color=dialog.querySelector("#chemTextColor"),size=dialog.querySelector("#chemTextSize");
    if(font)font.value=s.font;if(color)color.value=s.color;if(size)size.value=String(s.size);
    const bold=dialog.querySelector("#chemTextBold"),italic=dialog.querySelector("#chemTextItalic");
    if(bold){bold.setAttribute("aria-pressed",String(s.bold));bold.classList.toggle("active",s.bold);}
    if(italic){italic.setAttribute("aria-pressed",String(s.italic));italic.classList.toggle("active",s.italic);}
  }
  function currentTextStyle(){
    return sanitizeTextStyle({
      font:dialog.querySelector("#chemTextFont").value,
      color:dialog.querySelector("#chemTextColor").value,
      size:Number(dialog.querySelector("#chemTextSize").value),
      bold:dialog.querySelector("#chemTextBold").getAttribute("aria-pressed")==="true",
      italic:dialog.querySelector("#chemTextItalic").getAttribute("aria-pressed")==="true"
    });
  }
  function applyTextStyleFromControls(){
    const style=currentTextStyle(),ids=selectedAtoms.size?[...selectedAtoms]:graph.atoms.map(a=>a.id);
    if(!ids.length){status.textContent="There is no atom text to format yet.";return;}
    ids.forEach(id=>{const a=atomById(id);if(a)a.textStyle={...style};});
    if(!selectedAtoms.size)textDefaults={...style};
    status.textContent="Text style applied to "+(selectedAtoms.size?ids.length+" selected atom"+(ids.length===1?"":"s"):"all atom labels and numbers")+".";
    render();
  }
  function setSvgTextStyle(node,style,sizeFactor=1){
    const s=sanitizeTextStyle(style||textDefaults);
    node.style.fill=s.color;node.style.fontFamily='"'+s.font+'", sans-serif';node.style.fontSize=(s.size*sizeFactor)+"px";
    node.style.fontWeight=s.bold?"700":"400";node.style.fontStyle=s.italic?"italic":"normal";
  }
  function syncDisplayButtons(){
    if(!dialog)return;
    const entries=[
      ["#chemAtomCirclesToggle",showAtomCircles,"Atom circles"],
      ["#chemAtomLabelsToggle",showAtomLabels,"Atom labels"],
      ["#chemAtomNumbersToggle",showAtomNumbers,"Atom numbering"]
    ];
    entries.forEach(([selector,on,label])=>{const b=dialog.querySelector(selector);if(b){b.setAttribute("aria-pressed",String(on));b.textContent=label+": "+(on?"on":"off");b.classList.toggle("active",on);}});
  }
  function showIupacName(){
    const panel=dialog.querySelector("#chemIupacPanel");if(!panel)return;
    panel.hidden=false;
    if(graph.iupac){
      panel.innerHTML="<strong>IUPAC / systematic name</strong><span>"+graph.iupac+"</span>";
    }else if(mode==="pair"){
      panel.innerHTML="<strong>IUPAC name</strong><span>This edited noncovalent pair no longer matches a built-in chemical template. The beta does not infer systematic names for arbitrary edited structures.</span>";
    }else{
      panel.innerHTML="<strong>IUPAC name</strong><span>This drawing has been edited or built manually. Reliable IUPAC naming requires a chemical-structure naming engine, so RNA Explorer will not guess.</span>";
    }
  }
  function ringDefinition(kind){
    if(kind==="fused56"){
      return {points:[[-52,-30],[0,-60],[52,-30],[52,30],[0,60],[-52,30],[105,46],[132,0],[105,-46]],
        bonds:[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[5,0,1],[3,6,1],[6,7,1],[7,8,1],[8,2,1]],iupac:RING_NAMES.fused56};
    }
    const n=kind==="five"?5:6,bondLength=68,r=bondLength/(2*Math.sin(Math.PI/n)),points=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/n;return [Math.cos(a)*r,Math.sin(a)*r];});
    const bonds=Array.from({length:n},(_,i)=>[i,(i+1)%n,kind==="aromatic6"?(i%2===0?2:1):1]);
    return {points,bonds,iupac:RING_NAMES[kind]||null};
  }
  function ringInsertCenter(){
    if(!graph.atoms.length)return {x:410,y:235};
    const maxX=Math.max(...graph.atoms.map(a=>a.x)),minX=Math.min(...graph.atoms.map(a=>a.x));
    if(maxX<650)return {x:Math.min(650,maxX+105),y:235};
    if(minX>170)return {x:Math.max(100,minX-105),y:235};
    return {x:410,y:235};
  }
  function insertRing(kind){
    const def=ringDefinition(kind),center=ringInsertCenter(),wasEmpty=graph.atoms.length===0,newIds=[];
    def.points.forEach(([dx,dy])=>{const id="X"+atomSerial++;newIds.push(id);graph.atoms.push({id,element:"C",x:center.x+dx,y:center.y+dy,charge:0,label:"C",textStyle:{...textDefaults}});});
    def.bonds.forEach(([a,b,order])=>graph.bonds.push({id:"b"+bondSerial++,a:newIds[a],b:newIds[b],order}));
    graph.iupac=wasEmpty?def.iupac:null;selectAtoms(newIds,newIds[0]);render();validate();
    status.textContent=(kind==="aromatic6"?"Aromatic 6-membered":"Ring")+" template inserted. Drag the selected ring to position it.";
  }
  function pointInPolygon(p,poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j],cross=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);
      if(cross)inside=!inside;
    }
    return inside;
  }

  function selectedBounds(){
    const atoms=[...selectedAtoms].map(atomById).filter(Boolean);if(!atoms.length)return null;
    return {minX:Math.min(...atoms.map(a=>a.x)),maxX:Math.max(...atoms.map(a=>a.x)),minY:Math.min(...atoms.map(a=>a.y)),maxY:Math.max(...atoms.map(a=>a.y))};
  }
  function appendTransformOverlay(){
    if(tool!=="select"||selectedAtoms.size<2||selectionBox||lasso||!svg)return;
    const b=selectedBounds();if(!b)return;const pad=22,x=b.minX-pad,y=b.minY-pad,w=Math.max(24,b.maxX-b.minX+pad*2),h=Math.max(24,b.maxY-b.minY+pad*2),cx=x+w/2;
    const layer=document.createElementNS(NS,"g");layer.setAttribute("class","chem-transform-overlay");layer.setAttribute("data-export-remove","");
    const rect=document.createElementNS(NS,"rect");rect.setAttribute("x",x);rect.setAttribute("y",y);rect.setAttribute("width",w);rect.setAttribute("height",h);rect.setAttribute("rx","4");rect.style.fill="none";rect.style.stroke="#f2c66d";rect.style.strokeWidth="1.5";rect.style.strokeDasharray="6 4";rect.style.pointerEvents="none";layer.append(rect);
    const stem=document.createElementNS(NS,"line");stem.setAttribute("x1",cx);stem.setAttribute("y1",y);stem.setAttribute("x2",cx);stem.setAttribute("y2",y-30);stem.style.stroke="#f2c66d";stem.style.strokeWidth="1.5";stem.style.pointerEvents="none";layer.append(stem);
    [["nw",x,y],["ne",x+w,y],["se",x+w,y+h],["sw",x,y+h]].forEach(([name,hx,hy])=>{const c=document.createElementNS(NS,"circle");c.dataset.transformHandle=name;c.setAttribute("cx",hx);c.setAttribute("cy",hy);c.setAttribute("r","7");c.style.fill="#07111c";c.style.stroke="#f2c66d";c.style.strokeWidth="2";c.style.cursor=name+"-resize";layer.append(c);});
    const rotate=document.createElementNS(NS,"circle");rotate.dataset.transformHandle="rotate";rotate.setAttribute("cx",cx);rotate.setAttribute("cy",y-30);rotate.setAttribute("r","8");rotate.style.fill="#f2c66d";rotate.style.stroke="#07111c";rotate.style.strokeWidth="2";rotate.style.cursor="grab";layer.append(rotate);svg.append(layer);
  }
  function beginSelectionTransform(handle,pointerId,start){
    const bounds=selectedBounds();if(!bounds)return false;
    const center={x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2},original=[...selectedAtoms].map(id=>{const a=atomById(id);return a?{id,x:a.x,y:a.y}:null;}).filter(Boolean);
    const dx=start.x-center.x,dy=start.y-center.y;
    transformDrag={pointer:pointerId,kind:handle==="rotate"?"rotate":"scale",center,original,startAngle:Math.atan2(dy,dx),startRadius:Math.max(8,Math.hypot(dx,dy))};return true;
  }
  function moveSelectionTransform(current){
    if(!transformDrag)return;
    const t=transformDrag,dx=current.x-t.center.x,dy=current.y-t.center.y;
    if(t.kind==="rotate"){
      const delta=Math.atan2(dy,dx)-t.startAngle,c=Math.cos(delta),s=Math.sin(delta);
      t.original.forEach(o=>{const a=atomById(o.id);if(!a)return;const ox=o.x-t.center.x,oy=o.y-t.center.y;a.x=t.center.x+ox*c-oy*s;a.y=t.center.y+ox*s+oy*c;});
    }else{
      const scale=clamp(Math.hypot(dx,dy)/t.startRadius,.18,5);
      t.original.forEach(o=>{const a=atomById(o.id);if(a){a.x=t.center.x+(o.x-t.center.x)*scale;a.y=t.center.y+(o.y-t.center.y)*scale;}});
    }
  }
  function attachmentNeighbors(id){
    return graph.bonds.filter(b=>b.a===id||b.b===id).map(b=>({bond:b,atom:atomById(b.a===id?b.b:b.a)})).filter(x=>x.atom);
  }
  function angularDistance(a,b){let d=Math.abs(a-b)%(Math.PI*2);return Math.min(d,Math.PI*2-d);}
  function smartAttachmentPosition(originId,pointer){
    const origin=atomById(originId);if(!origin)return pointer||{x:410,y:235};
    const neighbors=attachmentNeighbors(originId),lengths=neighbors.map(({atom})=>Math.hypot(atom.x-origin.x,atom.y-origin.y)).filter(v=>v>20&&v<160).sort((a,b)=>a-b);
    const length=lengths.length?lengths[Math.floor(lengths.length/2)]:68,targetAngle=pointer?Math.atan2(pointer.y-origin.y,pointer.x-origin.x):0;let angle=targetAngle;
    if(neighbors.length===1){
      const n=neighbors[0],baseAngle=Math.atan2(n.atom.y-origin.y,n.atom.x-origin.x);
      if(Number(n.bond.order||1)>1)angle=baseAngle+Math.PI;
      else{const options=[baseAngle+Math.PI*2/3,baseAngle-Math.PI*2/3];angle=pointer?options.sort((a,b)=>angularDistance(a,targetAngle)-angularDistance(b,targetAngle))[0]:options[0];}
    }else if(neighbors.length>=2){
      const angles=neighbors.map(({atom})=>{let a=Math.atan2(atom.y-origin.y,atom.x-origin.x);if(a<0)a+=Math.PI*2;return a;}).sort((a,b)=>a-b);let bestStart=angles[0],bestGap=-1;
      for(let i=0;i<angles.length;i++){const start=angles[i],end=i===angles.length-1?angles[0]+Math.PI*2:angles[i+1],gap=end-start;if(gap>bestGap){bestGap=gap;bestStart=start;}}
      angle=bestStart+bestGap/2;
    }
    return {x:clamp(origin.x+Math.cos(angle)*length,22,798),y:clamp(origin.y+Math.sin(angle)*length,22,448)};
  }
  function componentCentroid(ids){
    const atoms=[...ids].map(atomById).filter(Boolean);if(!atoms.length)return {x:0,y:0};return {x:atoms.reduce((s,a)=>s+a.x,0)/atoms.length,y:atoms.reduce((s,a)=>s+a.y,0)/atoms.length};
  }
  function sideOfBond(p,a,b){return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);}
  function fuseBonds(firstId,secondId){
    const first=graph.bonds.find(b=>b.id===firstId),second=graph.bonds.find(b=>b.id===secondId);if(!first||!second||first.id===second?.id){status.textContent="Choose two different ring bonds to fuse.";return false;}
    const fixedIds=new Set(covalentComponent(first.a)),movingIds=new Set(covalentComponent(second.a));
    if([...movingIds].some(id=>fixedIds.has(id))){status.textContent="Those bonds are already in the same covalent structure. Choose one bond from each separate ring.";return false;}
    const fA=atomById(first.a),fB=atomById(first.b),sA=atomById(second.a),sB=atomById(second.b);if(!fA||!fB||!sA||!sB)return false;
    const targetLen=Math.hypot(fB.x-fA.x,fB.y-fA.y),sourceLen=Math.hypot(sB.x-sA.x,sB.y-sA.y);if(targetLen<1||sourceLen<1)return false;
    const fixedCenter=componentCentroid(fixedIds),movingCenter=componentCentroid(movingIds),fixedSide=sideOfBond(fixedCenter,fA,fB);
    const candidate=reverse=>{
      const src1=reverse?sB:sA,src2=reverse?sA:sB,sourceAngle=Math.atan2(src2.y-src1.y,src2.x-src1.x),targetAngle=Math.atan2(fB.y-fA.y,fB.x-fA.x),theta=targetAngle-sourceAngle,scale=targetLen/sourceLen,c=Math.cos(theta),s=Math.sin(theta);
      const transform=p=>{const x=(p.x-src1.x)*scale,y=(p.y-src1.y)*scale;return {x:fA.x+x*c-y*s,y:fA.y+x*s+y*c};};
      const movedCenter=transform(movingCenter),movingSide=sideOfBond(movedCenter,fA,fB),opposite=Math.abs(fixedSide)<1||fixedSide*movingSide<0;
      return {reverse,transform,score:(opposite?100000:0)+Math.abs(movingSide)};
    };
    const best=[candidate(false),candidate(true)].sort((a,b)=>b.score-a.score)[0];
    movingIds.forEach(id=>{const a=atomById(id);if(a){const p=best.transform(a);a.x=p.x;a.y=p.y;}});
    const endpointMap=new Map(best.reverse?[[second.b,first.a],[second.a,first.b]]:[[second.a,first.a],[second.b,first.b]]),removed=new Set([second.a,second.b]);
    graph.atoms=graph.atoms.filter(a=>!removed.has(a.id));
    const seen=new Set(),newBonds=[];
    graph.bonds.forEach(b=>{if(b.id===second.id)return;const a=endpointMap.get(b.a)||b.a,c=endpointMap.get(b.b)||b.b;if(a===c)return;const key=[a,c].sort().join("|");if(seen.has(key))return;seen.add(key);newBonds.push({...b,a,b:c});});graph.bonds=newBonds;
    graph.hbonds=graph.hbonds.map(h=>({...h,a:endpointMap.get(h.a)||h.a,b:endpointMap.get(h.b)||h.b})).filter(h=>h.a!==h.b&&atomById(h.a)&&atomById(h.b));
    const ids=[...fixedIds,...movingIds].map(id=>endpointMap.get(id)||id).filter(id=>atomById(id));selectAtoms([...new Set(ids)],first.a);pendingFuseBond=null;invalidateIupac();render();validate();status.textContent="Rings fused: the selected edges now share one pair of atoms and one bond.";return true;
  }

  function loadCurrent(){
    graph=mode==="base"?graphFromBase(base):mode==="pair"?mergePair(leftBase,rightBase):{atoms:[],bonds:[],hbonds:[],iupac:null};
    renumber();render();validate();
  }
  function changeCharge(delta){
    const ids=selectedAtoms.size?[...selectedAtoms]:(selectedAtom?[selectedAtom]:[]);
    if(!ids.length){status.textContent="Select one or more atoms first.";return;}
    pushUndo();
    ids.forEach(id=>{const a=atomById(id);if(a)a.charge=Math.max(-4,Math.min(4,(a.charge||0)+delta));});
    invalidateIupac();render();validate();
  }
  function point(event){
    // Convert pointer coordinates through the SVG transform itself. The previous
    // rect-based mapping ignored preserveAspectRatio letterboxing, which made
    // lasso geometry miss the atoms on many window sizes.
    const ctm=svg.getScreenCTM?.();
    if(ctm&&typeof DOMPoint!=="undefined"){
      try{
        const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(ctm.inverse());
        if(Number.isFinite(p.x)&&Number.isFinite(p.y))return {x:p.x,y:p.y};
      }catch(_error){}
    }
    const rect=svg.getBoundingClientRect(),vb=svg.viewBox?.baseVal;
    const width=vb?.width||820,height=vb?.height||470,x0=vb?.x||0,y0=vb?.y||0;
    return {x:x0+(event.clientX-rect.left)/Math.max(1,rect.width)*width,y:y0+(event.clientY-rect.top)/Math.max(1,rect.height)*height};
  }

  function canvasPointerDown(e){
    if(e.button!==0)return;
    if(tool==="lasso"){
      const p=point(e);lasso={pointer:e.pointerId,points:[p],additive:e.shiftKey};selectionBox=null;
      svg.setPointerCapture?.(e.pointerId);render();return;
    }
    pushUndo();
    const transformEl=e.target.closest?.("[data-transform-handle]");
    if(tool==="select"&&transformEl&&selectedAtoms.size>=2){const p=point(e);if(beginSelectionTransform(transformEl.dataset.transformHandle,e.pointerId,p)){svg.setPointerCapture?.(e.pointerId);render();}return;}
    const atomEl=e.target.closest?.("[data-atom-id]"),bondEl=e.target.closest?.("[data-bond-id]"),hEl=e.target.closest?.("[data-hbond-id]");
    if(tool==="delete"){
      if(atomEl)deleteAtom(atomEl.dataset.atomId);
      else if(bondEl){graph.bonds=graph.bonds.filter(b=>b.id!==bondEl.dataset.bondId);invalidateIupac();}
      else if(hEl)graph.hbonds=graph.hbonds.filter(h=>h.id!==hEl.dataset.hbondId);
      render();validate();return;
    }
    if(tool==="atom"&&!atomEl){
      const p=point(e),id="X"+atomSerial++;
      graph.atoms.push({id,element,x:p.x,y:p.y,charge:0,label:element,textStyle:{...textDefaults}});
      invalidateIupac();selectAtoms([id],id);render();validate();return;
    }
    if(tool==="bond"&&pendingAtom&&!atomEl&&!bondEl&&!hEl){
      const p=smartAttachmentPosition(pendingAtom,point(e)),id="X"+atomSerial++;
      graph.atoms.push({id,element,x:p.x,y:p.y,charge:0,label:element,textStyle:{...textDefaults}});
      graph.bonds.push({id:"b"+bondSerial++,a:pendingAtom,b:id,order:bondOrder});pendingAtom=null;invalidateIupac();selectAtoms([id],id);render();validate();status.textContent="New atom placed at a geometry-aware bond angle. Drag it if you want a different arrangement.";return;
    }
    if(tool==="fuse"&&bondEl){
      const id=bondEl.dataset.bondId;if(!pendingFuseBond){pendingFuseBond=id;status.textContent="First fusion edge selected. Now click one bond on the other ring.";render();}else if(id===pendingFuseBond){pendingFuseBond=null;status.textContent="Fusion selection cleared.";render();}else fuseBonds(pendingFuseBond,id);return;
    }
    if(atomEl){
      const id=atomEl.dataset.atomId;
      if(tool==="select"){
        if(e.shiftKey)toggleAtom(id);
        else if(!selectedAtoms.has(id)||selectedAtoms.size===0)selectAtoms([id],id);
        else selectedAtom=id;
        const a=atomById(id);element=a.element;dialog.querySelector("#chemElement").value=element;
        const p=point(e);
        drag={ids:[...selectedAtoms],pointer:e.pointerId,last:p};svg.setPointerCapture?.(e.pointerId);render();validate();return;
      }
      if(tool==="bond"||tool==="hbond"){
        if(!pendingAtom){pendingAtom=id;selectAtoms([id],id);render();return;}
        if(pendingAtom===id){pendingAtom=null;render();return;}
        if(tool==="bond"){
          const existing=bondBetween(pendingAtom,id);
          if(existing)existing.order=bondOrder;
          else graph.bonds.push({id:"b"+bondSerial++,a:pendingAtom,b:id,order:bondOrder});
          invalidateIupac();
        }else{
          const dup=graph.hbonds.some(h=>(h.a===pendingAtom&&h.b===id)||(h.a===id&&h.b===pendingAtom));
          if(!dup)graph.hbonds.push({id:"h"+hbondSerial++,a:pendingAtom,b:id});
        }
        pendingAtom=null;selectAtoms([id],id);render();validate();return;
      }
    }
    if(bondEl&&tool==="select"){
      const b=graph.bonds.find(x=>x.id===bondEl.dataset.bondId);if(b){b.order=bondOrder;invalidateIupac();status.textContent="Selected bond changed to order "+bondOrder+".";render();validate();return;}
    }
    if(tool==="select"&&!atomEl&&!bondEl&&!hEl){
      const p=point(e);
      if(!e.shiftKey){selectedAtoms.clear();selectedAtom=null;}
      selectionBox={pointer:e.pointerId,start:p,current:p,additive:e.shiftKey};
      svg.setPointerCapture?.(e.pointerId);render();
    }
  }
  function canvasPointerMove(e){
    if(transformDrag&&e.pointerId===transformDrag.pointer){moveSelectionTransform(point(e));render();return;}
    if(lasso&&e.pointerId===lasso.pointer){
      const p=point(e),last=lasso.points.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>3){lasso.points.push(p);render();}return;
    }
    if(drag&&e.pointerId===drag.pointer){
      const p=point(e),dx0=p.x-drag.last.x,dy0=p.y-drag.last.y;
      const atoms=drag.ids.map(atomById).filter(Boolean);if(!atoms.length)return;
      const minX=Math.min(...atoms.map(a=>a.x)),maxX=Math.max(...atoms.map(a=>a.x)),minY=Math.min(...atoms.map(a=>a.y)),maxY=Math.max(...atoms.map(a=>a.y));
      const dx=clamp(dx0,24-minX,796-maxX),dy=clamp(dy0,24-minY,446-maxY);
      atoms.forEach(a=>{a.x+=dx;a.y+=dy;});drag.last=p;render();return;
    }
    if(selectionBox&&e.pointerId===selectionBox.pointer){selectionBox.current=point(e);render();}
  }
  function canvasPointerUp(e){
    if(transformDrag&&e.pointerId===transformDrag.pointer){transformDrag=null;if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);invalidateIupac();render();validate();return;}
    if(lasso&&e.pointerId===lasso.pointer){
      const current=lasso,poly=current.points;
      if(!current.additive)selectedAtoms.clear();
      if(poly.length>=3){
        graph.atoms.filter(a=>{
          if(pointInPolygon({x:a.x,y:a.y},poly))return true;
          const r=14;
          return [[r,0],[-r,0],[0,r],[0,-r]].some(([dx,dy])=>pointInPolygon({x:a.x+dx,y:a.y+dy},poly));
        }).forEach(a=>selectedAtoms.add(a.id));
      }
      selectedAtom=[...selectedAtoms].at(-1)||null;lasso=null;
      if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);
      if(selectedAtom){const a=atomById(selectedAtom);if(a)syncTextControls(a.textStyle||textDefaults);}
      render();validate();return;
    }
    if(drag&&e.pointerId===drag.pointer){drag=null;if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);validate();return;}
    if(selectionBox&&e.pointerId===selectionBox.pointer){
      const {start,current,additive}=selectionBox,loX=Math.min(start.x,current.x),hiX=Math.max(start.x,current.x),loY=Math.min(start.y,current.y),hiY=Math.max(start.y,current.y);
      const ids=graph.atoms.filter(a=>a.x>=loX&&a.x<=hiX&&a.y>=loY&&a.y<=hiY).map(a=>a.id);
      if(!additive)selectedAtoms.clear();ids.forEach(id=>selectedAtoms.add(id));selectedAtom=ids.at(-1)||selectedAtoms.values().next().value||null;
      selectionBox=null;if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);render();validate();
    }
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function deleteAtom(id){
    invalidateIupac();graph.atoms=graph.atoms.filter(a=>a.id!==id);
    graph.bonds=graph.bonds.filter(b=>b.a!==id&&b.b!==id);
    graph.hbonds=graph.hbonds.filter(h=>h.a!==id&&h.b!==id);
    selectedAtoms.delete(id);if(selectedAtom===id)selectedAtom=selectedAtoms.values().next().value||null;
    if(pendingAtom===id)pendingAtom=null;
  }
  function deleteAtoms(ids){[...new Set(ids.filter(Boolean))].forEach(deleteAtom);}

  function bondSegments(a,b,order){
    const ax=Number(a.x),ay=Number(a.y),bx=Number(b.x),by=Number(b.y);
    if(![ax,ay,bx,by].every(Number.isFinite))return [];
    const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1,ox=-dy/len*4,oy=dx/len*4;
    const shifts=order===1?[0]:order===2?[-1,1]:[-1.4,0,1.4];
    return shifts.map(s=>({x1:ax+ox*s,y1:ay+oy*s,x2:bx+ox*s,y2:by+oy*s}));
  }
  function atomCharge(a){
    return a.charge===0?"":a.charge===1?"⁺":a.charge===-1?"⁻":a.charge>1?String(a.charge)+"⁺":String(Math.abs(a.charge))+"⁻";
  }
  function atomText(a){
    const charge=atomCharge(a);
    return (a.label&&a.label!==a.id?a.label:a.element)+charge;
  }
  function atomName(a){return String(a.label||a.id||"").replace(/^[LR]_/, "");}
  function atomBase(a){
    if(mode==="pair"){
      if(String(a.id).startsWith("L_"))return leftBase;
      if(String(a.id).startsWith("R_"))return rightBase;
    }
    return mode==="base"?base:"";
  }
  const CLEAN_LABELS={
    A:{N6:"NH₂",N9:"N",N7:"N",N1:"N",N3:"N"},
    G:{O6:"O",N1:"N–H",N2:"H₂N",N9:"N",N7:"N",N3:"N"},
    C:{N4:"H₂N",N3:"N",O2:"O",N1:"N"},
    U:{O4:"O",N3:"N–H",O2:"O",N1:"N"},
    T:{O4:"O",N3:"N–H",O2:"O",N1:"N"}
  };
  function cleanAtomText(a){
    const name=atomName(a),baseName=atomBase(a);
    const explicit=CLEAN_LABELS[baseName]?.[name];
    if(explicit)return explicit+atomCharge(a);
    if(a.element!=="C")return a.element+atomCharge(a);
    const degree=graph.bonds.reduce((n,b)=>n+(b.a===a.id||b.b===a.id?1:0),0);
    return degree===0?"C"+atomCharge(a):"";
  }
  function appendPairRMarkers(layer){
    if(mode!=="pair"||showAtomCircles)return;
    [["L",leftBase],["R",rightBase]].forEach(([side,b])=>{
      const atomId=side+"_"+(/[AG]/.test(b)?"N9":"N1"),a=atomById(atomId);if(!a)return;
      const line=document.createElementNS(NS,"line");line.setAttribute("x1",a.x);line.setAttribute("y1",a.y+5);line.setAttribute("x2",a.x);line.setAttribute("y2",a.y+28);line.setAttribute("class","chem-glycosidic-r-link");
      const text=document.createElementNS(NS,"text");text.setAttribute("x",a.x);text.setAttribute("y",a.y+45);text.setAttribute("class","chem-glycosidic-r-label");text.textContent="R";
      layer.append(line,text);
    });
  }
  function render(){
    if(!svg)return;
    svg.innerHTML="";
    const bondLayer=document.createElementNS(NS,"g");bondLayer.setAttribute("class","chem-editor-bonds");
    graph.bonds.forEach(b=>{
      const a=atomById(b.a),c=atomById(b.b);if(!a||!c)return;
      const g=document.createElementNS(NS,"g");g.dataset.bondId=b.id;g.setAttribute("class","chem-editor-bond"+(pendingFuseBond===b.id?" pending-fuse":""));
      bondSegments(a,c,b.order).forEach(segment=>{
        const line=document.createElementNS(NS,"line");
        Object.entries(segment).forEach(([key,value])=>line.setAttribute(key,String(value)));
        if(pendingFuseBond===b.id){line.style.stroke="#f2c66d";line.style.strokeWidth="4";}g.append(line);
      });
      bondLayer.append(g);
    });
    const hLayer=document.createElementNS(NS,"g");hLayer.setAttribute("class","chem-editor-hbonds");
    graph.hbonds.forEach(h=>{
      const a=atomById(h.a),b=atomById(h.b);if(!a||!b)return;
      const line=document.createElementNS(NS,"line");line.dataset.hbondId=h.id;line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",b.x);line.setAttribute("y2",b.y);hLayer.append(line);
    });
    const atomLayer=document.createElementNS(NS,"g");atomLayer.setAttribute("class","chem-editor-atoms "+(showAtomCircles?"with-circles":"clean-structure"));
    graph.atoms.forEach((a,index)=>{
      const g=document.createElementNS(NS,"g");g.dataset.atomId=a.id;g.setAttribute("transform",`translate(${a.x} ${a.y})`);
      g.setAttribute("class","chem-editor-atom"+(selectedAtoms.has(a.id)?" selected":"")+(pendingAtom===a.id?" pending":""));
      const circle=document.createElementNS(NS,"circle");circle.setAttribute("r","18");circle.setAttribute("class","chem-atom-circle");g.append(circle);
      const textValue=showAtomLabels?atomText(a):cleanAtomText(a);
      if(textValue){const text=document.createElementNS(NS,"text");text.textContent=textValue;text.setAttribute("y","1");text.setAttribute("class","chem-atom-label");setSvgTextStyle(text,a.textStyle||textDefaults,1);g.append(text);}
      if(showAtomNumbers){const sub=document.createElementNS(NS,"text");sub.textContent=String(index+1);sub.setAttribute("class","chem-atom-id");sub.setAttribute("y","31");setSvgTextStyle(sub,a.textStyle||textDefaults,.6);g.append(sub);}
      atomLayer.append(g);
    });
    const rLayer=document.createElementNS(NS,"g");rLayer.setAttribute("class","chem-editor-r-markers");appendPairRMarkers(rLayer);
    rLayer.querySelectorAll("text").forEach(t=>setSvgTextStyle(t,textDefaults,.88));
    svg.append(bondLayer,hLayer,rLayer,atomLayer);
    appendTransformOverlay();
    if(selectionBox){
      const x=Math.min(selectionBox.start.x,selectionBox.current.x),y=Math.min(selectionBox.start.y,selectionBox.current.y);
      const rect=document.createElementNS(NS,"rect");rect.setAttribute("class","chem-selection-box");rect.setAttribute("x",x);rect.setAttribute("y",y);
      rect.setAttribute("width",Math.abs(selectionBox.current.x-selectionBox.start.x));rect.setAttribute("height",Math.abs(selectionBox.current.y-selectionBox.start.y));svg.append(rect);
    }
    if(lasso&&lasso.points.length){
      const path=document.createElementNS(NS,"polyline");path.setAttribute("class","chem-lasso-path");
      const pts=lasso.points;path.setAttribute("points",[...pts,pts[0]].map(p=>p.x+","+p.y).join(" "));svg.append(path);
    }
  }

  async function exportCurrentDrawing(){
    if(typeof ExportTools==="undefined")throw new Error("Export tools are unavailable.");
    const format=dialog.querySelector("#chemExportFormat").value,scale=Number(dialog.querySelector("#chemExportScale").value)||2,background=dialog.querySelector("#chemExportBackground").value;
    const oldSelected=new Set(selectedAtoms),oldAtom=selectedAtom,oldPending=pendingAtom,oldBox=selectionBox,oldLasso=lasso;
    selectedAtoms.clear();selectedAtom=null;pendingAtom=null;selectionBox=null;lasso=null;render();
    try{
      const label=mode==="pair"?"rna-base-pair-"+leftBase+"-"+rightBase:mode==="blank"?"rna-molecular-drawing":"rna-template-"+String(base).toLowerCase();
      await ExportTools.exportSvgElement(svg,{format,filename:label,scale,background,viewBox:"0 0 820 470"});
      status.textContent=format.toUpperCase()+" image exported.";
    }finally{
      selectedAtoms=oldSelected;selectedAtom=oldAtom;pendingAtom=oldPending;selectionBox=oldBox;lasso=oldLasso;render();
    }
  }

    function validate(){
    const sums={};graph.atoms.forEach(a=>sums[a.id]=0);
    graph.bonds.forEach(b=>{sums[b.a]=(sums[b.a]||0)+Number(b.order||1);sums[b.b]=(sums[b.b]||0)+Number(b.order||1);});
    const warnings=[];
    graph.atoms.forEach(a=>{
      const val=standardValence[a.element];
      if(val&&sums[a.id]>val+Math.max(0,a.charge||0))warnings.push(a.id+" exceeds a simple valence check");
    });
    graph.hbonds.forEach(h=>{
      const a=atomById(h.a),b=atomById(h.b);
      if(a&&b&&!["N","O","S"].includes(a.element)&&!["N","O","S"].includes(b.element))warnings.push("An H-bond does not involve an N/O/S atom");
    });
    status.textContent=warnings.length?warnings.join(" · "):"Ready. Select / move supports box selection; lasso selects freeform groups. Multi-atom selections get resize and rotate handles. Add bond can place a new atom at a geometry-aware angle; Fuse rings merges two selected ring edges.";
    status.classList.toggle("warning",warnings.length>0);
    return warnings;
  }

  function syncCircleButton(){syncDisplayButtons();}
  function openBase(selectedBase,callback){
    ensureDialog();mode="base";base=selectedBase||"A";onSave=callback||null;showAtomCircles=false;showAtomLabels=true;showAtomNumbers=false;syncDisplayButtons();syncTextControls(textDefaults);
    title.textContent="Edit "+((BASES[base]||{}).name||base);
    dialog.querySelector("#chemPairControls").hidden=true;
    graph=graphFromBase(base);renumber();resetUndoHistory();render();validate();dialog.showModal();
  }
  function openPair(a,b,callback){
    ensureDialog();mode="pair";leftBase=a||"G";rightBase=b||"C";onSave=callback||null;showAtomCircles=false;showAtomLabels=true;showAtomNumbers=false;syncDisplayButtons();syncTextControls(textDefaults);
    title.textContent="Base-pair chemistry editor";
    dialog.querySelector("#chemPairControls").hidden=false;
    dialog.querySelector("#chemLeftBase").value=leftBase;dialog.querySelector("#chemRightBase").value=rightBase;
    const identity=leftBase+rightBase;
    graph=/^(GC|CG)$/.test(identity)?pairTemplate("GC",leftBase,rightBase)
      :/^(AU|UA)$/.test(identity)?pairTemplate("AU",leftBase,rightBase)
      :/^(GU|UG)$/.test(identity)?pairTemplate("GU",leftBase,rightBase)
      :mergePair(leftBase,rightBase);
    renumber();resetUndoHistory();render();validate();dialog.showModal();
  }
  function openBlank(callback){
    ensureDialog();mode="blank";onSave=callback||null;showAtomCircles=false;showAtomLabels=true;showAtomNumbers=false;syncDisplayButtons();syncTextControls(textDefaults);
    title.textContent="New molecular drawing";
    dialog.querySelector("#chemPairControls").hidden=true;
    graph={atoms:[],bonds:[],hbonds:[],iupac:null};renumber();resetUndoHistory();render();validate();
    status.textContent="Blank canvas. Choose Add atom to begin, then connect atoms with Add bond.";
    dialog.showModal();
  }

  function setup(){
    ensureDialog();
    const chosen=document.getElementById("chosenBase");
    if(chosen&&!document.getElementById("editNucleobaseButton")){
      const button=document.createElement("button");button.type="button";button.id="editNucleobaseButton";button.className="secondary-action";button.textContent="Edit selected nucleobase";
      const note=document.createElement("p");note.id="customBaseStatus";note.className="input-help";note.textContent="Open the molecular editor to add/delete atoms or bonds, change bond orders, charges, or atom types.";
      chosen.insertAdjacentElement("afterend",button);button.insertAdjacentElement("afterend",note);
      button.addEventListener("click",()=>openBase(chemistry.base,()=>{
        note.textContent="Custom "+chemistry.base+" structure saved for this session. Reopen the editor to continue editing.";
      }));
    }
  }

  function getSessionSnapshot(){
    return {savedBases:clone(savedBases)};
  }
  function restoreSessionSnapshot(snapshot={}){
    if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))throw new Error("Project chemistry data are invalid.");
    Object.keys(savedBases).forEach(key=>delete savedBases[key]);
    Object.entries(snapshot.savedBases||{}).forEach(([key,value])=>{if(BASES[key]&&value)savedBases[key]=sanitizeSavedBase(value,key);});
    if(dialog?.open)loadCurrent();
    return getSessionSnapshot();
  }

  return {setup,openBase,openPair,openBlank,getBaseGraph:graphFromBase,getSavedBase:b=>savedBases[b]?clone(savedBases[b]):null,pairTemplate,
    getSessionSnapshot,restoreSessionSnapshot,
    validateGraph:g=>{const old=graph;graph=clone(g);const w=validate();graph=old;return w;}};
})();