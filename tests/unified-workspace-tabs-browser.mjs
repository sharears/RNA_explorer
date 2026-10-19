import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
const output="test-output/unified-workspace-tabs";
mkdirSync(output,{recursive:true});
const note={};

async function verifyTabs(workspace){
  const scene="#scene-"+workspace;
  await page.waitForSelector(scene+":not([hidden])",{state:"visible",timeout:20000});
  await page.waitForFunction(ws=>document.querySelectorAll("#scene-"+ws+" .rna-category-host .rna-tool-tabs").length===1,
    workspace,{timeout:15000});
  const tabs=page.locator(scene+" .rna-category-host .rna-tool-tabs [data-rna-tab]");
  assert.deepEqual((await tabs.allTextContents()).map(t=>t.trim()),["Select","Display","Inspect"]);
  assert.equal(await tabs.count(),3);
  assert.equal(await page.locator(scene+" .workspace-category-shell").count(),0,"Duplicate top categories still exist");
  assert.equal(await page.locator(scene+" .rna-tool-tabs").count(),1,"Multiple bottom category navigations exist");
  for(const key of ["select","display","analyze"]){
    const panel=page.locator(scene+' .rna-category-host .rna-tool-panel[data-rna-panel="'+key+'"]');
    assert.equal(await panel.count(),1,key+" panel is missing");
    await page.locator(scene+' .rna-category-host .rna-tool-tabs [data-rna-tab="'+key+'"]').click();
    assert.equal(await panel.evaluate(el=>el.hidden),false,key+" panel did not activate");
    assert(await panel.locator("details,button,input,select,.se-whole-rotation-dock").count()>0,
      key+" panel is empty");
  }
}

try{
  await page.goto(base+"?page=secondary&start=example",{waitUntil:"domcontentloaded",timeout:30000});
  await verifyTabs("secondary");
  const sp="#scene-secondary .rna-category-host";
  const rotate=page.locator(sp+' .rna-tool-panel[data-rna-panel="display"] #seWholeRotation');
  assert.equal(await rotate.count(),1,"Whole RNA rotation was not merged into Display");
  const before=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot().wholeRotation);
  await page.locator(sp+' .rna-tool-tabs [data-rna-tab="display"]').click();
  await rotate.evaluate(el=>{el.value="32";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.waitForFunction(()=>Math.abs(Number(SecondaryExplorer.getWorkspaceSnapshot().wholeRotation)-32)<0.1,
    null,{timeout:10000});
  const after=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot().wholeRotation);
  assert.notEqual(after,before,"Secondary rotation control did not change the structure");
  assert.equal(await page.locator(sp+' .rna-tool-panel[data-rna-panel="select"] #seBoxSelectTool').count(),1,
    "Secondary residue selection lost");
  assert.equal(await page.locator(sp+' .rna-tool-panel[data-rna-panel="analyze"] #sePairProbFile').count(),1,
    "Secondary probability analysis lost");
  assert.equal(await page.locator("#seUndo").count(),1,"Secondary Undo missing");
  note.secondary={tabs:3,rotationChanged:[before,after],selection:true,probability:true};

  await page.goto(base+"?page=tertiary&start=example",{waitUntil:"domcontentloaded",timeout:30000});
  await verifyTabs("tertiary");
  const tp="#scene-tertiary .rna-category-host";
  await page.locator("#tertiaryMolecularViewer canvas").waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,
    null,{timeout:40000});
  const expected=[
    ["select","#teSelectNearCutoff"],
    ["select","#teSelectCurrent"],
    ["display","#teRepresentation"],
    ["display","#teClipEnabled"],
    ["analyze","#teMeasureMode"],
    ["analyze","#teAlignFile"]
  ];
  for(const [group,selector] of expected){
    assert.equal(await page.locator(tp+' .rna-tool-panel[data-rna-panel="'+group+'"] '+selector).count(),1,
      "Tertiary control "+selector+" missing from "+group);
  }
  const diagnosis=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert(diagnosis.modelReady&&diagnosis.atomCount>100,"Tertiary model did not load");
  assert.equal(await page.locator("#teOpenExport").count(),1,"Tertiary Export missing");
  note.tertiary={tabs:3,atoms:diagnosis.atomCount,controls:expected.map(x=>x[1]),export:true};
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/i.test(e)),[],"Unexpected browser errors");
  writeFileSync(output+"/report.json",JSON.stringify({result:"PASS",...note},null,2));
  console.log("PASS unified Select Display Inspect workspaces:",JSON.stringify(note));
}catch(err){
  await page.screenshot({path:output+"/failure.png"}).catch(()=>{});
  writeFileSync(output+"/failure.txt",String(err?.stack||err)+"\n\nBrowser errors:\n"+errors.join("\n"));
  throw err;
}finally{
  await browser.close();
}
