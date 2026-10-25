import {chromium} from "playwright";
import assert from "node:assert/strict";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";

const output="test-output/hbond-pulse";mkdirSync(output,{recursive:true});
const executablePath=["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[],results={};page.on("pageerror",error=>errors.push(String(error)));
const root=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const diag=()=>page.evaluate(()=>TertiaryExplorer.getDiagnostics());
const condition=(predicate,timeout=9000)=>page.waitForFunction(predicate,null,{timeout});
const clickSvg=selector=>page.locator(selector).first().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
const reveal=selector=>page.locator(selector).evaluate(el=>{
  for(let p=el;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true;
  const group=el.closest(".rna-tool-panel");
  group?.parentElement?.querySelector('[data-rna-tab="'+group.dataset.rnaPanel+'"]')?.click();
});
try{
  await page.goto(root+"?page=tertiary&start=example",{waitUntil:"domcontentloaded"});
  await condition(()=>TertiaryExplorer.getDiagnostics().modelReady,55000);
  await reveal("#teSplit");await page.locator("#teSplit").check();
  await condition(()=>TertiaryExplorer.getDiagnostics().mappingEnabled&&TertiaryExplorer.getDiagnostics().split);
  const availablePairs=await page.locator("#tertiaryMiniSvg [data-pair]").evaluateAll(els=>[...new Set(els.map(el=>el.getAttribute("data-pair")).filter(Boolean))]);
  assert(availablePairs.length>0,"No base pair shown in mapped 2D");
  let selectedKey=null,count=0;
  for(const key of availablePairs){
    await clickSvg('#tertiaryMiniSvg [data-pair="'+key+'"]');
    await condition(()=>TertiaryExplorer.getDiagnostics().selectedPairCount===1);
    const d=await diag();const n=d.hbondCounts[key]||0;
    if(n>0){selectedKey=key;count=n;break;}
  }
  assert(selectedKey,"No mapped base pair passed the site's existing hydrogen-bond geometry screen");
  results.pair={key:selectedKey,geometricHBonds:count};
  // Pulse ON must show exactly nine bright-pink sphere dots per screened bond.
  await condition(()=>{const d=TertiaryExplorer.getDiagnostics();return d.linkedPulseVisible&&d.linkedPulseHbondDots>0;},12000);
  let d=await diag();
  assert.equal(d.linkedPulseHbondDots,count*9,"Wrong count of synchronous H-bond dots");
  assert(d.linkedPulseShapes>d.linkedPulseHbondDots,"Base ring overlays did not pulse alongside H-bond dots");
  // OFF phase removes all temporary shapes (not merely dims them), including bonds.
  await condition(()=>{const d=TertiaryExplorer.getDiagnostics();return !d.linkedPulseVisible&&d.linkedPulseHbondDots===0&&d.linkedPulseShapes===0;},12000);
  await condition(()=>{const d=TertiaryExplorer.getDiagnostics();return d.linkedPulseVisible&&d.linkedPulseHbondDots>0;},12000);
  results.linked="3D hot pink bond dots appear/disappear in the very same pulse phase as both nucleobase rings";

  // Disabling the linked 2D pane must not stop an existing 3D base-pair selection.
  await reveal("#teSplit");await page.locator("#teSplit").uncheck();
  await condition(()=>!TertiaryExplorer.getDiagnostics().split&&TertiaryExplorer.getDiagnostics().selectedPairCount===1);
  await condition(()=>{const d=TertiaryExplorer.getDiagnostics();return d.linkedPulseVisible&&d.linkedPulseHbondDots>0;},12000);
  d=await diag();assert.equal(d.linkedPulseHbondDots,count*9);
  await condition(()=>{const d=TertiaryExplorer.getDiagnostics();return !d.linkedPulseVisible&&d.linkedPulseHbondDots===0;},12000);
  results.standalone="Hydrogen bonds continue pulsing in standalone 3D mode";

  // Selecting a single residue must not display a hydrogen bond pulse.
  await page.locator("#teSequencePanel .te-seq-residue").nth(8).click();
  await condition(()=>{const d=TertiaryExplorer.getDiagnostics();return d.selectedPairCount===0&&d.selectionCount===1;});
  await condition(()=>TertiaryExplorer.getDiagnostics().linkedPulseVisible,12000);
  d=await diag();assert.equal(d.linkedPulseHbondDots,0,"Single-residue selection shows pair hydrogen bonds");
  await page.locator("#teSequencePanel .te-seq-residue").nth(8).click();
  await condition(()=>!TertiaryExplorer.getDiagnostics().linkedPulseActive&&TertiaryExplorer.getDiagnostics().linkedPulseHbondDots===0);
  results.residue="Single residue pulses without H-bond dots and click-again clears everything";

  assert.deepEqual(errors.filter(x=>!/ResizeObserver loop/i.test(x)),[],errors.join("; "));
  console.log("PASS synchronized blinking hydrogen bonds",JSON.stringify(results));
  writeFileSync(output+"/report.json",JSON.stringify({status:"PASS",...results},null,2));
}catch(error){
  writeFileSync(output+"/failure.txt",String(error.stack||error)+"\n"+errors.join("\n"));
  await page.screenshot({path:output+"/failure.png",fullPage:true}).catch(()=>{});
  throw error;
}finally{await browser.close()}
