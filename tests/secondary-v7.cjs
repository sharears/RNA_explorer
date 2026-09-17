// Run from repository root: node tests/secondary-v7.cjs
const source=require("node:fs").readFileSync("secondary.js","utf8");

function assert(condition,message){if(!condition)throw Error(message);}
function throws(fn,message){let caught=false;try{fn();}catch{caught=true;}assert(caught,message);}
const header="Residue_Index,Residue_ID,Residue_Information\n";
const api=new Function(source+"\nreturn SecondaryExplorer;")();
let data=api.parseMetadata("\uFEFF"+header+'1,"G, first",1.5\r\n2,A,NA\r\n3,U,-2e-1\r\n',3);
assert(data[0].id==="G, first"&&data[0].value===1.5&&data[1].value===null&&data[2].value===-.2,"CSV quoted fields/missing/scientific values");
for(const bad of ["1,G,Infinity","0,G,1","4,G,1","1,G,abc","1,G,1\n1,A,2",'1,"broken,1',"1,G,NA","1,G,0x10"])throws(()=>api.parseMetadata(header+bad,3),"Reject "+bad);
throws(()=>api.parseMetadata("wrong,headers,here\n1,G,1",3),"Validate headers");
assert(api.parseMetadata(header+'1,"G""one",1',1)[0].id==='G"one',"Escaped CSV quotes");
const parsed=api.parse("GAGCAAAAAUUC","((((....))))");
assert(parsed.pairs.length===4,"Dot-bracket parse");
assert(api.radial(12,parsed.partner).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),"Radial coordinates");

class Element{
 constructor(name){this.tagName=name;this.attrs={};this.style={};this.children=[];this.dataset={};this.value="";this.hidden=false;this.disabled=false;this.clientWidth=700;this.parentElement={clientWidth:700};}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 removeAttribute(k){delete this.attrs[k];}
 append(...els){this.children.push(...els);}
 replaceChildren(...els){this.children=[...els];}
 addEventListener(){}
 querySelectorAll(){return [];}
}
const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
const document={getElementById:get,createElementNS:(ns,name)=>new Element(name),createElement:name=>new Element(name),querySelectorAll:()=>[]};
const instrumented=source.replace("return {setup,render,parse,parseMetadata,radial,followDefault(index)",'return {inspect(){return {settings,zoom,metadata,heatEnabled};},setState(v){seq=v.seq;db=v.db;partner=parse(seq,db).partner;pairs=parse(seq,db).pairs;layout=v.layout||"arc";metadata=v.metadata||{};heatEnabled=!!v.heatEnabled;heatRange=v.heatRange||[0,1];residueOverrides=v.residueOverrides||{};backboneOverrides=v.backboneOverrides||{};zoom=v.zoom||1;},residueStyle,heatColor,applyZoom,setup,render,parse,parseMetadata,radial,followDefault(index)');
const editor=new Function("document",instrumented+"\nreturn SecondaryExplorer;")(document);
editor.setState({seq:"GAGCAAAAAUUC",db:"((((....))))",metadata:{0:{id:"G",value:0},1:{id:"A",value:1}},heatEnabled:true,residueOverrides:{1:{fillColor:"#abcdef",letterSize:23}},backboneOverrides:{0:{backColor:"#123456",backWidth:5}}});
editor.render();
const root=get("secondarySvg"),backbones=root.children.filter(el=>el.attrs.class==="se-backbone"),residues=root.children.filter(el=>el.attrs.class==="se-node");
assert(backbones.length===11,"Every consecutive residue has backbone");
assert(backbones[0].children[0].attrs.stroke==="#123456"&&backbones[0].children[0].attrs["stroke-width"]==="5","Selected backbone override");
assert(backbones[1].children[0].attrs.stroke==="#74d7b6","Other backbones retain default");
assert(Number(backbones[0].children[0].attrs.x2)-Number(backbones[0].children[0].attrs.x1)===56,"Arc gap leaves 24px visible connection");
assert(editor.residueStyle(0).fillColor==="#440154","Heatmap minimum");
assert(editor.residueStyle(1).fillColor==="#abcdef","Manual fill overrides heatmap");
assert(editor.residueStyle(2).fillColor==="#2f6b57","Missing value keeps base color");
assert(residues[1].children.find(e=>e.tagName==="text").attrs["font-size"]==="23","Selected font size");
const initialWidth=parseFloat(root.style.width);
editor.setState({seq:"GAGCAAAAAUUC",db:"((((....))))",zoom:2});editor.render();
assert(Math.abs(parseFloat(root.style.width)-initialWidth*2)<.001,"Zoom scales drawing");
assert(root.getAttribute("viewBox").split(" ").length===4,"Export has full bounds independent of zoom");
editor.setState({seq:"G",db:".",heatEnabled:true,metadata:{0:{id:"G",value:5}},heatRange:[5,5]});
assert(editor.residueStyle(0).fillColor==="#21918c","Constant values map to midpoint");
editor.render();assert(root.children.filter(el=>el.attrs.class==="se-backbone").length===0,"Single residue has no invalid backbone");
for(const layout of ["radial","circular","arc"]){editor.setState({seq:"GAGCAAAAAUUC",db:"((((....))))",layout});editor.render();assert(!root.getAttribute("viewBox").includes("NaN"),layout+" finite bounds");}
assert(source.includes('context.clearRect(0,0,width,height);context.drawImage')&&!source.includes("context.fillRect"),"Export does not paint a background");
assert(source.includes('clone.removeAttribute("style")')&&source.includes('data-export-remove],title'),"Export strips zoom styles and highlights");

console.log("PASS: secondary v7 logic and rendering-unit checks (not a browser integration test).");
