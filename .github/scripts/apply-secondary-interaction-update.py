from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)

# Molecular Drawing: show the live angle beside the rotation handle.
p = Path("chemistry-editor.js")
s = p.read_text()
s = replace_once(
    s,
    '    const rotate=document.createElementNS(NS,"circle");rotate.dataset.transformHandle="rotate";rotate.setAttribute("cx",cx);rotate.setAttribute("cy",y-30);rotate.setAttribute("r","8");rotate.style.fill="#f2c66d";rotate.style.stroke="#07111c";rotate.style.strokeWidth="2";rotate.style.cursor="grab";layer.append(rotate);svg.append(layer);',
    '    const rotate=document.createElementNS(NS,"circle");rotate.dataset.transformHandle="rotate";rotate.setAttribute("cx",cx);rotate.setAttribute("cy",y-30);rotate.setAttribute("r","8");rotate.style.fill="#f2c66d";rotate.style.stroke="#07111c";rotate.style.strokeWidth="2";rotate.style.cursor="grab";layer.append(rotate);\n    if(transformDrag?.kind==="rotate"){const angle=document.createElementNS(NS,"text");angle.setAttribute("x",cx+14);angle.setAttribute("y",y-34);angle.setAttribute("class","chem-rotation-angle");angle.setAttribute("pointer-events","none");angle.textContent=Math.round(transformDrag.deltaDegrees||0)+"°";layer.append(angle);}\n    svg.append(layer);',
    "chem rotate overlay",
)
s = replace_once(
    s,
    '    transformDrag={pointer:pointerId,kind:handle==="rotate"?"rotate":"scale",center,original,startAngle:Math.atan2(dy,dx),startRadius:Math.max(8,Math.hypot(dx,dy))};return true;',
    '    transformDrag={pointer:pointerId,kind:handle==="rotate"?"rotate":"scale",center,original,startAngle:Math.atan2(dy,dx),startRadius:Math.max(8,Math.hypot(dx,dy)),deltaDegrees:0};return true;',
    "chem transform start",
)
s = replace_once(
    s,
    '      const delta=Math.atan2(dy,dx)-t.startAngle,c=Math.cos(delta),s=Math.sin(delta);\n      t.original.forEach(o=>{const a=atomById(o.id);if(!a)return;const ox=o.x-t.center.x,oy=o.y-t.center.y;a.x=t.center.x+ox*c-oy*s;a.y=t.center.y+ox*s+oy*c;});',
    '      const delta=Math.atan2(dy,dx)-t.startAngle,c=Math.cos(delta),s=Math.sin(delta);t.deltaDegrees=delta*180/Math.PI;\n      t.original.forEach(o=>{const a=atomById(o.id);if(!a)return;const ox=o.x-t.center.x,oy=o.y-t.center.y;a.x=t.center.x+ox*c-oy*s;a.y=t.center.y+ox*s+oy*c;});',
    "chem transform move",
)
p.write_text(s)

p = Path("chemistry-editor.css")
s = p.read_text()
if ".chem-rotation-angle{" not in s:
    s += '\n.chem-rotation-angle{fill:#f5e9c8;font:700 14px "DM Mono",monospace;paint-order:stroke;stroke:#07111c;stroke-width:4px;stroke-linejoin:round}\n'
p.write_text(s)

