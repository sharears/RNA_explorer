import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});

  // Primary → Secondary should teach pairing before revealing the existing Secondary workspace.
  await page.locator('.scale-step[data-scene="secondary"]').click();
  await page.waitForSelector('#scene-secondary.guided-transition-active #guidedSecondaryTransition',{state:"visible",timeout:10000});
  if(await page.locator("#secondarySequence").isVisible())throw new Error("Secondary analysis controls were visible before the transition lesson finished.");

  await page.locator('[data-gps-secondary-step="pair"]').click();
  await page.waitForSelector("#gpsPairStage .gps-pair-svg",{state:"visible"});
  await page.locator('[data-gps-pair="gc"]').click();
  if(!((await page.locator("#gpsPairText").textContent())||"").includes("three hydrogen bonds"))throw new Error("G–C base-pair lesson did not render.");
  await page.locator('[data-gps-pair="gu"]').click();
  if(!((await page.locator("#gpsPairText").textContent())||"").includes("G–U wobble"))throw new Error("G–U wobble lesson did not render.");

  await page.locator('[data-gps-secondary-step="more"]').click();
  const more=await page.locator(".gps-nonstandard-list").textContent();
  if(!more?.includes("Sheared G–A")||!more.includes("Hoogsteen"))throw new Error("Non-Watson–Crick examples are missing.");

  await page.locator("#gpsContinueSecondary").click();
  await page.waitForSelector("#secondarySequence",{state:"visible",timeout:10000});
  if(await page.locator("#scene-secondary").evaluate(el=>el.classList.contains("guided-transition-active")))throw new Error("Secondary transition did not hand off to the full workspace.");

  // Secondary → Tertiary should teach 3D features before the full structure.
  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector('#scene-tertiary.guided-transition-active #guidedTertiaryTransition',{state:"visible",timeout:10000});
  if(await page.locator("#tertiaryLearning").isVisible())throw new Error("Full tertiary learning controls were visible before the 3D transition lesson.");

  const features=["glycosidic","pucker","backbone","stacking","basepair","helix","loopjunction","tertiarycontact"];
  for(const key of features){
    await page.locator('[data-gps-mini-feature="'+key+'"]').click();
    await page.waitForFunction(expected=>document.querySelector("#gpsMini3D")?.dataset.feature===expected,key);
    const title=(await page.locator("#gpsMiniTitle").textContent())||"";
    if(title.length<5)throw new Error("Missing title for mini lesson "+key);
  }

  const before=await page.locator("#gpsMini3D").getAttribute("data-yaw");
  const box=await page.locator("#gpsMini3D").boundingBox();
  if(!box)throw new Error("Mini 3D viewer has no bounding box.");
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.68,box.y+box.height*.43,{steps:5});
  await page.mouse.up();
  const after=await page.locator("#gpsMini3D").getAttribute("data-yaw");
  if(before===after)throw new Error("Mini 3D model did not rotate after dragging.");

  await page.locator("#gpsContinueTertiary").click();
  await page.waitForSelector("#tertiaryLearning",{state:"visible",timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  await page.locator('[data-learning-feature="glycosidic"]').click();
  await page.waitForFunction(()=>{
    const d=TertiaryExplorer.getDiagnostics();
    return d.learningActive&&d.learningGuidedDimmed&&d.learningFlashActive;
  },{timeout:15000});
  await page.waitForFunction(()=>!TertiaryExplorer.getDiagnostics().learningFlashActive,{timeout:5000});
  const status=(await page.locator("#teLearningStatus").textContent())||"";
  if(!status.includes("remains white")&&!status.includes("target flashes"))throw new Error("Guided full-RNA highlight status is unclear: "+status);

  if(errors.length)throw new Error("Page errors: "+errors.join(" | "));
  console.log("PASS: Primary→Secondary and Secondary→Tertiary guided transitions hand off cleanly to existing workspaces.");
} finally {
  await browser.close();
}
