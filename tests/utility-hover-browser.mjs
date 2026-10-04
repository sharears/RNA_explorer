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
  console.log("PASS: More menu opens on hover, stays open while entering the panel, and closes after leaving.");
} finally {
  await browser.close();
}
