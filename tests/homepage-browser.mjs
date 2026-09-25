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
  if(cards!==0)throw new Error("Redundant Learn/Analyze cards should be removed from the homepage; found "+cards);
  const fork=page.locator(".home-analyze-fork");
  await fork.locator("summary").click();
  await page.waitForSelector(".home-analysis-branches",{state:"visible",timeout:5000});
  const branchLabels=(await page.locator(".home-analysis-branches").innerText()).replace(/\s+/g," ");
  if(!branchLabels.includes("2D")||!branchLabels.includes("Secondary structure")||!branchLabels.includes("3D")||!branchLabels.includes("Tertiary structure"))
    throw new Error("Analyze fork is missing the 2D/3D branches: "+branchLabels);

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Homepage browser runtime errors:\n"+serious.join("\n"));
  console.log("PASS: homepage cover image and navigation smoke test");
} finally {
  await browser.close();
}