# Secondary Structure: independent residue-index positions + remove legacy move-only undo/redo buttons.
p = Path("secondary.js")
s = p.read_text()
s = replace_once(s, '  let panX=0,panY=0,indexMode="default",indexSelection=new Set(),indexOverrides={};', '  let panX=0,panY=0,indexMode="default",indexSelection=new Set(),indexOverrides={},indexLabelOffsets={};', "index state")
s = replace_once(s, '      legendSettings,residueOverrides,backboneOverrides,indexMode,indexSelection:[...indexSelection],indexOverrides,pinnedResidues:[...pinnedResidues],', '      legendSettings,residueOverrides,backboneOverrides,indexMode,indexSelection:[...indexSelection],indexOverrides,indexLabelOffsets,pinnedResidues:[...pinnedResidues],', "snapshot index offsets")
s = replace_once(s, '      residueOverrides=w.residueOverrides||{};backboneOverrides=w.backboneOverrides||{};indexMode=w.indexMode||"default";indexSelection=new Set(w.indexSelection||[]);indexOverrides=w.indexOverrides||{};pinnedResidues=new Set(w.pinnedResidues||[]);', '      residueOverrides=w.residueOverrides||{};backboneOverrides=w.backboneOverrides||{};indexMode=w.indexMode||"default";indexSelection=new Set(w.indexSelection||[]);indexOverrides=w.indexOverrides||{};indexLabelOffsets=w.indexLabelOffsets&&typeof w.indexLabelOffsets==="object"?w.indexLabelOffsets:{};pinnedResidues=new Set(w.pinnedResidues||[]);', "restore index offsets")
s = replace_once(s, '      indexMode="default";indexOverrides={};indexSelection=new Set([...sequence].map((_,i)=>i).filter(i=>i===0||(i+1)%5===0||i===sequence.length-1));', '      indexMode="default";indexOverrides={};indexLabelOffsets={};indexSelection=new Set([...sequence].map((_,i)=>i).filter(i=>i===0||(i+1)%5===0||i===sequence.length-1));', "reset index offsets")
s = replace_once(
    s,
    '        const style={...indexSettings,...indexOverrides[i]};\n        const number=text(g,String(i+1),{x:layout==="arc"?0:away.x/norm*30,y:layout==="arc"?36:away.y/norm*30+4,fill:style.color,"font-size":style.size,"font-family":style.font,"font-style":style.fontStyle==="italic"?"italic":"normal","font-weight":style.fontStyle==="bold"?700:400,"text-anchor":"middle"});\n        number.setAttribute("class","se-index");',
    '        const style={...indexSettings,...indexOverrides[i]},indexOffset=indexLabelOffsets[i]||{x:0,y:0};\n        const number=text(g,String(i+1),{x:(layout==="arc"?0:away.x/norm*30)+(Number(indexOffset.x)||0),y:(layout==="arc"?36:away.y/norm*30+4)+(Number(indexOffset.y)||0),fill:style.color,"font-size":style.size,"font-family":style.font,"font-style":style.fontStyle==="italic"?"italic":"normal","font-weight":style.fontStyle==="bold"?700:400,"text-anchor":"middle"});\n        number.setAttribute("class","se-index");number.setAttribute("data-index-label",String(i));number.setAttribute("role","button");number.setAttribute("aria-label","Residue index "+(i+1)+". Drag to reposition the label without moving the residue.");',
    "index render",
)
s = replace_once(
    s,
    '  function installNodeDragging(root){\n    root.addEventListener("pointerdown",event=>{\n      if(event.button!==0)return;\n      const node=event.target.closest?.(".se-node");if(!node)return;',
    '  function installNodeDragging(root){\n    let indexDrag=null;\n    const historyCheckpoint=()=>{if(typeof window!=="undefined"&&typeof Event!=="undefined")window.dispatchEvent(new Event("rna-secondary-history-checkpoint"));};\n    root.addEventListener("pointerdown",event=>{\n      if(event.button!==0)return;\n      const indexLabel=event.target.closest?.("[data-index-label]");\n      if(indexLabel){\n        const index=Number(indexLabel.dataset.indexLabel);if(!Number.isInteger(index))return;\n        historyCheckpoint();const start=pointerInSecondary(event),base=indexLabelOffsets[index]||{x:0,y:0};\n        indexDrag={pointer:event.pointerId,index,start,base:{x:Number(base.x)||0,y:Number(base.y)||0},moved:false};\n        root.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopPropagation();return;\n      }\n      const node=event.target.closest?.(".se-node");if(!node)return;',
    "index drag begin",
)
s = replace_once(s, '      pushLayoutHistory();\n      const start=pointerInSecondary(event),base={};', '      historyCheckpoint();pushLayoutHistory();\n      const start=pointerInSecondary(event),base={};', "node history checkpoint")
s = replace_once(
    s,
    '    root.addEventListener("pointermove",event=>{\n      if(!nodeDrag||event.pointerId!==nodeDrag.pointer)return;\n      const p=pointerInSecondary(event),dx=p.x-nodeDrag.start.x,dy=p.y-nodeDrag.start.y;',
    '    root.addEventListener("pointermove",event=>{\n      if(indexDrag&&event.pointerId===indexDrag.pointer){\n        const p=pointerInSecondary(event),dx=p.x-indexDrag.start.x,dy=p.y-indexDrag.start.y;if(Math.hypot(dx,dy)>1)indexDrag.moved=true;\n        indexLabelOffsets[indexDrag.index]={x:indexDrag.base.x+dx,y:indexDrag.base.y+dy};suppressNodeClick=indexDrag.moved;render();return;\n      }\n      if(!nodeDrag||event.pointerId!==nodeDrag.pointer)return;\n      const p=pointerInSecondary(event),dx=p.x-nodeDrag.start.x,dy=p.y-nodeDrag.start.y;',
    "index drag move",
)
s = replace_once(
    s,
    '    const finish=event=>{\n      if(!nodeDrag||event.pointerId!==nodeDrag.pointer)return;\n      const moved=nodeDrag.moved;nodeDrag=null;',
    '    const finish=event=>{\n      if(indexDrag&&event.pointerId===indexDrag.pointer){\n        const moved=indexDrag.moved,index=indexDrag.index;indexDrag=null;if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);\n        if($("seDragStatus"))$("seDragStatus").textContent=moved?"Residue index "+(index+1)+" moved. The RNA structure itself was not changed.":"Drag a residue index to reposition only its label.";\n        setTimeout(()=>suppressNodeClick=false,60);return;\n      }\n      if(!nodeDrag||event.pointerId!==nodeDrag.pointer)return;\n      const moved=nodeDrag.moved;nodeDrag=null;',
    "index drag finish",
)
s = replace_once(
    s,
    'toolbar.innerHTML=\'<button id="seZoomOut" type="button" aria-label="Zoom out">−</button><output id="seZoomValue" aria-live="polite">100%</output><button id="seZoomIn" type="button" aria-label="Zoom in">+</button><button id="seZoomReset" type="button">Fit structure</button><button id="seUndoLayout" type="button">Undo move</button><button id="seRedoLayout" type="button">Redo move</button><label>Move<select id="seDragMode"><option value="residue">Nucleotide</option><option value="branch">Stem / branch</option><option value="whole">Whole structure</option></select></label><label class="se-inline-check"><input id="seFlexDrag" type="checkbox" checked> Flexible neighbors</label><button id="sePinSelected" type="button">Pin selected</button><button id="seResetManualLayout" type="button">Reset layout edits</button><label>Go to residue<input id="seGoToResidue" type="number" min="1" value="1"></label><button id="seGoToButton" type="button">Go</button><button id="seExportDialogButton" type="button">Export…</button>\';',
    'toolbar.innerHTML=\'<button id="seZoomOut" type="button" aria-label="Zoom out">−</button><output id="seZoomValue" aria-live="polite">100%</output><button id="seZoomIn" type="button" aria-label="Zoom in">+</button><button id="seZoomReset" type="button">Fit structure</button><label>Move<select id="seDragMode"><option value="residue">Nucleotide</option><option value="branch">Stem / branch</option><option value="whole">Whole structure</option></select></label><label class="se-inline-check"><input id="seFlexDrag" type="checkbox" checked> Flexible neighbors</label><button id="sePinSelected" type="button">Pin selected</button><button id="seResetManualLayout" type="button">Reset layout edits</button><label>Go to residue<input id="seGoToResidue" type="number" min="1" value="1"></label><button id="seGoToButton" type="button">Go</button><button id="seExportDialogButton" type="button">Export…</button>\';',
    "remove legacy undo buttons",
)
s = replace_once(s, '    $("seUndoLayout").addEventListener("click",undoLayout);$("seRedoLayout").addEventListener("click",redoLayout);\n', '', "remove legacy undo listeners")
s = replace_once(s, '    $("seResetManualLayout").addEventListener("click",()=>{pushLayoutHistory();manualOffsets={};pinnedResidues.clear();$("seDragStatus").textContent="Manual layout edits cleared.";render();});', '    $("seResetManualLayout").addEventListener("click",()=>{if(typeof window!=="undefined"&&typeof Event!=="undefined")window.dispatchEvent(new Event("rna-secondary-history-checkpoint"));pushLayoutHistory();manualOffsets={};pinnedResidues.clear();$("seDragStatus").textContent="Manual layout edits cleared.";render();});', "reset history checkpoint")
p.write_text(s)

