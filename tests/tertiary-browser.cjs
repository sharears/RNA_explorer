const http=require("http");
const fs=require("fs");
const path=require("path");
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
function mockRcsbCif(){
  const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
  const sequence=app.match(/const RNA_SEQUENCE = "([ACGU]+)"/)[1];
  const headers=[
    "group_PDB","id","type_symbol","label_atom_id","label_alt_id","label_comp_id","label_asym_id","label_entity_id","label_seq_id","pdbx_PDB_ins_code",
    "Cartn_x","Cartn_y","Cartn_z","occupancy","B_iso_or_equiv","pdbx_formal_charge","auth_seq_id","auth_comp_id","auth_asym_id","auth_atom_id","pdbx_PDB_model_num"
  ];
  const lines=["data_1EHZ","#","loop_",...headers.map(h=>"_atom_site."+h)];
  let serial=1;
  [...sequence].forEach((base,i)=>{
    const r=i+1,x=(i%12)*2.1,y=Math.floor(i/12)*2.1,z=Math.sin(i*.35)*2;
    lines.push(["ATOM",serial++,"P","P",".",base,"A","1",r,"?",x.toFixed(3),y.toFixed(3),z.toFixed(3),"1.00","10.00","?",r,base,"A","P","1"].join(" "));
    lines.push(["ATOM",serial++,"C","C4*",".",base,"A","1",r,"?",(x+.8).toFixed(3),(y+.5).toFixed(3),(z+.2).toFixed(3),"1.00","10.00","?",r,base,"A","C4*","1"].join(" "));
  });
  lines.push("#");return lines.join("\n")+"\n";
}

(async()=>{
  await listen();
  const port=server.address().port;
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on("pageerror",e=>errors.push("pageerror: "+e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});

  try{
    await page.route("https://files.rcsb.org/download/1EHZ.cif",route=>route.fulfill({status:200,contentType:"text/plain",body:mockRcsbCif()}));
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
    const initialState=await page.evaluate(()=>TertiaryExplorer.getDebugState());
    assert(initialState.modelAtoms>1000&&initialState.atomStyle?.stick,"Initial 3D model should be loaded and styled as sticks without requiring Reset view");

    // Headless Chromium does not reliably expose WebGL framebuffer changes through screenshots.
    // Verify the actual 3Dmol atom style state instead of screenshot hashes.
    await page.selectOption("#teRepresentation","spheres");
    await wait(350);
    const sphereState=await page.evaluate(()=>TertiaryExplorer.getDebugState());
    assert(sphereState.representation==="spheres"&&sphereState.atomStyle?.sphere,"Sphere representation should be applied immediately to RNA atoms");

    await page.selectOption("#teColorMode","uniform");
    await page.locator("#teUniformColor").evaluate(el=>{el.value="#ff00aa";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await wait(350);
    const colorState=await page.evaluate(()=>TertiaryExplorer.getDebugState());
    assert.strictEqual(colorState.colorMode,"uniform","Uniform color mode should apply immediately");
    assert.strictEqual(String(colorState.atomStyle?.sphere?.color).toLowerCase(),"#ff00aa","Uniform color should be applied to the 3D atom style immediately");

    const split=page.locator("#teSplit");
    await split.check();
    await wait(350);
    assert(await page.locator("#tertiaryMiniPanel").isVisible(),"Linked 2D panel should appear");
    assert.strictEqual(await page.locator('#tertiaryMiniSvg [data-residue-index] > text:not(.se-index)').count(),76,"Linked 2D view should render all residue letters from the Secondary workspace");
    assert.strictEqual((await page.locator('#tertiaryMiniSvg [data-residue-index="0"] > text:not(.se-index)').textContent()).trim(),"G","Linked 2D view should preserve residue identity text");
    assert((await page.locator("#tertiaryMiniSvg .se-index").count())>0,"Linked 2D view should preserve Secondary residue-index labels");
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

    await page.locator("#teCreateObject").evaluate(el=>{const d=el.closest("details");if(d)d.open=true;});
    page.once("dialog",d=>d.accept("browser_test_object"));
    await page.locator("#teCreateObject").evaluate(el=>el.click());
    await page.waitForFunction(()=>[...document.querySelectorAll("#teObjectList input")].some(e=>e.value==="browser_test_object"));
    const objectRow=page.locator("#teObjectList .te-object-row").filter({has:page.locator("input")}).last();
    assert.strictEqual(await objectRow.locator("input").inputValue(),"browser_test_object","Saved object should retain its assigned name");
    await objectRow.getByRole("button",{name:"Isolate",exact:true}).click();
    await wait(250);
    assert(await viewport.isVisible(),"Isolating a saved object should keep the 3D viewer visible");
    await objectRow.getByRole("button",{name:"Show all"}).click();

    await page.check("#teSurface");
    await wait(500);
    await page.uncheck("#teSurface");
    await page.locator("#teClipEnabled").evaluate(el=>{const d=el.closest("details");if(d)d.open=true;});
    await page.check("#teClipEnabled");
    await page.locator("#teClipNear").evaluate((el)=>{el.value="-25";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.locator("#teClipFar").evaluate((el)=>{el.value="25";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await wait(250);
    await page.uncheck("#teClipEnabled");

    await page.locator("#teSaveView").evaluate(el=>{const d=el.closest("details");if(d)d.open=true;});
    page.once("dialog",d=>d.accept("browser_test_view"));
    await page.locator("#teSaveView").evaluate(el=>el.click());
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
    await page.waitForFunction(()=>{
      const source=document.querySelector("#teStructureSource")?.textContent||"";
      const status=document.querySelector("#teMolecularStatus");
      return /RCSB PDB · 1EHZ/i.test(source)||(status&&!status.hidden&&/RCSB import failed/i.test(status.textContent||""));
    },{timeout:30000});
    const rcsbState=await page.evaluate(()=>({source:document.querySelector("#teStructureSource")?.textContent||"",status:document.querySelector("#teMolecularStatus")?.textContent||"",statusHidden:document.querySelector("#teMolecularStatus")?.hidden}));
    assert(/RCSB PDB · 1EHZ/i.test(rcsbState.source),"RCSB import should update the structure source. State: "+JSON.stringify(rcsbState));
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
