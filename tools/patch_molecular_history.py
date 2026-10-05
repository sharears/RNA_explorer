from pathlib import Path
import re

p = Path('chemistry-editor.js')
s = p.read_text()
pattern = re.compile(r'''  let undoStack=\[\];\n  const UNDO_LIMIT=80;\n\n  function historySnapshot\(\)\{.*?\n  \}\n\n  const atomById=''', re.S)
replacement = '''  let undoStack=[],redoStack=[];
  const HISTORY_LIMIT=80;

  function historySnapshot(){
    return JSON.stringify({graph,atomSerial,bondSerial,hbondSerial,textDefaults});
  }
  function syncUndoButton(){
    const undoButton=dialog?.querySelector("#chemUndoButton"),redoButton=dialog?.querySelector("#chemRedoButton");
    if(undoButton)undoButton.disabled=undoStack.length===0;
    if(redoButton)redoButton.disabled=redoStack.length===0;
  }
  function resetUndoHistory(){undoStack=[];redoStack=[];syncUndoButton();}
  function trimHistory(stack){if(stack.length>HISTORY_LIMIT)stack.splice(0,stack.length-HISTORY_LIMIT);}
  function pushUndo(){
    const snapshot=historySnapshot();
    if(undoStack.at(-1)!==snapshot)undoStack.push(snapshot);
    trimHistory(undoStack);redoStack=[];syncUndoButton();
  }
  function restoreHistorySnapshot(snapshot,message){
    const state=JSON.parse(snapshot);
    graph=state.graph;atomSerial=state.atomSerial;bondSerial=state.bondSerial;hbondSerial=state.hbondSerial;textDefaults=state.textDefaults||{...DEFAULT_TEXT_STYLE};
    selectedAtom=null;selectedAtoms.clear();pendingAtom=null;pendingFuseBond=null;drag=null;transformDrag=null;selectionBox=null;lasso=null;
    syncTextControls(textDefaults);render();validate();syncUndoButton();status.textContent=message;return true;
  }
  function undo(){
    if(!undoStack.length){status.textContent="Nothing to undo.";syncUndoButton();return false;}
    const current=historySnapshot();let snapshot=null;
    while(undoStack.length){const candidate=undoStack.pop();if(candidate!==current){snapshot=candidate;break;}}
    if(!snapshot){status.textContent="Nothing to undo.";syncUndoButton();return false;}
    if(redoStack.at(-1)!==current)redoStack.push(current);trimHistory(redoStack);
    return restoreHistorySnapshot(snapshot,"Undid the last molecular drawing change.");
  }
  function redo(){
    if(!redoStack.length){status.textContent="Nothing to redo.";syncUndoButton();return false;}
    const current=historySnapshot();let snapshot=null;
    while(redoStack.length){const candidate=redoStack.pop();if(candidate!==current){snapshot=candidate;break;}}
    if(!snapshot){status.textContent="Nothing to redo.";syncUndoButton();return false;}
    if(undoStack.at(-1)!==current)undoStack.push(current);trimHistory(undoStack);
    return restoreHistorySnapshot(snapshot,"Redid the molecular drawing change.");
  }

  const atomById='''
s, n = pattern.subn(replacement, s, count=1)
if n != 1: raise SystemExit(f'history replacement count={n}')
old='<button type="button" id="chemUndoButton" title="Undo (Ctrl+Z / ⌘Z)" aria-label="Undo last molecular drawing change" disabled>Undo</button>'
new=old+'\n          <button type="button" id="chemRedoButton" title="Redo (Ctrl+Y / Ctrl+Shift+Z / ⌘Shift+Z)" aria-label="Redo molecular drawing change" disabled>Redo</button>'
if old not in s: raise SystemExit('undo button marker not found')
s=s.replace(old,new,1)
old='dialog.querySelector("#chemUndoButton").addEventListener("click",undo);'
new=old+'\n    dialog.querySelector("#chemRedoButton").addEventListener("click",redo);'
if old not in s: raise SystemExit('undo listener marker not found')
s=s.replace(old,new,1)
old='''      const modifier=e.metaKey||e.ctrlKey;
      if(modifier&&!e.altKey&&String(e.key).toLowerCase()==="z"){e.preventDefault();undo();return;}'''
new='''      const modifier=e.metaKey||e.ctrlKey,key=String(e.key).toLowerCase();
      if(modifier&&!e.altKey){
        if(key==="z"&&e.shiftKey){e.preventDefault();redo();return;}
        if(key==="z"){e.preventDefault();undo();return;}
        if(!e.metaKey&&key==="y"){e.preventDefault();redo();return;}
      }'''
