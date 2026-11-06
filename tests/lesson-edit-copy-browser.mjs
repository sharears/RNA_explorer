// Run with: python3 -m http.server 4173 & node tests/lesson-edit-copy-browser.mjs
import {chromium} from "playwright";
import assert from "node:assert/strict";
const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const problems=[];
const context=await browser.newContext({
  viewport:{width:1160,height:900},
  permissions:["clipboard-read","clipboard-write"]
});
const page=await context.newPage();
page.on("pageerror",error=>problems.push(String(error)));
try{
  await page.goto(base+"?page=secondary&start=default",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#seCopySequence");
  assert.equal(await page.locator("#seCopySequence").count(),1);
  assert.equal(await page.locator("#seCopyDotBracket").count(),1);
  assert.equal(await page.getByRole("button",{name:"Copy sequence",exact:true}).count(),0);
  assert.equal(await page.getByRole("button",{name:"Copy dot-bracket",exact:true}).count(),0);
  for(const [field,button,value] of [
    ["#secondarySequence","#seCopySequence","ACGUGU"],
    ["#secondaryDotBracket","#seCopyDotBracket","((..))"]
  ]){
    await page.fill(field,value);
    await page.click(button);
    await page.waitForFunction(sel=>document.querySelector(sel)?.classList.contains("is-copied"),button);
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),value);
    assert.equal(await page.locator(button).locator(".se-check-glyph").count(),1);
    await page.waitForFunction(sel=>!document.querySelector(sel)?.classList.contains("is-copied"),button,{timeout:4500});
  }
  for(const [scene,defaultId] of [
    ["blocks","chemicalOverview"],
    ["nucleoside","nucleosideDiagram"],
    ["nucleotide","nucleotideDiagram"],
    ["primary","chainGrowth"]
  ]){
    await page.goto(base+"?page=journey&scene="+scene,{waitUntil:"domcontentloaded"});
    const root="#scene-"+scene;
    const defaultModel=page.locator("#"+defaultId);
    await page.waitForSelector(root+" .lesson-edit-button");
    assert.equal(await defaultModel.isVisible(),true,scene+" originally visible");
    assert.equal(await page.locator("#chemEditorDialog").evaluate(el=>el.open),false,scene+" editor hidden by default");
    await page.locator(root+" .lesson-edit-button").click();
    await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open===true);
    const graph=await page.evaluate(()=>MoleculeEditor.getCurrentGraph());
    assert.ok(graph.atoms.length>0&&graph.bonds.length>0,scene+" has real atoms and bonds");
    if(scene==="nucleoside"||scene==="nucleotide"){
      assert.ok(graph.bonds.some(b=>[b.a,b.b].includes("c1")&&[b.a,b.b].includes("n")),
        scene+" includes N-glycosidic bond");
    }
    if(scene==="nucleotide")assert.ok(graph.bonds.some(b=>
      [b.a,b.b].includes("p")&&[b.a,b.b].includes("o5")),"5' phosphate connected");
    if(scene==="primary")assert.equal(graph.bonds.filter(b=>b.a.endsWith("_oh3")&&b.b.endsWith("_p")).length,2);
    assert.equal(await page.locator("#chemEditorSave").innerText(),"Save & Return",scene+" offers Save & Return");
    await page.click("#chemEditorSave");
    // Saving a lesson edit returns to the scene automatically; no Close click.
    await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open===false);
    assert.equal(await page.locator(root+" .lesson-custom-preview").isVisible(),true,scene+" saved model appears");
    assert.equal(await defaultModel.isVisible(),false,scene+" original hidden after edit");
    await page.locator(root+" .lesson-edit-reset").click();
    assert.equal(await defaultModel.isVisible(),true,scene+" original restored");
    assert.equal(await page.locator(root+" .lesson-custom-preview").isVisible(),false,scene+" saved preview hidden after reset");
  }
  // Saving a nucleobase returns to all three Building Blocks components,
  // not a detached base-only drawing. The modification flows into Nucleoside.
  await page.goto(base+"?page=journey&scene=blocks",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#editNucleobaseButton");
  await page.locator("#editNucleobaseButton").click();
  await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open);
  const editingBase=await page.evaluate(()=>chemistry.base);
  const oxygen=editingBase==="C"||editingBase==="U"?"O2":"O6";
  await page.locator('#chemEditorSvg [data-atom-id="'+oxygen+'"]').click();
  await page.locator("#chemChargeMinus").click();
  await page.locator("#chemEditorSave").click();
  await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open===false);
  assert.equal(await page.locator("#chemicalOverview").isVisible(),true,"edited Building Blocks overview remains visible");
  assert.equal(await page.locator("#scene-blocks .lesson-custom-preview").isVisible(),false,"no base-only replacement diagram");
  const overviewText=await page.locator("#chemicalOverview").textContent();
  assert.ok(overviewText.includes("C1′"),"ribose is visible");
  assert.ok(overviewText.includes("P"),"phosphoric acid is visible");
  assert.ok(overviewText.includes("⁻"),"edited base atom charge is visible");
  await page.locator('[data-scene="nucleoside"]').click();
  const nucleosideText=await page.locator("#nucleosideDiagram").textContent();
  assert.ok(nucleosideText.includes("⁻"),"edited base carries into nucleoside formation");
  await page.locator('[data-scene="blocks"]').click();
  await page.locator("#scene-blocks .lesson-edit-reset").click();
  assert.equal(await page.locator("#chemicalOverview").isVisible(),true,"reset restores complete Building Blocks illustration");
  assert.ok(!(await page.locator("#chemicalOverview").textContent()).includes("⁻"),"reset removes the base modification");

  // Selected secondary structure can be copied/exported without flattening.
  await page.goto(base+"?page=secondary&start=example",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#seCopySelectedSvg");
  assert.equal(await page.locator("#seCopySelectedSvg").isDisabled(),true,"copy disabled without selection");
  const pair=await page.evaluate(()=>{
    const c=SecondaryExplorer.getContext();
    return SecondaryExplorer.parse(c.sequence,c.structure).pairs[0];
  });
  await page.evaluate(([a,b])=>SecondaryExplorer.highlightResidues([a,b]),pair);
  assert.equal(await page.locator("#seCopySelectedSvg").isEnabled(),true,"copy enabled after selecting residues");
  const region=await page.evaluate(()=>SecondarySelectionTools.selectedRegionSvg());
  const parserRegion=await page.evaluate(svgText=>{
    const xml=new DOMParser().parseFromString(svgText,"image/svg+xml");
    return {
      nodes:xml.querySelectorAll(".se-node").length,
      pairs:xml.querySelectorAll(".se-pair").length,
      removed:xml.querySelectorAll("[data-export-remove],.se-selected-transform-overlay").length,
      width:Number(xml.documentElement.getAttribute("width")),
      text:xml.documentElement.textContent
    };
  },region.svgText);
  assert.equal(parserRegion.nodes,2,"only selected residues exported");
  assert.equal(parserRegion.pairs,1,"selected base pair remains editable");
  assert.equal(parserRegion.removed,0,"selection handles and invisible controls excluded");
  assert.ok(parserRegion.width>0&&region.svgText.includes("<svg"),"valid vector SVG generated");
  await page.locator("#seCopySelectedSvg").click();
  await page.waitForFunction(()=>/Copied |Copy failed:/.test(document.querySelector("#seSelectionExportStatus")?.textContent||""));
  const copiedStatus=await page.locator("#seSelectionExportStatus").textContent();
  assert.ok(copiedStatus.includes("Copied"),"vector-copy clipboard attempted successfully: "+copiedStatus);
  await page.locator("#seDownloadSelectedSvg").click();
  assert.ok((await page.locator("#seSelectionExportStatus").textContent()).includes("Downloaded editable SVG"),
    "vector SVG download offered for Illustrator");
  if(problems.length)throw Error("Browser JavaScript errors:\n"+problems.join("\n"));
  console.log("PASS: Inline copy, four lesson editors, composite edited nucleobase, and selected SVG vector copy/export.");
}finally{
  await context.close();
  await browser.close();
}