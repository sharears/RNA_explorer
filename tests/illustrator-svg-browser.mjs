import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=tertiary&start=example";
const outputDir=resolve("test-output/illustrator-svg");
mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));

try {
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#scene-tertiary:not([hidden])").waitFor({timeout:15000});
  await page.locator("#tertiaryMolecularViewer canvas").waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(()=>typeof TertiaryExplorer!=="undefined"&&TertiaryExplorer.getDiagnostics().modelReady,
    null,{timeout:45000});
  const d=await page.evaluate(()=>TertiaryExplorer.getDiagnostics());
  assert(d.viewerReady && d.modelReady && d.atomCount>100,
    "RNA Explorer did not load the 3D model: "+JSON.stringify(d));

  await page.locator("#teOpenExport").click();
  await page.locator("#teExportDialog[open]").waitFor({state:"visible",timeout:10000});
  await page.selectOption("#teExportType","image");
  await page.selectOption("#teImageFormat","svg");
  await page.selectOption("#teImageBackground","#ffffff");
  await page.selectOption("#teImageDpi","96");
  await page.locator("#teImageScale").evaluate(el=>{
    el.value="1";el.dispatchEvent(new Event("input",{bubbles:true}));
  });

  const downloadPromise=page.waitForEvent("download",{timeout:45000});
  await page.locator("#teExportNow").click();
  const download=await downloadPromise;
  const suggested=download.suggestedFilename();
  assert(suggested.endsWith(".svg"),"Expected downloaded SVG; got "+suggested);
  const out=resolve(outputDir,"rna-explorer-actual-tertiary.svg");
  await download.saveAs(out);
  const xml=readFileSync(out,"utf8");
  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),"Missing XML declaration");
  assert(xml.includes('xmlns:xlink="http://www.w3.org/1999/xlink"'),"Missing SVG xlink namespace");

  const info=await page.evaluate(async markup=>{
    const doc=new DOMParser().parseFromString(markup,"image/svg+xml");
    const err=doc.querySelector("parsererror");
    if(err)throw new Error("SVG XML parser error: "+err.textContent);
    const root=doc.documentElement;
    if(root.localName!=="svg"||root.namespaceURI!=="http://www.w3.org/2000/svg")
      throw new Error("Expected an SVG root element");
    const img=root.querySelector("image");
    if(!img)throw new Error("No raster snapshot embedded in SVG");
    const href=img.getAttributeNS("http://www.w3.org/1999/xlink","href");
    if(!href||!href.startsWith("data:image/png;base64,"))throw new Error("PNG is not self-contained in xlink:href");
    if(img.hasAttribute("href"))throw new Error("Image has an href-only attribute");
    const bitmap=new Image();
    await new Promise((ok,fail)=>{
      bitmap.onload=ok;bitmap.onerror=()=>fail(new Error("Embedded PNG cannot be decoded"));
      bitmap.src=href;
    });
    const c=document.createElement("canvas");c.width=96;c.height=96;
    const ctx=c.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,96,96);
    const data=ctx.getImageData(0,0,96,96).data;
    const colors=new Set();
    for(let i=0;i<data.length;i+=4){
      colors.add([data[i]>>4,data[i+1]>>4,data[i+2]>>4,data[i+3]>>4].join(":"));
    }
    return {width:Number(root.getAttribute("width")),height:Number(root.getAttribute("height")),
      imageWidth:bitmap.naturalWidth,imageHeight:bitmap.naturalHeight,
      imageCount:root.querySelectorAll("image").length,uniqueColors:colors.size,href};
  },xml);
  assert(info.width>100&&info.height>100,"Export dimensions are too small");
  console.log("SVG display dimensions vs embedded PNG dimensions:",JSON.stringify({svg:[info.width,info.height],png:[info.imageWidth,info.imageHeight]}));
  assert(info.imageWidth>100&&info.imageHeight>100,"Embedded PNG dimensions are too small");
  assert(Math.abs(info.width/info.height-info.imageWidth/info.imageHeight)/(info.width/info.height)<0.03,
    "Embedded PNG aspect ratio mismatch: SVG "+info.width+"x"+info.height+"; PNG "+info.imageWidth+"x"+info.imageHeight);
  assert(info.imageCount===1,"Expected one embedded image, got "+info.imageCount);
  assert(info.uniqueColors>=3,"Rendered PNG looks blank/monochrome");
  const png=Buffer.from(info.href.slice("data:image/png;base64,".length),"base64");
  assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),"Invalid PNG signature");
  assert(png.length>5000,"PNG is unexpectedly small: "+png.length);
  const status=await page.locator("#teExportDialogStatus").innerText();
  assert(/Image exported/i.test(status),"Export UI did not report success: "+status);
  assert(errors.filter(x=>!/ResizeObserver loop/i.test(x)).length===0,
    "Browser errors: "+errors.join(" | "));

  const report={result:"PASS",source:d.source,atomCount:d.atomCount,filename:suggested,
    svgBytes:Buffer.byteLength(xml),embeddedPngBytes:png.length,
    width:info.width,height:info.height,uniqueSampledColors:info.uniqueColors,
    sha256:createHash("sha256").update(xml).digest("hex"),
    note:"Produced by clicking RNA Explorer 3D Export > Image > SVG in Chromium. Actual Adobe Illustrator import must be verified separately."};
  writeFileSync(resolve(outputDir,"report.json"),JSON.stringify(report,null,2)+"\n");
  console.log("PASS actual 3D export SVG:",JSON.stringify(report));
} catch(error) {
  await page.screenshot({path:resolve(outputDir,"failure.png"),fullPage:false}).catch(()=>{});
  writeFileSync(resolve(outputDir,"failure.txt"),String(error.stack||error)+"\n");
  throw error;
} finally {
  await browser.close();
}
