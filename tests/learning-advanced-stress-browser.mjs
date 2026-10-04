import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

const dispatchInput=async(locator,value)=>{
  await locator.evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));},value);
};

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});

  // Secondary learning mode: the visible Advanced controls disclosure must expose
  // the real Explore controls and those controls must change the drawing.
  await page.locator('.scale-step[data-scene="secondary"]').click();
  await page.waitForSelector("#scene-secondary:not([hidden])",{timeout:10000});
  const secondaryAdvanced=page.locator("#scene-secondary .workspace-advanced-panel");
  if(await secondaryAdvanced.count()!==1)throw new Error("Secondary Advanced controls panel is missing in Learn mode.");
  const secondarySummary=secondaryAdvanced.locator(":scope > summary");
  if(((await secondarySummary.textContent())||"").trim()!=="Advanced controls")throw new Error("Secondary disclosure label is not 'Advanced controls'.");
  await secondarySummary.click();
  await page.waitForFunction(()=>document.getElementById("scene-secondary")?.classList.contains("learning-tools-open"));
  if(!(await page.locator("#scene-secondary .se-controls").isVisible()))throw new Error("Secondary Explore editing controls did not become visible in Learn mode.");
  await dispatchInput(page.locator("#se-letterSize"),24);
  await page.waitForFunction(()=>document.querySelector("#secondarySvg .se-node text")?.getAttribute("font-size")==="24");

  // Tertiary learning mode: Advanced controls should expose and honor the same
  // display/analysis controls used by the Explore workspace.
  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  const tertiaryAdvanced=page.locator("#gpsTertiaryCustomize");
  if(((await tertiaryAdvanced.textContent())||"").trim()!=="Advanced controls")throw new Error("Tertiary disclosure label is not 'Advanced controls'.");
  await tertiaryAdvanced.click();
  await page.waitForFunction(()=>document.getElementById("scene-tertiary")?.classList.contains("learning-tools-open"));
  if(!(await page.locator("#tertiaryControls").isVisible()))throw new Error("Tertiary Explore controls did not become visible in Learn mode.");

  const sticksLabel=((await page.locator('#teRepresentation option[value="sticks"]').textContent())||"").trim();
  if(sticksLabel!=="Sticks")throw new Error("Sticks representation is still labeled '"+sticksLabel+"'.");

  for(const representation of ["sticks","ballstick","wire","spheres","backbone","cartoon"]){
    await page.selectOption("#teRepresentation",representation);
    await page.waitForFunction(expected=>TertiaryExplorer.getDiagnostics().representation===expected,representation,{timeout:10000});
    if(!(await page.locator("#tertiaryControls").isVisible()))throw new Error("Advanced controls collapsed while changing representation to "+representation+".");
  }

  await page.selectOption("#teColorMode","uniform");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().colorMode==="uniform");
  await page.locator("#teOrthographic").check();
  await page.locator("#teSurface").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().surfaceEnabled===true);
  await page.locator("#teSurface").uncheck();

  // Small-RNA stress test: 1HS8 is a 13-residue RNA hairpin.
  await page.fill("#tePdbId","1HS8");
  await page.click("#teLoadPdbId");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().source.includes("1HS8"),{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll("#teSequencePanel .te-seq-residue").length===13,{timeout:15000});
  let d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!d.modelReady||d.atomCount<150)throw new Error("1HS8 did not load as a usable small RNA model: "+JSON.stringify(d));

  const selectSummary=page.locator("summary").filter({hasText:"Select · sequence & ranges"}).first();
  if(!(await selectSummary.evaluate(el=>el.parentElement.open)))await selectSummary.click();
  const objectSummary=page.locator("summary").filter({hasText:"Saved objects"}).first();
  if(!(await objectSummary.evaluate(el=>el.parentElement.open)))await objectSummary.click();

  // Residue 1 -> thicker saved object.
  await page.locator("#teSequencePanel .te-seq-residue").nth(0).click();
  page.once("dialog",dialog=>dialog.accept("large_residue"));
  await page.click("#teCreateObject");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedObjectCount===1);
  await page.click("#teSelectClear");

  // Residue 2 -> thin saved object.
  await page.locator("#teSequencePanel .te-seq-residue").nth(1).click();
  page.once("dialog",dialog=>dialog.accept("thin_residue"));
  await page.click("#teCreateObject");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().savedObjectCount===2);

  const rows=page.locator("#teObjectList .te-object-row");
  const thick1=rows.nth(0).locator("label").filter({hasText:"Thickness"}).locator("input");
  const thick2=rows.nth(1).locator("label").filter({hasText:"Thickness"}).locator("input");
  await dispatchInput(thick1,0.22);
  await dispatchInput(thick2,0.02);
  const color1=rows.nth(0).locator('input[type="color"]');
  const color2=rows.nth(1).locator('input[type="color"]');
  await dispatchInput(color1,"#ff33aa");
  await dispatchInput(color2,"#33ddff");

  const styled=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot().savedObjects.map(o=>({name:o.name,indices:o.indices,style:o.style})));
  if(styled.length!==2||styled[0].indices.length!==1||styled[1].indices.length!==1)throw new Error("Per-residue saved-object highlighting was not preserved: "+JSON.stringify(styled));
  if(Math.abs(styled[0].style.thickness-.22)>.001||Math.abs(styled[1].style.thickness-.02)>.001)throw new Error("Different residue thicknesses were not preserved: "+JSON.stringify(styled));

  // Real atom-picking distance measurement. Scan the visible canvas until two
  // distinct atoms are picked and a plausible non-zero distance is produced.
  const analyzeSummary=page.locator("summary").filter({hasText:"Analyze · measurements & contacts"}).first();
  if(!(await analyzeSummary.evaluate(el=>el.parentElement.open)))await analyzeSummary.click();
  await page.selectOption("#teMeasureMode","distance");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().measurementMode==="distance");
  const canvas=page.locator("#tertiaryMolecularViewer canvas");
  const box=await canvas.boundingBox();
  if(!box)throw new Error("Could not locate the 3D canvas for atom-picking.");

  let measured=null;
  const fractions=[.22,.32,.42,.5,.58,.68,.78];
  outer: for(const fy of fractions){
    for(const fx of fractions){
      await page.mouse.click(box.x+box.width*fx,box.y+box.height*fy);
      await page.waitForTimeout(60);
      const snap=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot());
      if(snap.measurements?.length){
        const value=Number(snap.measurements.at(-1).value);
        if(Number.isFinite(value)&&value>0.1&&value<100){measured=value;break outer;}
        await page.click("#teMeasureClear");
      }
    }
  }
  if(measured===null)throw new Error("Could not create a non-zero atom-to-atom distance by real canvas picking in 1HS8.");
  const measurementText=(await page.locator("#teMeasurementList").textContent())||"";
  if(!measurementText.includes("Å"))throw new Error("Distance measurement was not displayed in Å: "+measurementText);

  // One more non-representation control while Advanced is open.
  const clippingSummary=page.locator("summary").filter({hasText:"Clipping"}).first();
  if(!(await clippingSummary.evaluate(el=>el.parentElement.open)))await clippingSummary.click();
  await page.locator("#teClipEnabled").check();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().clipEnabled===true);
  await page.locator("#teClipEnabled").uncheck();

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Browser runtime errors:\n"+serious.join("\n"));
  console.log(`PASS: guided Advanced controls work in Secondary and Tertiary; 1HS8 styled as two differently weighted residues; distance measured at ${measured.toFixed(2)} Å.`);
} finally {
  await browser.close();
}
