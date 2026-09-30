import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#tertiaryLearning.guided-inline-lesson",{state:"visible",timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  const features=["glycosidic","pucker","stacking","basepair","helix","loopjunction","tertiarycontact"];
  for(const key of features){
    await page.locator('[data-learning-feature="'+key+'"]').click();
    await page.waitForFunction(expected=>TertiaryExplorer.getDiagnostics().learningKey===expected,key,{timeout:15000});
    if(await page.evaluate(()=>TertiaryExplorer.getDiagnostics().learningActive))throw new Error(key+" auto-highlighted the full RNA before the Show button.");
    await page.locator("#teLearningShow").click();
    await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().learningActive,{timeout:15000});
    const status=await page.locator("#teLearningStatus").textContent();
    if(!status||/could not|not found|not available/i.test(status))throw new Error(key+" lesson did not produce a valid example: "+status);
    await page.locator("#teLearningClear").click();
    await page.waitForFunction(()=>!TertiaryExplorer.getDiagnostics().learningActive);
  }

  await page.locator('[data-learning-feature="backbone"]').click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().learningKey==="backbone",{timeout:15000});
  if(!(await page.locator("#teLearningTorsionWrap").isVisible()))throw new Error("Backbone torsion selector is not visible.");
  for(const torsion of ["alpha","beta","gamma","delta","epsilon","zeta"]){
    await page.selectOption("#teLearningTorsion",torsion);
    await page.locator("#teLearningShow").click();
    await page.waitForFunction(expected=>{
      const d=TertiaryExplorer.getDiagnostics();
      return d.learningKey==="backbone"&&d.learningTorsion===expected&&d.learningActive&&d.learningStatus.includes("°");
    },torsion,{timeout:15000});
  }

  await page.locator("#teLearningClear").click();
  await page.waitForFunction(()=>!TertiaryExplorer.getDiagnostics().learningActive);
  if(errors.length)throw new Error("Page errors: "+errors.join(" | "));
  console.log("PASS: guided tertiary learning lab exercises all concepts and α–ζ torsions.");
} finally {
  await browser.close();
}
