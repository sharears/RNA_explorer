from pathlib import Path


def rep(s, old, new, label):
    if old not in s:
        raise SystemExit(f"missing fix anchor: {label}")
    return s.replace(old, new, 1)

p = Path('secondary.js')
s = p.read_text()
s = rep(
    s,
    '    getCurrentPositions(){return coordinates().map(p=>({x:p.x,y:p.y}));},\n    setWholeRotation(degrees=0){',
    '    getCurrentPositions(){return coordinates().map(p=>({x:p.x,y:p.y}));},\n    getIndexLabelOffset(index){const o=indexLabelOffsets[index]||{x:0,y:0};return {x:Number(o.x)||0,y:Number(o.y)||0};},\n    setIndexLabelOffset(index,{x=0,y=0}={}){if(!Number.isInteger(index)||index<0||index>=seq.length)return null;indexLabelOffsets[index]={x:Number(x)||0,y:Number(y)||0};render();return {...indexLabelOffsets[index]};},\n    setWholeRotation(degrees=0){',
    'secondary index API',
)
p.write_text(s)

p = Path('secondary-selection-tools.js')
s = p.read_text()
s = rep(
    s,
    '  let mode="",gesture=null,overlay=null,transformGesture=null;',
    '  let mode="",gesture=null,overlay=null,transformGesture=null,indexGesture=null;',
    'index gesture state',
)
s = rep(
    s,
    '  function begin(event){const handle=event.target.closest?.("[data-se-transform-handle]");if(handle){beginTransform(event,handle.dataset.seTransformHandle);return;}if(!mode||event.button!==0)return;const root=$("secondarySvg");if(!root)return;event.preventDefault();event.stopImmediatePropagation();const p=point(event);gesture={pointer:event.pointerId,start:p,points:[p],additive:event.shiftKey};root.setPointerCapture?.(event.pointerId);drawGestureOverlay();}',
    '  function begin(event){const root=$("secondarySvg");if(!root)return;const indexLabel=event.target.closest?.("[data-index-label]");if(indexLabel&&event.button===0){const index=Number(indexLabel.dataset.indexLabel);if(Number.isInteger(index)){event.preventDefault();event.stopImmediatePropagation();remember();const start=point(event),base=SecondaryExplorer.getIndexLabelOffset(index);indexGesture={pointer:event.pointerId,index,start,base};root.setPointerCapture?.(event.pointerId);return;}}const handle=event.target.closest?.("[data-se-transform-handle]");if(handle){beginTransform(event,handle.dataset.seTransformHandle);return;}if(!mode||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();const p=point(event);gesture={pointer:event.pointerId,start:p,points:[p],additive:event.shiftKey};root.setPointerCapture?.(event.pointerId);drawGestureOverlay();}',
    'index gesture begin',
)
s = rep(
    s,
    '  function move(event){if(moveTransform(event))return;if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();const p=point(event);if(mode==="box")gesture.points=[gesture.start,p];else if(Math.hypot(p.x-gesture.points.at(-1).x,p.y-gesture.points.at(-1).y)>2)gesture.points.push(p);drawGestureOverlay();}',
    '  function move(event){if(indexGesture&&event.pointerId===indexGesture.pointer){event.preventDefault();event.stopImmediatePropagation();const p=point(event),dx=p.x-indexGesture.start.x,dy=p.y-indexGesture.start.y;SecondaryExplorer.setIndexLabelOffset(indexGesture.index,{x:indexGesture.base.x+dx,y:indexGesture.base.y+dy});return;}if(moveTransform(event))return;if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();const p=point(event);if(mode==="box")gesture.points=[gesture.start,p];else if(Math.hypot(p.x-gesture.points.at(-1).x,p.y-gesture.points.at(-1).y)>2)gesture.points.push(p);drawGestureOverlay();}',
    'index gesture move',
)
s = rep(
    s,
    '  function finish(event){if(finishTransform(event))return;if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();const root=$("secondarySvg");if(mode==="lasso")gesture.points.push(point(event));else gesture.points=[gesture.start,point(event)];const indices=selectedIndicesFromGesture();if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);gesture=null;removeOverlay();remember();SecondaryExplorer.highlightResidues(indices);SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncSelectionState();if($("seSelectionStatus"))$("seSelectionStatus").textContent=indices.length?`${indices.length} residue${indices.length===1?"":"s"} selected.`:"Nothing was inside the selection.";}',
    '  function finish(event){const root=$("secondarySvg");if(indexGesture&&event.pointerId===indexGesture.pointer){event.preventDefault();event.stopImmediatePropagation();const index=indexGesture.index;indexGesture=null;if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);const status=$("seSelectionStatus");if(status)status.textContent=`Residue index ${index+1} repositioned; RNA coordinates were unchanged.`;return;}if(finishTransform(event))return;if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();if(mode==="lasso")gesture.points.push(point(event));else gesture.points=[gesture.start,point(event)];const indices=selectedIndicesFromGesture();if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);gesture=null;removeOverlay();remember();SecondaryExplorer.highlightResidues(indices);SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});syncSelectionState();if($("seSelectionStatus"))$("seSelectionStatus").textContent=indices.length?`${indices.length} residue${indices.length===1?"":"s"} selected.`:"Nothing was inside the selection.";}',
    'index gesture finish',
)
s = rep(
    s,
    '  function cancel(){gesture=null;transformGesture=null;removeOverlay();drawSelectedTransformOverlay();}',
    '  function cancel(){gesture=null;transformGesture=null;indexGesture=null;removeOverlay();drawSelectedTransformOverlay();}',
    'index gesture cancel',
)
p.write_text(s)
print('INDEX_DRAG_FIX_OK')
