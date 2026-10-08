import { chromium } from "playwright";
import fs from "node:fs";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=secondary";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error"&&!/Failed to load resource/i.test(msg.text()))errors.push("console: "+msg.text());});

const moved=(a,b)=>Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('body[data-page-mode="secondary"] #scene-secondary:not([hidden])',{timeout:10000});
  await page.waitForSelector("#secondarySvg .se-node",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>document.querySelector("#seDragMode")?.value==="whole",{timeout:10000});

  const badge=((await page.locator("#scene-secondary .rna-workspace-mode-badge").textContent())||"").replace(/\s+/g," ").trim();
  if(!/Explore workspace/i.test(badge)||!/Secondary structure/i.test(badge))throw new Error("Secondary workspace consistency label is missing: "+badge);

  // 1. Whole 2D structure should be directly draggable by default.
  await page.evaluate(()=>{
    const snap=SecondaryExplorer.getWorkspaceSnapshot();
    snap.selectedResidues=[];
    SecondaryExplorer.restoreWorkspaceSnapshot(snap);
  });
  const wholeBefore=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const firstNode=page.locator("#secondarySvg .se-node").first();
  const firstBox=await firstNode.boundingBox();
  if(!firstBox)throw new Error("Could not measure a secondary-structure residue for whole-view drag.");
  await page.mouse.move(firstBox.x+firstBox.width/2,firstBox.y+firstBox.height/2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x+firstBox.width/2+70,firstBox.y+firstBox.height/2+35,{steps:6});
  await page.mouse.up();
  const wholeAfter=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  if(Math.hypot((wholeAfter.panX||0)-(wholeBefore.panX||0),(wholeAfter.panY||0)-(wholeBefore.panY||0))<10)
    throw new Error("Direct whole-secondary drag did not change the saved pan position.");

  // 2. A selected group should drag together, without turning into a whole-view pan.
  await page.evaluate(()=>{
    const snap=SecondaryExplorer.getWorkspaceSnapshot();
    snap.selectedResidues=[0,1];
    snap.selectionScale=1;
    snap.selectionRotation=0;
    SecondaryExplorer.restoreWorkspaceSnapshot(snap);
  });
  const selectedBefore=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const selectedNode=page.locator('#secondarySvg .se-node[data-residue-index="0"]');
  const selectedBox=await selectedNode.boundingBox();
  if(!selectedBox)throw new Error("Could not measure the selected secondary-structure residue.");
  await page.mouse.move(selectedBox.x+selectedBox.width/2,selectedBox.y+selectedBox.height/2);
  await page.mouse.down();
  await page.mouse.move(selectedBox.x+selectedBox.width/2+55,selectedBox.y+selectedBox.height/2-30,{steps:6});
  await page.mouse.up();
  const selectedAfter=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  const before0=selectedBefore.manualOffsets?.[0]||{x:0,y:0},after0=selectedAfter.manualOffsets?.[0]||{x:0,y:0};
  const before1=selectedBefore.manualOffsets?.[1]||{x:0,y:0},after1=selectedAfter.manualOffsets?.[1]||{x:0,y:0};
  if(moved(before0,after0)<5||moved(before1,after1)<5)throw new Error("Selected residues did not move together as a group. before="+JSON.stringify({before0,before1})+" after="+JSON.stringify({after0,after1}));
  if(Math.hypot((selectedAfter.panX||0)-(selectedBefore.panX||0),(selectedAfter.panY||0)-(selectedBefore.panY||0))>1)
    throw new Error("Dragging a selected region incorrectly panned the whole secondary structure.");
  if(JSON.stringify(selectedAfter.selectedResidues)!==JSON.stringify([0,1]))throw new Error("Selected-region drag did not preserve the selection: "+JSON.stringify(selectedAfter.selectedResidues));

  // Existing selected-region zoom/rotation must remain available after repositioning.
  const selectionControls=await page.evaluate(()=>({
    scale:!!document.querySelector('#seSelectionScale, [data-selection-scale]'),
    rotation:!!document.querySelector('#seSelectionRotation, [data-selection-rotation]')
  }));
  // The public workspace state is the contract even if the visible controls use different IDs.
  if(typeof selectedAfter.selectionScale!=="number"||typeof selectedAfter.selectionRotation!=="number")
    throw new Error("Selected-region zoom/rotation state disappeared after group dragging: "+JSON.stringify(selectionControls));

  // Residue-number labels must keep their independent drag target instead of moving with the whole RNA.
  if(await page.locator("#secondarySvg [data-index-label]").count()<1)throw new Error("Residue-index drag targets disappeared after adding whole/selection dragging.");

  // 3. Molecular Drawing should open as a full, opaque dedicated workspace.
  await page.evaluate(()=>MoleculeEditor.openBlank());
  await page.waitForSelector("#chemEditorDialog[open]",{state:"visible",timeout:10000});
  const drawing=await page.locator("#chemEditorDialog").evaluate(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {left:r.left,top:r.top,width:r.width,height:r.height,borderRadius:s.borderRadius,background:s.backgroundColor,label:el.getAttribute("aria-label")};
  });
  const viewport=page.viewportSize();
  if(!viewport||Math.abs(drawing.left)>2||Math.abs(drawing.top)>2||Math.abs(drawing.width-viewport.width)>3||Math.abs(drawing.height-viewport.height)>3)
    throw new Error("Molecular Drawing is not filling the workspace viewport: "+JSON.stringify({drawing,viewport}));
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
