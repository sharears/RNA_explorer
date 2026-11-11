// Run with: python3 -m http.server 4173 & node tests/lesson-edit-copy-browser.mjs
import {chromium} from "playwright";
import assert from "node:assert/strict";
const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const problems=[];
const context=await browser.newContext({
  viewport:{width:1160,height:900},
  permissions:["clipboard-read","clipboard-write"]
});
const page=await context.newPage();
page.on("pageerror",error=>problems.push(String(error)));
try{
  await page.goto(base+"?page=secondary&start=default",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#seCopySequence");
  assert.equal(await page.locator("#seCopySequence").count(),1);
  assert.equal(await page.locator("#seCopyDotBracket").count(),1);
  assert.equal(await page.getByRole("button",{name:"Copy sequence",exact:true}).count(),0);
  assert.equal(await page.getByRole("button",{name:"Copy dot-bracket",exact:true}).count(),0);
  for(const [field,button,value] of [
    ["#secondarySequence","#seCopySequence","ACGUGU"],
    ["#secondaryDotBracket","#seCopyDotBracket","((..))"]
  ]){
    await page.fill(field,value);
    await page.click(button);
    await page.waitForFunction(sel=>document.querySelector(sel)?.classList.contains("is-copied"),button);
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),value);
    assert.equal(await page.locator(button).locator(".se-check-glyph").count(),1);
    await page.waitForFunction(sel=>!document.querySelector(sel)?.classList.contains("is-copied"),button,{timeout:4500});
  }
  for(const [scene,defaultId] of [
    ["blocks","chemicalOverview"],
    ["nucleoside","nucleosideDiagram"],
    ["nucleotide","nucleotideDiagram"],
    ["primary","chainGrowth"]
  ]){
    await page.goto(base+"?page=journey&scene="+scene,{waitUntil:"domcontentloaded"});
    const root="#scene-"+scene;
    const defaultModel=page.locator("#"+defaultId);
    await page.waitForSelector(root+" .lesson-edit-button");
    assert.equal(await defaultModel.isVisible(),true,scene+" originally visible");
    assert.equal(await page.locator("#chemEditorDialog").evaluate(el=>el.open),false,scene+" editor hidden by default");
    await page.locator(root+" .lesson-edit-button").click();
    await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open===true);
    const graph=await page.evaluate(()=>MoleculeEditor.getCurrentGraph());
    assert.ok(graph.atoms.length>0&&graph.bonds.length>0,scene+" has real atoms and bonds");
    if(scene==="nucleoside"||scene==="nucleotide"){
      assert.ok(graph.bonds.some(b=>[b.a,b.b].includes("c1")&&[b.a,b.b].includes("n")),
        scene+" includes N-glycosidic bond");
    }
    if(scene==="nucleotide")assert.ok(graph.bonds.some(b=>
      [b.a,b.b].includes("p")&&[b.a,b.b].includes("o5")),"5' phosphate connected");
    if(scene==="primary")assert.equal(graph.bonds.filter(b=>b.a.endsWith("_oh3")&&b.b.endsWith("_p")).length,2);
    assert.equal(await page.locator("#chemEditorSave").innerText(),"Save & Return",scene+" offers Save & Return");
    await page.click("#chemEditorSave");
    // Saving a lesson edit returns to the scene automatically; no Close click.
    await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open===false);
    assert.equal(await page.locator(root+" .lesson-custom-preview").isVisible(),true,scene+" saved model appears");
    assert.equal(await defaultModel.isVisible(),false,scene+" original hidden after edit");
    await page.locator(root+" .lesson-edit-reset").click();
    assert.equal(await defaultModel.isVisible(),true,scene+" original restored");
    assert.equal(await page.locator(root+" .lesson-custom-preview").isVisible(),false,scene+" saved preview hidden after reset");
  }
  // Saving a nucleobase returns to all three Building Blocks components,
  // not a detached base-only drawing. The modification flows into Nucleoside.
  await page.goto(base+"?page=journey&scene=blocks",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#editNucleobaseButton");
  await page.locator("#editNucleobaseButton").click();
  await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open);
  const editingBase=await page.evaluate(()=>chemistry.base);
  const oxygen=editingBase==="C"||editingBase==="U"?"O2":"O6";
  await page.locator('#chemEditorSvg [data-atom-id="'+oxygen+'"]').click();
  // Trigger the existing charge control directly; its accordion may be
  // collapsed or moved by responsive toolbar organization.
  await page.locator("#chemChargeMinus").evaluate(button=>button.click());
  await page.locator("#chemEditorSave").click();
  await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open===false);
  assert.equal(await page.locator("#chemicalOverview").isVisible(),true,"edited Building Blocks overview remains visible");
  assert.equal(await page.locator("#scene-blocks .lesson-custom-preview").isVisible(),false,"no base-only replacement diagram");
  const overviewText=await page.locator("#chemicalOverview").textContent();
  assert.ok(overviewText.includes("C1′"),"ribose is visible");
  assert.ok(overviewText.includes("P"),"phosphoric acid is visible");
  assert.ok(overviewText.includes("⁻"),"edited base atom charge is visible");
  await page.locator('[data-scene="nucleoside"]').click();
  const nucleosideText=await page.locator("#nucleosideDiagram").textContent();
  assert.ok(nucleosideText.includes("⁻"),"edited base carries into nucleoside formation");
  await page.locator('[data-scene="blocks"]').click();
  await page.locator("#scene-blocks .lesson-edit-reset").click();
  assert.equal(await page.locator("#chemicalOverview").isVisible(),true,"reset restores complete Building Blocks illustration");
  assert.ok(!(await page.locator("#chemicalOverview").textContent()).includes("⁻"),"reset removes the base modification");

  // The *viewer* copy control and Ctrl/Cmd+C use real SVG vectors, not XML text.
  await page.goto(base+"?page=secondary&start=example",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#seCopyStructure");
  assert.equal(await page.locator("#seCopySelectedSvg,#seDownloadSelectedSvg").count(),0,
    "redundant selected-SVG buttons removed from Select tab");
  const viewport=await page.locator("#scene-secondary .se-viewport").boundingBox();
  const copyButton=await page.locator("#seCopyStructure").boundingBox();
  assert.ok(copyButton.x>=viewport.x+viewport.width-65&&copyButton.y>=viewport.y+viewport.height-65,
    "copy icon sits inside bottom-right of RNA viewer");
  const pair=await page.evaluate(()=>{
    const c=SecondaryExplorer.getContext();
    return SecondaryExplorer.parse(c.sequence,c.structure).pairs[0];
  });
  await page.evaluate(([a,b])=>SecondaryExplorer.highlightResidues([a,b]),pair);
  const region=await page.evaluate(()=>SecondarySelectionTools.selectedRegionSvg());
  const parsed=await page.evaluate(s=>{
    const xml=new DOMParser().parseFromString(s,"image/svg+xml"),svg=xml.documentElement;
    return {
      valid:!xml.querySelector("parsererror"),
      nodes:xml.querySelectorAll(".se-node").length,
      pairs:xml.querySelectorAll(".se-pair").length,
      wires:xml.querySelectorAll(".se-backbone").length,
      removed:xml.querySelectorAll("[data-export-remove],.se-selected-transform-overlay").length,
      viewBox:svg.getAttribute("viewBox"),
      width:Number(svg.getAttribute("width")),
      letters:xml.querySelectorAll(".se-node text").length,
      vector:xml.querySelectorAll("path,line,circle,text").length
    };
  },region.svgText);
  assert.ok(parsed.valid,"valid standalone XML");
  assert.equal(parsed.nodes,2,"two selected residues and no others");
  assert.equal(parsed.pairs,1,"the connecting pair remains a vector");
  assert.equal(parsed.removed,0,"no invisible hit targets or selection UI");
  assert.ok(parsed.letters>=2&&parsed.vector>2,"letters and line elements remain editable");
  assert.ok(parsed.viewBox.startsWith("0 0 ")&&parsed.width>0,
    "normalized 0-origin viewBox improves Illustrator import");

  await page.locator("#seCopyStructure").click();
  await page.waitForFunction(()=>document.querySelector("#seCopyStructure")?.classList.contains("is-copied"));
  const copied=await page.evaluate(async()=>{
    const items=await navigator.clipboard.read();
    const formats=items.flatMap(item=>item.types);
    const imageItem=items.find(item=>item.types.includes("image/svg+xml"));
    return {formats,svgText:imageItem?await (await imageItem.getType("image/svg+xml")).text():""};
  });
  assert.ok(copied.formats.includes("image/svg+xml"),"native SVG clipboard MIME used");
  assert.ok(!copied.formats.includes("text/plain"),"never replace vector artwork with raw XML source");
  assert.ok(!copied.svgText.includes('fill="#0b1220"'),"clipboard has no dark backdrop rectangle");
  assert.equal((copied.svgText.match(/class="se-node/g)||[]).length,2,
    "copy icon places only selected residues on clipboard");

  // A standalone vector SVG must render independently of RNA Explorer CSS,
  // as a vector editor opens it outside the website.
  const vectorRender=await page.evaluate(async svgText=>{
    const blob=new Blob([svgText],{type:"image/svg+xml"}),url=URL.createObjectURL(blob);
    const img=new Image();
    try{
      await new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=()=>reject(Error("Clipboard SVG is not independently renderable"));
        img.src=url;
      });
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.min(320,img.naturalWidth));
      canvas.height=Math.max(1,Math.min(320,img.naturalHeight));
      const ctx=canvas.getContext("2d");
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let colorful=0;
      for(let i=0;i<pixels.length;i+=16){
        const delta=Math.abs(pixels[i]-11)+Math.abs(pixels[i+1]-18)+Math.abs(pixels[i+2]-32);
        if(pixels[i+3]>128&&delta>24)colorful++;
      }
      return {width:img.naturalWidth,height:img.naturalHeight,colorful,cornerAlpha:pixels[3]};
    }finally{URL.revokeObjectURL(url);}
  },copied.svgText);
  assert.ok(vectorRender.width>40&&vectorRender.height>40&&vectorRender.colorful>12,
    "transparent copied SVG retains independently rendered nucleotide artwork");
  assert.equal(vectorRender.cornerAlpha,0,"SVG clipboard artwork has a transparent corner/background");


  // On desktop, keyboard copy must use the same artwork and leave typing alone.
  await page.evaluate(()=>navigator.clipboard.writeText("SENTINEL"));
  await page.locator("#seCopyStructure").focus();
  await page.keyboard.press("Control+c");
  await page.waitForFunction(async()=>{
    const items=await navigator.clipboard.read();
    return items.some(item=>item.types.includes("image/svg+xml"));
  });
  const keyed=await page.evaluate(async()=>{
    const item=(await navigator.clipboard.read()).find(item=>item.types.includes("image/svg+xml"));
    return (await item.getType("image/svg+xml")).text();
  });
  assert.equal((keyed.match(/class="se-node/g)||[]).length,2,
    "Ctrl+C uses same selected vector artwork");
  await page.locator("#secondarySequence").focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),
    await page.locator("#secondarySequence").inputValue(),
    "Ctrl+C inside sequence textbox retains normal text copying");

  // Without a selection the icon copies the *whole* secondary structure.
  await page.evaluate(()=>SecondaryExplorer.clearHighlights());
  await page.locator("#seCopyStructure").click();
  const whole=await page.evaluate(async()=>{
    const items=await navigator.clipboard.read(),item=items.find(i=>i.types.includes("image/svg+xml"));
    return (await item.getType("image/svg+xml")).text();
  });
  assert.equal((whole.match(/class="se-node/g)||[]).length,76,
    "copy icon uses entire rendered tRNA when nothing is selected");

  // Existing Export… dialog offers selected-only SVG without duplicate buttons.
  await page.evaluate(([a,b])=>SecondaryExplorer.highlightResidues([a,b]),pair);
  await page.locator("#seExportDialogButton").click();
  assert.equal(await page.locator("#seExportSelectedOnly").isChecked(),true,
    "export dialog defaults to selected region when a selection exists");
  await page.selectOption("#seImageFormat","svg");
  const downloadPromise=page.waitForEvent("download");
  await page.locator("#seExportNow").click();
  const download=await downloadPromise;
  const exported=await (await import("node:fs/promises")).readFile(await download.path(),"utf8");
  assert.equal((exported.match(/class="se-node/g)||[]).length,2,
    "selected SVG download contains only chosen residues");
  assert.ok(exported.includes("<svg")&&exported.includes("<text"),
    "download retains editable vector paths/text");
  // RNA Spotlight replaces the old homepage "Did you know?" label.
  await page.goto(base+"?page=home",{waitUntil:"domcontentloaded"});
  assert.equal((await page.locator("#rnaFactLabel").textContent()).trim(),
    "RNA Spotlight","homepage science feature has the new name");

  // Molecular Drawing: copy a chemically bounded atom/bond selection as
  // editable, standalone SVG without accidentally copying the whole canvas.
  await page.goto(base+"?page=drawing",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#drawingOpenBlank");
  await page.evaluate(()=>MoleculeEditor.openBase("A"));
  await page.waitForFunction(()=>document.querySelector("#chemEditorDialog")?.open);
  const baseGraph=await page.evaluate(()=>MoleculeEditor.getCurrentGraph());
  assert.ok(baseGraph.atoms.length>5&&baseGraph.bonds.length>4,
    "molecular editor loaded atom/bond drawing");
  const chosenBond=baseGraph.bonds[0];
  await page.locator('#chemEditorSvg [data-atom-id="'+chosenBond.a+'"]').click();
  await page.locator('#chemEditorSvg [data-atom-id="'+chosenBond.b+'"]').click({modifiers:["Shift"]});
  const molecule=await page.evaluate(()=>MoleculeEditor.molecularCopySvg());
  assert.equal(molecule.atomCount,2,"only the two selected atoms copied");
  assert.equal(molecule.bondCount,1,"the bond between selected atoms included");
  const parsedMolecule=await page.evaluate(text=>{
    const xml=new DOMParser().parseFromString(text,"image/svg+xml"),root=xml.documentElement;
    return {error:Boolean(xml.querySelector("parsererror")),
      atoms:xml.querySelectorAll(".chem-editor-atom").length,
      bonds:xml.querySelectorAll(".chem-editor-bond").length,
      outside:xml.querySelectorAll(".chem-selection-box,.chem-lasso-path,.chem-selection-transform-overlay").length,
      lines:xml.querySelectorAll(".chem-editor-bond line").length,
      labels:xml.querySelectorAll(".chem-editor-atom text").length,
      circles:xml.querySelectorAll(".chem-atom-circle").length,
      box:root.getAttribute("viewBox"),
      width:Number(root.getAttribute("width"))
    };
  },molecule.svgText);
  assert.equal(parsedMolecule.error,false,"molecular SVG parses as XML");
  assert.equal(parsedMolecule.atoms,2,"only chosen atom groups exported");
  assert.equal(parsedMolecule.bonds,1,"only internal covalent connection exported");
  assert.equal(parsedMolecule.outside,0,"no editor selection handles exported");
  assert.equal(parsedMolecule.circles,0,"hidden editor-only atom circles omitted");
  assert.ok(parsedMolecule.lines>=1&&parsedMolecule.labels>=1&&
    parsedMolecule.box.startsWith("0 0 ")&&parsedMolecule.width>0,
    "normalized SVG retains separately editable vector bonds and atom labels");

  const canvasBounds=await page.locator("#chemEditorDialog .chem-editor-canvas-wrap").boundingBox();
  const iconBounds=await page.locator("#chemCopyArtwork").boundingBox();
  assert.ok(iconBounds.x>=canvasBounds.x+canvasBounds.width-65&&
    iconBounds.y>=canvasBounds.y+canvasBounds.height-65,
    "molecular copy button sits at bottom-right of drawing canvas");
  await page.locator("#chemCopyArtwork").click();
  await page.waitForFunction(()=>document.querySelector("#chemCopyArtwork")?.classList.contains("is-copied"));
  const copyTypes=await page.evaluate(async()=>(await navigator.clipboard.read()).flatMap(x=>x.types));
  assert.ok(copyTypes.includes("image/svg+xml")&&!copyTypes.includes("text/plain"),
    "clipboard contains real SVG vectors, not source text");
  const copiedMolecule=await page.evaluate(async()=>{
    const item=(await navigator.clipboard.read()).find(i=>i.types.includes("image/svg+xml"));
    return (await item.getType("image/svg+xml")).text();
  });
  assert.equal((copiedMolecule.match(/class="chem-editor-atom(?:\\s|")/g)||[]).length,2,
    "copy button contains only selected atoms");
  assert.ok(!copiedMolecule.includes('fill="#0b1220"')&&
    !copiedMolecule.includes("chem-selection-box"),
    "molecular copy is transparent with no selection box");

  await page.evaluate(()=>navigator.clipboard.writeText("SENTINEL"));
  await page.locator("#chemCopyArtwork").focus();
  await page.keyboard.press("Control+c");
  await page.waitForFunction(async()=>(await navigator.clipboard.read())
    .some(item=>item.types.includes("image/svg+xml")));
  const shortcutSvg=await page.evaluate(async()=>{
    const item=(await navigator.clipboard.read()).find(i=>i.types.includes("image/svg+xml"));
    return (await item.getType("image/svg+xml")).text();
  });
  assert.equal((shortcutSvg.match(/class="chem-editor-atom(?:\\s|")/g)||[]).length,2,
    "Ctrl+C copies selected molecular vectors");
  await page.locator("#chemCopyArtwork").focus();
  await page.keyboard.press("Escape");
  const entireMolecule=await page.evaluate(()=>MoleculeEditor.molecularCopySvg());
  assert.equal(entireMolecule.atomCount,baseGraph.atoms.length,
    "without a selection, copy includes the whole molecule");
  if(problems.length)throw Error("Browser JavaScript errors:\n"+problems.join("\n"));
  console.log("PASS: RNA Spotlight, molecular selected SVG copy and Ctrl+C, plus secondary and lesson regressions.");
}finally{
  await context.close();
  await browser.close();
}