# Secondary selection/history tools: grouped like Molecular Drawing, with selection-local rotate/scale handles.
Path("secondary-selection-tools.js").write_text(r'''const SecondarySelectionTools=(()=>{
  let mode="",gesture=null,overlay=null,transformGesture=null;
  let undoStack=[],redoStack=[],continuousEdit=false,restoringHistory=false;
  const $=id=>document.getElementById(id),svgNS="http://www.w3.org/2000/svg";
  function snapshot(){try{return JSON.stringify(SecondaryExplorer?.getWorkspaceSnapshot?.()||null);}catch(_){return null;}}
  function syncHistoryButtons(){const u=$("seUndo"),r=$("seRedo");if(u)u.disabled=undoStack.length===0;if(r)r.disabled=redoStack.length===0;}
  function remember(){if(restoringHistory)return;const snap=snapshot();if(!snap)return;if(undoStack.at(-1)!==snap)undoStack.push(snap);if(undoStack.length>80)undoStack.shift();redoStack=[];syncHistoryButtons();}
  function restoreHistory(raw){if(!raw)return;restoringHistory=true;try{SecondaryExplorer.restoreWorkspaceSnapshot(JSON.parse(raw));syncTransformControls();syncSelectionState();}finally{restoringHistory=false;}syncHistoryButtons();drawSelectedTransformOverlay();}
  function undo(){if(!undoStack.length)return;const current=snapshot(),previous=undoStack.pop();if(current)redoStack.push(current);restoreHistory(previous);}
  function redo(){if(!redoStack.length)return;const current=snapshot(),next=redoStack.pop();if(current)undoStack.push(current);restoreHistory(next);}
  function beginContinuousEdit(){if(!continuousEdit){remember();continuousEdit=true;}}
  function endContinuousEdit(){continuousEdit=false;}
  function point(event){const root=$("secondarySvg"),ctm=root?.getScreenCTM?.();if(ctm&&typeof DOMPoint!=="undefined"){try{const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(ctm.inverse());if(Number.isFinite(p.x)&&Number.isFinite(p.y))return{x:p.x,y:p.y};}catch(_){}}const rect=root.getBoundingClientRect(),v=root.getAttribute("viewBox").split(/\s+/).map(Number);return{x:v[0]+(event.clientX-rect.left)/rect.width*v[2],y:v[1]+(event.clientY-rect.top)/rect.height*v[3]};}
  function pointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j],cross=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(cross)inside=!inside;}return inside;}
  function setMode(next){mode=mode===next?"":next;[["seBoxSelectTool","box"],["seLassoSelectTool","lasso"]].forEach(([id,key])=>{const b=$(id);if(!b)return;const active=mode===key;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});const root=$("secondarySvg");if(root)root.classList.toggle("se-selecting",Boolean(mode));if($("seSelectionStatus"))$("seSelectionStatus").textContent=mode==="box"?"Drag a rectangle around the residues to select.":mode==="lasso"?"Draw a freeform loop around the residues to select.":selectionMessage();drawSelectedTransformOverlay();}
  function selectionMessage(){const n=SecondaryExplorer?.getContext?.().selectedResidues?.length||0;return n?`${n} residue${n===1?"":"s"} selected. Use the handles on the selection box to rotate or zoom that region.`:"No region selected.";}
  function syncSelectionState(){const n=SecondaryExplorer?.getContext?.().selectedResidues?.length||0;const reset=$("seResetSelectedTransform");if(reset)reset.disabled=n===0;if(!mode&&$("seSelectionStatus"))$("seSelectionStatus").textContent=selectionMessage();drawSelectedTransformOverlay();}
  function syncTransformControls(){const state=SecondaryExplorer?.getTransformState?.();if(!state)return;const whole=$("seWholeRotation");if(whole){whole.value=String(state.wholeRotation);$("seWholeRotationValue").textContent=Math.round(state.wholeRotation)+"°";}}
  function removeOverlay(){overlay?.remove();overlay=null;}
  function drawGestureOverlay(){const root=$("secondarySvg");if(!root||!gesture)return;removeOverlay();if(mode==="box"){const a=gesture.start,b=gesture.points.at(-1)||a,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);overlay=document.createElementNS(svgNS,"rect");Object.entries({x,y,width:w,height:h}).forEach(([k,v])=>overlay.setAttribute(k,v));}else{overlay=document.createElementNS(svgNS,"path");const pts=gesture.points;overlay.setAttribute("d",pts.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ")+(pts.length>2?" Z":""));}overlay.classList.add("se-selection-overlay");overlay.setAttribute("data-export-remove","");overlay.setAttribute("pointer-events","none");root.append(overlay);}
  function selectedBounds(){const positions=SecondaryExplorer?.getCurrentPositions?.()||[],indices=SecondaryExplorer?.getContext?.().selectedResidues||[],pts=indices.map(i=>positions[i]).filter(Boolean);if(pts.length<2)return null;return{minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};}
  function drawSelectedTransformOverlay(){const root=$("secondarySvg");if(!root)return;root.querySelectorAll(".se-selected-transform-overlay").forEach(el=>el.remove());if(mode||gesture)return;const b=selectedBounds();if(!b)return;const pad=28,x=b.minX-pad,y=b.minY-pad,w=Math.max(52,b.maxX-b.minX+pad*2),h=Math.max(52,b.maxY-b.minY+pad*2),cx=x+w/2;const layer=document.createElementNS(svgNS,"g");layer.setAttribute("class","se-selected-transform-overlay");layer.setAttribute("data-export-remove","");const rect=document.createElementNS(svgNS,"rect");Object.entries({x,y,width:w,height:h,rx:5}).forEach(([k,v])=>rect.setAttribute(k,v));rect.setAttribute("class","se-selected-transform-box");layer.append(rect);const stem=document.createElementNS(svgNS,"line");Object.entries({x1:cx,y1:y,x2:cx,y2:y-32}).forEach(([k,v])=>stem.setAttribute(k,v));stem.setAttribute("class","se-transform-stem");layer.append(stem);[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].forEach(([hx,hy])=>{const c=document.createElementNS(svgNS,"circle");c.dataset.seTransformHandle="scale";c.setAttribute("cx",hx);c.setAttribute("cy",hy);c.setAttribute("r",7);c.setAttribute("class","se-transform-handle se-scale-handle");layer.append(c);});const rotate=document.createElementNS(svgNS,"circle");rotate.dataset.seTransformHandle="rotate";rotate.setAttribute("cx",cx);rotate.setAttribute("cy",y-32);rotate.setAttribute("r",8);rotate.setAttribute("class","se-transform-handle se-rotate-handle");layer.append(rotate);if(transformGesture?.kind==="rotate"){const label=document.createElementNS(svgNS,"text");label.setAttribute("x",cx+14);label.setAttribute("y",y-36);label.setAttribute("class","se-rotation-angle");label.textContent=Math.round(transformGesture.liveRotation)+"°";layer.append(label);}root.append(layer);}
  function selectedIndicesFromGesture(){const positions=SecondaryExplorer.getCurrentPositions(),current=SecondaryExplorer.getContext().selectedResidues||[];let hit=[];if(mode==="box"){const a=gesture.start,b=gesture.points.at(-1)||a,minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);hit=positions.map((p,i)=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY?i:-1).filter(i=>i>=0);}else if(gesture.points.length>=3)hit=positions.map((p,i)=>pointInPolygon(p,gesture.points)?i:-1).filter(i=>i>=0);return gesture.additive?[...new Set([...current,...hit])]:hit;}
  function resetSelectedTransform(){SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncSelectionState();}
  function beginTransform(event,handle){const b=selectedBounds();if(!b)return;event.preventDefault();event.stopImmediatePropagation();remember();const p=point(event),state=SecondaryExplorer.getTransformState(),center={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},dx=p.x-center.x,dy=p.y-center.y;transformGesture={pointer:event.pointerId,kind:handle,center,startAngle:Math.atan2(dy,dx),startRadius:Math.max(8,Math.hypot(dx,dy)),baseRotation:state.selectionRotation,baseScale:state.selectionScale,liveRotation:state.selectionRotation};$("secondarySvg").setPointerCapture?.(event.pointerId);}
  function moveTransform(event){if(!transformGesture||event.pointerId!==transformGesture.pointer)return false;event.preventDefault();event.stopImmediatePropagation();const p=point(event),t=transformGesture,dx=p.x-t.center.x,dy=p.y-t.center.y;if(t.kind==="rotate"){let rotation=t.baseRotation+(Math.atan2(dy,dx)-t.startAngle)*180/Math.PI;while(rotation>180)rotation-=360;while(rotation<-180)rotation+=360;t.liveRotation=rotation;SecondaryExplorer.setSelectionTransform({rotation,scale:t.baseScale});}else{const scale=Math.max(.35,Math.min(3,t.baseScale*Math.hypot(dx,dy)/t.startRadius));SecondaryExplorer.setSelectionTransform({rotation:t.baseRotation,scale});}drawSelectedTransformOverlay();return true;}
  function finishTransform(event){if(!transformGesture||event.pointerId!==transformGesture.pointer)return false;event.preventDefault();event.stopImmediatePropagation();const root=$("secondarySvg");if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);transformGesture=null;drawSelectedTransformOverlay();return true;}
  function begin(event){const handle=event.target.closest?.("[data-se-transform-handle]");if(handle){beginTransform(event,handle.dataset.seTransformHandle);return;}if(!mode||event.button!==0)return;const root=$("secondarySvg");if(!root)return;event.preventDefault();event.stopImmediatePropagation();const p=point(event);gesture={pointer:event.pointerId,start:p,points:[p],additive:event.shiftKey};root.setPointerCapture?.(event.pointerId);drawGestureOverlay();}
  function move(event){if(moveTransform(event))return;if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();const p=point(event);if(mode==="box")gesture.points=[gesture.start,p];else if(Math.hypot(p.x-gesture.points.at(-1).x,p.y-gesture.points.at(-1).y)>2)gesture.points.push(p);drawGestureOverlay();}
  function finish(event){if(finishTransform(event))return;if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();const root=$("secondarySvg");if(mode==="lasso")gesture.points.push(point(event));else gesture.points=[gesture.start,point(event)];const indices=selectedIndicesFromGesture();if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);gesture=null;removeOverlay();remember();SecondaryExplorer.highlightResidues(indices);SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncSelectionState();if($("seSelectionStatus"))$("seSelectionStatus").textContent=indices.length?`${indices.length} residue${indices.length===1?"":"s"} selected.`:"Nothing was inside the selection.";}
  function cancel(){gesture=null;transformGesture=null;removeOverlay();drawSelectedTransformOverlay();}
  function buildToolbar(){const stage=document.querySelector("#scene-secondary .secondary-stage"),existing=stage?.querySelector(".se-toolbar");if(!stage||!existing||$("seTransformToolbar"))return;const bar=document.createElement("div");bar.id="seTransformToolbar";bar.className="se-transform-toolbar";bar.innerHTML=`<details class="se-tool-group" open><summary>History</summary><div class="se-tool-group-body"><button id="seUndo" type="button" disabled title="Undo (Ctrl+Z / ⌘Z)">Undo</button><button id="seRedo" type="button" disabled title="Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)">Redo</button></div></details><details class="se-tool-group" open><summary>Select · Residues & regions</summary><div class="se-tool-group-body"><button id="seBoxSelectTool" type="button" aria-pressed="false">Select / move</button><button id="seLassoSelectTool" type="button" aria-pressed="false">Lasso select</button><button id="seClearRegionSelection" type="button">Clear selection</button><button id="seResetSelectedTransform" type="button" disabled>Reset selected transform</button></div><p id="seSelectionStatus" role="status">No region selected.</p></details>`;existing.before(bar);const viewport=stage.querySelector(".se-viewport");const dock=document.createElement("div");dock.className="se-whole-rotation-dock";dock.innerHTML=`<label>Rotate whole structure <input id="seWholeRotation" type="range" min="-180" max="180" step="1" value="0"><output id="seWholeRotationValue">0°</output></label>`;(viewport||$("secondarySvg")).insertAdjacentElement("afterend",dock);
    $("seUndo").addEventListener("click",undo);$("seRedo").addEventListener("click",redo);$("seBoxSelectTool").addEventListener("click",()=>setMode("box"));$("seLassoSelectTool").addEventListener("click",()=>setMode("lasso"));$("seClearRegionSelection").addEventListener("click",()=>{remember();SecondaryExplorer.clearHighlights();SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncSelectionState();});$("seResetSelectedTransform").addEventListener("click",()=>{remember();resetSelectedTransform();});
    const whole=$("seWholeRotation");whole.addEventListener("pointerdown",beginContinuousEdit);whole.addEventListener("pointerup",endContinuousEdit);whole.addEventListener("change",endContinuousEdit);whole.addEventListener("blur",endContinuousEdit);whole.addEventListener("keydown",event=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key))beginContinuousEdit();});whole.addEventListener("input",e=>{beginContinuousEdit();const value=Number(e.target.value);$("seWholeRotationValue").textContent=value+"°";SecondaryExplorer.setWholeRotation(value);});
    const root=$("secondarySvg");root.addEventListener("pointerdown",begin,true);root.addEventListener("pointermove",move,true);root.addEventListener("pointerup",finish,true);root.addEventListener("pointercancel",finish,true);document.addEventListener("keydown",event=>{if(event.key==="Escape"){cancel();setMode("");return;}const target=event.target,typing=target?.matches?.("input:not([type=range]),textarea,[contenteditable=true]");if(typing)return;const mod=event.ctrlKey||event.metaKey;if(!mod)return;if(event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();}else if(event.ctrlKey&&event.key.toLowerCase()==="y"){event.preventDefault();redo();}});window.addEventListener("rna-secondary-history-checkpoint",remember);window.addEventListener("rna-secondary-layout",()=>{syncSelectionState();syncTransformControls();});window.addEventListener("rna-secondary-select",syncSelectionState);syncTransformControls();syncSelectionState();}
  function setup(){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",buildToolbar,{once:true});else buildToolbar();}
  return{setup,setMode,syncSelectionState,remember};
})();
SecondarySelectionTools.setup();
''')

