import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});

  // Primary → Secondary now goes directly to the real radial secondary structure.
  await page.locator('.scale-step[data-scene="secondary"]').click();
  await page.waitForSelector("#scene-secondary:not([hidden])",{timeout:10000});
  if(await page.locator("#guidedSecondaryTransition").count())throw new Error("Legacy pre-secondary transition overlay should not exist.");
  if(!(await page.locator('[data-secondary-layout="radial"]').evaluate(el=>el.classList.contains("active"))))throw new Error("Guided Secondary did not open in radial layout.");
  if(!(await page.locator("#secondarySvg").isVisible()))throw new Error("Real secondary structure is not visible.");
  if(await page.locator(".secondary-inputs").isVisible())throw new Error("Analysis inputs should be hidden in the Guided Journey secondary lesson.");

  // The base-pair lesson sits on the same Secondary page, underneath the real structure.
  await page.waitForSelector("#guidedSecondaryLesson",{state:"visible",timeout:10000});
  const secStage=await page.locator(".secondary-stage").boundingBox();
  const secLesson=await page.locator("#guidedSecondaryLesson").boundingBox();
  if(!secStage||!secLesson||secLesson.y<=secStage.y)throw new Error("Base-pair lesson is not positioned after the secondary structure.");
  for(const key of ["au","gc","gu"]){
    const card=page.locator('[data-pair-card="'+key+'"]');
    if(await card.count()!==1)throw new Error("Missing "+key+" secondary base-pair card.");
    if(await card.locator(".gps-sugar-label").count()<2)throw new Error(key+" card should label each ribose simply as Sugar.");
  }
  const secondaryText=(await page.locator("#guidedSecondaryLesson").textContent())||"";
  if(!secondaryText.includes("Watson–Crick–Franklin")||!secondaryText.includes("G–U wobble")||!secondaryText.includes("More RNA base-pair types come later"))throw new Error("Secondary base-pair teaching copy is incomplete.");

  // Tertiary now opens directly on the complete RNA; the structural-feature lab is below it on the same page.
  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  if(await page.locator("#guidedTertiaryTransition").count())throw new Error("Legacy pre-tertiary transition overlay should not exist.");
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});
  if(await page.locator("#tertiaryControls").isVisible())throw new Error("Full analysis controls should stay out of the Guided Journey overview.");
  await page.waitForSelector("#tertiaryLearning",{state:"visible",timeout:10000});
  const tertStage=await page.locator("#tertiaryStage").boundingBox();
  const tertLesson=await page.locator("#tertiaryLearning").boundingBox();
  if(!tertStage||!tertLesson||tertLesson.y<=tertStage.y)throw new Error("Tertiary feature lesson is not positioned after the full 3D structure.");

  // Choosing a feature updates the small teaching model only.
  await page.locator('[data-learning-feature="stacking"]').click();
  await page.waitForFunction(()=>document.querySelector("#gpsMini3D")?.dataset.feature==="stacking");
  if(await page.evaluate(()=>TertiaryExplorer.getDiagnostics().learningActive))throw new Error("Feature selection should not immediately replace the full-RNA overview with a highlight.");

  // PyMOL-like mini-viewer: left drag rotates, right drag pans, wheel zooms, labels toggle.
  const svg=page.locator("#gpsMini3D");
  const box=await svg.boundingBox();if(!box)throw new Error("Mini 3D viewer has no bounding box.");
  const yaw0=await svg.getAttribute("data-yaw");
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down({button:"left"});
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.42,{steps:5});await page.mouse.up({button:"left"});
  const yaw1=await svg.getAttribute("data-yaw");if(yaw0===yaw1)throw new Error("Left-drag did not rotate the mini model.");

  const pan0=await page.evaluate(()=>GuidedStructureTransitions.getState().panX);
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down({button:"right"});
  await page.mouse.move(box.x+box.width*.58,box.y+box.height*.58,{steps:4});await page.mouse.up({button:"right"});
  const pan1=await page.evaluate(()=>GuidedStructureTransitions.getState().panX);if(pan0===pan1)throw new Error("Right-drag did not pan the mini model.");

  const zoom0=Number(await svg.getAttribute("data-zoom"));
  await svg.hover();await page.mouse.wheel(0,-450);
  const zoom1=Number(await svg.getAttribute("data-zoom"));if(!(zoom1>zoom0))throw new Error("Mouse wheel did not zoom the mini model.");

  await page.locator("#gpsMiniLabels").click();
  if(await svg.getAttribute("data-labels")!=="off")throw new Error("Label toggle did not turn labels off.");
  await page.locator("#gpsMiniLabels").click();

  // Real G–C/A–U/G–U nucleotide pairs use stick rendering and yellow dotted H-bonds.
  await page.locator('[data-learning-feature="basepair"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#gpsMini3D .gps-stick-atom[data-element="P"]').length>=2,{timeout:20000});
  for(const element of ["C","O","N","H","P"]){
    if(await page.locator('#gpsMini3D .gps-stick-atom[data-element="'+element+'"]').count()<1)throw new Error("Missing "+element+" atoms from the real base-pair model.");
  }
  if(await page.locator("#gpsMini3D .gps-stick-bond").count()<20)throw new Error("Base-pair model is not rendered as a detailed stick representation.");
  const guide=page.locator("#gpsMini3D .gps-mini-guide.hbond").first();
  const guideStyle=await guide.evaluate(el=>({stroke:getComputedStyle(el).stroke,dash:getComputedStyle(el).strokeDasharray}));
  if(!guideStyle.dash||guideStyle.dash==="none")throw new Error("Hydrogen bonds are not dotted.");
  if(!/255/.test(guideStyle.stroke))throw new Error("Hydrogen bonds are not rendered in the yellow teaching color.");
  for(const pair of ["gc","au","gu"]){
    await page.locator('[data-gps-real-pair="'+pair+'"]').click();
    await page.waitForFunction(expected=>document.querySelector('[data-gps-real-pair="'+expected+'"]')?.classList.contains("active"),pair);
    if(await page.locator("#gpsMini3D .gps-stick-atom").count()<20)throw new Error(pair+" base-pair model has too few atoms.");
  }

  // Explicit handoff to the same full RNA viewer.
  await page.locator("#teLearningShow").click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().learningActive,{timeout:15000});
  await page.waitForFunction(()=>!TertiaryExplorer.getDiagnostics().learningFlashActive,{timeout:5000});
  const status=(await page.locator("#teLearningStatus").textContent())||"";
  if(!status.includes("remains white")&&!status.includes("target flashes"))throw new Error("Full-RNA teaching highlight status is unclear.");

  if(errors.length)throw new Error("Page errors: "+errors.join(" | "));
  console.log("PASS: Guided Journey uses inline Secondary/Tertiary lessons, clean 3D overview, PyMOL-like mini controls, and explicit full-RNA highlighting.");
} finally {
  await browser.close();
}
