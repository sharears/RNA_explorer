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
  await page.waitForSelector("#tertiaryLearning",{state:"visible",timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  if(await page.locator("#guidedTertiaryTransition").count())throw new Error("Legacy tertiary transition overlay should not exist.");
  const stageBox=await page.locator("#tertiaryStage").boundingBox();
  const lessonBox=await page.locator("#tertiaryLearning").boundingBox();
  if(!stageBox||!lessonBox||lessonBox.y<=stageBox.y)throw new Error("Structural-feature lesson is not positioned after the full 3D structure.");

  const features=["glycosidic","pucker","stacking","basepair","helix","loopjunction","tertiarycontact"];
  for(const key of features){
    await page.locator('[data-learning-feature="'+key+'"]').click();
    await page.waitForFunction(expected=>TertiaryExplorer.getDiagnostics().learningKey===expected,key,{timeout:10000});
    if(await page.evaluate(()=>TertiaryExplorer.getDiagnostics().learningActive))throw new Error(key+" highlighted the full RNA before the user requested it.");
    await page.locator("#teLearningShow").click();
    await page.waitForFunction(expected=>{
      const d=TertiaryExplorer.getDiagnostics();
      return d.learningKey===expected&&d.learningActive&&d.learningStatus.length>5;
    },key,{timeout:15000});
    const status=await page.locator("#teLearningStatus").textContent();
    if(!status||/could not|not found|not available/i.test(status))throw new Error(key+" lesson did not produce a valid example: "+status);
    await page.locator("#teLearningClear").click();
    await page.waitForFunction(()=>!TertiaryExplorer.getDiagnostics().learningActive);
  }

  await page.locator('[data-learning-feature="backbone"]').click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().learningKey==="backbone",{timeout:10000});
  if(!(await page.locator("#teLearningTorsionWrap").isVisible()))throw new Error("Backbone torsion selector is not visible.");
  for(const torsion of ["alpha","beta","gamma","delta","epsilon","zeta"]){
    await page.selectOption("#teLearningTorsion",torsion);
    await page.locator("#teLearningShow").click();
    await page.waitForFunction(expected=>{
      const d=TertiaryExplorer.getDiagnostics();
      return d.learningKey==="backbone"&&d.learningTorsion===expected&&d.learningActive&&d.learningStatus.includes("°");
    },torsion,{timeout:15000});
    await page.locator("#teLearningClear").click();
    await page.waitForFunction(()=>!TertiaryExplorer.getDiagnostics().learningActive);
  }

  if(errors.length)throw new Error("Page errors: "+errors.join(" | "));
  console.log("PASS: inline tertiary learning lab teaches first, then highlights real RNA examples on request.");
} finally {
  await browser.close();
}
