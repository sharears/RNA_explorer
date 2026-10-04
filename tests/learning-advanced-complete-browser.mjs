import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

await page.addInitScript(()=>{
  let threeDmol;
  Object.defineProperty(window,"$3Dmol",{
    configurable:true,
    get(){return threeDmol;},
    set(value){
      threeDmol=value;
      if(value&&typeof value.createViewer==="function"&&!value.__rnaExplorerTestWrapped){
        const original=value.createViewer.bind(value);
        value.createViewer=(...args)=>{
          const viewer=original(...args);
          window.__rnaExplorerTestViewer=viewer;
          return viewer;
        };
        value.__rnaExplorerTestWrapped=true;
      }
    }
  });
});

const dispatchInput=async(locator,value)=>{
  await locator.evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));},value);
};
const openDetails=async summary=>{
  const parent=summary.locator("..");
  if(!(await parent.evaluate(el=>el.open)))await summary.click();
};

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});

  await page.locator('.scale-step[data-scene="secondary"]').click();
  await page.waitForSelector("#scene-secondary:not([hidden])",{timeout:10000});
  const secondaryAdvanced=page.locator("#scene-secondary .workspace-advanced-panel");
  if(await secondaryAdvanced.count()!==1)throw new Error("Secondary Advanced controls panel is missing in Learn mode.");
  const secondarySummary=secondaryAdvanced.locator(":scope > summary");
  if(((await secondarySummary.textContent())||"").trim()!=="Advanced controls")throw new Error("Secondary disclosure label is not 'Advanced controls'.");
  await secondarySummary.click();
  await page.waitForFunction(()=>document.getElementById("scene-secondary")?.classList.contains("learning-tools-open"));
  if(!(await page.locator("#scene-secondary .se-controls").isVisible()))throw new Error("Secondary Explore controls did not become visible in Learn mode.");
  await dispatchInput(page.locator("#se-letterSize"),24);
  await page.waitForFunction(()=>document.querySelector("#secondarySvg .se-node text")?.getAttribute("font-size")==="24");

  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  const tertiaryAdvanced=page.locator("#gpsTertiaryCustomize");
  if(((await tertiaryAdvanced.textContent())||"").trim()!=="Advanced controls")throw new Error("Tertiary disclosure label is not 'Advanced controls'.");
  await tertiaryAdvanced.click();
  await page.waitForFunction(()=>document.getElementById("scene-tertiary")?.classList.contains("learning-tools-open"));
  const teControls=page.locator("#tertiaryControls .te-controls");
  if(await teControls.count()!==1)throw new Error("Tertiary Explore controls did not become visible in Learn mode.");

  const displaySummary=teControls.locator(":scope > details > summary").filter({hasText:"Display"}).first();
  await openDetails(displaySummary);
  const sticksLabel=((await page.locator('#teRepresentation option[value="sticks"]').textContent())||"").trim();
  if(sticksLabel!=="Sticks")throw new Error("Sticks representation is mislabeled: "+sticksLabel);
  for(const representation of ["sticks","ballstick","wire","spheres","backbone","cartoon"]){
    await page.selectOption("#teRepresentation",representation);
    await page.waitForFunction(expected=>TertiaryExplorer.getDiagnostics().representation===expected,representation,{timeout:10000});
  }

  const importSummary=teControls.locator(":scope > details > summary").filter({hasText:"Import structure"}).first();
  await openDetails(importSummary);
  await page.fill("#tePdbId","1HS8");
  await page.click("#teLoadPdbId");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().source.includes("1HS8"),{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll("#teSequencePanel .te-seq-residue").length===13,{timeout:15000});
  const diagnostics=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!diagnostics.modelReady||diagnostics.atomCount<150)throw new Error("1HS8 did not load as a usable RNA model: "+JSON.stringify(diagnostics));

  await page.selectOption("#teRepresentation","sticks");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().representation==="sticks");
  if(await page.locator("#teFitAll").count())await page.click("#teFitAll");
  await page.waitForTimeout(250);

  const deepAdvanced=teControls.locator(":scope > .workspace-advanced-panel");
  if(await deepAdvanced.count())await openDetails(deepAdvanced.locator(":scope > summary"));
  const selectSummary=page.locator("summary").filter({hasText:"Select · sequence & ranges"}).first();
  await openDetails(selectSummary);
  const objectSummary=page.locator("summary").filter({hasText:"Saved objects"}).first();
  await openDetails(objectSummary);

  await page.locator("#teSequencePanel .te-seq-residue").nth(0).click();
  page.once("dialog",dialog=>dialog.accept("large_residue"));
  await page.click("#teCreateObject");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedObjectCount===1);
  await page.click("#teSelectClear");

  await page.locator("#teSequencePanel .te-seq-residue").nth(1).click();
  page.once("dialog",dialog=>dialog.accept("thin_residue"));
  await page.click("#teCreateObject");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedObjectCount===2);

  const rows=page.locator("#teObjectList .te-object-row");
  const thick1=rows.nth(0).locator("label").filter({hasText:"Thickness"}).locator("input");
  const thick2=rows.nth(1).locator("label").filter({hasText:"Thickness"}).locator("input");
  await dispatchInput(thick1,0.22);
  await dispatchInput(thick2,0.02);
  await dispatchInput(rows.nth(0).locator('input[type="color"]'),"#ff33aa");
  await dispatchInput(rows.nth(1).locator('input[type="color"]'),"#33ddff");

  const styled=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot().savedObjects.map(o=>({name:o.name,indices:o.indices,style:o.style})));
  if(styled.length!==2||Math.abs(styled[0].style.thickness-.22)>.001||Math.abs(styled[1].style.thickness-.02)>.001){
    throw new Error("Different residue styles were not preserved: "+JSON.stringify(styled));
  }

  mkdirSync("test-output",{recursive:true});
  await page.locator("#tertiaryMolecularViewer canvas").screenshot({path:"test-output/1HS8-styled.png"});

  const analyzeSummary=page.locator("summary").filter({hasText:"Analyze · measurements & contacts"}).first();
  await openDetails(analyzeSummary);
  await page.selectOption("#teMeasureMode","distance");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().measurementMode==="distance");

  const measurement=await page.evaluate(()=>TertiaryExplorer.createDistanceMeasurementFromAtomIndices(0,1));
  const measured=Number(measurement.value);
  if(measurement.type!=="distance"||!Number.isFinite(measured)||measured<=0){
    throw new Error("Distance result is invalid: "+JSON.stringify(measurement));
  }
  const measurementText=(await page.locator("#teMeasurementList").textContent())||"";
  if(!measurementText.includes("Å"))throw new Error("Distance was not displayed in Å: "+measurementText);

  const clippingSummary=page.locator("summary").filter({hasText:"Clipping"}).first();
  await openDetails(clippingSummary);
  await page.locator("#teClipEnabled").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().clipEnabled===true);
  await page.locator("#teClipEnabled").uncheck();

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Browser runtime errors:\n"+serious.join("\n"));
  console.log(JSON.stringify({result:"PASS",pdb:"1HS8",atomCount:diagnostics.atomCount,objects:styled,distanceAngstrom:measured,screenshot:"test-output/1HS8-styled.png"}));
} finally {
  await browser.close();
}
