import { chromium } from "playwright";
import fs from "node:fs";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=secondary&start=example";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error"&&!/Failed to load resource/i.test(msg.text()))errors.push("console: "+msg.text());});

const moved=(a,b)=>Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));
const offset=(snapshot,index)=>snapshot.manualOffsets?.[index]||{x:0,y:0};

async function visibleNucleotide(){
  const nodes=page.locator('#secondarySvg .se-node');
  const count=await nodes.count();
  const viewport=page.viewportSize();
  for(let i=0;i<count;i++){
    const node=nodes.nth(i);
    const circle=node.locator('circle:not(.se-index-hit)').first();
    const box=await circle.boundingBox();
    if(!box||!viewport)continue;
    const point={x:box.x+box.width/2,y:box.y+box.height/2};
    if(point.x<1||point.y<1||point.x>=viewport.width-1||point.y>=viewport.height-1)continue;
    const info=await page.evaluate(({x,y})=>{
      const el=document.elementFromPoint(x,y),node=el?.closest?.('.se-node');
      return {index:node?.dataset?.residueIndex??null,tag:el?.tagName||null};
    },point);
    if(info.index!==null)return {point,index:Number(info.index),tag:info.tag};
  }
  throw new Error('Could not find a visible nucleotide interaction target in the secondary workspace.');
}

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('body[data-page-mode="secondary"] #scene-secondary:not([hidden])',{timeout:10000});
  await page.waitForSelector("#secondarySvg .se-node",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>document.querySelector("#seDragMode")?.value==="whole",{timeout:10000});

  const badge=((await page.locator("#scene-secondary .rna-workspace-mode-badge").textContent())||"").replace(/\s+/g," ").trim();
  if(!/Explore workspace/i.test(badge)||!/Secondary structure/i.test(badge))throw new Error("Secondary workspace consistency label is missing: "+badge);

  await page.evaluate(()=>{
    const snap=SecondaryExplorer.getWorkspaceSnapshot();
    snap.selectedResidues=[];
    SecondaryExplorer.restoreWorkspaceSnapshot(snap);
  });
  const wholeBefore=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const wholeTarget=await visibleNucleotide();
  await page.mouse.move(wholeTarget.point.x,wholeTarget.point.y);
  await page.mouse.down();
  await page.mouse.move(wholeTarget.point.x+70,wholeTarget.point.y+35,{steps:6});
  await page.mouse.up();
  const wholeAfter=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const panDelta=Math.hypot((wholeAfter.panX||0)-(wholeBefore.panX||0),(wholeAfter.panY||0)-(wholeBefore.panY||0));
  const firstDelta=moved(offset(wholeBefore,0),offset(wholeAfter,0));
  const lastIndex=(wholeAfter.sequence?.length||1)-1;
  const lastDelta=moved(offset(wholeBefore,lastIndex),offset(wholeAfter,lastIndex));
  if(panDelta<10&&(firstDelta<5||lastDelta<5))
    throw new Error("Direct whole-secondary drag did not reposition the structure. "+JSON.stringify({panDelta,firstDelta,lastDelta,wholeTarget,beforeDragMode:wholeBefore.dragMode,afterDragMode:wholeAfter.dragMode}));

  const selectionTarget=await visibleNucleotide();
  const n=wholeAfter.sequence?.length||3;
  const dragIndex=selectionTarget.index;
  const second=(dragIndex+1)%n;
  const unselected=(dragIndex+2)%n;
  await page.evaluate(({dragIndex,second})=>{
    const snap=SecondaryExplorer.getWorkspaceSnapshot();
    snap.selectedResidues=[dragIndex,second];
    snap.selectionScale=1;
    snap.selectionRotation=0;
    SecondaryExplorer.restoreWorkspaceSnapshot(snap);
  },{dragIndex,second});
  const selectedBefore=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const selectedNode=page.locator(`#secondarySvg .se-node[data-residue-index="${dragIndex}"]`);
  const circle=selectedNode.locator('circle:not(.se-index-hit)').first();
  const selectedBox=await circle.boundingBox();
  if(!selectedBox)throw new Error('Could not measure the visible selected nucleotide.');
  const selectedPoint={x:selectedBox.x+selectedBox.width/2,y:selectedBox.y+selectedBox.height/2};
  await page.mouse.move(selectedPoint.x,selectedPoint.y);
  await page.mouse.down();
  await page.mouse.move(selectedPoint.x+55,selectedPoint.y-30,{steps:6});
  await page.mouse.up();
  const selectedAfter=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const beforeA=offset(selectedBefore,dragIndex),afterA=offset(selectedAfter,dragIndex);
  const beforeB=offset(selectedBefore,second),afterB=offset(selectedAfter,second);
  const beforeU=offset(selectedBefore,unselected),afterU=offset(selectedAfter,unselected);
  if(moved(beforeA,afterA)<5||moved(beforeB,afterB)<5)throw new Error("Selected residues did not move together as a group. "+JSON.stringify({dragIndex,second,beforeA,afterA,beforeB,afterB}));
  if(moved(beforeU,afterU)>1)throw new Error("Selected-region drag also moved an unselected residue. "+JSON.stringify({unselected,beforeU,afterU}));
  if(Math.hypot((selectedAfter.panX||0)-(selectedBefore.panX||0),(selectedAfter.panY||0)-(selectedBefore.panY||0))>1)throw new Error("Dragging a selected region incorrectly panned the whole secondary structure.");
  const actualSelected=[...(selectedAfter.selectedResidues||[])].sort((a,b)=>a-b),expectedSelected=[dragIndex,second].sort((a,b)=>a-b);
  if(JSON.stringify(actualSelected)!==JSON.stringify(expectedSelected))throw new Error("Selected-region drag did not preserve the selection: "+JSON.stringify(actualSelected));

  if(typeof selectedAfter.selectionScale!=="number"||typeof selectedAfter.selectionRotation!=="number")throw new Error("Selected-region zoom/rotation state disappeared after group dragging.");
  if(await page.locator("#secondarySvg [data-index-label]").count()<1)throw new Error("Residue-index drag targets disappeared after adding whole/selection dragging.");

  await page.evaluate(()=>MoleculeEditor.openBlank());
  await page.waitForSelector("#chemEditorDialog[open]",{state:"visible",timeout:10000});
  const drawing=await page.locator("#chemEditorDialog").evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {left:r.left,top:r.top,width:r.width,height:r.height,borderRadius:s.borderRadius,background:s.backgroundColor,label:el.getAttribute("aria-label")};});
  const viewport=page.viewportSize();
  if(!viewport||Math.abs(drawing.left)>2||Math.abs(drawing.top)>2||Math.abs(drawing.width-viewport.width)>3||Math.abs(drawing.height-viewport.height)>3)throw new Error("Molecular Drawing is not filling the workspace viewport: "+JSON.stringify({drawing,viewport}));
  if(drawing.borderRadius!=="0px")throw new Error("Molecular Drawing still looks like a floating modal: "+JSON.stringify(drawing));
  if(!/Molecular Drawing workspace/i.test(drawing.label||""))throw new Error("Molecular Drawing dedicated-workspace label is missing: "+JSON.stringify(drawing));
  await page.click("#chemEditorClose");

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Workspace interaction browser errors:\n"+serious.join("\n"));
  console.log("PASS: whole 2D drag, selected-region drag, index-label targets, workspace consistency, and full Molecular Drawing workspace");
} catch(error) {
  fs.mkdirSync("test-output",{recursive:true});
  fs.writeFileSync("test-output/workspace-interactions-error.txt",String(error?.stack||error)+"\n\nCaptured browser errors:\n"+errors.join("\n"));
  throw error;
} finally {
  await browser.close();
}
