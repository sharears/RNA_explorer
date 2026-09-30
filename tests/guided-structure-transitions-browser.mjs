import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});

  // Secondary opens directly to the real radial structure; the lesson lives on the same page below it.
  await page.locator('.scale-step[data-scene="secondary"]').click();
  await page.waitForSelector("#scene-secondary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#secondarySvg",{state:"visible",timeout:10000});
  if(await page.locator("#scene-secondary").evaluate(el=>el.classList.contains("guided-transition-active")))throw new Error("Secondary should not use an interstitial lesson screen.");
  await page.waitForSelector("#guidedSecondaryLesson",{state:"visible",timeout:10000});
  if(!(await page.locator('[data-secondary-layout="radial"]').getAttribute("aria-pressed"))?.includes("true"))throw new Error("Secondary did not open in radial view.");

  // Same-page base-pair chemistry: A–U, G–C, G–U and simple Sugar labels.
  for(const pair of ["au","gc","gu"]){
    await page.locator('[data-gps-pair="'+pair+'"]').click();
    await page.waitForSelector("#gpsPairStage .gps-pair-svg",{state:"visible"});
    const sugarCount=await page.locator("#gpsPairStage .gps-sugar-label").count();
    if(sugarCount!==2)throw new Error(pair+" diagram should label both sugars without drawing full sugar rings.");
  }
  const secondaryLessonText=(await page.locator("#guidedSecondaryLesson").textContent())||"";
  if(!secondaryLessonText.includes("A–U")||!secondaryLessonText.includes("G–C")||!secondaryLessonText.includes("G–U"))throw new Error("Secondary base-pair lesson is incomplete.");
  if(!secondaryLessonText.includes("non-Watson"))throw new Error("Secondary page should note that non-Watson–Crick pairs will be expanded later.");

  // Tertiary opens directly to the full RNA; structural-feature teaching is below it on the same page.
  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  if(await page.locator("#scene-tertiary").evaluate(el=>el.classList.contains("guided-transition-active")))throw new Error("Tertiary should not use an interstitial lesson screen.");
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});
  await page.waitForSelector("#tertiaryLearning.guided-inline-lesson",{state:"visible",timeout:10000});

  const d0=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(d0.learningActive)throw new Error("Full RNA should start as a clean overview, not with a feature already highlighted.");

  // Choosing a concept teaches in the small viewer; it must not automatically alter the full RNA.
  await page.locator('[data-learning-feature="basepair"]').click();
  await page.waitForFunction(()=>document.querySelector("#gpsMini3D")?.dataset.feature==="basepair");
  if((await page.evaluate(()=>TertiaryExplorer.getDiagnostics().learningActive)))throw new Error("Choosing a feature should not auto-highlight the full RNA.");

  // Real nucleotide pair, stick representation, element colors, yellow dotted H-bonds.
  await page.waitForFunction(()=>document.querySelectorAll('#gpsMini3D [data-element="P"]').length>=2,{timeout:20000});
  if(await page.locator("#gpsMini3D .gps-stick-bond").count()<20)throw new Error("Base-pair example is not rendered as a molecular stick model.");
  if(await page.locator("#gpsMini3D .gps-mini-guide").count()<2)throw new Error("Base-pair example is missing hydrogen-bond guides.");
  const hbondStroke=await page.locator("#gpsMini3D .gps-mini-guide").first().evaluate(el=>getComputedStyle(el).stroke);
  if(!/255, 214, 10|rgb\(255, 214, 10\)/.test(hbondStroke))throw new Error("Hydrogen bonds are not yellow.");
  for(const element of ["C","O","N","H","P"]){
    if(await page.locator('#gpsMini3D [data-element="'+element+'"]').count()<1)throw new Error("Missing "+element+" atoms in real 3D pair.");
  }

  // Labels toggle.
  const labelsBefore=await page.locator("#gpsMini3D .gps-stick-label").count();
  if(labelsBefore<1)throw new Error("Atom labels should be on by default.");
  await page.locator("#gpsLabelsToggle").click();
  if(await page.locator("#gpsMini3D .gps-stick-label").count()!==0)throw new Error("Labels toggle did not turn labels off.");
  await page.locator("#gpsLabelsToggle").click();

  // PyMOL-like rotate, pan, zoom.
  const svg=page.locator("#gpsMini3D"),box=await svg.boundingBox();
  if(!box)throw new Error("Mini molecular viewer has no bounding box.");
  const yaw0=await svg.getAttribute("data-yaw");
  await page.mouse.move(box.x+box.width*.50,box.y+box.height*.50);await page.mouse.down({button:"left"});
  await page.mouse.move(box.x+box.width*.66,box.y+box.height*.42,{steps:5});await page.mouse.up({button:"left"});
  const yaw1=await svg.getAttribute("data-yaw");
  if(yaw0===yaw1)throw new Error("Left-drag did not rotate the molecular model.");

  const firstTransform0=await page.locator("#gpsMini3D g[data-element]").first().getAttribute("transform");
  await page.mouse.move(box.x+box.width*.50,box.y+box.height*.50);await page.mouse.down({button:"right"});
  await page.mouse.move(box.x+box.width*.58,box.y+box.height*.57,{steps:4});await page.mouse.up({button:"right"});
  const firstTransform1=await page.locator("#gpsMini3D g[data-element]").first().getAttribute("transform");
  if(firstTransform0===firstTransform1)throw new Error("Right-drag did not pan the molecular model.");

  const zoom0=Number(await svg.getAttribute("data-zoom"));
  await svg.hover();await page.mouse.wheel(0,-500);
  const zoom1=Number(await svg.getAttribute("data-zoom"));
  if(!(zoom1>zoom0))throw new Error("Mouse wheel did not zoom the molecular model.");

  // Explicit button now connects the teaching example to the full RNA.
  await page.locator("#teLearningShow").click();
  await page.waitForFunction(()=>{
    const d=TertiaryExplorer.getDiagnostics();
    return d.learningActive&&d.learningGuidedDimmed;
  },{timeout:15000});
  const status=(await page.locator("#teLearningStatus").textContent())||"";
  if(!status.includes("flashes")&&!status.includes("remains white"))throw new Error("Full-RNA feature highlight status is unclear.");

  if(errors.length)throw new Error("Page errors: "+errors.join(" | "));
  console.log("PASS: same-page Secondary/Tertiary learning, molecular stick viewer, labels, PyMOL-like controls, and explicit full-RNA highlighting.");
} finally {
  await browser.close();
}
