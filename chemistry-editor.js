const MoleculeEditor = (() => {
  const NS="http://www.w3.org/2000/svg";
  const savedBases={};
  const standardValence={H:1,C:4,N:3,O:2,P:5,S:6,F:1,Cl:1,Br:1,I:1};

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
    }
  };

  function clone(obj){return JSON.parse(JSON.stringify(obj));}
  function graphFromBase(base){
    const src=savedBases[base]||BASES[base]||BASES.A;
    return {
      atoms:src.atoms.map(a=>({id:a[0]||a.id,element:a[1]||a.element,x:a[2]??a.x,y:a[3]??a.y,charge:a[4]??a.charge??0,label:a[0]||a.id})),
      bonds:src.bonds.map((b,i)=>({id:"b"+i,a:b[0]||b.a,b:b[1]||b.b,order:b[2]||b.order||1})),
      hbonds:[]
    };
  }
  function storeBase(base,graph){
    savedBases[base]={
      name:(BASES[base]||{}).name||base,
      atoms:graph.atoms.map(a=>[a.id,a.element,a.x,a.y,a.charge||0]),
      bonds:graph.bonds.map(b=>[b.a,b.b,b.order])
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
    return {atoms,bonds,hbonds:[],leftIds,rightIds};
  }
  function pairTemplate(kind,left,right){
    const p=mergePair(left,right);
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
  let graph={atoms:[],bonds:[],hbonds:[]},tool="select",element="C",bondOrder=1,selectedAtom=null,selectedAtoms=new Set(),pendingAtom=null,drag=null,selectionBox=null,onSave=null;
  let atomSerial=1,bondSerial=1,hbondSerial=1;

  const atomById=id=>graph.atoms.find(a=>a.id===id);
  const bondBetween=(a,b)=>graph.bonds.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));

  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement("dialog");dialog.id="chemEditorDialog";dialog.className="chem-editor-dialog";
    dialog.innerHTML=`
      <div class="chem-editor-shell">
        <header><div><p class="eyebrow">RNA chemistry editor</p><h2 id="chemEditorTitle">Nucleobase editor</h2></div><button id="chemEditorClose" class="chem-editor-close" type="button" aria-label="Close">×</button></header>
        <div class="chem-editor-toolbar" role="toolbar" aria-label="Molecular drawing tools">
          <button type="button" data-chem-tool="select" class="active">Select / move</button>
          <button type="button" id="chemSelectAll">Select all</button>
          <button type="button" data-chem-tool="atom">Add atom</button>
          <button type="button" data-chem-tool="bond">Add bond</button>
          <button type="button" data-chem-tool="hbond">H-bond</button>
          <button type="button" data-chem-tool="delete">Delete</button>
          <label>Element<select id="chemElement"><option>C</option><option>N</option><option>O</option><option>H</option><option>P</option><option>S</option><option>F</option><option>Cl</option><option>Br</option><option>I</option></select></label>
          <label>Bond order<select id="chemBondOrder"><option value="1">Single</option><option value="2">Double</option><option value="3">Triple</option></select></label>
          <button type="button" id="chemChargeMinus">Charge −</button><button type="button" id="chemChargePlus">Charge +</button>
        </div>
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
          <div><button type="button" id="chemEditorReset">Reset</button><button type="button" id="chemEditorSave" class="primary-action">Save structure</button></div>
        </div>
      </div>`;
    document.body.append(dialog);
    svg=dialog.querySelector("#chemEditorSvg");status=dialog.querySelector("#chemEditorStatus");title=dialog.querySelector("#chemEditorTitle");
    dialog.querySelector("#chemEditorClose").addEventListener("click",()=>dialog.close());
    dialog.querySelectorAll("[data-chem-tool]").forEach(b=>b.addEventListener("click",()=>{
      tool=b.dataset.chemTool;pendingAtom=null;
      dialog.querySelectorAll("[data-chem-tool]").forEach(x=>x.classList.toggle("active",x===b));render();
    }));
    dialog.querySelector("#chemSelectAll").addEventListener("click",()=>{selectAtoms(graph.atoms.map(a=>a.id));render();});
    dialog.querySelector("#chemSelectLeft").addEventListener("click",()=>{selectAtoms(graph.atoms.filter(a=>a.id.startsWith("L_")).map(a=>a.id));render();});
    dialog.querySelector("#chemSelectRight").addEventListener("click",()=>{selectAtoms(graph.atoms.filter(a=>a.id.startsWith("R_")).map(a=>a.id));render();});
    dialog.querySelector("#chemSelectPair").addEventListener("click",()=>{selectAtoms(graph.atoms.map(a=>a.id));render();});
    dialog.querySelector("#chemElement").addEventListener("change",e=>{
      element=e.target.value;
      if(selectedAtom){const a=atomById(selectedAtom);if(a){a.element=element;a.label=element;render();validate();}}
    });
    dialog.querySelector("#chemBondOrder").addEventListener("change",e=>bondOrder=Number(e.target.value));
    dialog.querySelector("#chemChargeMinus").addEventListener("click",()=>changeCharge(-1));
    dialog.querySelector("#chemChargePlus").addEventListener("click",()=>changeCharge(1));
    dialog.querySelector("#chemExportScale").addEventListener("input",e=>dialog.querySelector("#chemExportScaleValue").textContent=e.target.value+"×");
    dialog.querySelector("#chemExportButton").addEventListener("click",async()=>{status.textContent="Preparing export…";try{await exportCurrentDrawing();}catch(error){status.textContent="Export failed: "+error.message;}});
    dialog.querySelector("#chemEditorReset").addEventListener("click",()=>loadCurrent());
    dialog.querySelector("#chemEditorSave").addEventListener("click",()=>{
      if(mode==="base")storeBase(base,graph);
      if(onSave)onSave(clone(graph));
      status.textContent=mode==="base"?"Saved edited "+base+" structure for this session.":"Saved custom base-pair drawing for this session.";
    });
    dialog.querySelector("#chemLeftBase").addEventListener("change",e=>leftBase=e.target.value);
    dialog.querySelector("#chemRightBase").addEventListener("change",e=>rightBase=e.target.value);
    dialog.querySelector("#chemLoadPair").addEventListener("click",()=>{graph=mergePair(leftBase,rightBase);renumber();render();validate();});
    dialog.querySelectorAll("[data-pair-template]").forEach(b=>b.addEventListener("click",()=>{
      const k=b.dataset.pairTemplate;
      if(k==="GC"){leftBase="G";rightBase="C";}
      if(k==="AU"){leftBase="A";rightBase="U";}
      if(k==="GU"){leftBase="G";rightBase="U";}
      dialog.querySelector("#chemLeftBase").value=leftBase;dialog.querySelector("#chemRightBase").value=rightBase;
      graph=pairTemplate(k,leftBase,rightBase);renumber();render();validate();
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
      if(e.key==="Escape"&&selectedAtoms.size){selectedAtoms.clear();selectedAtom=null;render();return;}
      if((e.key==="Delete"||e.key==="Backspace")&&(selectedAtoms.size||selectedAtom)){
        e.preventDefault();deleteAtoms(selectedAtoms.size?[...selectedAtoms]:[selectedAtom]);selectedAtom=null;render();validate();
      }
    });
  }

  function renumber(){
    atomSerial=graph.atoms.length+1;bondSerial=graph.bonds.length+1;hbondSerial=graph.hbonds.length+1;
    selectedAtom=null;selectedAtoms.clear();pendingAtom=null;drag=null;selectionBox=null;
  }
  function selectAtoms(ids,activeId=null){
    selectedAtoms=new Set(ids.filter(id=>atomById(id)));
    selectedAtom=activeId&&selectedAtoms.has(activeId)?activeId:(selectedAtoms.values().next().value||null);
    if(selectedAtom){
      const a=atomById(selectedAtom);element=a?.element||element;
      if(dialog&&a&&dialog.querySelector("#chemElement"))dialog.querySelector("#chemElement").value=element;
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
  function loadCurrent(){
    graph=mode==="base"?graphFromBase(base):mergePair(leftBase,rightBase);renumber();render();validate();
  }
  function changeCharge(delta){
    const ids=selectedAtoms.size?[...selectedAtoms]:(selectedAtom?[selectedAtom]:[]);
    if(!ids.length){status.textContent="Select one or more atoms first.";return;}
    ids.forEach(id=>{const a=atomById(id);if(a)a.charge=Math.max(-4,Math.min(4,(a.charge||0)+delta));});
    render();validate();
  }
  function point(event){
    const rect=svg.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width*820,y:(event.clientY-rect.top)/rect.height*470};
  }

  function canvasPointerDown(e){
    if(e.button!==0)return;
    const atomEl=e.target.closest?.("[data-atom-id]"),bondEl=e.target.closest?.("[data-bond-id]"),hEl=e.target.closest?.("[data-hbond-id]");
    if(tool==="delete"){
      if(atomEl)deleteAtom(atomEl.dataset.atomId);
      else if(bondEl)graph.bonds=graph.bonds.filter(b=>b.id!==bondEl.dataset.bondId);
      else if(hEl)graph.hbonds=graph.hbonds.filter(h=>h.id!==hEl.dataset.hbondId);
      render();validate();return;
    }
    if(tool==="atom"&&!atomEl){
      const p=point(e),id="X"+atomSerial++;
      graph.atoms.push({id,element,x:p.x,y:p.y,charge:0,label:element});
      selectAtoms([id],id);render();validate();return;
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
        }else{
          const dup=graph.hbonds.some(h=>(h.a===pendingAtom&&h.b===id)||(h.a===id&&h.b===pendingAtom));
          if(!dup)graph.hbonds.push({id:"h"+hbondSerial++,a:pendingAtom,b:id});
        }
        pendingAtom=null;selectAtoms([id],id);render();validate();return;
      }
    }
    if(bondEl&&tool==="select"){
      const b=graph.bonds.find(x=>x.id===bondEl.dataset.bondId);if(b){b.order=bondOrder;status.textContent="Selected bond changed to order "+bondOrder+".";render();validate();return;}
    }
    if(tool==="select"&&!atomEl&&!bondEl&&!hEl){
      const p=point(e);
      if(!e.shiftKey){selectedAtoms.clear();selectedAtom=null;}
      selectionBox={pointer:e.pointerId,start:p,current:p,additive:e.shiftKey};
      svg.setPointerCapture?.(e.pointerId);render();
    }
  }
  function canvasPointerMove(e){
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
    graph.atoms=graph.atoms.filter(a=>a.id!==id);
    graph.bonds=graph.bonds.filter(b=>b.a!==id&&b.b!==id);
    graph.hbonds=graph.hbonds.filter(h=>h.a!==id&&h.b!==id);
    selectedAtoms.delete(id);if(selectedAtom===id)selectedAtom=selectedAtoms.values().next().value||null;
    if(pendingAtom===id)pendingAtom=null;
  }
  function deleteAtoms(ids){[...new Set(ids.filter(Boolean))].forEach(deleteAtom);}

  function bondLines(a,b,order){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ox=-dy/len*4,oy=dx/len*4;
    const shifts=order===1?[0]:order===2?[-1,1]:[-1.4,0,1.4];
    return shifts.map(s=>`<line x1="${a.x+ox*s}" y1="${a.y+oy*s}" x2="${b.x+ox*s}" y2="${b.y+oy*s}"/>`).join("");
  }
  function atomText(a){
    const charge=a.charge===0?"":a.charge===1?"⁺":a.charge===-1?"⁻":a.charge>1?String(a.charge)+"⁺":String(Math.abs(a.charge))+"⁻";
    const label=(a.label&&a.label!==a.id?a.label:a.element)+charge;
    return label;
  }
  function render(){
    if(!svg)return;
    svg.innerHTML="";
    const bondLayer=document.createElementNS(NS,"g");bondLayer.setAttribute("class","chem-editor-bonds");
    graph.bonds.forEach(b=>{
      const a=atomById(b.a),c=atomById(b.b);if(!a||!c)return;
      const g=document.createElementNS(NS,"g");g.dataset.bondId=b.id;g.setAttribute("class","chem-editor-bond");
      g.innerHTML=bondLines(a,c,b.order);bondLayer.append(g);
    });
    const hLayer=document.createElementNS(NS,"g");hLayer.setAttribute("class","chem-editor-hbonds");
    graph.hbonds.forEach(h=>{
      const a=atomById(h.a),b=atomById(h.b);if(!a||!b)return;
      const line=document.createElementNS(NS,"line");line.dataset.hbondId=h.id;line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",b.x);line.setAttribute("y2",b.y);hLayer.append(line);
    });
    const atomLayer=document.createElementNS(NS,"g");atomLayer.setAttribute("class","chem-editor-atoms");
    graph.atoms.forEach(a=>{
      const g=document.createElementNS(NS,"g");g.dataset.atomId=a.id;g.setAttribute("transform",`translate(${a.x} ${a.y})`);
      g.setAttribute("class","chem-editor-atom"+(selectedAtoms.has(a.id)?" selected":"")+(pendingAtom===a.id?" pending":""));
      const circle=document.createElementNS(NS,"circle");circle.setAttribute("r","18");g.append(circle);
      const text=document.createElementNS(NS,"text");text.textContent=atomText(a);text.setAttribute("y","1");g.append(text);
      const sub=document.createElementNS(NS,"text");sub.textContent=a.id;sub.setAttribute("class","chem-atom-id");sub.setAttribute("y","31");g.append(sub);
      atomLayer.append(g);
    });
    svg.append(bondLayer,hLayer,atomLayer);
    if(selectionBox){
      const x=Math.min(selectionBox.start.x,selectionBox.current.x),y=Math.min(selectionBox.start.y,selectionBox.current.y);
      const rect=document.createElementNS(NS,"rect");rect.setAttribute("class","chem-selection-box");rect.setAttribute("x",x);rect.setAttribute("y",y);
      rect.setAttribute("width",Math.abs(selectionBox.current.x-selectionBox.start.x));rect.setAttribute("height",Math.abs(selectionBox.current.y-selectionBox.start.y));svg.append(rect);
    }
  }

  async function exportCurrentDrawing(){
    if(typeof ExportTools==="undefined")throw new Error("Export tools are unavailable.");
    const format=dialog.querySelector("#chemExportFormat").value,scale=Number(dialog.querySelector("#chemExportScale").value)||2,background=dialog.querySelector("#chemExportBackground").value;
    const oldSelected=new Set(selectedAtoms),oldAtom=selectedAtom,oldPending=pendingAtom,oldBox=selectionBox;
    selectedAtoms.clear();selectedAtom=null;pendingAtom=null;selectionBox=null;render();
    try{
      const label=mode==="pair"?"rna-base-pair-"+leftBase+"-"+rightBase:"rna-nucleobase-"+base;
      await ExportTools.exportSvgElement(svg,{format,filename:label,scale,background,viewBox:"0 0 820 470"});
      status.textContent=format.toUpperCase()+" image exported.";
    }finally{
      selectedAtoms=oldSelected;selectedAtom=oldAtom;pendingAtom=oldPending;selectionBox=oldBox;render();
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
    status.textContent=warnings.length?warnings.join(" · "):"Ready. Click an atom to move it; Shift-click or drag a box to select multiple atoms. Double-click an atom to select its whole covalent structure, then drag any selected atom to move the group.";
    status.classList.toggle("warning",warnings.length>0);
    return warnings;
  }

  function openBase(selectedBase,callback){
    ensureDialog();mode="base";base=selectedBase||"A";onSave=callback||null;
    title.textContent="Edit "+((BASES[base]||{}).name||base);
    dialog.querySelector("#chemPairControls").hidden=true;
    graph=graphFromBase(base);renumber();render();validate();dialog.showModal();
  }
  function openPair(a,b,callback){
    ensureDialog();mode="pair";leftBase=a||"G";rightBase=b||"C";onSave=callback||null;
    title.textContent="Base-pair chemistry editor";
    dialog.querySelector("#chemPairControls").hidden=false;
    dialog.querySelector("#chemLeftBase").value=leftBase;dialog.querySelector("#chemRightBase").value=rightBase;
    const identity=leftBase+rightBase;
    graph=/^(GC|CG)$/.test(identity)?pairTemplate("GC",leftBase,rightBase)
      :/^(AU|UA)$/.test(identity)?pairTemplate("AU",leftBase,rightBase)
      :/^(GU|UG)$/.test(identity)?pairTemplate("GU",leftBase,rightBase)
      :mergePair(leftBase,rightBase);
    renumber();render();validate();dialog.showModal();
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

  return {setup,openBase,openPair,getBaseGraph:graphFromBase,getSavedBase:b=>savedBases[b]?clone(savedBases[b]):null,pairTemplate,validateGraph:g=>{const old=graph;graph=clone(g);const w=validate();graph=old;return w;}};
})();