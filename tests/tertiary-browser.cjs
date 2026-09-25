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
    await page.waitForSelector("#tertiaryMolecularViewer canvas",{state:"visible",timeout:30000});
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
    assert.strictEqual(await page.locator("#tertiaryMiniSvg .te-mini-node text").count(),76,"Linked 2D view should render residue letters");
    await split.uncheck();
    await wait(350);
    assert(!(await page.locator("#tertiaryMiniPanel").isVisible()),"Linked 2D panel should hide");
    assert(await viewport.isVisible(),"3D viewport should remain visible after unlinking");
    const afterUnlink=await page.locator("#tertiaryMolecularViewer canvas").boundingBox();
    assert(afterUnlink&&afterUnlink.width>300,"3D canvas should remain sized after unlinking");

    // Basic analysis controls should execute without runtime errors.
    await page.check("#teProximity");
    await page.check("#teContacts");
    await page.selectOption("#teMeasureMode","distance");
    await page.click("#teSelectRange");
    await page.click("#teFocusSelection");
    await page.check("#teSurface");
    await wait(500);
    await page.uncheck("#teSurface");

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
