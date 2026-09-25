const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const assert=require("assert");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".csv":"text/csv",".pdb":"text/plain",".cif":"text/plain",".svg":"image/svg+xml"};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://127.0.0.1");
  let p=decodeURIComponent(u.pathname);
  if(p==="/")p="/index.html";
  const file=path.normalize(path.join(root,p));
  if(!file.startsWith(root)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);return res.end("not found");}
    res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});
    res.end(data);
  });
});
const listen=()=>new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");

(async()=>{
  await listen();
  const port=server.address().port;
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on("pageerror",e=>errors.push("pageerror: "+e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});

  try{
    await page.goto(`http://127.0.0.1:${port}/?page=tertiary`,{waitUntil:"domcontentloaded",timeout:30000});
    try{
      await page.waitForFunction(()=>{
        const canvas=document.querySelector("#tertiaryMolecularViewer canvas");
        const box=canvas?.getBoundingClientRect();
        return !!canvas&&canvas.width>0&&box&&box.width>100&&box.height>100;
      },{timeout:30000});
    }catch(error){
      const metrics=await page.evaluate(()=>["scene-tertiary","tertiaryStage","tertiarySplitShell","tertiaryViewport","tertiaryMolecularViewer"].map(id=>{
        const e=document.getElementById(id),r=e?.getBoundingClientRect(),cs=e?getComputedStyle(e):null;
        return {id,hidden:e?.hidden,display:cs?.display,width:r?.width,height:r?.height,clientWidth:e?.clientWidth,clientHeight:e?.clientHeight};
      }).concat([{id:"canvas",...(()=>{const e=document.querySelector("#tertiaryMolecularViewer canvas"),r=e?.getBoundingClientRect();return {width:r?.width,height:r?.height,canvasWidth:e?.width,canvasHeight:e?.height};})()}]));
      console.error("3D layout metrics:",JSON.stringify(metrics));throw error;
    }
    await page.waitForFunction(()=>document.querySelectorAll("#teSequencePanel button").length>10,{timeout:30000});
    await wait(500);

    const status=page.locator("#teMolecularStatus");
    assert(!(await status.isVisible()),"3D viewer should not retain an error/loading overlay after successful load");

    const canvasBox=await page.locator("#tertiaryMolecularViewer canvas").boundingBox();
    assert(canvasBox&&canvasBox.width>300&&canvasBox.height>300,"3D canvas should have a usable initial size");

    const viewport=page.locator("#tertiaryViewport");
    const initial=hash(await viewport.screenshot());

    await page.selectOption("#teRepresentation","spheres");
    await wait(350);
    const spheres=hash(await viewport.screenshot());
    assert.notStrictEqual(spheres,initial,"Representation change should immediately update the 3D drawing");

    await page.selectOption("#teColorMode","uniform");
    await page.fill("#teUniformColor","#ff00aa");
    await page.locator("#teUniformColor").dispatchEvent("input");
    await wait(350);
    const recolored=hash(await viewport.screenshot());
    assert.notStrictEqual(recolored,spheres,"Color change should immediately recolor the 3D drawing");

    const split=page.locator("#teSplit");
    await split.check();
    await wait(350);
    assert(await page.locator("#tertiaryMiniPanel").isVisible(),"Linked 2D panel should appear");
    assert.strictEqual(await page.locator('#tertiaryMiniSvg [data-residue-index] text').count(),76,"Linked 2D view should render all residue letters from the Secondary workspace");
    assert.strictEqual((await page.locator('#tertiaryMiniSvg [data-residue-index="0"] text').textContent()).trim(),"G","Linked 2D view should preserve residue identity text");
    await split.uncheck();
    await wait(350);
    assert(!(await page.locator("#tertiaryMiniPanel").isVisible()),"Linked 2D panel should hide");
    assert(await viewport.isVisible(),"3D viewport should remain visible after unlinking");
    const afterUnlink=await page.locator("#tertiaryMolecularViewer canvas").boundingBox();
    assert(afterUnlink&&afterUnlink.width>300,"3D canvas should remain sized after unlinking");

    // Analysis controls: proximity, contacts, measurements, selection, surface and clipping.
    await page.check("#teProximity");
    await page.waitForFunction(()=>/residue|neighbor|within/i.test(document.querySelector("#teProximityStatus")?.textContent||""));
    await page.check("#teContacts");
    await page.waitForFunction(()=>/contacts|H-bond/i.test(document.querySelector("#teContactStatus")?.textContent||""));
    await page.selectOption("#teMeasureMode","distance");
    assert(/distance/i.test(await page.locator("#teMeasureStatus").textContent()),"Distance measurement mode should activate");

    await page.fill("#teSelectStart","1");
    await page.fill("#teSelectEnd","5");
    await page.click("#teSelectRange");
    assert.strictEqual(await page.locator("#teSequencePanel .chosen").count(),5,"Residue range selection should select five residues");
    await page.click("#teFocusSelection");

    page.once("dialog",d=>d.accept("browser_test_object"));
    await page.click("#teCreateObject");
    await page.waitForFunction(()=>[...document.querySelectorAll("#teObjectList input")].some(e=>e.value==="browser_test_object"));
    const objectRow=page.locator("#teObjectList .te-object-row").filter({has:page.locator('input[value="browser_test_object"]')});
    await objectRow.getByRole("button",{name:"Isolate"}).click();
    await wait(250);
    assert(await viewport.isVisible(),"Isolating a saved object should keep the 3D viewer visible");
    await objectRow.getByRole("button",{name:"Show all"}).click();

    await page.check("#teSurface");
    await wait(500);
    await page.uncheck("#teSurface");
    await page.check("#teClipEnabled");
    await page.locator("#teClipNear").evaluate((el)=>{el.value="-25";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.locator("#teClipFar").evaluate((el)=>{el.value="25";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await wait(250);
    await page.uncheck("#teClipEnabled");

    page.once("dialog",d=>d.accept("browser_test_view"));
    await page.click("#teSaveView");
    await page.waitForFunction(()=>document.querySelector("#teSavedViews")?.textContent.includes("browser_test_view"));

    // Structure export should produce a real PDB download from the current selection.
    await page.click("#teOpenExport");
    await page.selectOption("#teExportType","structure");
    await page.selectOption("#teExportScope","selection");
    await page.selectOption("#teExportFormat","pdb");
    const pdbDownloadPromise=page.waitForEvent("download");
    await page.click("#teExportNow");
    const pdbDownload=await pdbDownloadPromise;
    assert(/\.pdb$/i.test(pdbDownload.suggestedFilename()),"Selection export should download a PDB file");
    await page.locator("#teExportClose").click();

    // Direct RCSB import by PDB ID.
    await page.fill("#tePdbId","1EHZ");
    await page.click("#teLoadPdbId");
    await page.waitForFunction(()=>/RCSB PDB · 1EHZ/i.test(document.querySelector("#teStructureSource")?.textContent||""),{timeout:30000});
    await page.waitForFunction(()=>document.querySelectorAll("#teSequencePanel button").length>10,{timeout:30000});
    assert(!(await status.isVisible()),"RCSB-loaded structure should not leave an error overlay");

    const meaningful=errors.filter(e=>!e.includes("favicon"));
    assert.deepStrictEqual(meaningful,[],"Browser console/runtime errors:\n"+meaningful.join("\n"));
    console.log("PASS: tertiary browser integration (initial render, display/color, link toggle, 2D letters, analysis controls, RCSB import).");
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exit(1);});
