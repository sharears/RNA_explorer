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

  const miniResidues=page.locator('#tertiaryMiniSvg [data-residue-index]');
  await miniResidues.nth(0).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===1);
  let secondaryContext=await page.evaluate(()=>SecondaryExplorer.getContext());
  if(!secondaryContext.selectedResidues.includes(0))throw new Error("3D → 2D residue selection did not stay synchronized.");
  await miniResidues.nth(1).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===2);
  await miniResidues.nth(0).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===1);

  await page.locator('#secondarySvg [data-residue-index]').nth(2).dispatchEvent("click");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===2);
  secondaryContext=await page.evaluate(()=>SecondaryExplorer.getContext());
  if(secondaryContext.selectedResidues.length<2)throw new Error("2D additive residue selections were not preserved.");

  const miniPair=page.locator('#tertiaryMiniSvg [data-pair]').first();
  await miniPair.click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectedPairCount===1);
  await page.locator('#secondarySvg [data-pair]').nth(1).dispatchEvent("click");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectedPairCount===2);
  secondaryContext=await page.evaluate(()=>SecondaryExplorer.getContext());
  if(secondaryContext.selectedPairKeys.length<2)throw new Error("2D additive base-pair selections were not preserved.");
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  const selectedKey=d.selectedPairKeys[0];
  if(!(selectedKey in d.hbondCounts))throw new Error("Selected pair did not report a 3D H-bond count.");
  const contextText=(await page.locator("#teContextPanel").textContent())||"";
  if(!/H-bond|no donor–acceptor/i.test(contextText))throw new Error("Selected pair context did not report H-bond geometry status.");

  await split.uncheck();
  await page.waitForSelector("#tertiaryMiniPanel",{state:"hidden",timeout:10000});
  if(!(await page.locator("#tertiaryMolecularViewer canvas").isVisible()))throw new Error("3D viewer disappeared after disabling linked view.");

  await page.fill("#tePdbId","1EHZ");
  await page.click("#teLoadPdbId");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().source.includes("RCSB PDB · 1EHZ"),{timeout:30000});
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!d.modelReady||d.atomCount<100)throw new Error("RCSB PDB-ID import did not load a usable model.");

  await page.click("#teGenerateSecondary");
  await page.waitForFunction(()=>{
    const d=TertiaryExplorer.getDiagnostics();
    return d.derivedSecondary&&d.derivedSecondary.pairCount>0&&d.mappingEnabled&&d.split;
  },{timeout:30000});
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(d.derivedSecondary.pairCount<5)throw new Error("3D → 2D derivation found unexpectedly few base pairs: "+JSON.stringify(d.derivedSecondary));
  const derivedNote=(await page.locator("#secondarySourceNote").textContent())||"";
  if(!/Derived from 3D coordinates/i.test(derivedNote))throw new Error("Derived Secondary source note was not populated.");

  await page.locator("#teSurface").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().surfaceEnabled===true);
  await page.locator("#teSurface").uncheck();

  await page.locator("summary").filter({hasText:"Analyze · measurements & contacts"}).click();
  await page.locator("#teContacts").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().contactEnabled===true);
  await page.locator("#teContacts").uncheck();

  await page.locator("#teProximity").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().proximityEnabled===true);
  await page.locator("#teProximity").uncheck();

  await page.locator("summary").filter({hasText:"Clipping"}).click();
  await page.locator("#teClipEnabled").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().clipEnabled===true);
  await page.locator("#teClipEnabled").uncheck();

  await page.selectOption("#teMeasureMode","distance");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().measurementMode==="distance");
  await page.selectOption("#teMeasureMode","off");

  await page.locator("summary").filter({hasText:"Select · sequence & ranges"}).click();
  await page.click("#teSelectCurrent");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount>0);
  await page.locator("summary").filter({hasText:"Saved objects"}).click();
  page.once("dialog",dialog=>dialog.accept("browser_test_object"));
  await page.click("#teCreateObject");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedObjectCount===1);
  await page.getByRole("button",{name:"Isolate",exact:true}).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().isolateObjectId!==null);
  await page.getByRole("button",{name:"Show all",exact:true}).click();

  await page.locator("summary").filter({hasText:"Saved camera views"}).click();
  page.once("dialog",dialog=>dialog.accept("browser_test_view"));
  await page.click("#teSaveView");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedViewCount===1);

  await page.locator("summary").filter({hasText:"Compare / align structures"}).click();
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
  await page.click("#teExportClose");

  const projectSnapshot=await page.evaluate(()=>ProjectSession.getProjectSnapshot());
  if(projectSnapshot.schema!=="rna-explorer-project"||!projectSnapshot.secondary||!projectSnapshot.tertiary?.sourceText)
    throw new Error("Project snapshot did not include the active 2D/3D workspace.");
  if(!projectSnapshot.tertiary.savedObjects?.length||!projectSnapshot.tertiary.savedViews?.length||!projectSnapshot.tertiary.comparison)
    throw new Error("Project snapshot did not retain saved 3D analysis state.");

  const projectDownload=page.waitForEvent("download",{timeout:15000});
  await page.click("#saveProjectButton");
  const projectFile=await projectDownload;
  if(!projectFile.suggestedFilename().endsWith(".rnaexplorer.json"))throw new Error("Save Project did not produce an RNA Explorer JSON project file.");
  const projectPath=await projectFile.path();
  if(!projectPath)throw new Error("Downloaded project file was not available to the browser test.");

  await page.selectOption("#teRepresentation","wire");
  await page.click("#teSelectClear");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().representation==="wire"&&TertiaryExplorer.getDiagnostics().selectionCount===0);
  await page.setInputFiles("#projectFileInput",projectPath);
  await page.waitForFunction(()=>/Project restored/i.test(document.getElementById("projectSessionStatus")?.textContent||""),{timeout:30000});
  d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(d.representation!=="spheres")throw new Error("Open Project did not restore the saved 3D representation.");
  if(d.selectionCount<1||d.savedObjectCount!==1||d.savedViewCount!==1||d.comparisonCount<3)
    throw new Error("Open Project did not restore selections, objects, saved views, and comparison state: "+JSON.stringify(d));
  secondaryContext=await page.evaluate(()=>SecondaryExplorer.getContext());
  if(!/Derived from 3D coordinates/i.test(secondaryContext.sourceNote||""))throw new Error("Open Project did not restore the linked generated Secondary structure.");

  const serious=pageErrors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Browser runtime errors:\n"+serious.join("\n"));
  console.log("PASS: browser-level tertiary viewer smoke test");
} finally {
  await browser.close();
}
