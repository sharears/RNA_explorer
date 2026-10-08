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

async function nucleotideCenter(node){
  const circle=node.locator('circle:not(.se-index-hit)').first();
  const box=await circle.boundingBox();
  if(!box)throw new Error("Could not measure nucleotide circle for drag interaction.");
  return {x:box.x+box.width/2,y:box.y+box.height/2};
}
async function pointInfo(point){
  return page.evaluate(({x,y})=>{
    const el=document.elementFromPoint(x,y);
    const node=el?.closest?.('.se-node');
    return {tag:el?.tagName||null,className:el?.getAttribute?.('class')||null,nodeIndex:node?.dataset?.residueIndex??null,dragMode:document.querySelector('#seDragMode')?.value||null,status:document.querySelector('#seDragStatus')?.textContent||null};
  },point);
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
  const firstNode=page.locator("#secondarySvg .se-node").first();
  const firstPoint=await nucleotideCenter(firstNode);
  const targetBefore=await pointInfo(firstPoint);
  await page.mouse.move(firstPoint.x,firstPoint.y);
  await page.mouse.down();
  await page.mouse.move(firstPoint.x+70,firstPoint.y+35,{steps:6});
  await page.mouse.up();
  const targetAfter=await pointInfo(firstPoint);
  const wholeAfter=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const panDelta=Math.hypot((wholeAfter.panX||0)-(wholeBefore.panX||0),(wholeAfter.panY||0)-(wholeBefore.panY||0));
  const firstDelta=moved(offset(wholeBefore,0),offset(wholeAfter,0));
  const lastIndex=(wholeAfter.sequence?.length||1)-1;
  const lastDelta=moved(offset(wholeBefore,lastIndex),offset(wholeAfter,lastIndex));
  if(panDelta<10&&(firstDelta<5||lastDelta<5))
    throw new Error("Direct whole-secondary drag did not reposition the structure. "+JSON.stringify({panDelta,firstDelta,lastDelta,targetBefore,targetAfter,beforeDragMode:wholeBefore.dragMode,afterDragMode:wholeAfter.dragMode}));

  await page.evaluate(()=>{
    const snap=SecondaryExplorer.getWorkspaceSnapshot();
    snap.selectedResidues=[0,1];
    snap.selectionScale=1;
    snap.selectionRotation=0;
    SecondaryExplorer.restoreWorkspaceSnapshot(snap);
  });
  const selectedBefore=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const selectedNode=page.locator('#secondarySvg .se-node[data-residue-index="0"]');
  const selectedPoint=await nucleotideCenter(selectedNode);
  await page.mouse.move(selectedPoint.x,selectedPoint.y);
  await page.mouse.down();
  await page.mouse.move(selectedPoint.x+55,selectedPoint.y-30,{steps:6});
  await page.mouse.up();
  const selectedAfter=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const before0=offset(selectedBefore,0),after0=offset(selectedAfter,0);
  const before1=offset(selectedBefore,1),after1=offset(selectedAfter,1);
  const before2=offset(selectedBefore,2),after2=offset(selectedAfter,2);
  if(moved(before0,after0)<5||moved(before1,after1)<5)throw new Error("Selected residues did not move together as a group. before="+JSON.stringify({before0,before1})+" after="+JSON.stringify({after0,after1}));
  if(moved(before2,after2)>1)throw new Error("Selected-region drag also moved an unselected residue. "+JSON.stringify({before2,after2}));
  if(Math.hypot((selectedAfter.panX||0)-(selectedBefore.panX||0),(selectedAfter.panY||0)-(selectedBefore.panY||0))>1)
    throw new Error("Dragging a selected region incorrectly panned the whole secondary structure.");
  if(JSON.stringify(selectedAfter.selectedResidues)!==JSON.stringify([0,1]))throw new Error("Selected-region drag did not preserve the selection: "+JSON.stringify(selectedAfter.selectedResidues));

  const selectionControls=await page.evaluate(()=>({scale:!!document.querySelector('#seSelectionScale, [data-selection-scale]'),rotation:!!document.querySelector('#seSelectionRotation, [data-selection-rotation]')}));
  if(typeof selectedAfter.selectionScale!=="number"||typeof selectedAfter.selectionRotation!=="number")throw new Error("Selected-region zoom/rotation state disappeared after group dragging: "+JSON.stringify(selectionControls));
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
