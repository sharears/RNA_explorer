/* RNA Explorer: optional motif highlighting and loop-identification practice.
   Identify motifs from dot-bracket topology, not from the drawing's positions.
   For hairpins, bulges, and internal loops, targets are unpaired loop residues. */
const SecondaryMotifExplorer=(()=>{
"use strict";
const PINK="#ff1493",TYPES=[
 {id:"hairpin",label:"Hairpin loops",one:"hairpin loop"},
 {id:"bulge",label:"Bulges",one:"bulge"},
 {id:"internal",label:"Internal loops",one:"internal loop"},
 {id:"junction",label:"Multibranch junctions",one:"multibranch junction"}
],$=id=>document.getElementById(id),range=(a,b)=>Array.from({length:Math.max(0,b-a)},(_,i)=>a+i);
let motifs=[],signature="",shown=null,challenge=false,kind="hairpin",size="any",answer=[],solved=false;
function identify(sequence,dot){
 if(typeof sequence!=="string"||typeof dot!=="string"||sequence.length!==dot.length||!/^[ACGU]+$/.test(sequence))return [];
 const stack=[],roots=[];
 for(let i=0;i<dot.length;i++){
  if(dot[i]==="("){const n={i,j:-1,children:[]};if(stack.length)stack[stack.length-1].children.push(n);else roots.push(n);stack.push(n);}
  else if(dot[i]===")"){if(!stack.length)return [];stack.pop().j=i;}
  else if(dot[i]!==".")return [];
 }
 if(stack.length)return [];
 const out=[];
 const add=(type,n,indices,loopSize=indices.length)=>{if(indices.length)out.push({type,start:n.i,end:n.j,indices,size:loopSize});};
 function visit(n){
  if(!n.children.length)add("hairpin",n,range(n.i+1,n.j));
  else{
   let cursor=n.i+1;const gaps=[];
   n.children.forEach(c=>{gaps.push(range(cursor,c.i));cursor=c.j+1;});gaps.push(range(cursor,n.j));
   if(n.children.length===1){
    if(gaps[0].length&&gaps[1].length)add("internal",n,[...gaps[0],...gaps[1]]);
    else if(gaps[0].length||gaps[1].length)add("bulge",n,[...gaps[0],...gaps[1]]);
   }else{
    const loop=gaps.flat();
    // Junctions with zero unpaired bases are shown using closing-pair boundaries.
    const indices=loop.length?loop:[n.i,n.j,...n.children.flatMap(c=>[c.i,c.j])];
    add("junction",n,[...new Set(indices)],loop.length);
   }
  }
  n.children.forEach(visit);
 }
 roots.forEach(visit);return out.sort((a,b)=>a.start-b.start||a.end-b.end);
}
const matching=type=>motifs.filter(m=>m.type===type);
const candidates=()=>matching(kind).filter(m=>size==="any"||m.size===Number(size));
const typeName=type=>TYPES.find(t=>t.id===type)?.one||type;
function setStatus(message,level="info"){const el=$("seMotifStatus");if(el){el.textContent=message;el.dataset.level=level;}}
function selected(){return SecondaryExplorer.getContext?.().selectedResidues||[];}
function paint(){
 const svg=$("secondarySvg");if(!svg)return;
 svg.querySelectorAll(".se-motif-ring").forEach(el=>el.remove());
 const indices=challenge?answer:shown?[...new Set(matching(shown).flatMap(m=>m.indices))]:[];
 indices.forEach(i=>{
  const node=svg.querySelector('[data-residue-index="'+i+'"]');if(!node)return;
  const ring=document.createElementNS("http://www.w3.org/2000/svg","circle");
  ring.setAttribute("class","se-motif-ring");ring.setAttribute("r","23");ring.setAttribute("fill","none");
  ring.setAttribute("stroke",PINK);ring.setAttribute("stroke-width","5");
  ring.setAttribute("pointer-events","none");ring.setAttribute("data-export-remove","");
  node.insertBefore(ring,node.firstChild);
 });
}
function sizes(){
 const select=$("seMotifSize");if(!select)return;
 const found=[...new Set(matching(kind).map(m=>m.size))].sort((a,b)=>a-b);
 const all=[...new Set([...(kind==="hairpin"?[3,4]:[]),...found])].sort((a,b)=>a-b);
 select.replaceChildren(new Option("Any loop size","any"));
 all.forEach(n=>{const item=new Option(n+" unpaired nucleotide"+(n===1?"":"s"),String(n));item.disabled=!found.includes(n);select.append(item);});
 if(size!=="any"&&!found.includes(Number(size)))size="any";
 select.value=size;select.disabled=!found.length;
}
function controls(){
 TYPES.forEach(t=>{
  const button=$("seMotifShow-"+t.id);if(!button)return;
  const count=matching(t.id).length;button.textContent="Show "+t.label+" ("+count+")";
  button.disabled=!count;button.setAttribute("aria-pressed",String(!challenge&&shown===t.id));
 });
 const clear=$("seMotifClear");if(clear)clear.disabled=!shown;
 const types=$("seMotifType");
 if(types){
  [...types.options].forEach(o=>o.disabled=!matching(o.value).length);
  if(!matching(kind).length){kind=TYPES.find(t=>matching(t.id).length)?.id||"hairpin";size="any";}
  types.value=kind;types.disabled=!motifs.length;
 }
 sizes();
 if($("seMotifStart"))$("seMotifStart").disabled=!motifs.length;
 for(const id of ["seMotifCheck","seMotifReveal","seMotifStop"])if($(id))$(id).disabled=!challenge;
 if($("seMotifPractice"))$("seMotifPractice").classList.toggle("active",challenge);
 if($("scene-secondary"))$("scene-secondary").dataset.motifChallenge=String(challenge);
}
function refresh(){
 const context=SecondaryExplorer.getContext?.();if(!context)return;
 const next=context.sequence+"|"+context.structure;
 if(signature!==next){
  signature=next;motifs=identify(context.sequence,context.structure);
  shown=null;challenge=false;solved=false;answer=[];controls();
  setStatus(motifs.length?"Found: "+TYPES.map(t=>matching(t.id).length+" "+t.label.toLowerCase()).join(" · ")+".":"No loop motifs recognized in this secondary structure.");
 }
 paint();
}
function show(type){
 if(!matching(type).length)return;
 const wasChallenge=challenge;challenge=false;shown=type;solved=false;answer=[];
 if(wasChallenge)SecondaryExplorer.clearHighlights();
 controls();paint();
 const sizes=[...new Set(matching(type).map(m=>m.size))].sort((a,b)=>a-b);
 setStatus(matching(type).length+" "+typeName(type)+(matching(type).length===1?"":"s")+" highlighted in hot pink. Unpaired loop sizes: "+sizes.join(", ")+".");
}
function stop(){
 const wasChallenge=challenge;challenge=false;shown=null;answer=[];solved=false;
 if(wasChallenge)SecondaryExplorer.clearHighlights();
 controls();paint();
 setStatus("Choose a motif to highlight or start another challenge.");
}
function start(){
 if(!candidates().length)return;
 shown=null;challenge=true;answer=[];solved=false;
 SecondarySelectionTools?.remember?.();SecondaryExplorer.clearHighlights();
 controls();paint();
 const phrase=size==="any"?"":" containing "+size+" unpaired nucleotide"+(size==="1"?"":"s");
 setStatus("Find a "+typeName(kind)+phrase+". Select only its unpaired loop residues using single clicks, box, or lasso, then press Check answer.");
}
function sameSet(a,b){return a.length===b.length&&new Set(a).size===a.length&&a.every(i=>b.includes(i));}
function check(){
 if(!challenge)return;
 const chosen=selected(),match=candidates().find(m=>sameSet(chosen,m.indices));
 if(match){solved=true;answer=match.indices.slice();paint();setStatus("Correct! "+typeName(kind)+" with "+match.size+" unpaired nucleotide"+(match.size===1?"":"s")+".","success");}
 else{solved=false;answer=[];paint();setStatus(chosen.length?"Not quite: "+chosen.length+" residues selected. Select exactly the loop residues and try again.":"Select loop residues first, then check your answer.","error");}
}
function reveal(){
 if(!challenge||!candidates().length)return;
 answer=candidates()[0].indices.slice();paint();
 setStatus("One correct "+typeName(kind)+" is outlined in hot pink. Other motifs of the same size may also be valid.");
}
function toggleResidue(event){
 if(!challenge||event.defaultPrevented||SecondarySelectionTools?.isRegionMode?.())return;
 if(event.type==="keydown"&&!["Enter"," "].includes(event.key))return;
 if(event.type==="click"&&event.button!==0)return;
 if(event.target.closest?.("[data-index-label]"))return;
 const node=event.target.closest?.("[data-residue-index]");
 if(!node||!$("secondarySvg")?.contains(node))return;
 event.preventDefault();event.stopImmediatePropagation();
 const i=Number(node.dataset.residueIndex);if(!Number.isInteger(i))return;
 const next=new Set(selected());if(next.has(i))next.delete(i);else next.add(i);
 SecondarySelectionTools?.remember?.();answer=[];solved=false;
 SecondaryExplorer.highlightResidues([...next]);
 SecondarySelectionTools?.syncSelectionState?.();
 setStatus(next.size+" nucleotide"+(next.size===1?"":"s")+" selected. Check answer when ready.");
}
function setup(){
 const panel=document.querySelector('#scene-secondary .rna-tool-panel[data-rna-panel="analyze"]'),svg=$("secondarySvg");
 if(!panel||!svg||$("seMotifTools"))return;
 const style=document.createElement("style");style.id="seMotifStyles";
 style.textContent=[
  '#seMotifTools{margin:0 0 .7rem;min-width:0}',
  '#seMotifTools>summary{color:var(--mint);font-weight:750}',
  '#seMotifTools h4{margin:.8rem 0 .3rem;color:var(--cream);font-size:.88rem}',
  '#seMotifTools p{margin:.35rem 0 .65rem;line-height:1.5;font-size:.8rem}',
  '.se-motif-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.35rem}',
  '#seMotifTools button{min-width:0;overflow-wrap:anywhere}',
  '#seMotifTools button:disabled{opacity:.38;cursor:not-allowed;color:#87909b}',
  '#seMotifTools button[aria-pressed="true"]{color:#ff8ec8!important;border-color:#ff1493!important;background:rgba(255,20,147,.12)}',
  '#seMotifTools label{display:grid;gap:.3rem;align-items:start;justify-content:stretch}',
  '#seMotifTools select{width:100%}',
  '.se-motif-actions{display:flex;flex-wrap:wrap;gap:.35rem;margin:.6rem 0}',
  '.se-motif-actions button{flex:1 1 90px}',
  '#seMotifPractice{margin-top:.75rem;padding:.6rem;border:1px solid var(--line);border-radius:8px}',
  '#seMotifPractice.active{border-color:#ff1493}',
  '#seMotifStatus{min-height:2.8em;overflow-wrap:anywhere}',
  '#seMotifStatus[data-level="success"]{color:#74d7b6}',
  '#seMotifStatus[data-level="error"]{color:#ffc1c1}',
  '#scene-secondary[data-motif-challenge="true"] .se-node.multi-selected>circle:first-child{stroke:#ff1493!important;stroke-width:4!important}',
  '.se-motif-ring{filter:drop-shadow(0 0 5px rgba(255,20,147,.65))}'
 ].join("\n");document.head.append(style);
 const block=document.createElement("details");block.id="seMotifTools";block.open=true;
 block.innerHTML=[
 '<summary>Learn · Identify RNA motifs</summary>',
 '<p>Motifs are identified from dot-bracket pairing topology. Pink rings mark the unpaired loop nucleotides.</p>',
 '<h4>Show structural motifs</h4>',
 '<div class="se-motif-grid" id="seMotifButtons"></div>',
 '<button id="seMotifClear" type="button">Clear motif highlights</button>',
 '<section id="seMotifPractice"><h4>Practice · Find the motif</h4>',
 '<p>Choose a motif and size. Unavailable choices are gray and disabled.</p>',
 '<label>Motif type<select id="seMotifType"></select></label>',
 '<label>Loop size<select id="seMotifSize"></select></label>',
 '<div class="se-motif-actions">',
 '<button id="seMotifStart" type="button">Start challenge</button>',
 '<button id="seMotifCheck" type="button" disabled>Check answer</button>',
 '<button id="seMotifReveal" type="button" disabled>Show answer</button>',
 '<button id="seMotifStop" type="button" disabled>Stop</button></div>',
 '<p>During practice, click nucleotides to add or remove them. Box and lasso selection also work through the Select tab.</p>',
 '</section><p id="seMotifStatus" role="status" aria-live="polite"></p>'
 ].join("");panel.prepend(block);
 TYPES.forEach(t=>{
  const button=document.createElement("button");button.id="seMotifShow-"+t.id;button.type="button";button.setAttribute("aria-pressed","false");
  button.addEventListener("click",()=>show(t.id));$("seMotifButtons").append(button);
  $("seMotifType").append(new Option(t.label,t.id));
 });
 $("seMotifClear").addEventListener("click",()=>{shown=null;controls();paint();setStatus("Motif highlights cleared.");});
 $("seMotifType").addEventListener("change",e=>{kind=e.target.value;size="any";stop();});
 $("seMotifSize").addEventListener("change",e=>{size=e.target.value;if(challenge)stop();});
 $("seMotifStart").addEventListener("click",start);
 $("seMotifCheck").addEventListener("click",check);
 $("seMotifReveal").addEventListener("click",reveal);
 $("seMotifStop").addEventListener("click",stop);
 // The native editor selects on pointer-down, before click. In a challenge,
 // block only that native selection, allowing our additive click handler to run.
 svg.addEventListener("pointerdown",event=>{
  if(!challenge||SecondarySelectionTools?.isRegionMode?.()||event.button!==0)return;
  if(event.target.closest?.("[data-index-label]"))return;
  if(event.target.closest?.(".se-node"))event.stopImmediatePropagation();
 },true);
 svg.addEventListener("click",toggleResidue,true);svg.addEventListener("keydown",toggleResidue,true);
 window.addEventListener("rna-secondary-layout",refresh);window.addEventListener("rna-secondary-context",refresh);refresh();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});else setup();
return {identify,getMotifs:()=>motifs.slice(),isChallengeActive:()=>challenge};
})();
