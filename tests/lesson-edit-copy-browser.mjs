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
    await page.click("#chemEditorSave");
    await page.click("#chemEditorClose");
    await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open===false);
    assert.equal(await page.locator(root+" .lesson-custom-preview").isVisible(),true,scene+" saved model appears");
    assert.equal(await defaultModel.isVisible(),false,scene+" original hidden after edit");
    await page.locator(root+" .lesson-edit-reset").click();
    assert.equal(await defaultModel.isVisible(),true,scene+" original restored");
    assert.equal(await page.locator(root+" .lesson-custom-preview").isVisible(),false,scene+" saved preview hidden after reset");
  }
  if(problems.length)throw Error("Browser JavaScript errors:\n"+problems.join("\n"));
  console.log("PASS: Secondary inline copy/checkmark and optional Learn molecular editing in four scenes.");
}finally{
  await context.close();
  await browser.close();
}