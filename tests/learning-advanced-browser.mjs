import { chromium } from "playwright";
import { createHash } from "node:crypto";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

const canvasHash=async()=>{
  const canvas=page.locator("#tertiaryMolecularViewer canvas");
  const png=await canvas.screenshot();
  return createHash("sha256").update(png).digest("hex");
};

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});

  // Secondary Learning: the visible Advanced controls disclosure must expose the real Explore controls.
  await page.locator('.scale-step[data-scene="secondary"]').click();
  await page.waitForSelector("#scene-secondary:not([hidden])",{timeout:10000});
  const secondaryAdvanced=page.locator("#scene-secondary .workspace-advanced-panel");
  if(!(await secondaryAdvanced.isVisible()))throw new Error("Secondary Advanced controls disclosure is not visible in Learning mode.");
  const secondaryLabel=(await secondaryAdvanced.locator(":scope > summary").textContent())?.trim();
  if(secondaryLabel!=="Advanced controls")throw new Error("Secondary disclosure label is not 'Advanced controls': "+secondaryLabel);
  await secondaryAdvanced.locator(":scope > summary").click();
  await page.waitForFunction(()=>document.getElementById("scene-secondary")?.classList.contains("learning-tools-open"));
  if(!(await page.locator("#scene-secondary .se-controls").isVisible()))throw new Error("Secondary Explore-style controls did not become visible after opening Advanced controls.");

  // Tertiary Learning: open the real Explore controls and load a deliberately small RNA.
  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,{timeout:30000});

  const advancedButton=page.locator("#gpsTertiaryCustomize");
  if((await advancedButton.textContent())?.trim()!=="Advanced controls")throw new Error("Tertiary button label is not 'Advanced controls'.");
  await advancedButton.click();
  await page.waitForFunction(()=>document.getElementById("scene-tertiary")?.classList.contains("learning-tools-open"));
  if(!(await page.locator("#tertiaryControls").isVisible()))throw new Error("Tertiary Explore controls did not become visible after opening Advanced controls.");

  const sticksLabel=(await page.locator('#teRepresentation option[value="sticks"]').textContent())?.trim();
  if(sticksLabel!=="Sticks")throw new Error("Sticks representation is still mislabeled: "+sticksLabel);

  await page.fill("#tePdbId","1HS8");
  await page.click("#teLoadPdbId");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().source.includes("1HS8"),{timeout:30000});
  let d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  if(!d.modelReady||d.atomCount<150)throw new Error("1HS8 did not load as a usable RNA model: "+JSON.stringify(d));

  // Representation controls must cause real canvas changes, not just state changes.
  const hashes={};
  for(const rep of ["sticks","ballstick","wire","spheres","backbone"]){
    await page.selectOption("#teRepresentation",rep);
    await page.waitForFunction(expected=>TertiaryExplorer.getDiagnostics().representation===expected,rep,{timeout:10000});
    await page.waitForTimeout(250);
    hashes[rep]=await canvasHash();
  }
  if(new Set(Object.values(hashes)).size<4)throw new Error("Representation choices did not produce sufficiently distinct rendered canvases: "+JSON.stringify(hashes));

  // Exercise highlighting and deliberately extreme selected-residue styling.
  const selectDetails=page.locator("#tertiaryControls summary").filter({hasText:"Select · sequence & ranges"});
  if(!(await selectDetails.count()))throw new Error("Selection tools are missing from Advanced controls.");
  await selectDetails.first().click();
  const residues=page.locator("#teSequencePanel .te-seq-residue");
  if(await residues.count()<3)throw new Error("1HS8 sequence panel did not expose enough residues for styling tests.");
  await residues.nth(1).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===1);
  const appearance=page.locator("#teContextPanel details").filter({hasText:"Selected residue appearance"}).first();
  if(!(await appearance.count()))throw new Error("Selected-residue appearance controls did not appear.");
  const sliders=appearance.locator('input[type="range"]');
  if(await sliders.count()<2)throw new Error("Selected-residue thickness/opacity controls are missing.");
  await sliders.nth(0).evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event("input",{bubbles:true}));});
  await sliders.nth(1).evaluate(el=>{el.value="0.85";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.waitForTimeout(200);
  const thickSnapshot=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot());
  if(Number(thickSnapshot.selectionStyle?.thickness)<0.45)throw new Error("Large selected-residue thickness did not persist.");

  // Highlight an additional residue, then make the selection deliberately thin.
  await residues.nth(7).click();
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().selectionCount===2);
  await sliders.nth(0).evaluate(el=>{el.value=el.min;el.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.waitForTimeout(200);
  const thinSnapshot=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot());
  if(Number(thinSnapshot.selectionStyle?.thickness)>0.1)throw new Error("Thin selected-residue thickness did not persist.");

  // Exercise the actual atom-picking distance tool by clicking the WebGL canvas.
  const analyzeSummary=page.locator("#tertiaryControls summary").filter({hasText:"Analyze · measurements & contacts"});
  if(!(await analyzeSummary.count()))throw new Error("Measurement controls are missing from Advanced controls.");
  await analyzeSummary.first().click();
  await page.selectOption("#teMeasureMode","distance");
  await page.waitForFunction(()=>TertiaryExplorer.getDiagnostics().measurementMode==="distance");

  const canvas=page.locator("#tertiaryMolecularViewer canvas");
  const box=await canvas.boundingBox();
  if(!box)throw new Error("Could not determine 3D canvas bounds for distance picking.");
  const fractions=[.5,.44,.56,.38,.62,.32,.68,.26,.74,.2,.8];
  let measurement=null;
  for(const fy of fractions){
    for(const fx of fractions){
      await page.mouse.click(box.x+box.width*fx,box.y+box.height*fy);
      await page.waitForTimeout(55);
      const snap=await page.evaluate(()=>TertiaryExplorer.getWorkspaceSnapshot());
      if(snap.measurements?.length){measurement=snap.measurements.at(-1);break;}
    }
    if(measurement)break;
  }
  if(!measurement||!Number.isFinite(Number(measurement.value)))throw new Error("Distance mode was enabled, but two atom picks could not be completed on the rendered RNA.");
  if(Number(measurement.value)<=0||Number(measurement.value)>100)throw new Error("Measured atom distance is implausible: "+measurement.value);

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Browser runtime errors:\n"+serious.join("\n"));

  console.log(JSON.stringify({
    result:"PASS",
    pdb:"1HS8",
    atomCount:d.atomCount,
    representationHashes:hashes,
    highlightedResidues:thinSnapshot.selectionIndices,
    finalSelectionThickness:thinSnapshot.selectionStyle?.thickness,
    distanceAngstrom:Number(measurement.value),
    distanceAtoms:measurement.points?.map(p=>({atom:p.atom,resn:p.resn,resi:p.resi,chain:p.chain}))||[]
  }));
} finally {
  await browser.close();
}
