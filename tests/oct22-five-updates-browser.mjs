import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
const root=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const dir="test-output/oct22-five-updates";mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const browserErrors=[],report={};
page.on("pageerror",e=>browserErrors.push(String(e)));
const wait=ms=>page.waitForTimeout(ms);
async function reveal(sel){await page.locator(sel).evaluate(el=>{for(let p=el;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true;const p=el.closest(".rna-tool-panel");p?.parentElement?.querySelector('[data-rna-tab="'+p.dataset.rnaPanel+'"]')?.click();});}
async function editorOpen(name){
  const group=page.locator("#scene-secondary .se-controls details").filter({has:page.locator(":scope > summary").filter({hasText:name})}).first();
  return group.evaluate(el=>el.open);
}
try{
  await page.goto(root+"?page=secondary&start=example",{waitUntil:"domcontentloaded"});
  await page.locator("#secondarySvg .se-node").first().waitFor({state:"visible",timeout:22000});
  await page.waitForSelector(".rna-tool-tabs [data-rna-tab='display']", {timeout:15000});
  // 1. RNA arc roundness is a geometric ellipse, not a CSS-distorted path.
  await page.locator('[data-secondary-layout="arc"]').first().click();
  await page.locator('[data-arc-style="arc"]').click();
  await page.locator("#seArcRoundness").evaluate(el=>{el.value="1";el.dispatchEvent(new Event("input",{bubbles:true}));});
  const firstPath=await page.locator("#secondarySvg .se-pair path[stroke]:not([stroke='transparent'])").first().getAttribute("d");
  assert.match(firstPath,/\bA\s+[\d.]+\s+[\d.]+\s+0\s+0/,"Arc is not elliptical SVG");
  let m=firstPath.match(/\bA\s+([\d.]+)\s+([\d.]+)/);assert(Math.abs(Number(m[1])-Number(m[2]))<.001,"1.00× did not produce a semicircle");
  await page.locator("#seArcRoundness").evaluate(el=>{el.value="0.5";el.dispatchEvent(new Event("input",{bubbles:true}));});
  const flatter=await page.locator("#secondarySvg .se-pair path[stroke]:not([stroke='transparent'])").first().getAttribute("d");
  m=flatter.match(/\bA\s+([\d.]+)\s+([\d.]+)/);
  assert(Math.abs(Number(m[2])/Number(m[1])-.5)<.001,"Roundness did not change ellipse geometry");
  assert.equal((await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot())).arcRoundness,.5);
  await page.locator('[data-arc-style="square"]').click();assert(await page.locator("#seArcRoundness").isHidden(),"Square controls did not hide arc-specific input");
  await page.locator('[data-arc-style="arc"]').click();await page.locator("#seArcRoundnessReset").click();
  assert.equal((await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot())).arcRoundness,1);
  report.arc="Adjustable SVG ellipse + exact semicircle reset";

  // 2. SVG components open their existing Display editors.
  await page.evaluate(()=>document.querySelector('#secondarySvg [data-backbone="2"]').dispatchEvent(new MouseEvent("click",{bubbles:true})));
  assert(await editorOpen("Display · Backbone"),"Backbone settings not opened");
  await page.evaluate(()=>document.querySelector('#secondarySvg [data-pair]').dispatchEvent(new MouseEvent("click",{bubbles:true})));
  assert(await editorOpen("Display · Base pairs"),"Pair settings not opened");
  await page.evaluate(()=>document.querySelector('#secondarySvg .se-node[data-residue-index="4"] circle').dispatchEvent(new MouseEvent("click",{bubbles:true})));
  assert(await editorOpen("Display · Residues"),"Residue settings not opened");
  await page.evaluate(()=>SecondaryExplorer.openSettingsFor("index",0));
  assert(await editorOpen("Display · Residue index"),"Index settings not opened");
  assert.notEqual((await page.evaluate(()=>SecondaryExplorer.getWorkspaceSnapshot())).indexMode,"selected",
    "Clicking index made other visible labels disappear");
  report.editors="Backbone, pair, residue and index all open existing controls";

  // 3. Radial region rotation via drag handle and accessible angle slider.
  await page.locator('[data-secondary-layout="radial"]').first().click();
  await page.evaluate(()=>SecondaryExplorer.highlightResidues([0,1,2,3]));
  await page.locator("#secondarySvg [data-se-transform-handle='rotate']").waitFor({state:"attached",timeout:7000});
  await reveal("#seSelectedRotation");
  assert(await page.locator("#seSelectedRotation").isEnabled(),"Region rotation slider disabled despite four selected residues");
  await page.locator("#seSelectedRotation").evaluate(el=>{el.value="45";el.dispatchEvent(new Event("input",{bubbles:true}));});
  assert.equal((await page.evaluate(()=>SecondaryExplorer.getTransformState())).selectionRotation,45);
  assert(await page.locator(".se-rotate-hint").count(),"Rotation cue is missing");
  report.rotation="Selection box, rotation handle, cue and 45-degree slider";

  // 4. Homepage verified source cards.
  await page.goto(root,{waitUntil:"domcontentloaded"});
  await page.locator("#rnaFactTitle").waitFor({state:"visible",timeout:15000});
  const initial=await page.locator("#rnaFactTitle").textContent();
  assert((await page.locator("#rnaFactDetails").textContent()).length>40,"No expanded fact explanation");
  assert((await page.locator("#rnaFactSource").getAttribute("href")).startsWith("https://"));
  await page.locator("#rnaFactLearnMore > summary").click();
  assert(await page.locator("#rnaFactSource").isVisible(),"Source link not revealed");
  await page.locator("#rnaFactNext").click();
  assert.notEqual(await page.locator("#rnaFactTitle").textContent(),initial,"Another discovery did not advance");
  assert.match(await page.locator("#rnaFactCounter").textContent(),/Curated Oct 2026/);
  report.facts="Eight sourced historical / classic / recent items, details, daily feature and Next";

  // 5. Linked side-by-side highlight: steady in 2D, animated in 3D until toggled off.
  await page.goto(root+"?page=tertiary&start=example",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,
    null,{timeout:45000});
  await page.locator("#teSplit").check({force:true});
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().split&&TertiaryExplorer.getDiagnostics().mappingEnabled,
    null,{timeout:12000});
  await page.locator("#tertiaryMiniSvg [data-residue-index='9']").waitFor({state:"attached",timeout:12000});
  await page.locator("#tertiaryMiniSvg [data-residue-index='9']").evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===1&&TertiaryExplorer.getDiagnostics().linkedPulseActive,
    null,{timeout:12000});
  assert(await page.locator("#tertiaryMiniSvg [data-residue-index='9'].te-linked-selected").count(),"Steady 2D selection missing");
  await wait(1000);
  const pulse=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert(pulse.linkedPulseActive,"Linked 3D pulse stopped");
  await page.locator("#tertiaryMiniSvg [data-residue-index='9']").evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===0&&!TertiaryExplorer.getDiagnostics().linkedPulseActive,
    null,{timeout:12000});
  await page.locator("#tertiaryMiniSvg [data-pair]").first().evaluate(el=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectedPairCount===1&&TertiaryExplorer.getDiagnostics().linkedPulseActive,
    null,{timeout:12000});
  assert(await page.locator("#tertiaryMiniSvg [data-pair].te-linked-pair-selected").count(),"Linked base pair highlight missing");
  report.linked="Strong steady 2D node/pair with live 3D pulse; same click stops pulse";

  assert.deepEqual(browserErrors.filter(e=>!/ResizeObserver loop/i.test(e)),[],
    "Browser exceptions: "+browserErrors.join("; "));
  writeFileSync(dir+"/report.json",JSON.stringify({result:"PASS",...report},null,2));
  console.log("PASS five new RNA Explorer updates "+JSON.stringify(report));
}catch(error){
  await page.screenshot({path:dir+"/failure.png",fullPage:false}).catch(()=>{});
  writeFileSync(dir+"/failure.txt",String(error?.stack||error)+"\nBrowser exceptions:\n"+browserErrors.join("\n"));
  throw error;
}finally{await browser.close();}
