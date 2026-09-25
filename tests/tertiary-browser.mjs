import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=tertiary";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const pageErrors=[];
page.on("pageerror",err=>pageErrors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")pageErrors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  let d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!d.viewerReady||!d.modelReady||d.atomCount<100)throw new Error("3D molecule did not initialize with atoms: "+JSON.stringify(d));

  const status=await page.locator("#teMolecularStatus").textContent();
  if(status&&/could not load|could not initialize/i.test(status))throw new Error("False molecular-viewer error remained visible: "+status);

  await page.selectOption("#teRepresentation","spheres");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().representation==="spheres");
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(d.representation!=="spheres")throw new Error("Representation control did not update 3D state.");

  await page.selectOption("#teColorMode","uniform");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().colorMode==="uniform");
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(d.colorMode!=="uniform")throw new Error("Color control did not update 3D state.");

  const split=page.locator("#teSplit");
  await split.check();
  await page.waitForSelector("#tertiaryMiniPanel:not([hidden])",{timeout:10000});
  const letters=await page.locator("#tertiaryMiniSvg text").count();
  if(letters<20)throw new Error("Linked 2D panel is not rendering residue letters; text count="+letters);

  await split.uncheck();
  await page.waitForSelector("#tertiaryMiniPanel[hidden]",{timeout:10000});
  if(!(await page.locator("#tertiaryMolecularViewer canvas").isVisible()))throw new Error("3D viewer disappeared after disabling linked view.");

  await page.fill("#tePdbId","1EHZ");
  await page.click("#teLoadPdbId");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().source.includes("RCSB PDB · 1EHZ"),{timeout:30000});
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!d.modelReady||d.atomCount<100)throw new Error("RCSB PDB-ID import did not load a usable model.");

  await page.locator("#teSurface").check();
  await page.locator("#teSurface").uncheck();
  await page.locator("#teContacts").check();
  await page.locator("#teContacts").uncheck();
  await page.locator("#teProximity").check();
  await page.locator("#teProximity").uncheck();

  const serious=pageErrors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Browser runtime errors:\n"+serious.join("\n"));
  console.log("PASS: browser-level tertiary viewer smoke test");
} finally {
  await browser.close();
}
