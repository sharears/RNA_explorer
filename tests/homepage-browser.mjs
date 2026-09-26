import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('body[data-page-mode="home"] .home-cover',{state:"visible",timeout:10000});
  const image=page.locator(".home-cover-art img");
  await image.waitFor({state:"visible",timeout:10000});
  const dims=await image.evaluate(img=>({naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}));
  if(dims.naturalWidth<400||dims.naturalHeight<400)throw new Error("Homepage cover image did not load at expected resolution: "+JSON.stringify(dims));

  const title=(await page.locator("#homeCoverTitle").textContent())||"";
  if(!/RNA structure/i.test(title)||!/minus the fuss/i.test(title))throw new Error("Homepage hero headline is missing.");

  const thought=((await page.locator(".home-thought-bubble").textContent())||"").replace(/\s+/g," ").trim();
  if(!thought.includes("A little editing here")||!thought.includes("a better base pair there")||!thought.includes("RNA makes sense!"))
    throw new Error("Thought bubble copy is missing or changed: "+thought);

  const cards=await page.locator(".home-path-card").count();
  if(cards!==0)throw new Error("Redundant homepage Learn/Analyze cards should be removed; found "+cards);
  const learnHref=await page.locator('.home-cover-actions a[href="?page=journey"]').getAttribute("href");
  if(learnHref!=="?page=journey")throw new Error("Learn RNA structure should open the guided journey.");
  const analyze=page.locator("#homeAnalyzeToggle"),fork=page.locator("#homeAnalyzeFork");
  await analyze.click();
  if(await fork.isHidden())throw new Error("Analyze an RNA should reveal the 2D/3D fork.");
  const destinations=await fork.locator("a").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("href")));
  if(!destinations.includes("?page=secondary")||!destinations.includes("?page=tertiary"))throw new Error("Analyze fork must contain both 2D and 3D workspace links.");

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Homepage browser runtime errors:\n"+serious.join("\n"));
  console.log("PASS: homepage cover image and navigation smoke test");
} finally {
  await browser.close();
}
