// Standalone focused live-browser regression for the RNA cartoon rendering mode.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
try{
  await page.goto(base+"?page=tertiary&start=example",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#teRepresentation",{state:"attached",timeout:30000});
  try{
    await page.waitForFunction(()=>{
      const d=typeof TertiaryExplorer!=="undefined"?TertiaryExplorer.getDiagnostics():null;
      return d?.viewerReady&&d?.modelReady&&d.atomCount>100;
    },undefined,{timeout:24000});
  }catch(error){
    const details=await page.evaluate(()=>({
      page:document.body.dataset.pageMode,
      sceneHidden:document.querySelector("#scene-tertiary")?.hidden,
      model:typeof TertiaryExplorer!=="undefined"?TertiaryExplorer.getDiagnostics():null,
      message:document.querySelector("#teMolecularStatus")?.textContent,
      has3Dmol:!!window.$3Dmol
    }));
    console.log("3D INITIALIZATION DIAGNOSTICS",JSON.stringify(details));
    await mkdir("artifacts",{recursive:true});
    await page.screenshot({path:"artifacts/native-cartoon-ribbon.png"});
    throw error;
  }
  await page.evaluate(()=>{const select=document.querySelector("#teRepresentation");select.value="cartoon";select.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.waitForFunction(()=>{
    const d=TertiaryExplorer.getDiagnostics();
    return d.representation==="cartoon"&&d.cartoonNormalizedResidueCount>=1;
  },undefined,{timeout:30000});
  const sample=await page.evaluate(()=>{
    const d=TertiaryExplorer.getDiagnostics();
    const source=TertiaryExplorer.getWorkspaceSnapshot().sourceText;
    return {count:d.cartoonNormalizedResidueCount,atomCount:d.atomCount,
      nativeSourceHasModification:/\b(?:PSU|1MA|5MC|5MU|H2U|7MG)\b/.test(source)};
  });
  assert.ok(sample.nativeSourceHasModification,"Original 1EHZ modification labels are preserved");
  assert.ok(sample.count>=1,"Known modified RNA residues supplied to native cartoon as canonical");
  await mkdir("artifacts",{recursive:true});
  await page.locator("#tertiaryMolecularViewer").screenshot({path:"artifacts/native-cartoon-ribbon.png"});
  await page.evaluate(()=>{const select=document.querySelector("#teRepresentation");select.value="sticks";select.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.waitForFunction(()=>{
    const d=TertiaryExplorer.getDiagnostics();
    return d.representation==="sticks"&&d.cartoonNormalizedResidueCount===0;
  });
  assert.equal(errors.length,0,"No browser errors while switching native cartoon/sticks modes");
  console.log("PASS: Native RNA cartoon recognizes "+sample.count+
    " modified nucleotide residues and restores original molecular information.");
}finally{await browser.close();}
