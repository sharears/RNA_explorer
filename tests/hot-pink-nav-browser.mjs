import {chromium} from "playwright";
import assert from "node:assert/strict";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";

const dir="test-output/hot-pink-nav";
mkdirSync(dir,{recursive:true});
const executablePath=["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const root=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const errors=[],report={};
page.on("pageerror",e=>errors.push(String(e)));
const color=async selector=>page.locator(selector).first().evaluate(el=>({
  stroke:getComputedStyle(el).stroke, dash:getComputedStyle(el).strokeDasharray,
  animation:getComputedStyle(el).animationName,
  boxShadow:getComputedStyle(el).boxShadow
}));
const clickSvg=async selector=>page.locator(selector).first().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
async function reveal(selector){
  await page.locator(selector).evaluate(el=>{
    for(let p=el;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true;
    const group=el.closest(".rna-tool-panel");
    group?.parentElement?.querySelector('[data-rna-tab="'+group.dataset.rnaPanel+'"]')?.click();
  });
}
try{
  await page.goto(root+"?page=secondary&start=example",{waitUntil:"domcontentloaded"});
  await page.locator("#secondarySvg .se-node").first().waitFor({state:"attached"});
  await clickSvg('#secondarySvg .se-node[data-residue-index="6"]');
  assert.deepEqual(await page.evaluate(()=>SecondaryExplorer.getContext().selectedResidues),[6]);
  const selectedNode=await color('#secondarySvg .se-node.multi-selected>circle:first-child');
  assert.equal(selectedNode.stroke,"rgb(255, 20, 147)",JSON.stringify(selectedNode));
  assert.match(selectedNode.animation,/rna-hot-pink-pulse/);
  await clickSvg("#secondarySvg .se-pair");
  assert.equal((await page.evaluate(()=>SecondaryExplorer.getContext().selectedPairKeys)).length,1);
  const selectedPair=await color('#secondarySvg .se-pair.selected path:not([stroke="transparent"])');
  assert.equal(selectedPair.stroke,"rgb(255, 20, 147)",JSON.stringify(selectedPair));
  assert.match(selectedPair.dash,/3px,?\s*7px|3px 7px|3,?\s*7/);
  assert.match(selectedPair.animation,/rna-hot-pink-pulse/);
  report.secondary="Selected residues pulse hot pink; selected pair connection is pink and dotted";

  await page.goto(root+"?page=tertiary&start=example",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().modelReady,null,{timeout:55000});
  assert.equal(await page.locator('#scene-tertiary .workspace-control-map').count(),0,"Duplicate five-button shortcut row still exists");
  const tabs=await page.locator('#scene-tertiary .rna-tool-tabs [data-rna-tab]').allTextContents();
  assert.deepEqual(tabs,["Select","Display","Inspect"],"Primary functional 3D tabs were changed");
  assert.equal(await page.locator("#teStructureFile").count(),1,"Import tools accidentally removed");
  assert.equal(await page.locator("#teSelectRange").count(),1,"Selection controls accidentally removed");
  assert.equal(await page.locator("#teColorMode").count(),1,"Display tools accidentally removed");
  assert.equal(await page.locator("#teMeasureMode").count(),1,"Inspect tools accidentally removed");
  assert.equal(await page.locator("#teClipEnabled").count(),1,"View/Clipping tool accidentally removed");
  await page.locator("#scene-tertiary .rna-tool-tabs [data-rna-tab=display]").click();
  await reveal("#teColorMode");
  assert(await page.locator("#teColorMode").isVisible(),"Display tab not accessible after shortcut removal");
  await page.locator("#scene-tertiary .rna-tool-tabs [data-rna-tab=analyze]").click();
  await reveal("#teMeasureMode");
  assert(await page.locator("#teMeasureMode").isVisible(),"Inspect tab not accessible after shortcut removal");
  report.tabs="Five duplicate shortcut buttons absent; Select, Display, Inspect and every tool remain";

  await page.locator('#teSequencePanel .te-seq-residue').nth(8).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===1,null,{timeout:6000});
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().linkedPulseActive,null,{timeout:6000});
  let diag=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert.equal(diag.selectionHighlightColor,"#ff1493");
  assert.deepEqual(diag.linkedPulseFocus,[8],"Sequence pick failed to focus the 3D ring");
  let seq=await page.locator('#teSequencePanel .te-seq-residue.chosen').first().evaluate(el=>({
    animation:getComputedStyle(el).animationName,boxShadow:getComputedStyle(el).boxShadow
  }));
  assert.match(seq.animation,/rna-hot-pink-button/);
  await page.locator('#teSequencePanel .te-seq-residue').nth(8).click();
  await page.waitForFunction(()=>!TertiaryExplorer.getDiagnostics().linkedPulseActive,null,{timeout:6000});
  assert.equal((await page.evaluate(()=>TertiaryExplorer.getDiagnostics())).selectionCount,0);
  report.standalone="Sequence-selected nucleobase blinks hot pink in standalone 3D and stops when deselected";

  await reveal("#teSplit");await page.locator("#teSplit").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().split&&TertiaryExplorer.getDiagnostics().mappingEnabled,null,{timeout:9000});
  await clickSvg('#tertiaryMiniSvg [data-residue-index="9"]');
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===1,null,{timeout:9000});
  const linked=await color('#tertiaryMiniSvg [data-residue-index="9"] circle');
  assert.equal(linked.stroke,"rgb(255, 20, 147)",JSON.stringify(linked));
  assert.match(linked.animation,/rna-hot-pink-pulse/);
  await clickSvg('#tertiaryMiniSvg [data-pair]');
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectedPairCount===1,null,{timeout:9000});
  diag=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert.equal(diag.pairHighlightColor,"#ff1493");
  assert.equal(diag.linkedPulseFocus.length,2);
  const linkPair=await color('#tertiaryMiniSvg [data-pair].te-linked-pair-selected path:not([stroke="transparent"]), #tertiaryMiniSvg [data-pair].te-linked-pair-selected line:not([stroke="transparent"])');
  assert.equal(linkPair.stroke,"rgb(255, 20, 147)",JSON.stringify(linkPair));
  assert.match(linkPair.dash,/3px,?\s*7px|3px 7px|3,?\s*7/);
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().linkedPulseActive,null,{timeout:9000});
  report.linked="Linked 2D residue and base pair are pink, dotted, blinking; both nucleobase rings glow in 3D";
  assert.deepEqual(errors.filter(x=>!/ResizeObserver loop/i.test(x)),[],"Browser errors: "+errors.join("; "));
  writeFileSync(dir+"/report.json",JSON.stringify({status:"PASS",...report},null,2));
  console.log("PASS hot-pink and tertiary navigation regression "+JSON.stringify(report));
}catch(e){
  await page.screenshot({path:dir+"/failure.png",fullPage:true}).catch(()=>{});
  writeFileSync(dir+"/failure.txt",String(e.stack||e)+"\n"+errors.join("\n"));
  throw e;
}finally{await browser.close()}
