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
  function syncSelectionState(){const n=SecondaryExplorer?.getContext?.().selectedResidues?.length||0;const reset=$("seResetSelectedTransform");if(reset)reset.disabled=n===0;const selectedRotation=$("seSelectedRotation");if(selectedRotation)selectedRotation.disabled=n<2;if(!mode&&$("seSelectionStatus"))$("seSelectionStatus").textContent=n?selectionMessage():"Drag on empty space to box-select; click an individual residue or bond to edit.";drawSelectedTransformOverlay();}
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
  // One vector-export path for Ctrl/Cmd+C, the in-viewer copy icon and Export.
  // Never copy SVG *source text*: Illustrator may paste it as XML, not artwork.
  function selectedIndices(){
    const context=SecondaryExplorer.getContext(),indices=new Set((context.selectedResidues||[])
      .filter(i=>Number.isInteger(i)&&i>=0&&i<context.sequence.length));
    (context.selectedPairKeys||[]).forEach(key=>{
      const ends=String(key).split(":").map(Number);
      if(ends.length===2&&ends.every(i=>Number.isInteger(i)&&i>=0&&i<context.sequence.length))
        ends.forEach(i=>indices.add(i));
    });
    return indices;
  }
  function hasSelection(){return selectedIndices().size>0;}
  function artworkSvgElement({selectedOnly=true,includeBackground=false}={}){
    const source=$("secondarySvg");
    if(!source?.children.length||typeof ExportTools==="undefined")
      throw Error("Render a secondary structure before copying.");
    const indices=selectedIndices();
    if(selectedOnly&&!indices.size)throw Error("Select residues before exporting a selected region.");
    const keep=el=>{
      if(el.matches(".se-node"))return !selectedOnly||indices.has(Number(el.getAttribute("data-residue-index")));
      if(el.matches(".se-backbone")){
        const i=Number(el.getAttribute("data-backbone"));
        return !selectedOnly||(indices.has(i)&&indices.has(i+1));
      }
      if(el.matches(".se-pair")){
        const p=String(el.getAttribute("data-pair")||"").split(":").map(Number);
        return !selectedOnly||(p.length===2&&p.every(i=>Number.isInteger(i)&&indices.has(i)));
      }
      return !selectedOnly&&el.matches(".se-strand-end");
    };
    const kept=[...source.children].filter(keep);
    if(!kept.length)throw Error("No visible artwork in this selection.");
    // Copy explicit computed paint and type styles, eliminating any dependency
    // on the site's CSS when this SVG is imported by a vector editor.
    const {clone}=ExportTools.preparedSvg(source);
    [...clone.children].forEach(el=>{if(!keep(el))el.remove();});
    let x,y,w,h;
    if(selectedOnly){
      const positions=SecondaryExplorer.getCurrentPositions(),bounds=[];
      kept.forEach(el=>{
        try{
          const b=el.getBBox();
          if(![b.x,b.y,b.width,b.height].every(Number.isFinite))return;
          let dx=0,dy=0;
          if(el.matches(".se-node")){
            const p=positions[Number(el.getAttribute("data-residue-index"))];
            if(!p)return;dx=p.x;dy=p.y;
          }
          bounds.push({x:b.x+dx,y:b.y+dy,w:b.width,h:b.height});
        }catch(_){}
      });
      indices.forEach(i=>{const p=positions[i];if(p)bounds.push({x:p.x-24,y:p.y-24,w:48,h:48});});
      if(!bounds.length)throw Error("Could not calculate selected artwork bounds.");
      const pad=20;
      x=Math.min(...bounds.map(b=>b.x))-pad;
      y=Math.min(...bounds.map(b=>b.y))-pad;
      w=Math.max(...bounds.map(b=>b.x+b.w))+pad-x;
      h=Math.max(...bounds.map(b=>b.y+b.h))+pad-y;
    }else{
      [x,y,w,h]=String(source.dataset.fullViewBox||source.getAttribute("viewBox")||"0 0 720 520")
        .trim().split(/\s+/).map(Number);
    }
    const rounded=n=>Number(n.toFixed(3));
    [x,y,w,h]=[x,y,Math.max(1,w),Math.max(1,h)].map(rounded);
    // Normalized zero-origin coordinates avoid importer-specific viewBox offsets.
    const art=document.createElementNS(svgNS,"g");
    art.setAttribute("transform","translate("+(-x)+" "+(-y)+")");
    while(clone.firstChild)art.append(clone.firstChild);
    if(includeBackground){
      // Pale nucleotide labels need their native dark canvas when the artwork
      // is pasted into Illustrator's normally white artboard. Background is a
      // plain editable SVG rectangle; Export remains configurable.
      const backdrop=document.createElementNS(svgNS,"rect");
      backdrop.setAttribute("x","0");backdrop.setAttribute("y","0");
      backdrop.setAttribute("width",String(w));backdrop.setAttribute("height",String(h));
      backdrop.setAttribute("fill","#0b1220");backdrop.setAttribute("data-copy-background","");
      clone.append(backdrop);
    }
    clone.append(art);
    clone.setAttribute("viewBox","0 0 "+w+" "+h);
    clone.setAttribute("width",String(w));clone.setAttribute("height",String(h));
    clone.setAttribute("preserveAspectRatio","xMidYMid meet");
    clone.setAttribute("xmlns",svgNS);
    clone.removeAttribute("role");clone.removeAttribute("aria-label");
    clone.querySelectorAll("*").forEach(el=>{
      ["role","aria-label","aria-pressed","tabindex","pointer-events"].forEach(a=>el.removeAttribute(a));
      [...el.attributes].filter(a=>a.name.startsWith("data-")).forEach(a=>el.removeAttribute(a.name));
      el.style?.removeProperty("pointer-events");el.style?.removeProperty("cursor");
      el.style?.removeProperty("filter");
    });
    return clone;
  }
  function selectedRegionSvg({selectedOnly=true,includeBackground=false}={}){
    const element=artworkSvgElement({selectedOnly,includeBackground});
    const count=selectedOnly?selectedIndices().size:SecondaryExplorer.getContext().sequence.length;
    return {svgText:new XMLSerializer().serializeToString(element),
      count,filename:"rna-"+(selectedOnly?"selected-region-":"secondary-")+count+"nt.svg"};
  }
  function copyStatus(message,error=false){
    const output=$("seExportStatus");if(!output)return;
    output.textContent=message;output.classList.toggle("error",error);
  }
  let checkTimer=null;
  function markCopied(){
    const button=$("seCopyStructure");if(!button)return;
    clearTimeout(checkTimer);button.classList.add("is-copied");
    checkTimer=setTimeout(()=>button.classList.remove("is-copied"),1800);
  }
  async function copyArtwork(){
    const button=$("seCopyStructure");
    if(button)button.disabled=true;
    try{
      const selectedOnly=hasSelection(),region=selectedRegionSvg({selectedOnly,includeBackground:false});
      // No text/plain or HTML fallback: those previously gave distorted or
      // literal SVG text in Illustrator. Only report success for true SVG MIME.
      if(!navigator.clipboard?.write||typeof ClipboardItem==="undefined"||
        (typeof ClipboardItem.supports==="function"&&!ClipboardItem.supports("image/svg+xml")))
        throw Error("Native SVG clipboard is unavailable in this browser. Use Export… → Image → SVG (Selected region only if needed).");
      const item=new ClipboardItem({"image/svg+xml":new Blob([region.svgText],{type:"image/svg+xml"})});
      await navigator.clipboard.write([item]);
      markCopied();
      copyStatus("Copied "+(selectedOnly?region.count+" selected residues":"the entire RNA structure")+
        " as SVG vectors. Illustrator's paste behavior may vary; Export → SVG is the reliable fallback.");
      return true;
    }catch(error){copyStatus("Vector copy unavailable: "+error.message,true);return false;}
    finally{if(button)button.disabled=false;}
  }
  function onCopyShortcut(event){
    if(!((event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&
      String(event.key).toLowerCase()==="c"))return;
    const scene=$("scene-secondary");
    if(!scene||scene.hidden||document.querySelector("dialog[open]"))return;
    if(event.target?.closest?.('input,textarea,select,[contenteditable],[contenteditable="true"]'))return;
    if(document.activeElement?.isContentEditable)return;
    if(window.getSelection?.()?.toString())return; // Preserve native copying of highlighted instructional text.
    event.preventDefault();copyArtwork();
  }
  function installCopyControl(){
    const viewport=document.querySelector("#scene-secondary .se-viewport");
    if(!viewport||$("seCopyStructure"))return;
    const button=document.createElement("button");
    button.type="button";button.id="seCopyStructure";
    button.className="se-copy-icon-button se-structure-copy-button";
    button.setAttribute("aria-label","Copy selected RNA vector structure, or entire structure if none selected");
    button.title="Copy RNA structure vectors (Ctrl+C / ⌘C)";
    button.innerHTML='<svg class="se-copy-glyph" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg><svg class="se-check-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"></path></svg>';
    viewport.append(button);button.addEventListener("click",copyArtwork);
    document.addEventListener("keydown",onCopyShortcut,true);
  }
  function buildToolbar(){const stage=document.querySelector("#scene-secondary .secondary-stage"),existing=stage?.querySelector(".se-toolbar");if(!stage||!existing||$("seTransformToolbar"))return;const bar=document.createElement("div");bar.id="seTransformToolbar";bar.className="se-transform-toolbar";bar.innerHTML=`<details class="se-tool-group" open><summary>History</summary><div class="se-tool-group-body"><button id="seUndo" type="button" disabled title="Undo (Ctrl+Z / ⌘Z)">Undo</button><button id="seRedo" type="button" disabled title="Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)">Redo</button></div></details><details class="se-tool-group" open><summary>Select · Residues & regions</summary><div class="se-tool-group-body"><button id="seBoxSelectTool" type="button" aria-pressed="false">Box select · default</button><button id="seLassoSelectTool" type="button" aria-pressed="false">Lasso select</button><button id="seClearRegionSelection" type="button">Clear selection</button><button id="seResetSelectedTransform" type="button" disabled>Reset selected transform</button><label class="se-region-rotation">Rotate selected region <input id="seSelectedRotation" type="range" min="-180" max="180" step="1" value="0" disabled><output id="seSelectedRotationValue">0°</output></label></div><p id="seSelectionStatus" role="status">Drag on empty space to box-select; click a residue or bond to edit.</p></details>`;existing.before(bar);const viewport=stage.querySelector(".se-viewport");const dock=document.createElement("div");dock.className="se-whole-rotation-dock";dock.innerHTML=`<label><span class="se-whole-rotation-label">Rotate whole structure</span><input id="seWholeRotation" type="range" min="-180" max="180" step="1" value="0"><output id="seWholeRotationValue">0°</output></label>`;(viewport||$("secondarySvg")).insertAdjacentElement("afterend",dock);
    $("seUndo").addEventListener("click",undo);$("seRedo").addEventListener("click",redo);$("seBoxSelectTool").addEventListener("click",()=>setMode("box"));$("seLassoSelectTool").addEventListener("click",()=>setMode("lasso"));$("seClearRegionSelection").addEventListener("click",()=>{remember();SecondaryExplorer.clearHighlights();SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncSelectionState();});$("seResetSelectedTransform").addEventListener("click",()=>{remember();resetSelectedTransform();});
    const selectedRotation=$("seSelectedRotation");selectedRotation.addEventListener("pointerdown",beginContinuousEdit);selectedRotation.addEventListener("pointerup",endContinuousEdit);selectedRotation.addEventListener("change",endContinuousEdit);selectedRotation.addEventListener("input",e=>{beginContinuousEdit();SecondaryExplorer.setSelectionTransform({rotation:Number(e.target.value)});syncTransformControls();});
    const whole=$("seWholeRotation");whole.addEventListener("pointerdown",beginContinuousEdit);whole.addEventListener("pointerup",endContinuousEdit);whole.addEventListener("change",endContinuousEdit);whole.addEventListener("blur",endContinuousEdit);whole.addEventListener("keydown",event=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key))beginContinuousEdit();});whole.addEventListener("input",e=>{beginContinuousEdit();const value=Number(e.target.value);$("seWholeRotationValue").textContent=value+"°";SecondaryExplorer.setWholeRotation(value);});
    const root=$("secondarySvg");root.addEventListener("pointerdown",begin,true);root.addEventListener("pointermove",move,true);root.addEventListener("pointerup",finish,true);root.addEventListener("pointercancel",finish,true);document.addEventListener("keydown",event=>{if(event.key==="Escape"){cancel();setMode("");return;}const target=event.target,typing=target?.matches?.("input:not([type=range]),textarea,[contenteditable=true]");if(typing)return;const mod=event.ctrlKey||event.metaKey;if(!mod)return;if(event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();}else if(event.ctrlKey&&event.key.toLowerCase()==="y"){event.preventDefault();redo();}});window.addEventListener("rna-secondary-history-checkpoint",remember);window.addEventListener("rna-secondary-layout",()=>{syncSelectionState();syncTransformControls();});window.addEventListener("rna-secondary-select",syncSelectionState);syncTransformControls();setMode("");}
  function setup(){const ready=()=>{buildToolbar();installCopyControl();};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});else ready();}
  return{setup,setMode,isRegionMode,syncSelectionState,remember,artworkSvgElement,selectedRegionSvg,copyArtwork,hasSelection,selectedCount:()=>selectedIndices().size};
})();
SecondarySelectionTools.setup();
