const SecondarySelectionTools=(()=>{
  let mode="",gesture=null,overlay=null;
  let undoStack=[],redoStack=[],continuousEdit=false,restoringHistory=false;
  const $=id=>document.getElementById(id);
  function snapshot(){try{return JSON.stringify(SecondaryExplorer?.getWorkspaceSnapshot?.()||null);}catch(_){return null;}}
  function syncHistoryButtons(){const u=$("seUndo"),r=$("seRedo");if(u)u.disabled=undoStack.length===0;if(r)r.disabled=redoStack.length===0;}
  function remember(){if(restoringHistory)return;const snap=snapshot();if(!snap)return;if(undoStack.at(-1)!==snap)undoStack.push(snap);if(undoStack.length>80)undoStack.shift();redoStack=[];syncHistoryButtons();}
  function restoreHistory(raw){if(!raw)return;restoringHistory=true;try{SecondaryExplorer.restoreWorkspaceSnapshot(JSON.parse(raw));syncTransformControls();syncSelectionState();}finally{restoringHistory=false;}syncHistoryButtons();}
  function undo(){if(!undoStack.length)return;const current=snapshot();const previous=undoStack.pop();if(current)redoStack.push(current);restoreHistory(previous);}
  function redo(){if(!redoStack.length)return;const current=snapshot();const next=redoStack.pop();if(current)undoStack.push(current);restoreHistory(next);}
  function beginContinuousEdit(){if(!continuousEdit){remember();continuousEdit=true;}}
  function endContinuousEdit(){continuousEdit=false;}
  const svgNS="http://www.w3.org/2000/svg";
  function point(event){
    const root=$("secondarySvg"),ctm=root?.getScreenCTM?.();
    if(ctm&&typeof DOMPoint!=="undefined"){
      try{const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(ctm.inverse());if(Number.isFinite(p.x)&&Number.isFinite(p.y))return {x:p.x,y:p.y};}catch(_){ }
    }
    const rect=root.getBoundingClientRect(),v=root.getAttribute("viewBox").split(/\s+/).map(Number);
    return {x:v[0]+(event.clientX-rect.left)/rect.width*v[2],y:v[1]+(event.clientY-rect.top)/rect.height*v[3]};
  }
  function pointInPolygon(p,poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      const crosses=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);
      if(crosses)inside=!inside;
    }
    return inside;
  }
  function setMode(next){
    mode=mode===next?"":next;
    [["seBoxSelectTool","box"],["seLassoSelectTool","lasso"]].forEach(([id,key])=>{const b=$(id);if(!b)return;const active=mode===key;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
    const root=$("secondarySvg");if(root)root.classList.toggle("se-selecting",Boolean(mode));
    if($("seSelectionStatus"))$("seSelectionStatus").textContent=mode==="box"?"Drag a rectangle around the residues to select.":mode==="lasso"?"Draw a freeform loop around the residues to select.":selectionMessage();
  }
  function selectionMessage(){
    const n=SecondaryExplorer?.getContext?.().selectedResidues?.length||0;
    return n?`${n} residue${n===1?"":"s"} selected. Use Selected rotate or Selected zoom to transform only that region.`:"No region selected.";
  }
  function syncSelectionState(){
    const n=SecondaryExplorer?.getContext?.().selectedResidues?.length||0;
    ["seSelectedRotation","seSelectedScale","seResetSelectedTransform"].forEach(id=>{const el=$(id);if(el)el.disabled=n===0;});
    if(!mode&&$("seSelectionStatus"))$("seSelectionStatus").textContent=selectionMessage();
  }
  function syncTransformControls(){
    const state=SecondaryExplorer?.getTransformState?.();if(!state)return;
    const whole=$("seWholeRotation"),selectedRotate=$("seSelectedRotation"),selectedScale=$("seSelectedScale");
    if(whole){whole.value=String(state.wholeRotation);$("seWholeRotationValue").textContent=Math.round(state.wholeRotation)+"°";}
    if(selectedRotate){selectedRotate.value=String(state.selectionRotation);$("seSelectedRotationValue").textContent=Math.round(state.selectionRotation)+"°";}
    if(selectedScale){selectedScale.value=String(state.selectionScale);$("seSelectedScaleValue").textContent=Math.round(state.selectionScale*100)+"%";}
  }
  function removeOverlay(){overlay?.remove();overlay=null;}
  function drawOverlay(){
    const root=$("secondarySvg");if(!root||!gesture)return;removeOverlay();
    if(mode==="box"){
      const a=gesture.start,b=gesture.points.at(-1)||a,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
      overlay=document.createElementNS(svgNS,"rect");overlay.setAttribute("x",x);overlay.setAttribute("y",y);overlay.setAttribute("width",w);overlay.setAttribute("height",h);
    }else{
      overlay=document.createElementNS(svgNS,"path");const pts=gesture.points;overlay.setAttribute("d",pts.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ")+(pts.length>2?" Z":""));overlay.setAttribute("fill","rgba(116,215,182,.10)");
    }
    overlay.classList.add("se-selection-overlay");overlay.setAttribute("data-export-remove","");overlay.setAttribute("pointer-events","none");root.append(overlay);
  }
  function selectedIndicesFromGesture(){
    const positions=SecondaryExplorer.getCurrentPositions(),current=SecondaryExplorer.getContext().selectedResidues||[];
    let hit=[];
    if(mode==="box"){
      const a=gesture.start,b=gesture.points.at(-1)||a,minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
      hit=positions.map((p,i)=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY?i:-1).filter(i=>i>=0);
    }else if(gesture.points.length>=3){
      hit=positions.map((p,i)=>pointInPolygon(p,gesture.points)?i:-1).filter(i=>i>=0);
    }
    return gesture.additive?[...new Set([...current,...hit])]:hit;
  }
  function resetSelectedTransform(){
    if($("seSelectedRotation"))$("seSelectedRotation").value="0";
    if($("seSelectedScale"))$("seSelectedScale").value="1";
    if($("seSelectedRotationValue"))$("seSelectedRotationValue").textContent="0°";
    if($("seSelectedScaleValue"))$("seSelectedScaleValue").textContent="100%";
    SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});
  }
  function begin(event){
    if(!mode||event.button!==0)return;
    const root=$("secondarySvg");if(!root)return;
    event.preventDefault();event.stopImmediatePropagation();
    const p=point(event);gesture={pointer:event.pointerId,start:p,points:[p],additive:event.shiftKey};root.setPointerCapture?.(event.pointerId);drawOverlay();
  }
  function move(event){
    if(!gesture||event.pointerId!==gesture.pointer)return;
    event.preventDefault();event.stopImmediatePropagation();const p=point(event);
    if(mode==="box")gesture.points=[gesture.start,p];else if(Math.hypot(p.x-gesture.points.at(-1).x,p.y-gesture.points.at(-1).y)>2)gesture.points.push(p);
    drawOverlay();
  }
  function finish(event){
    if(!gesture||event.pointerId!==gesture.pointer)return;
    event.preventDefault();event.stopImmediatePropagation();const root=$("secondarySvg");
    if(mode==="lasso")gesture.points.push(point(event));else gesture.points=[gesture.start,point(event)];
    const indices=selectedIndicesFromGesture();if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);
    gesture=null;removeOverlay();remember();SecondaryExplorer.highlightResidues(indices);resetSelectedTransform();syncSelectionState();
    if($("seSelectionStatus"))$("seSelectionStatus").textContent=indices.length?`${indices.length} residue${indices.length===1?"":"s"} selected.`:"Nothing was inside the selection.";
  }
  function cancel(){gesture=null;removeOverlay();}
  function buildToolbar(){
    const stage=document.querySelector("#scene-secondary .secondary-stage"),existing=stage?.querySelector(".se-toolbar");if(!stage||!existing||$("seTransformToolbar"))return;
    const bar=document.createElement("div");bar.id="seTransformToolbar";bar.className="se-transform-toolbar";
    bar.innerHTML=`<div class="se-history-group" role="group" aria-label="Undo and redo secondary structure changes">
      <button id="seUndo" type="button" disabled title="Undo (Ctrl+Z / ⌘Z)">Undo</button>
      <button id="seRedo" type="button" disabled title="Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)">Redo</button>
    </div>
    <div class="se-transform-group" role="group" aria-label="Secondary structure selection tools">
      <strong>Select region</strong>
      <button id="seBoxSelectTool" type="button" aria-pressed="false">Box select</button>
      <button id="seLassoSelectTool" type="button" aria-pressed="false">Lasso</button>
      <button id="seClearRegionSelection" type="button">Clear</button>
    </div>
    <label class="se-transform-range">Rotate structure <input id="seWholeRotation" type="range" min="-180" max="180" step="1" value="0"><output id="seWholeRotationValue">0°</output></label>
    <label class="se-transform-range">Selected rotate <input id="seSelectedRotation" type="range" min="-180" max="180" step="1" value="0" disabled><output id="seSelectedRotationValue">0°</output></label>
    <label class="se-transform-range">Selected zoom <input id="seSelectedScale" type="range" min="0.5" max="2" step="0.05" value="1" disabled><output id="seSelectedScaleValue">100%</output></label>
    <button id="seResetSelectedTransform" type="button" disabled>Reset selected</button>
    <p id="seSelectionStatus" role="status">No region selected.</p>`;
    existing.before(bar);
    $("seUndo").addEventListener("click",undo);$("seRedo").addEventListener("click",redo);
    $("seBoxSelectTool").addEventListener("click",()=>setMode("box"));$("seLassoSelectTool").addEventListener("click",()=>setMode("lasso"));
    $("seClearRegionSelection").addEventListener("click",()=>{remember();SecondaryExplorer.clearHighlights();resetSelectedTransform();syncSelectionState();});
    ["seWholeRotation","seSelectedRotation","seSelectedScale"].forEach(id=>{const el=$(id);el.addEventListener("pointerdown",beginContinuousEdit);el.addEventListener("keydown",event=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key))beginContinuousEdit();});el.addEventListener("pointerup",endContinuousEdit);el.addEventListener("change",endContinuousEdit);el.addEventListener("blur",endContinuousEdit);});
    $("seWholeRotation").addEventListener("input",e=>{beginContinuousEdit();const value=Number(e.target.value);$("seWholeRotationValue").textContent=value+"°";SecondaryExplorer.setWholeRotation(value);});
    $("seSelectedRotation").addEventListener("input",e=>{beginContinuousEdit();const value=Number(e.target.value),scale=Number($("seSelectedScale").value);$("seSelectedRotationValue").textContent=value+"°";SecondaryExplorer.setSelectionTransform({rotation:value,scale});});
    $("seSelectedScale").addEventListener("input",e=>{beginContinuousEdit();const scale=Number(e.target.value),rotation=Number($("seSelectedRotation").value);$("seSelectedScaleValue").textContent=Math.round(scale*100)+"%";SecondaryExplorer.setSelectionTransform({rotation,scale});});
    $("seResetSelectedTransform").addEventListener("click",()=>{remember();resetSelectedTransform();});
    const root=$("secondarySvg");root.addEventListener("pointerdown",begin,true);root.addEventListener("pointermove",move,true);root.addEventListener("pointerup",finish,true);root.addEventListener("pointercancel",cancel,true);
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"){cancel();setMode("");return;}
      const target=event.target,typing=target?.matches?.("input:not([type=range]),textarea,[contenteditable=true]");if(typing)return;
      const mod=event.ctrlKey||event.metaKey;if(!mod)return;
      if(event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();}
      else if(event.ctrlKey&&event.key.toLowerCase()==="y"){event.preventDefault();redo();}
    });
    window.addEventListener("rna-secondary-layout",syncSelectionState);window.addEventListener("rna-secondary-select",syncSelectionState);
    syncTransformControls();syncSelectionState();
  }
  function setup(){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",buildToolbar,{once:true});else buildToolbar();}
  return {setup,setMode,syncSelectionState};
})();
SecondarySelectionTools.setup();
