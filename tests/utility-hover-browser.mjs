import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  const menu=page.locator("#utilityMenu");
  const summary=menu.locator(":scope > summary");
  if(await menu.evaluate(el=>el.open))throw new Error("More menu unexpectedly started open.");
  await summary.hover();
  await page.waitForFunction(()=>document.getElementById("utilityMenu")?.open===true,{timeout:3000});
  await page.locator("#utilityMenu .utility-menu-panel").hover();
  if(!(await menu.evaluate(el=>el.open)))throw new Error("More menu closed while moving from the dots into the panel.");
  await page.mouse.move(400,500);
  await page.waitForFunction(()=>document.getElementById("utilityMenu")?.open===false,{timeout:3000});

  await page.goto(new URL("./",base).href,{waitUntil:"domcontentloaded",timeout:30000});
  const cover=page.locator(".home-cover-art img");
  await cover.waitFor({state:"visible",timeout:10000});
  await page.waitForFunction(()=>{
    const image=document.querySelector(".home-cover-art img");
    return image && image.complete && image.naturalWidth>0 && image.naturalHeight>0;
  },{timeout:10000});
  const coverState=await cover.evaluate(image=>{
    const style=getComputedStyle(image);
    const rect=image.getBoundingClientRect();
    return {
      src:image.currentSrc||image.src,
      naturalWidth:image.naturalWidth,
      naturalHeight:image.naturalHeight,
      opacity:Number(style.opacity),
      visibility:style.visibility,
      display:style.display,
      width:rect.width,
      height:rect.height
    };
  });
  if(coverState.naturalWidth<1000||coverState.naturalHeight<700)throw new Error("Homepage cover did not load the regenerated high-resolution artwork: "+JSON.stringify(coverState));
  if(coverState.opacity<=0||coverState.visibility==="hidden"||coverState.display==="none"||coverState.width<200||coverState.height<200){
    throw new Error("Homepage cover loaded but is not visibly rendered: "+JSON.stringify(coverState));
  }

  console.log("PASS: More menu hover works and the regenerated homepage cover is visibly rendered.");
} finally {
  await browser.close();
}
