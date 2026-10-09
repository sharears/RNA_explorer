import { chromium } from "playwright";
import fs from "node:fs";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error"&&!/Failed to load resource/i.test(msg.text()))errors.push("console: "+msg.text());});

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const waitForRepresentation=value=>page.waitForFunction(v=>TertiaryExplorer.getWorkspaceSnapshot().representation===v,value,{timeout:15000});

try{
  await page.goto(base+"?page=tertiary&start=example",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('#scene-tertiary:not([hidden])',{state:"visible",timeout:20000});
  await page.waitForSelector("#teWorkspaceCategories .workspace-category-tab",{timeout:20000});
  await page.waitForSelector("#teSequenceDock .te-seq-residue",{state:"visible",timeout:20000});
  await page.waitForSelector("#teUndo",{timeout:20000});

  const tertiaryTabs=await page.locator("#teWorkspaceCategories .workspace-category-tab").allTextContents();
  assert(JSON.stringify(tertiaryTabs.map(x=>x.trim()))===JSON.stringify(["Select","Display","Analyze"]),"Tertiary category order is not Select / Display / Analyze: "+JSON.stringify(tertiaryTabs));

  const sequenceInfo=await page.locator("#teSequenceDock").evaluate(dock=>({
    beforeSplit:dock.nextElementSibling?.id==="tertiarySplitShell",
    chain:document.querySelector("#teSequenceChainLabel")?.textContent||"",
    count:dock.querySelectorAll(".te-seq-residue").length,
    index:dock.querySelector(".te-seq-residue .te-seq-index")?.textContent||"",
    base:dock.querySelector(".te-seq-residue .te-seq-base")?.textContent||""
  }));
  assert(sequenceInfo.beforeSplit,"Tertiary residue sequence is not docked immediately above the 3D split workspace.");
  assert(sequenceInfo.count>5,"Tertiary residue sequence did not render enough residues: "+JSON.stringify(sequenceInfo));
  assert(sequenceInfo.index==="1","First tertiary sequence item does not show residue index above the base: "+JSON.stringify(sequenceInfo));
  assert(/^[ACGU?]$/.test(sequenceInfo.base),"First tertiary sequence item has an invalid base label: "+JSON.stringify(sequenceInfo));
  assert(/chain/i.test(sequenceInfo.chain),"Tertiary sequence dock is missing the chain label: "+JSON.stringify(sequenceInfo));

  const sequenceButton=page.locator("#teSequenceDock .te-seq-residue").nth(4);
  await sequenceButton.click();
  await page.waitForFunction(()=>TertiaryExplorer.getWorkspaceSnapshot().selected===4,{timeout:10000});
  const afterSequence=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot());
  assert(afterSequence.selectionIndices.includes(4),"Clicking residue 5 in the sequence did not select the same residue in the tertiary workspace.");

  const cutoff=page.locator("#teSelectNearCutoff");
  const cutoffDetails=cutoff.locator("xpath=ancestor::details[1]");
  if(!(await cutoffDetails.getAttribute("open")))await cutoffDetails.locator(":scope > summary").click();
  await cutoff.fill("6.2");
  assert(await cutoff.getAttribute("max")==="25","Tertiary proximity selection should allow manual cutoffs only up to 25 Å.");
  await page.click("#teSelectNearButton");
  await page.waitForFunction(()=>/Selected \d+ residue/.test(document.querySelector("#teSelectionProximityStatus")?.textContent||""),{timeout:15000});
  const afterNear=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot());
  assert(afterNear.selectionIndices.length>=1,"Proximity selection removed the starting residue unexpectedly.");
  assert((await page.locator("#teSelectionProximityStatus").textContent()).includes("6.2 Å"),"Proximity selection did not use the user-entered cutoff.");

  await page.click('[data-workspace-category="display"]');
  const beforeRep=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot().representation);
  const changedRep=beforeRep==="spheres"?"sticks":"spheres";
  await page.selectOption("#teRepresentation",changedRep);
  await waitForRepresentation(changedRep);
  await page.waitForFunction(()=>!document.querySelector("#teUndo")?.disabled,{timeout:10000});
  await page.click("#teUndo");
  await waitForRepresentation(beforeRep);
  await page.waitForFunction(()=>!document.querySelector("#teRedo")?.disabled,{timeout:10000});
  await page.click("#teRedo");
  await waitForRepresentation(changedRep);
  const historyTitles=await page.evaluate(()=>({u:document.querySelector("#teUndo")?.title,r:document.querySelector("#teRedo")?.title}));
  assert(/Ctrl\+Z/.test(historyTitles.u||"")&&/Ctrl\+Y/.test(historyTitles.r||""),"Tertiary Undo/Redo shortcut labels are not standardized: "+JSON.stringify(historyTitles));

  await page.goto(base+"?page=secondary&start=example",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('#scene-secondary:not([hidden])',{state:"visible",timeout:20000});
  await page.waitForSelector("#seWorkspaceCategories .workspace-category-tab",{timeout:20000});
  await page.waitForSelector("#seWorkspaceHistory #seUndo",{timeout:20000});
  const secondaryTabs=await page.locator("#seWorkspaceCategories .workspace-category-tab").allTextContents();
  assert(JSON.stringify(secondaryTabs.map(x=>x.trim()))===JSON.stringify(["Select","Display","Analyze"]),"Secondary category order is not Select / Display / Analyze: "+JSON.stringify(secondaryTabs));
  assert(await page.locator('#seWorkspaceCategories [data-workspace-panel="display"] details').count()>0,"Secondary Display category is empty.");
  assert(await page.locator('#seWorkspaceCategories [data-workspace-panel="analyze"] details').count()>0,"Secondary Analyze category is empty.");

  await page.evaluate(()=>MoleculeEditor.openBlank());
  await page.waitForSelector("#chemEditorDialog[open] #chemUndoButton",{state:"visible",timeout:10000});
  const molecularHistory=await page.evaluate(()=>({
    undoClass:document.querySelector("#chemUndoButton")?.classList.contains("workspace-history-button"),
    redoClass:document.querySelector("#chemRedoButton")?.classList.contains("workspace-history-button"),
    undoTitle:document.querySelector("#chemUndoButton")?.title||"",
    redoTitle:document.querySelector("#chemRedoButton")?.title||""
  }));
  assert(molecularHistory.undoClass&&molecularHistory.redoClass,"Molecular Drawing history controls are not using the shared workspace history treatment.");
  assert(/Ctrl\+Z/.test(molecularHistory.undoTitle)&&/Ctrl\+Y/.test(molecularHistory.redoTitle),"Molecular Drawing history shortcut labels are inconsistent.");
  await page.click("#chemEditorClose");

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Workspace category browser errors:\n"+serious.join("\n"));
  console.log("PASS: Select/Display/Analyze organization, tertiary sequence selection, manual cutoff selection, and shared Undo/Redo");
} catch(error) {
  fs.mkdirSync("test-output",{recursive:true});
  fs.writeFileSync("test-output/workspace-categories-error.txt",String(error?.stack||error)+"\n\nCaptured browser errors:\n"+errors.join("\n"));
  throw error;
} finally {
  await browser.close();
}