# Secondary UI styles, preserving homepage/learning styles that live later in this file.
p = Path("secondary-selection-tools.css")
s = p.read_text()
marker = "/* Homepage Did-you-know strip */"
if marker not in s:
    raise SystemExit("missing secondary css marker")
tail = s[s.index(marker):]
head = r'''/* Secondary region selection and transform controls */
.se-transform-toolbar{display:flex;flex-wrap:wrap;gap:9px;align-items:flex-start;padding:0;background:transparent}
.se-tool-group{border:1px solid rgba(116,215,182,.24);border-radius:10px;background:rgba(116,215,182,.035);min-width:210px}
.se-tool-group>summary{cursor:pointer;padding:9px 11px;color:var(--cream);font-size:.8rem;font-weight:750;list-style-position:inside}
.se-tool-group-body{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 10px 10px}
.se-tool-group button{border:1px solid var(--line);background:var(--ink-soft);color:var(--text);border-radius:7px;padding:8px 10px;cursor:pointer}
.se-tool-group button.active,.se-tool-group button[aria-pressed="true"]{border-color:var(--mint);background:rgba(116,215,182,.12);color:var(--mint)}
.se-tool-group button:disabled{opacity:.42;cursor:default}
#seSelectionStatus{margin:0;padding:0 11px 10px;color:var(--muted);font-size:.75rem;line-height:1.45}
.se-whole-rotation-dock{display:flex;justify-content:center;margin:9px 0 4px;padding:9px 12px;border:1px solid rgba(116,215,182,.2);border-radius:10px;background:rgba(116,215,182,.025)}
.se-whole-rotation-dock label{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:.8rem}.se-whole-rotation-dock input[type="range"]{width:min(520px,52vw)}.se-whole-rotation-dock output{min-width:48px;color:var(--cream);font:12px "DM Mono",monospace;text-align:right}
#secondarySvg.se-selecting{cursor:crosshair;touch-action:none}.se-selection-overlay{stroke:#74d7b6;stroke-width:2;stroke-dasharray:7 5;fill:rgba(116,215,182,.10);vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 3px rgba(116,215,182,.35))}
.se-selected-transform-box{fill:none;stroke:#f2c66d;stroke-width:1.6;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;pointer-events:none}.se-transform-stem{stroke:#f2c66d;stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:none}.se-transform-handle{stroke:#07111c;stroke-width:2;vector-effect:non-scaling-stroke;cursor:pointer}.se-scale-handle{fill:#07111c;stroke:#f2c66d;cursor:nwse-resize}.se-rotate-handle{fill:#f2c66d;cursor:grab}.se-rotation-angle{fill:#f5e9c8;font:700 14px "DM Mono",monospace;paint-order:stroke;stroke:#07111c;stroke-width:4px;stroke-linejoin:round;pointer-events:none}
.se-index[data-index-label]{cursor:move;pointer-events:all;user-select:none}.se-index[data-index-label]:hover{fill:#f5e9c8!important;filter:drop-shadow(0 0 3px rgba(245,233,200,.55))}
@media(max-width:720px){.se-transform-toolbar{display:grid;grid-template-columns:1fr}.se-tool-group{min-width:0;width:100%}.se-whole-rotation-dock label{display:grid;grid-template-columns:1fr auto;width:100%}.se-whole-rotation-dock input[type="range"]{grid-column:1/2;width:100%}.se-whole-rotation-dock output{grid-column:2/3;grid-row:1/3;align-self:center}}

'''
p.write_text(head + tail)

# Cache bust the edited assets.
p = Path("index.html")
s = p.read_text()
s = s.replace("chemistry-editor.js?v=chem-editor-12", "chemistry-editor.js?v=chem-editor-13", 1)
s = s.replace("chemistry-editor.css?v=chem-editor-7", "chemistry-editor.css?v=chem-editor-8", 1)
s = s.replace("secondary.js?v=secondary-23", "secondary.js?v=secondary-24", 1)
s = s.replace("secondary-selection-tools.js?v=2", "secondary-selection-tools.js?v=3", 1)
s = s.replace("secondary-selection-tools.css?v=2", "secondary-selection-tools.css?v=3", 1)
p.write_text(s)

print("PATCH_OK")
