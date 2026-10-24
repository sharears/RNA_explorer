import {chromium} from "playwright";
import assert from "node:assert/strict";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const dir="test-output/oct23-selection-stock";mkdirSync(dir,{recursive:true});
const context=vm.createContext({});
vm.runInContext(readFileSync("amino-acid-stock.js","utf8")+";globalThis.api=AminoAcidStock;",context);
const amino=context.api;
const catalog=amino.list();assert.equal(catalog.length,20);
const allNames=catalog.map(x=>x.name);assert(new Set(allNames).size===20);
const degreeLimit={H:1,C:4,N:3,O:2,S:6,P:5};
for(const {code,name} of catalog){
  const g=amino.getGraph(code);
  assert.equal(g.name,name);assert(g.atoms.length>=5);
  const ids=new Set(g.atoms.map(a=>a.id));assert.equal(ids.size,g.atoms.length,code+" atom id duplication");
  const degrees=new Map(g.atoms.map(a=>[a.id,0]));
  const network=new Map(g.atoms.map(a=>[a.id,new Set()]));
  const pairs=new Set();
  for(const bond of g.bonds){
    assert(ids.has(bond.a)&&ids.has(bond.b),code+" invalid edge");
    const key=[bond.a,bond.b].sort().join(":");assert(!pairs.has(key),code+" duplicate edge");
    pairs.add(key);degrees.set(bond.a,degrees.get(bond.a)+bond.order);degrees.set(bond.b,degrees.get(bond.b)+bond.order);
    network.get(bond.a).add(bond.b);network.get(bond.b).add(bond.a);
  }
  g.atoms.forEach(a=>assert(degrees.get(a.id)<=degreeLimit[a.element],code+" valence at "+a.id+": "+degrees.get(a.id)));
  const connected=new Set(["CA"]),pending=["CA"];while(pending.length){for(const to of network.get(pending.pop()))if(!connected.has(to)){connected.add(to);pending.push(to);}}
  assert.equal(connected.size,g.atoms.length,code+" contains disconnected atoms");
}
const browser=await chromium.launch({headless:true,executablePath:["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(existsSync)});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const root=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const errors=[],report={};
page.on("pageerror",e=>errors.push(String(e)));
async function reveal(selector){await page.locator(selector).evaluate(el=>{for(let p=el;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true;const group=el.closest(".rna-tool-panel");group?.parentElement?.querySelector('[data-rna-tab="'+group.dataset.rnaPanel+'"]')?.click();});}
try{
  await page.goto(root+"?page=secondary&start=example",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#secondarySvg .se-node");
  await page.waitForSelector("#seBoxSelectTool");
  const context=()=>page.evaluate(()=>SecondaryExplorer.getContext());
  async function clickNode(i){await page.locator('#secondarySvg .se-node[data-residue-index="'+i+'"] circle').last().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));}
  await clickNode(5);
  assert.deepEqual((await context()).selectedResidues,[5]);
  assert.equal(await page.locator(".se-selected-transform-overlay").count(),0,"Regular click generated region box");
  await clickNode(5);assert.deepEqual((await context()).selectedResidues,[],"Clicking same residue failed deselect");
  await clickNode(6);await clickNode(7);
  assert.deepEqual((await context()).selectedResidues,[7],"Normal click accumulated multi-selection");
  assert.equal(await page.locator(".se-selected-transform-overlay").count(),0);
  await page.locator("#secondarySvg .se-pair").first().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  assert.equal((await context()).selectedResidues.length,0);assert.equal((await context()).selectedPairKeys.length,1);
  await page.locator("#secondarySvg .se-pair").first().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  assert.equal((await context()).selectedPairKeys.length,0);
  await page.locator('#secondarySvg .se-backbone[data-backbone="2"]').evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  assert.equal(await page.locator('#secondarySvg .se-backbone.selected[data-backbone="2"]').count(),1);
  await page.locator('#secondarySvg .se-backbone[data-backbone="2"]').evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  assert.equal(await page.locator('#secondarySvg .se-backbone.selected[data-backbone="2"]').count(),0);
  await page.evaluate(()=>SecondarySelectionTools.setMode("box"));
  await page.evaluate(()=>SecondaryExplorer.highlightResidues([5,6,7]));
  assert.equal((await context()).selectedResidues.length,3);
  assert(await page.locator("#secondarySvg .se-selected-transform-overlay").count()>0,"Box selection didn't produce transform overlay");
  await page.evaluate(()=>SecondarySelectionTools.setMode("box"));
  assert.equal(await page.locator("#secondarySvg .se-selected-transform-overlay").count(),0,"Region rectangle remains after exiting group mode");
  report.secondary="Exclusive click, click-off, pair/backbone toggle, group only in box/lasso";

  await page.goto(root+"?page=drawing",{waitUntil:"domcontentloaded"});
  await page.locator("#drawingStockFamily").waitFor({state:"visible"});
  await page.locator("#drawingStockFamily").selectOption("amino");
  assert.equal(await page.locator("#drawingTemplateSelect option").count(),20);
  await page.locator("#drawingTemplateSelect").selectOption("amino:TRP");
  await page.locator("#drawingOpenTemplate").click();
  await page.locator("#chemEditorDialog[open]").waitFor({state:"visible",timeout:10000});
  assert.match(await page.locator("#chemEditorTitle").textContent(),/Tryptophan/);
  let g=await page.evaluate(()=>MoleculeEditor.getCurrentGraph());
  assert(g.atoms.length>=12&&g.bonds.length>=12,"Tryptophan stock graph not loaded");
  const stock=page.locator("#chemStockStructures");
  assert(await stock.isVisible(),"Stock structures menu missing");
  await page.locator("#chemStockNucleicTab").click();
  assert((await page.locator("#chemLeftBase option").allTextContents()).includes("T"),"Left thymine missing");
  assert((await page.locator("#chemRightBase option").allTextContents()).includes("T"),"Right thymine missing");
  await page.locator('[data-pair-template="GC"]').click();
  g=await page.evaluate(()=>MoleculeEditor.getCurrentGraph());
  assert.equal(g.hbonds.length,3,"G-C WCF template lost 3 base-pair hydrogen bonds");
  await page.locator("#chemStockAminoTab").click();
  assert(await page.locator("#chemAminoControls").isVisible());
  await page.locator("#chemAminoSelect").selectOption("LYS");
  await page.locator("#chemLoadAmino").click();
  g=await page.evaluate(()=>MoleculeEditor.getCurrentGraph());
  assert(g.atoms.some(a=>a.id==="NZ"),"Lysine side chain unavailable");
  report.stock="20 connected valence-screened editable amino acids, G–C template preserved, thymine left/right";

  await page.goto(root+"?page=tertiary&start=example",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().modelReady,null,{timeout:45000});
  await reveal("#teSplit");await page.locator("#teSplit").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().mappingEnabled,null,{timeout:10000});
  const selected=page.locator("#tertiaryMiniSvg [data-residue-index='9']");
  await selected.evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().linkedPulseShapes>6,null,{timeout:12000});
  let d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert.deepEqual(d.linkedPulseFocus,[9]);assert.equal(d.selectionCount,1);
  await selected.evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().linkedPulseActive===false,null,{timeout:12000});
  assert.equal((await page.evaluate(()=>TertiaryExplorer.getDiagnostics())).selectionCount,0);
  await page.locator("#tertiaryMiniSvg [data-pair]").first().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectedPairCount===1&&TertiaryExplorer.getDiagnostics().linkedPulseShapes>12,null,{timeout:12000});
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert.equal(d.linkedPulseFocus.length,2);
  report.linked="Nucleobase ring overlay, two-residue pair pulse, click to stop";
  assert.deepEqual(errors.filter(x=>!/ResizeObserver loop/i.test(x)),[],"Browser errors: "+errors.join("; "));
  writeFileSync(dir+"/report.json",JSON.stringify({status:"PASS",...report},null,2));
  console.log("PASS: all five new RNA Explorer changes: "+JSON.stringify(report));
}catch(e){await page.screenshot({path:dir+"/failure.png"}).catch(()=>{});writeFileSync(dir+"/failure.txt",String(e?.stack||e)+"\n"+errors.join("\n"));throw e;}finally{await browser.close();}
