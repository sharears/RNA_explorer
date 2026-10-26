import {chromium} from "playwright";
import assert from "node:assert/strict";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";

const output="test-output/full-nucleotide-and-layout";
mkdirSync(output,{recursive:true});
const executablePath=["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[],results={};page.on("pageerror",e=>errors.push(String(e)));
const root=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const get=()=>page.evaluate(()=>TertiaryExplorer.getDiagnostics());
const wait=(expr,timeout=12000)=>page.waitForFunction(expr,null,{timeout});
const select=selector=>page.locator(selector).first().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
const reveal=selector=>page.locator(selector).evaluate(el=>{
  for(let p=el;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true;
  const group=el.closest(".rna-tool-panel");
  group?.parentElement?.querySelector('[data-rna-tab="'+group.dataset.rnaPanel+'"]')?.click();
});
try{
  await page.goto(root+"?page=tertiary&start=example",{waitUntil:"domcontentloaded"});
  await wait(()=>TertiaryExplorer.getDiagnostics().modelReady,55000);
  const ctrl=page.locator("#tertiaryControls .te-controls");
  const importPanel=ctrl.locator(":scope > details").first();
  assert.match(await importPanel.locator(":scope > summary").textContent(),/Import.*[Mm]apping/i,
    "Import Structures & Mapping is not the first controls section");
  const sequence=await ctrl.evaluate(el=>[...el.children].map(x=>({name:x.tagName,id:x.id,cl:x.className})));
  console.log("Tertiary control order:",JSON.stringify(sequence));
  assert.equal(sequence[0].name,"DETAILS","First section is not the import disclosure");
  assert.equal(sequence[1].cl,"rna-workspace-global-bar","History must follow Import");
  assert.equal(sequence[2].cl,"rna-category-host","Select/Display/Inspect must follow Import and History");
  const tabNames=await page.locator('#scene-tertiary .rna-tool-tabs [data-rna-tab]').allTextContents();
  assert.deepEqual(tabNames,["Select","Display","Inspect"]);
  const selectionPanel=page.locator("#teSelectionDetails");
  assert.equal(await selectionPanel.locator(":scope > summary").textContent(),"Selection Details");
  assert.equal(await page.locator("#teSelectionDetails #teContextPanel").count(),1,"Existing context editor must be reused");
  assert.equal(await page.locator('.rna-tool-panel[data-rna-panel="select"] > #teSelectionDetails').count(),1,
    "Selection Details is not inside the Select tab");
  assert.equal(await ctrl.locator(':scope > #teContextPanel').count(),0,"Always-visible selection panel remained outside Select");
  await selectionPanel.locator(":scope > summary").click();
  assert(await page.locator("#teContextPanel").isVisible(),"Selection Details does not expand");
  await page.locator('#scene-tertiary [data-rna-tab="display"]').click();
  assert(!(await page.locator("#teContextPanel").isVisible()),"Selection Details visible when Display selected");
  await page.locator('#scene-tertiary [data-rna-tab="analyze"]').click();
  assert(!(await page.locator("#teContextPanel").isVisible()),"Selection Details visible when Inspect selected");
  await page.locator('#scene-tertiary [data-rna-tab="select"]').click();
  assert(await page.locator("#teContextPanel").isVisible(),"Selection details not restored in Select");
  assert.equal(await page.locator("#teStructureFile").count(),1);
  assert.equal(await page.locator("#tePdbId").count(),1);
  assert.equal(await page.locator("#teSameMolecule").count(),1);
  results.layout="Import first, History next, Select/Display/Inspect after; Selection Details only under collapsible Select; all import tools remain";

  await page.locator('#teSequencePanel .te-seq-residue').nth(8).click();
  await wait(()=>TertiaryExplorer.getDiagnostics().selectionCount===1);
  await wait(()=>{const d=TertiaryExplorer.getDiagnostics();return d.linkedPulseVisible&&d.linkedPulseAtomParts.base>0&&d.linkedPulseAtomParts.sugar>0&&d.linkedPulseAtomParts.phosphate>0&&d.linkedPulseCovalentBonds>0;});
  let d=await get();
  assert.deepEqual(d.linkedPulseFocus,[8]);
  assert.equal(d.linkedPulseHbondDots,0,"A single nucleotide must not have pair H-bond dots");
  assert(d.linkedPulseAtomParts.base>0&&d.linkedPulseAtomParts.sugar>=5&&d.linkedPulseAtomParts.phosphate>=2);
  assert(d.linkedPulseCovalentBonds>15,"Covalent connections to ribose/phosphate were not highlighted");
  results.single={selectedIndex:8,atomParts:d.linkedPulseAtomParts,covalentBonds:d.linkedPulseCovalentBonds};
  await wait(()=>{const s=TertiaryExplorer.getDiagnostics();return !s.linkedPulseVisible&&s.linkedPulseCovalentBonds===0&&s.linkedPulseAtomParts.sugar===0;});
  await wait(()=>{const s=TertiaryExplorer.getDiagnostics();return s.linkedPulseVisible&&s.linkedPulseAtomParts.phosphate>0;});
  await page.locator("#teSequencePanel .te-seq-residue").nth(8).click();
  await wait(()=>{const s=TertiaryExplorer.getDiagnostics();return !s.linkedPulseActive&&s.linkedPulseCovalentBonds===0;});
  results.singleBlink="Base, sugar and phosphate all pulse on/off together and clicking again deselects";

  await reveal("#teSplit");await page.locator("#teSplit").check();
  await wait(()=>TertiaryExplorer.getDiagnostics().split&&TertiaryExplorer.getDiagnostics().mappingEnabled);
  await select('#tertiaryMiniSvg [data-pair]');
  await wait(()=>{const s=TertiaryExplorer.getDiagnostics();return s.selectedPairCount===1&&s.linkedPulseVisible&&s.linkedPulseAtomParts.phosphate>=4&&s.linkedPulseCovalentBonds>25;});
  d=await get();
  assert.equal(d.linkedPulseFocus.length,2,"Only one nucleotide of base pair was highlighted");
  assert(d.linkedPulseAtomParts.sugar>=10);
  results.pair={highlightedResidues:d.linkedPulseFocus,parts:d.linkedPulseAtomParts,connectedBonds:d.linkedPulseCovalentBonds};
  await wait(()=>{const s=TertiaryExplorer.getDiagnostics();return !s.linkedPulseVisible&&s.linkedPulseAtomParts.phosphate===0;});
  results.pairBlink="Both entire selected nucleotides pulse without highlighting neighbors";
  assert.deepEqual(errors.filter(x=>!/ResizeObserver loop/i.test(x)),[],errors.join("; "));
  writeFileSync(output+"/report.json",JSON.stringify({status:"PASS",...results},null,2));
  console.log("PASS Tertiary selection-details, import order, entire-nucleotide blink",JSON.stringify(results));
}catch(e){
  await page.screenshot({path:output+"/failure.png",fullPage:true}).catch(()=>{});
  writeFileSync(output+"/failure.txt",String(e.stack||e)+"\n"+errors.join("\n"));
  throw e;
}finally{await browser.close()}