if old not in s: raise SystemExit('keyboard marker not found')
s=s.replace(old,new,1)
marker='  function selectedBounds(){'
helpers='''  function distancePointToSegment(p,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;if(len2<1e-9)return Math.hypot(p.x-a.x,p.y-a.y);
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)),x=a.x+t*dx,y=a.y+t*dy;return Math.hypot(p.x-x,p.y-y);
  }
  function lassoContainsAtom(atom,poly,radius=19){
    const center={x:atom.x,y:atom.y};if(pointInPolygon(center,poly))return true;
    for(let i=0;i<poly.length;i++)if(distancePointToSegment(center,poly[i],poly[(i+1)%poly.length])<=radius)return true;
    return false;
  }
  function setActiveChemTool(name){
    tool=name;pendingAtom=null;pendingFuseBond=null;transformDrag=null;selectionBox=null;lasso=null;
    dialog?.querySelectorAll("[data-chem-tool]").forEach(button=>button.classList.toggle("active",button.dataset.chemTool===name));
  }

'''
if marker not in s: raise SystemExit('selectedBounds marker not found')
s=s.replace(marker,helpers+marker,1)
old='''    if(lasso&&e.pointerId===lasso.pointer){
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
    }'''
new='''    if(lasso&&e.pointerId===lasso.pointer){
      const current=lasso,end=point(e),last=current.points.at(-1);
      if(!last||Math.hypot(end.x-last.x,end.y-last.y)>1)current.points.push(end);
      const poly=current.points;if(!current.additive)selectedAtoms.clear();
      if(poly.length>=3)graph.atoms.filter(a=>lassoContainsAtom(a,poly)).forEach(a=>selectedAtoms.add(a.id));
      selectedAtom=[...selectedAtoms].at(-1)||null;
      if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);
      const count=selectedAtoms.size;if(selectedAtom){const a=atomById(selectedAtom);if(a)syncTextControls(a.textStyle||textDefaults);}
      setActiveChemTool("select");render();validate();
      status.textContent=count?`Lasso selected ${count} atom${count===1?"":"s"}. Drag the selection or use the resize/rotate handles.`:"No atoms were inside the lasso. Try drawing a wider loop around the atom centers.";
      return;
    }'''
if old not in s: raise SystemExit('lasso marker not found')
s=s.replace(old,new,1)
p.write_text(s)
idx=Path('index.html');t=idx.read_text()
if 'chemistry-editor.js?v=chem-editor-10' not in t: raise SystemExit('cache marker not found')
idx.write_text(t.replace('chemistry-editor.js?v=chem-editor-10','chemistry-editor.js?v=chem-editor-11',1))
test=r'''import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on("pageerror",e=>errors.push(String(e)));await page.goto("http://127.0.0.1:4173/?page=drawing",{waitUntil:"networkidle"});
async function userToClient(x,y){return page.evaluate(({x,y})=>{const svg=document.querySelector("#chemEditorSvg"),pt=svg.createSVGPoint();pt.x=x;pt.y=y;const o=pt.matrixTransform(svg.getScreenCTM());return{x:o.x,y:o.y};},{x,y});}
await page.evaluate(()=>MoleculeEditor.openBase("A"));await page.locator("#chemEditorDialog").waitFor({state:"visible"});await page.locator('[data-chem-tool="lasso"]').click();const poly=[[135,30],[500,30],[500,320],[135,320],[135,30]];let q=await userToClient(...poly[0]);await page.mouse.move(q.x,q.y);await page.mouse.down();for(let i=1;i<poly.length;i++){const [sx,sy]=poly[i-1],[ex,ey]=poly[i];for(let k=1;k<=8;k++){q=await userToClient(sx+(ex-sx)*k/8,sy+(ey-sy)*k/8);await page.mouse.move(q.x,q.y);}}await page.mouse.up();const lr=await page.evaluate(()=>({selected:document.querySelectorAll("#chemEditorSvg .chem-editor-atom.selected").length,selectActive:document.querySelector('[data-chem-tool="select"]')?.classList.contains("active"),status:document.querySelector("#chemEditorStatus")?.textContent||""}));assert.ok(lr.selected>=8,`lasso selected ${lr.selected}: ${lr.status}`);assert.equal(lr.selectActive,true);
await page.evaluate(()=>MoleculeEditor.openBlank());await page.locator('[data-chem-tool="atom"]').click();q=await userToClient(410,235);await page.mouse.click(q.x,q.y);const count=()=>page.locator("#chemEditorSvg .chem-editor-atom").count();assert.equal(await count(),1);await page.keyboard.press("Control+z");assert.equal(await count(),0);await page.keyboard.press("Control+y");assert.equal(await count(),1);await page.keyboard.press("Meta+z");assert.equal(await count(),0);await page.keyboard.press("Meta+Shift+z");assert.equal(await count(),1);assert.equal(await page.locator("#chemRedoButton").count(),1);assert.equal(errors.length,0);console.log(JSON.stringify({result:"PASS",lassoSelected:lr.selected,redoShortcuts:"PASS"}));await browser.close();'''
Path('tests/molecular-editor-history-browser.mjs').write_text(test)
