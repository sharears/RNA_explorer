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
  await page.goto(base+"?page=tertiary",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#teRepresentation",{timeout:30000});
  await page.waitForFunction(()=>{
    const d=window.TertiaryExplorer?.getDiagnostics?.();
    return d?.viewerReady&&d?.modelReady&&d.atomCount>100;
  },undefined,{timeout:60000});
  await page.selectOption("#teRepresentation","cartoon");
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
  await page.selectOption("#teRepresentation","sticks");
  await page.waitForFunction(()=>{
    const d=TertiaryExplorer.getDiagnostics();
    return d.representation==="sticks"&&d.cartoonNormalizedResidueCount===0;
  });
  assert.equal(errors.length,0,"No browser errors while switching native cartoon/sticks modes");
  console.log("PASS: Native RNA cartoon recognizes "+sample.count+
    " modified nucleotide residues and restores original molecular information.");
}finally{await browser.close();}
