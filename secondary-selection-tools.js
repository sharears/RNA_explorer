const SecondarySelectionTools=(()=>{
  let mode="",gesture=null,overlay=null,transformGesture=null,indexGesture=null;
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
  function setMode(next){mode=mode===next?"":next;[["seBoxSelectTool","box"],["seLassoSelectTool","lasso"]].forEach(([id,key])=>{const b=$(id);if(!b)return;const active=mode===key;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});const root=$("secondarySvg");if(root)root.classList.add("se-selecting");syncSelectionState();if($("seSelectionStatus"))$("seSelectionStatus").textContent=mode==="lasso"?"Drag on empty space to draw a freeform lasso. Clicking a residue or bond still opens its editor.":"Drag on empty space to box-select. Click residues, pairs, or backbone lines to edit them normally.";drawSelectedTransformOverlay();}
  function isRegionMode(){return mode==="box"||mode==="lasso";}
  function selectionMessage(){const n=SecondaryExplorer?.getContext?.().selectedResidues?.length||0;return n?`${n} residue${n===1?"":"s"} selected. Use the handles on the selection box to rotate or zoom that region.`:"No region selected.";}
  function syncSelectionState(){const n=SecondaryExplorer?.getContext?.().selectedResidues?.length||0;const reset=$("seResetSelectedTransform");if(reset)reset.disabled=n===0;const selectedRotation=$("seSelectedRotation");if(selectedRotation)selectedRotation.disabled=n<2;const hasSelection=n>0||(SecondaryExplorer?.getContext?.().selectedPairKeys?.length||0)>0;["seCopySelectedSvg","seDownloadSelectedSvg"].forEach(id=>{const b=$(id);if(b)b.disabled=!hasSelection;});if(!mode&&$("seSelectionStatus"))$("seSelectionStatus").textContent=n?selectionMessage():"Drag on empty space to box-select; click an individual residue or bond to edit.";drawSelectedTransformOverlay();}
  function syncTransformControls(){const state=SecondaryExplorer?.getTransformState?.();if(!state)return;const whole=$("seWholeRotation");if(whole){whole.value=String(state.wholeRotation);$("seWholeRotationValue").textContent=Math.round(state.wholeRotation)+"°";}const selected=$("seSelectedRotation");if(selected){selected.value=String(state.selectionRotation);$("seSelectedRotationValue").textContent=Math.round(state.selectionRotation)+"°";}}
  function removeOverlay(){overlay?.remove();overlay=null;}
  function drawGestureOverlay(){const root=$("secondarySvg");if(!root||!gesture)return;root.querySelectorAll(".se-selected-transform-overlay").forEach(el=>el.remove());removeOverlay();if(gesture.kind==="box"){const a=gesture.start,b=gesture.points.at(-1)||a,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);overlay=document.createElementNS(svgNS,"rect");Object.entries({x,y,width:w,height:h}).forEach(([k,v])=>overlay.setAttribute(k,v));}else{overlay=document.createElementNS(svgNS,"path");const pts=gesture.points;overlay.setAttribute("d",pts.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ")+(pts.length>2?" Z":""));}overlay.classList.add("se-selection-overlay");overlay.setAttribute("data-export-remove","");overlay.setAttribute("pointer-events","none");root.append(overlay);}
  function selectedBounds(){const positions=SecondaryExplorer?.getCurrentPositions?.()||[],indices=SecondaryExplorer?.getContext?.().selectedResidues||[],pts=indices.map(i=>positions[i]).filter(Boolean);if(pts.length<2)return null;return{minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};}
  function drawSelectedTransformOverlay(){const root=$("secondarySvg");if(!root)return;root.querySelectorAll(".se-selected-transform-overlay").forEach(el=>el.remove());if(gesture)return;const b=selectedBounds();if(!b)return;const pad=22,x=b.minX-pad,y=b.minY-pad,w=Math.max(24,b.maxX-b.minX+pad*2),h=Math.max(24,b.maxY-b.minY+pad*2),cx=x+w/2;const layer=document.createElementNS(svgNS,"g");layer.setAttribute("class","se-selected-transform-overlay");layer.setAttribute("data-export-remove","");const rect=document.createElementNS(svgNS,"rect");Object.entries({x,y,width:w,height:h,rx:4}).forEach(([k,v])=>rect.setAttribute(k,v));rect.setAttribute("class","se-selected-transform-box");layer.append(rect);const stem=document.createElementNS(svgNS,"line");Object.entries({x1:cx,y1:y,x2:cx,y2:y-30}).forEach(([k,v])=>stem.setAttribute(k,v));stem.setAttribute("class","se-transform-stem");layer.append(stem);[["nw",x,y],["ne",x+w,y],["se",x+w,y+h],["sw",x,y+h]].forEach(([name,hx,hy])=>{const c=document.createElementNS(svgNS,"circle");c.dataset.seTransformHandle=name;c.setAttribute("cx",hx);c.setAttribute("cy",hy);c.setAttribute("r",7);c.setAttribute("class","se-transform-handle se-scale-handle se-scale-handle-"+name);layer.append(c);});const rotate=document.createElementNS(svgNS,"circle");rotate.dataset.seTransformHandle="rotate";rotate.setAttribute("cx",cx);rotate.setAttribute("cy",y-30);rotate.setAttribute("r",8);rotate.setAttribute("class","se-transform-handle se-rotate-handle");layer.append(rotate);if(transformGesture?.kind==="rotate"){const label=document.createElementNS(svgNS,"text");label.setAttribute("x",cx+14);label.setAttribute("y",y-34);label.setAttribute("class","se-rotation-angle");label.textContent=Math.round(transformGesture.liveRotation)+"°";layer.append(label);}const state=SecondaryExplorer?.getTransformState?.()||{selectionScale:1};const tip=document.createElementNS(svgNS,"text");tip.setAttribute("x",cx+14);tip.setAttribute("y",y-40);tip.setAttribute("class","se-rotate-hint");tip.textContent="↻ rotate";layer.append(tip);const zoom=document.createElementNS(svgNS,"text");zoom.setAttribute("x",x+w-8);zoom.setAttribute("y",y+h-9);zoom.setAttribute("text-anchor","end");zoom.setAttribute("class","se-transform-zoom-label");zoom.setAttribute("pointer-events","none");zoom.textContent=Math.round((Number(state.selectionScale)||1)*100)+"%";layer.append(zoom);root.append(layer);}
  function selectedIndicesFromGesture(){const positions=SecondaryExplorer.getCurrentPositions(),current=SecondaryExplorer.getContext().selectedResidues||[];let hit=[];if(gesture.kind==="box"){const a=gesture.start,b=gesture.points.at(-1)||a,minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);hit=positions.map((p,i)=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY?i:-1).filter(i=>i>=0);}else if(gesture.points.length>=3)hit=positions.map((p,i)=>pointInPolygon(p,gesture.points)?i:-1).filter(i=>i>=0);return gesture.additive?[...new Set([...current,...hit])]:hit;}
  function resetSelectedTransform(){SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncTransformControls();syncSelectionState();}
  function beginTransform(event,handle){const b=selectedBounds();if(!b)return;event.preventDefault();event.stopImmediatePropagation();remember();const p=point(event),state=SecondaryExplorer.getTransformState(),center={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},dx=p.x-center.x,dy=p.y-center.y;transformGesture={pointer:event.pointerId,kind:handle,center,startAngle:Math.atan2(dy,dx),startRadius:Math.max(8,Math.hypot(dx,dy)),baseRotation:state.selectionRotation,baseScale:state.selectionScale,liveRotation:state.selectionRotation};$("secondarySvg").setPointerCapture?.(event.pointerId);}
  function moveTransform(event){if(!transformGesture||event.pointerId!==transformGesture.pointer)return false;event.preventDefault();event.stopImmediatePropagation();const p=point(event),t=transformGesture,dx=p.x-t.center.x,dy=p.y-t.center.y;if(t.kind==="rotate"){let rotation=t.baseRotation+(Math.atan2(dy,dx)-t.startAngle)*180/Math.PI;while(rotation>180)rotation-=360;while(rotation<-180)rotation+=360;t.liveRotation=rotation;SecondaryExplorer.setSelectionTransform({rotation,scale:t.baseScale});}else{const scale=Math.max(.35,Math.min(3,t.baseScale*Math.hypot(dx,dy)/t.startRadius));SecondaryExplorer.setSelectionTransform({rotation:t.baseRotation,scale});}drawSelectedTransformOverlay();return true;}
  function finishTransform(event){if(!transformGesture||event.pointerId!==transformGesture.pointer)return false;event.preventDefault();event.stopImmediatePropagation();const root=$("secondarySvg");if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);transformGesture=null;syncTransformControls();drawSelectedTransformOverlay();return true;}
  function begin(event){
    const root=$("secondarySvg");if(!root||event.button!==0)return;
    const indexLabel=event.target.closest?.("[data-index-label]");
    if(indexLabel){
      const index=Number(indexLabel.dataset.indexLabel);
      if(Number.isInteger(index)){
        event.preventDefault();event.stopImmediatePropagation();remember();
        const start=point(event),base=SecondaryExplorer.getIndexLabelOffset(index);
        indexGesture={pointer:event.pointerId,index,start,base,moved:false};
        root.setPointerCapture?.(event.pointerId);return;
      }
    }
    const handle=event.target.closest?.("[data-se-transform-handle]");
    if(handle){beginTransform(event,handle.dataset.seTransformHandle);return;}
    // A drag beginning on a residue, pair, or backbone remains an edit/move,
    // including when users explicitly click the Box select control.
    if(event.target.closest?.(".se-node,.se-pair,.se-backbone,.se-strand-end,[data-index-label]"))return;
    const p=point(event);
    gesture={pointer:event.pointerId,start:p,points:[p],kind:mode==="lasso"?"lasso":"box",
      additive:event.shiftKey,moved:false,startClient:{x:event.clientX,y:event.clientY}};
    event.preventDefault();event.stopImmediatePropagation();
    root.setPointerCapture?.(event.pointerId);
  }
  function move(event){
    if(indexGesture&&event.pointerId===indexGesture.pointer){
      event.preventDefault();event.stopImmediatePropagation();
      const p=point(event),dx=p.x-indexGesture.start.x,dy=p.y-indexGesture.start.y;
      if(Math.hypot(dx,dy)>4)indexGesture.moved=true;
      if(indexGesture.moved)SecondaryExplorer.setIndexLabelOffset(indexGesture.index,{x:indexGesture.base.x+dx,y:indexGesture.base.y+dy});
      return;
    }
    if(moveTransform(event))return;
    if(!gesture||event.pointerId!==gesture.pointer)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(Math.hypot(event.clientX-gesture.startClient.x,event.clientY-gesture.startClient.y)>4)gesture.moved=true;
    if(!gesture.moved)return;
    const p=point(event);
    if(gesture.kind==="box")gesture.points=[gesture.start,p];
    else if(Math.hypot(p.x-gesture.points.at(-1).x,p.y-gesture.points.at(-1).y)>2)gesture.points.push(p);
    drawGestureOverlay();
  }
  function finish(event){
    const root=$("secondarySvg");
    if(indexGesture&&event.pointerId===indexGesture.pointer){
      event.preventDefault();event.stopImmediatePropagation();
      const index=indexGesture.index,moved=indexGesture.moved;indexGesture=null;
      if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);
      if(!moved)SecondaryExplorer.openSettingsFor?.("index",index);
      const status=$("seSelectionStatus");
      if(status)status.textContent=moved?`Residue index ${index+1} repositioned; RNA coordinates were unchanged.`:`Residue index ${index+1} settings opened.`;
      return;
    }
    if(finishTransform(event))return;
    if(!gesture||event.pointerId!==gesture.pointer)return;
    event.preventDefault();event.stopImmediatePropagation();
    const selecting=gesture;
    if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);
    if(!selecting.moved){gesture=null;removeOverlay();drawSelectedTransformOverlay();return;}
    if(selecting.kind==="lasso")gesture.points.push(point(event));
    else gesture.points=[gesture.start,point(event)];
    const indices=selectedIndicesFromGesture();
    gesture=null;removeOverlay();remember();
    SecondaryExplorer.highlightResidues(indices);
    SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});
    syncSelectionState();
    if($("seSelectionStatus"))$("seSelectionStatus").textContent=indices.length?`${indices.length} residue${indices.length===1?"":"s"} selected.`:"Nothing was inside the selection.";
  }
  function cancel(){gesture=null;transformGesture=null;indexGesture=null;removeOverlay();drawSelectedTransformOverlay();}
  // Build a standalone SVG from the CURRENT selected residues. Connections are
  // included only when both endpoints belong to the selected region; unselected
  // residues and interactive selection handles are excluded from Illustrator.
  function selectedRegionSvg(){
    const context=SecondaryExplorer.getContext(),snap=SecondaryExplorer.getWorkspaceSnapshot();
    const indices=new Set((context.selectedResidues||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<context.sequence.length));
    const pairKeys=context.selectedPairKeys||[];
    pairKeys.forEach(key=>{const p=String(key).split(":").map(Number);if(p.length===2&&p.every(Number.isInteger)){indices.add(p[0]);indices.add(p[1]);}});
    if(!indices.size)throw Error("Select one or more residues with box/lasso selection before copying a region.");
    const source=$("secondarySvg");
    if(!source||!source.children.length||typeof ExportTools==="undefined")throw Error("Render a secondary structure before exporting.");
    const pos=SecondaryExplorer.getCurrentPositions(),bounds=[];
    indices.forEach(i=>{const p=pos[i];if(p)bounds.push({x:p.x-48,y:p.y-52,w:96,h:104});});
    const keep=el=>{
      if(el.matches(".se-node"))return indices.has(Number(el.getAttribute("data-residue-index")));
      if(el.matches(".se-backbone")){const i=Number(el.getAttribute("data-backbone"));return indices.has(i)&&indices.has(i+1);}
      if(el.matches(".se-pair")){
        const match=String(el.getAttribute("data-pair")||"").split(":").map(Number);
        return match.length===2&&match.every(Number.isInteger)&&indices.has(match[0])&&indices.has(match[1]);
      }
      return false;
    };
    Array.from(source.children).filter(keep).forEach(el=>{
      if(el.matches(".se-node"))return; // residue labels are covered by the per-residue margin above
      try{
        const r=el.getBBox();if([r.x,r.y,r.width,r.height].every(Number.isFinite))
          bounds.push({x:r.x,y:r.y,w:r.width,h:r.height});
      }catch(_){}
    });
    if(!bounds.length)throw Error("Nothing is visible in the selected region.");
    const padding=16,minX=Math.min(...bounds.map(b=>b.x))-padding,minY=Math.min(...bounds.map(b=>b.y))-padding;
    const maxX=Math.max(...bounds.map(b=>b.x+b.w))+padding,maxY=Math.max(...bounds.map(b=>b.y+b.h))+padding;
    const width=Math.max(100,maxX-minX),height=Math.max(100,maxY-minY);
    const box=[minX,minY,width,height].map(v=>Number(v.toFixed(2))).join(" ");
    // Prepared SVG copies computed paint and text styles into the elements,
    // so the result doesn't depend on RNA Explorer stylesheets when opened.
    const {clone}=ExportTools.preparedSvg(source,{viewBox:box});
    Array.from(clone.children).forEach(el=>{if(!keep(el))el.remove();});
    clone.setAttribute("viewBox",box);
    clone.setAttribute("width",String(Math.ceil(width)));
    clone.setAttribute("height",String(Math.ceil(height)));
    clone.setAttribute("xmlns",svgNS);
    clone.setAttribute("aria-label","Selected RNA secondary structure, "+indices.size+" residues");
    clone.querySelectorAll("[role],[aria-label],[aria-pressed],[data-residue-index],[data-backbone],[data-pair],[data-index-label],[data-backbone-visible]").forEach(el=>{
      ["role","aria-label","aria-pressed","data-residue-index","data-backbone","data-pair","data-index-label","data-backbone-visible"].forEach(a=>el.removeAttribute(a));
    });
    const svgText=new XMLSerializer().serializeToString(clone);
    return {svgText,count:indices.size,filename:"rna-selected-region-"+indices.size+"nt.svg"};
  }
  function selectionExportStatus(message,error=false){
    const out=$("seSelectionExportStatus");if(!out)return;
    out.textContent=message;out.classList.toggle("error",error);
  }
  async function copySelectedSvg(){
    const button=$("seCopySelectedSvg");
    if(button)button.disabled=true;
    try{
      const {svgText,count}=selectedRegionSvg();
      if(!navigator.clipboard?.write||typeof ClipboardItem==="undefined"){
        if(navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(svgText);
          selectionExportStatus("Copied SVG source for "+count+" residues. To preserve editable vector artwork in Illustrator, use Download selected SVG and open that file.");
        }else throw Error("Clipboard copying is unavailable here. Use Download selected SVG instead.");
        return;
      }
      const blob=(value,type)=>new Blob([value],{type});
      const html=blob(svgText,"text/html"),plain=blob(svgText,"text/plain"),image=blob(svgText,"image/svg+xml");
      // Raw SVG clipboard support differs by browser. HTML SVG is attempted
      // separately rather than silently treating copied source as artwork.
      let vectorCopied=false;
      try{
        await navigator.clipboard.write([new ClipboardItem({"image/svg+xml":image,"text/html":html,"text/plain":plain})]);
        vectorCopied=true;
      }catch(_){
        await navigator.clipboard.write([new ClipboardItem({"text/html":html,"text/plain":plain})]);
      }
      selectionExportStatus(vectorCopied
        ?"Copied "+count+" residues as SVG vector artwork. Illustrator paste support depends on your browser; Download selected SVG is the reliable alternative."
        :"Copied "+count+" residues as SVG/HTML. Illustrator may paste text rather than editable shapes; Download selected SVG and open it in Illustrator for reliable editing.");
    }catch(error){selectionExportStatus("Copy failed: "+error.message,true);}
    finally{if(button)button.disabled=false;syncSelectionState();}
  }
  function downloadSelectedSvg(){
    try{
      const {svgText,count,filename}=selectedRegionSvg();
      ExportTools.downloadText(svgText,filename,"image/svg+xml;charset=utf-8");
      selectionExportStatus("Downloaded editable SVG for "+count+" residues. Open the SVG file in Adobe Illustrator to edit vectors and text.");
    }catch(error){selectionExportStatus("Export failed: "+error.message,true);}
  }
  function buildToolbar(){const stage=document.querySelector("#scene-secondary .secondary-stage"),existing=stage?.querySelector(".se-toolbar");if(!stage||!existing||$("seTransformToolbar"))return;const bar=document.createElement("div");bar.id="seTransformToolbar";bar.className="se-transform-toolbar";bar.innerHTML=`<details class="se-tool-group" open><summary>History</summary><div class="se-tool-group-body"><button id="seUndo" type="button" disabled title="Undo (Ctrl+Z / ⌘Z)">Undo</button><button id="seRedo" type="button" disabled title="Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)">Redo</button></div></details><details class="se-tool-group" open><summary>Select · Residues & regions</summary><div class="se-tool-group-body"><button id="seBoxSelectTool" type="button" aria-pressed="false">Box select · default</button><button id="seLassoSelectTool" type="button" aria-pressed="false">Lasso select</button><button id="seClearRegionSelection" type="button">Clear selection</button><button id="seCopySelectedSvg" type="button" disabled title="Copy selected residues as SVG vectors for Illustrator">Copy selected SVG</button><button id="seDownloadSelectedSvg" type="button" disabled title="Download editable SVG artwork (recommended for Adobe Illustrator)">Download selected SVG</button><button id="seResetSelectedTransform" type="button" disabled>Reset selected transform</button><label class="se-region-rotation">Rotate selected region <input id="seSelectedRotation" type="range" min="-180" max="180" step="1" value="0" disabled><output id="seSelectedRotationValue">0°</output></label></div><p id="seSelectionStatus" role="status">Drag on empty space to box-select; click a residue or bond to edit.</p><p id="seSelectionExportStatus" class="se-selection-export-status" role="status" aria-live="polite">SVG keeps residues, lines, and labels as editable vector artwork. Open a downloaded SVG in Illustrator if clipboard paste is unsupported.</p></details>`;existing.before(bar);const viewport=stage.querySelector(".se-viewport");const dock=document.createElement("div");dock.className="se-whole-rotation-dock";dock.innerHTML=`<label><span class="se-whole-rotation-label">Rotate whole structure</span><input id="seWholeRotation" type="range" min="-180" max="180" step="1" value="0"><output id="seWholeRotationValue">0°</output></label>`;(viewport||$("secondarySvg")).insertAdjacentElement("afterend",dock);
    $("seUndo").addEventListener("click",undo);$("seRedo").addEventListener("click",redo);$("seBoxSelectTool").addEventListener("click",()=>setMode("box"));$("seLassoSelectTool").addEventListener("click",()=>setMode("lasso"));$("seCopySelectedSvg").addEventListener("click",copySelectedSvg);$("seDownloadSelectedSvg").addEventListener("click",downloadSelectedSvg);$("seClearRegionSelection").addEventListener("click",()=>{remember();SecondaryExplorer.clearHighlights();SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncSelectionState();});$("seResetSelectedTransform").addEventListener("click",()=>{remember();resetSelectedTransform();});
    const selectedRotation=$("seSelectedRotation");selectedRotation.addEventListener("pointerdown",beginContinuousEdit);selectedRotation.addEventListener("pointerup",endContinuousEdit);selectedRotation.addEventListener("change",endContinuousEdit);selectedRotation.addEventListener("input",e=>{beginContinuousEdit();SecondaryExplorer.setSelectionTransform({rotation:Number(e.target.value)});syncTransformControls();});
    const whole=$("seWholeRotation");whole.addEventListener("pointerdown",beginContinuousEdit);whole.addEventListener("pointerup",endContinuousEdit);whole.addEventListener("change",endContinuousEdit);whole.addEventListener("blur",endContinuousEdit);whole.addEventListener("keydown",event=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key))beginContinuousEdit();});whole.addEventListener("input",e=>{beginContinuousEdit();const value=Number(e.target.value);$("seWholeRotationValue").textContent=value+"°";SecondaryExplorer.setWholeRotation(value);});
    const root=$("secondarySvg");root.addEventListener("pointerdown",begin,true);root.addEventListener("pointermove",move,true);root.addEventListener("pointerup",finish,true);root.addEventListener("pointercancel",finish,true);document.addEventListener("keydown",event=>{if(event.key==="Escape"){cancel();setMode("");return;}const target=event.target,typing=target?.matches?.("input:not([type=range]),textarea,[contenteditable=true]");if(typing)return;const mod=event.ctrlKey||event.metaKey;if(!mod)return;if(event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();}else if(event.ctrlKey&&event.key.toLowerCase()==="y"){event.preventDefault();redo();}});window.addEventListener("rna-secondary-history-checkpoint",remember);window.addEventListener("rna-secondary-layout",()=>{syncSelectionState();syncTransformControls();});window.addEventListener("rna-secondary-select",syncSelectionState);syncTransformControls();setMode("");}
  function setup(){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",buildToolbar,{once:true});else buildToolbar();}
  return{setup,setMode,isRegionMode,syncSelectionState,remember,selectedRegionSvg,copySelectedSvg,downloadSelectedSvg};
})();
SecondarySelectionTools.setup();
