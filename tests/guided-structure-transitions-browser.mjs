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

  // Step 1: straight chain changes into a radial/hairpin path without any base-pair connections.
  if(await page.locator(".gps-fold-svg.shape-view .gps-fold-pair-group").count())throw new Error("Shape-change step should not show base pairs.");
  await page.waitForFunction(()=>getComputedStyle(document.querySelector(".gps-chain-folded")).opacity==="1",{timeout:5000});

  // Step 2: keep that radial shape fixed and reveal pair connections one by one.
  await page.locator('[data-gps-secondary-step="pair"]').click();
  if(await page.locator(".gps-fold-svg.pairing-view .gps-chain-fixed").count()!==1)throw new Error("Pairing step did not keep a fixed radial chain.");
  if(await page.locator(".gps-fold-pair-group").count()!==4)throw new Error("Expected four teaching base-pair connections.");
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector(".gps-fold-pair-group.pair-3")).opacity)>.9,{timeout:5000});
  const pairingText=(await page.locator("#gpsSecondaryCopy").textContent())||"";
  if(!pairingText.includes("A–U")||!pairingText.includes("G–C")||!pairingText.includes("G–U"))throw new Error("Pairing animation does not identify A–U, G–C and G–U.");

  // Step 3: atom-level 2D explanation and non-Watson–Crick context remain available.
  await page.locator('[data-gps-secondary-step="more"]').click();
  await page.waitForSelector("#gpsPairStage .gps-pair-svg",{state:"visible"});
  await page.locator('[data-gps-pair="gc"]').click();
  if(!((await page.locator("#gpsPairText").textContent())||"").includes("three hydrogen bonds"))throw new Error("G–C base-pair lesson did not render.");
  await page.locator('[data-gps-pair="gu"]').click();
  if(!((await page.locator("#gpsPairText").textContent())||"").includes("G–U wobble"))throw new Error("G–U wobble lesson did not render.");
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

  // The base-pair 3D lesson must use complete atom-level nucleotides from 1EHZ, not polygon placeholders.
  await page.locator('[data-gps-mini-feature="basepair"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#gpsMini3D .gps-mini-node[data-element="P"]').length>=2,{timeout:20000});
  for(const element of ["C","O","N","H","P"]){
    if(await page.locator('#gpsMini3D .gps-mini-node[data-element="'+element+'"]').count()<1)throw new Error("Missing "+element+" atoms from real 3D base-pair model.");
  }
  if(!((await page.locator("#gpsMiniCaption").textContent())||"").includes("PDB 1EHZ"))throw new Error("Real 3D base-pair source is not identified.");

  for(const pair of ["gc","au","gu"]){
    await page.locator('[data-gps-real-pair="'+pair+'"]').click();
    await page.waitForFunction(expected=>document.querySelector('[data-gps-real-pair="'+expected+'"]')?.classList.contains("active"),pair);
    if(await page.locator("#gpsMini3D .gps-mini-node").count()<20)throw new Error(pair+" 3D nucleotide pair has too few atoms.");
    if(await page.locator("#gpsMini3D .gps-mini-guide").count()<2)throw new Error(pair+" 3D nucleotide pair is missing hydrogen-bond guides.");
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
