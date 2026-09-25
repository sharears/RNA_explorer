import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

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
  await page.waitForSelector("#tertiaryMiniPanel",{state:"hidden",timeout:10000});
  if(!(await page.locator("#tertiaryMolecularViewer canvas").isVisible()))throw new Error("3D viewer disappeared after disabling linked view.");

  await page.fill("#tePdbId","1EHZ");
  await page.click("#teLoadPdbId");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().source.includes("RCSB PDB · 1EHZ"),{timeout:30000});
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!d.modelReady||d.atomCount<100)throw new Error("RCSB PDB-ID import did not load a usable model.");

  await page.locator("#teSurface").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().surfaceEnabled===true);
  await page.locator("#teSurface").uncheck();

  await page.locator("#teContacts").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().contactEnabled===true);
  await page.locator("#teContacts").uncheck();

  await page.locator("#teProximity").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().proximityEnabled===true);
  await page.locator("#teProximity").uncheck();

  await page.locator("#teClipEnabled").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().clipEnabled===true);
  await page.locator("#teClipEnabled").uncheck();

  await page.selectOption("#teMeasureMode","distance");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().measurementMode==="distance");
  await page.selectOption("#teMeasureMode","off");

  await page.click("#teSelectCurrent");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount>0);
  page.once("dialog",dialog=>dialog.accept("browser_test_object"));
  await page.click("#teCreateObject");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedObjectCount===1);
  await page.getByRole("button",{name:"Isolate",exact:true}).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().isolateObjectId!==null);
  await page.getByRole("button",{name:"Show all",exact:true}).click();

  page.once("dialog",dialog=>dialog.accept("browser_test_view"));
  await page.click("#teSaveView");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedViewCount===1);

  const pdbResponse=await fetch("https://files.rcsb.org/download/1EHZ.pdb");
  if(!pdbResponse.ok)throw new Error("Could not fetch 1EHZ PDB for alignment smoke test.");
  const pdbPath="/tmp/rna-explorer-1ehz.pdb";writeFileSync(pdbPath,await pdbResponse.text());
  await page.setInputFiles("#teAlignFile",pdbPath);
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().comparisonCount>=3,{timeout:30000});
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!Number.isFinite(d.comparisonRmsd))throw new Error("Alignment did not produce an RMSD.");

  await page.click("#teOpenExport");
  await page.selectOption("#teExportType","structure");
  const structureDownload=page.waitForEvent("download",{timeout:15000});
  await page.click("#teExportNow");
  const structureFile=await structureDownload;
  if(!structureFile.suggestedFilename().endsWith(".pdb"))throw new Error("Structure export did not produce a PDB download.");
  await page.click("#teExportClose");

  await page.click("#teOpenExport");
  await page.selectOption("#teExportType","image");
  await page.selectOption("#teImageFormat","png");
  await page.selectOption("#teImageDpi","96");
  await page.locator("#teImageScale").evaluate(el=>{el.value="1";el.dispatchEvent(new Event("input",{bubbles:true}));});
  const imageDownload=page.waitForEvent("download",{timeout:20000});
  await page.click("#teExportNow");
  const imageFile=await imageDownload;
  if(!imageFile.suggestedFilename().endsWith(".png"))throw new Error("Image export did not produce a PNG download.");

  const serious=pageErrors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Browser runtime errors:\n"+serious.join("\n"));
  console.log("PASS: browser-level tertiary viewer smoke test");
} finally {
  await browser.close();
}
