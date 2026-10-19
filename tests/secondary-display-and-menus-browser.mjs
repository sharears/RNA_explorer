import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync, writeFileSync} from "node:fs";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const dir="test-output/secondary-display-and-menus";mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
const report={};

async function expose(selector){
  await page.locator(selector).evaluate(el=>{
    for(let n=el;n;n=n.parentElement){if(n.tagName==="DETAILS")n.open=true;}
    const host=el.closest(".rna-tool-panel");
    if(host){
      const group=host.dataset.rnaPanel;
      const btn=host.parentElement.querySelector('[data-rna-tab="'+group+'"]');
      btn?.click();
    }
  });
}
async function checkedWithin(selector,bound){
  const rect=await page.locator(selector).boundingBox();
  const outer=await page.locator(bound).boundingBox();
  if(!rect||!outer)throw Error("Missing bounding box: "+selector);
  assert(rect.x>=outer.x-2 && rect.x+rect.width<=outer.x+outer.width+2,
    selector+" escapes "+bound+": "+JSON.stringify({rect,outer}));
}

try{
  await page.goto(base+"?page=secondary&start=example",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#scene-secondary:not([hidden])").waitFor({state:"visible",timeout:20000});
  await page.waitForSelector("#scene-secondary .rna-tool-tabs",{timeout:15000});
  assert.equal(await page.locator("#scene-secondary .workspace-control-map").count(),0,"Obsolete bottom Display/Analyze row remains");
  assert.deepEqual((await page.locator("#scene-secondary .rna-tool-tabs [data-rna-tab]").allTextContents()).map(x=>x.trim()),
    ["Select","Display","Inspect"],"Main tabs changed");
  const pairGroup=page.locator("#scene-secondary .rna-tool-panel[data-rna-panel='display'] > details").filter({has:page.locator("summary")}).filter({hasText:"Display · Base pairs"});
  assert.equal(await pairGroup.count(),1,"No Display Base pairs accordion");
  assert.equal(await page.locator("#scene-secondary .rna-tool-panel[data-rna-panel='analyze'] #sePairProbFile").count(),1,
    "Inspect probability data controls were removed");
  assert.equal(await page.locator("#sePairVisible").count(),1);
  assert.equal(await page.locator("#seLWLabels").count(),1);
  assert.deepEqual(await page.locator("#se-mode option").evaluateAll(items=>items.map(x=>x.value)),
    ["uniform","typed","lw","lw-only"]);
  await expose("#sePairVisible");
  const initial=await page.locator("#secondarySvg g.se-pair").count();
  assert(initial>3,"Initial RNA has no base-pair connector graphics");
  await page.locator("#sePairVisible").uncheck();
  assert.equal(await page.locator("#secondarySvg g.se-pair").count(),0,"Show/hide toggle did not hide pair connectors");
  assert.equal((await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot())).structure.length,76,
    "Show/hide unexpectedly removed pairing data");
  await page.locator("#sePairVisible").check();
  assert.equal(await page.locator("#secondarySvg g.se-pair").count(),initial,"Toggle failed to restore pairing");

  await expose("#se-mode");
  await page.locator("#se-mode").selectOption("lw-only");
  const pairList=page.locator("#sePairList");
  await expose("#sePairList");
  const options=await pairList.locator("option").evaluateAll(items=>items.filter(x=>x.value).map(x=>x.value));
  assert(options.length>4,"No editable base pairs were found");
  await pairList.selectOption(options[0]);
  await expose("#seLw");
  await page.locator("#seLw").selectOption("cWW");
  const firstKey=options[0];
  const pair=page.locator('#secondarySvg g.se-pair[data-pair="'+firstKey+'"]');
  assert.equal(await pair.locator("circle").count(),1,"cWW did not generate an LW circle");
  assert.equal(await pair.locator('path[stroke]:not([stroke="transparent"])').count(),0,
    "LW symbols only unexpectedly left line connectors");
  await page.locator("#seLWLabels").check();
  assert.equal(await pair.locator("text").innerText(),"cWW","Show family labels failed");
  await page.locator("#se-mode").selectOption("lw");
  // An existing per-pair override is not allowed to silently defeat the global both mode.
  // Restore selected pair style to inherit if needed.
  await expose("#seLocal-mode");
  await page.locator("#seLocal-mode").selectOption("inherit");
  assert(await pair.locator('path[stroke]:not([stroke="transparent"])').count()>0,
    "Combined lines + symbols mode did not draw its connector");
  assert.equal(await pair.locator("circle").count(),1,"Combined mode lost the LW symbol");
  const saved=await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot());
  assert.equal(saved.annotations[firstKey],"cWW");
  assert.equal(saved.settings.lwLabels,true);
  assert.equal(saved.settings.pairVisible,true);
  report.basePairs={number:initial,family:saved.annotations[firstKey],familyLabels:saved.settings.lwLabels,
    lwSymbolOnlyAndCombined:true,showHide:true};

  // Test the narrow control column at multiple widths.
  await expose("#seWholeRotation");
  for(const width of [1440,740,390]){
    await page.setViewportSize({width,height:980});
    await page.waitForTimeout(200);
    await checkedWithin(".se-whole-rotation-dock","#scene-secondary .rna-tool-panel[data-rna-panel='display']");
    await checkedWithin(".se-whole-rotation-dock input[type=range]",".se-whole-rotation-dock");
    await checkedWithin(".se-whole-rotation-dock .se-whole-rotation-label",".se-whole-rotation-dock");
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator("#seWholeRotation").evaluate(el=>{el.value="42";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.waitForFunction(()=>Number(SecondaryExplorer.getWorkspaceSnapshot().wholeRotation)===42,
    null,{timeout:7000});
  report.rotation={testedWidths:[1440,740,390],angle:42};

  // Clicking Explore and hovering near the utility trigger must not open More.
  await page.hover(".nav-menu#exploreNavMenu > button");
  assert.equal(await page.locator("#utilityMenu").evaluate(el=>el.open),false,
    "Hovering Explore unexpectedly opens the three-dot utility menu");
  await page.hover("#utilityMenu > summary");
  assert.equal(await page.locator("#utilityMenu").evaluate(el=>el.open),false,
    "Hovering over More unexpectedly opens it");
  await page.locator("#utilityMenu > summary").click();
  assert.equal(await page.locator("#utilityMenu").evaluate(el=>el.open),true,
    "More menu did not open on click");
  await page.hover("#exploreNavMenu > button");
  assert.equal(await page.locator("#utilityMenu").evaluate(el=>el.open),false,
    "More menu stayed open after hovering Explore");
  await page.locator("#exploreNavMenu > button").click();
  assert.equal(await page.locator("#utilityMenu").evaluate(el=>el.open),false,
    "Clicking Explore reopened utility");
  report.menus={exploreDoesNotOpenMore:true,moreClickOnly:true,exclusive:true};
  await page.screenshot({path:dir+"/secondary-desktop.png",fullPage:false});

  // Smoke-test the unaffected tertiary workspace and structure renderer.
  await page.goto(base+"?page=tertiary&start=example",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#tertiaryMolecularViewer canvas").waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,
    null,{timeout:40000});
  assert.equal(await page.locator("#teOpenExport").count(),1,"3D export button disappeared");
  const d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert(d.atomCount>100,"3D model failed after update");
  report.tertiary={atoms:d.atomCount,exportPresent:true};

  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/i.test(e)),[],
    "Browser exceptions: "+JSON.stringify(errors));
  writeFileSync(dir+"/report.json",JSON.stringify({result:"PASS",...report},null,2));
  console.log("PASS: four Secondary and topbar fixes",JSON.stringify(report));
}catch(err){
  await page.screenshot({path:dir+"/failure.png",fullPage:false}).catch(()=>{});
  writeFileSync(dir+"/failure.txt",String(err?.stack||err)+"\n\nBrowser errors:\n"+errors.join("\n"));
  throw err;
}finally{await browser.close();}
