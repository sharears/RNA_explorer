import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=secondary";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('body[data-page-mode="secondary"] #scene-secondary:not([hidden])',{timeout:10000});

  const dataSummary=page.locator("summary").filter({hasText:"Analyze · Data layers"}).first();
  await dataSummary.click();

  await page.click("#seExample");
  await page.waitForFunction(()=>!document.querySelector("#seHeatLegend")?.hidden,{timeout:10000});
  await page.click("#sePairProbExample");
  await page.waitForFunction(()=>!document.querySelector("#sePairProbLegend")?.hidden,{timeout:10000});
  await page.locator("summary").filter({hasText:"Reactivity color bar"}).click();
  await page.locator("summary").filter({hasText:"Base-pair probability color bar"}).click();

  for(const prefix of ["seHeatLegend","sePairLegend"]){
    for(const suffix of ["Title","TitleFontSize","TitleStyle","TitleColor","BoxMode","BackgroundColor","BackgroundOpacity","BorderVisible","BorderColor","BorderThickness"]){
      if(await page.locator("#"+prefix+suffix).count()!==1)throw new Error("Missing color-bar editor control #"+prefix+suffix);
    }
  }

  await page.fill("#seHeatLegendTitle","DMS reactivity");
  await page.fill("#seHeatLegendTitleFontSize","21");
  await page.selectOption("#seHeatLegendTitleStyle","italic");
  await page.locator("#seHeatLegendTitleColor").evaluate(el=>{el.value="#ff3366";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.selectOption("#seHeatLegendBoxMode","none");

  let heat=page.locator("#seHeatLegend");
  if(((await heat.locator(".se-legend-drag-handle strong").textContent())||"").trim()!=="DMS reactivity")throw new Error("Reactivity color-bar title did not update.");
  const heatStyle=await heat.evaluate(el=>{
    const title=getComputedStyle(el.querySelector(".se-legend-drag-handle strong")),box=getComputedStyle(el);
    return {fontSize:title.fontSize,fontStyle:title.fontStyle,color:title.color,borderStyle:box.borderStyle,background:box.backgroundColor,className:el.className};
  });
  if(heatStyle.fontSize!=="21px"||heatStyle.fontStyle!=="italic"||!heatStyle.className.includes("legend-none")||heatStyle.borderStyle!=="none"||heatStyle.background!=="rgba(0, 0, 0, 0)")
    throw new Error("Reactivity title/box styling did not apply: "+JSON.stringify(heatStyle));

  await page.fill("#sePairLegendTitle","Pairing confidence");
  await page.fill("#sePairLegendTitleFontSize","18");
  await page.selectOption("#sePairLegendTitleStyle","bold");
  await page.locator("#sePairLegendTitleColor").evaluate(el=>{el.value="#55ccff";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.selectOption("#sePairLegendBoxMode","transparent");
  await page.locator("#sePairLegendBorderColor").evaluate(el=>{el.value="#ffcc00";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.fill("#sePairLegendBorderThickness","3");

  let pair=page.locator("#sePairProbLegend");
  if(((await pair.locator(".se-legend-drag-handle strong").textContent())||"").trim()!=="Pairing confidence")throw new Error("Base-pair probability title did not update.");
  const pairStyle=await pair.evaluate(el=>{
    const title=getComputedStyle(el.querySelector(".se-legend-drag-handle strong")),box=getComputedStyle(el);
    return {fontSize:title.fontSize,fontWeight:title.fontWeight,color:title.color,borderWidth:box.borderTopWidth,borderStyle:box.borderTopStyle,background:box.backgroundColor,className:el.className};
  });
  if(pairStyle.fontSize!=="18px"||!pairStyle.className.includes("legend-transparent")||pairStyle.borderWidth!=="3px"||pairStyle.borderStyle==="none"||pairStyle.background!=="rgba(0, 0, 0, 0)")
    throw new Error("Base-pair probability title/box styling did not apply: "+JSON.stringify(pairStyle));

  const before=await pair.boundingBox();
  const handle=pair.locator(".se-legend-drag-handle");
  const hb=await handle.boundingBox();
  if(!before||!hb)throw new Error("Could not measure draggable base-pair probability color bar.");
  await page.mouse.move(hb.x+10,hb.y+8);
  await page.mouse.down();
  await page.mouse.move(hb.x+55,hb.y+38,{steps:5});
  await page.mouse.up();
  const after=await pair.boundingBox();
  if(!after||Math.abs(after.x-before.x)<15||Math.abs(after.y-before.y)<10)throw new Error("Color bar was not draggable after title/container edits.");

  const project=await page.evaluate(()=>ProjectSession.getProjectSnapshot());
  if(project.secondary.legendSettings.heat.title!=="DMS reactivity"||project.secondary.legendSettings.pair.title!=="Pairing confidence")
    throw new Error("Project session did not preserve both edited color-bar titles.");
  if(project.secondary.legendSettings.heat.boxMode!=="none"||project.secondary.legendSettings.pair.boxMode!=="transparent")
    throw new Error("Project session did not preserve both color-bar box settings.");

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Secondary browser runtime errors:\n"+serious.join("\n"));
  console.log("PASS: secondary color-bar title, box styling, drag, and project-state smoke test");
} finally {
  await browser.close();
}
