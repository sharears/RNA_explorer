import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error"&&!/Failed to load resource/i.test(msg.text()))errors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});

  // Enter Primary directly, then use the Guided Journey Next button.
  await page.locator('.scale-step[data-scene="primary"]').click();
  await page.waitForSelector("#scene-primary:not([hidden])",{timeout:10000});
  await page.locator("#nextButton").click();

  await page.waitForSelector("#journeyStructureBridge:not([hidden])",{timeout:10000});
  let bridge=await page.evaluate(()=>JourneyStructureLearning.getState());
  if(bridge.activeBridge!=="pairing")throw new Error("Primary → Secondary pairing bridge did not open.");

  const foldStage=page.locator("#foldStage");
  await page.waitForFunction(()=>document.querySelector("#foldStage")?.classList.contains("folded"),{timeout:5000});
  if(!(await foldStage.locator(".forming-pairs line").count()))throw new Error("Pair-formation animation has no base-pair guides.");

  for(const kind of ["AU","GC","GU","other"]){
    await page.locator('[data-pair-kind="'+kind+'"]').click();
    const chemistry=await page.locator("#pairChemistry").textContent();
    if(!chemistry?.trim())throw new Error("Base-pair lesson is empty for "+kind);
  }
  const nonWc=await page.locator("#pairLessonCopy").textContent();
  if(!/not limited|Hoogsteen|sugar edges/i.test(nonWc||""))throw new Error("Non-Watson–Crick lesson copy is missing.");

  await page.locator("#journeyBridgeContinue").click();
  await page.waitForSelector("#scene-secondary:not([hidden])",{timeout:10000});
  if(!(await page.locator("#secondarySvg").isVisible()))throw new Error("Secondary structure did not open after the pairing bridge.");

  // Secondary → Tertiary bridge.
  await page.locator("#nextButton").click();
  await page.waitForSelector("#journeyStructureBridge:not([hidden])",{timeout:10000});
  bridge=await page.evaluate(()=>JourneyStructureLearning.getState());
  if(bridge.activeBridge!=="tertiary")throw new Error("Secondary → Tertiary feature bridge did not open.");

  await page.waitForSelector("#bridge3DViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>JourneyStructureLearning.getState().miniReady,{timeout:30000});
  const features=["glycosidic","pucker","backbone","stacking","basepair","helix","loopjunction","tertiarycontact"];
  for(const key of features){
    await page.locator('[data-bridge-feature="'+key+'"]').click();
    await page.waitForFunction(expected=>JourneyStructureLearning.getState().currentFeature===expected,key,{timeout:5000});
    await page.waitForFunction(()=>!/Preparing|Loading|unavailable/i.test(document.querySelector("#bridgeFeatureStatus")?.textContent||""),{timeout:15000});
    const status=await page.locator("#bridgeFeatureStatus").textContent();
    if(!status||/unavailable|not found/i.test(status))throw new Error("Isolated 3D lesson failed for "+key+": "+status);
  }
  await page.locator('[data-bridge-feature="backbone"]').click();
  await page.waitForFunction(()=>JourneyStructureLearning.getState().currentFeature==="backbone",{timeout:5000});
  for(const torsion of ["alpha","beta","gamma","delta","epsilon","zeta"]){
    await page.selectOption("#bridgeTorsion",torsion);
    await page.waitForFunction(expected=>JourneyStructureLearning.getState().currentTorsion===expected,torsion,{timeout:5000});
    const status=await page.locator("#bridgeFeatureStatus").textContent();
    if(!status?.includes("°"))throw new Error("Backbone torsion "+torsion+" did not report a dihedral: "+status);
  }

  await page.locator("#journeyBridgeContinue").click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  await page.locator('[data-learning-feature="glycosidic"]').click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().learningActive,{timeout:15000});
  await page.waitForSelector("#scene-tertiary.learning-feature-active",{timeout:10000});
  await page.waitForSelector('#teLearningStatus[data-pulse="true"]',{timeout:5000});
  await page.waitForFunction(()=>!document.querySelector("#teLearningStatus")?.dataset.pulse,{timeout:5000});
  const finalStatus=await page.locator("#teLearningStatus").textContent();
  if(!/remains highlighted in white/i.test(finalStatus||""))throw new Error("Persistent Guided Tertiary highlight was not confirmed: "+finalStatus);

  // Analysis workspaces still expose their established controls.
  await page.goto(new URL("?page=secondary",base).href,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#scene-secondary:not([hidden])",{timeout:10000});
  if(!(await page.locator("#se-mode").isVisible()))throw new Error("Analyze → 2D controls were affected by Guided Journey changes.");

  await page.goto(new URL("?page=tertiary",base).href,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  if(!(await page.locator("#teMeasureMode").isVisible()))throw new Error("Analyze → 3D measurement controls were affected by Guided Journey changes.");

  if(errors.length)throw new Error("Page errors: "+errors.join(" | "));
  console.log("PASS: guided Primary→Secondary→Tertiary teaching flow and analysis-workspace regression.");
} finally {
  await browser.close();
}
