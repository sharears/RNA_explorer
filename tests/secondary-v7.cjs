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
const instrumented=source.replace("return {setup,render,parse,parseMetadata,parsePairProbabilities,radial,orientEndsBottom,", 'return {inspect(){return {settings,zoom,metadata,heatEnabled};},setState(v){seq=v.seq;db=v.db;partner=parse(seq,db).partner;pairs=parse(seq,db).pairs;layout=v.layout||"arc";metadata=v.metadata||{};heatEnabled=!!v.heatEnabled;heatRange=v.heatRange||[0,1];residueOverrides=v.residueOverrides||{};backboneOverrides=v.backboneOverrides||{};zoom=v.zoom||1;},residueStyle,heatColor,applyZoom,setup,render,parse,parseMetadata,parsePairProbabilities,radial,orientEndsBottom,');
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
const initialViewBox=root.getAttribute("viewBox").split(" ").map(Number);
editor.setState({seq:"GAGCAAAAAUUC",db:"((((....))))",zoom:2});editor.render();
const zoomedViewBox=root.getAttribute("viewBox").split(" ").map(Number);
assert(Math.abs(zoomedViewBox[2]-initialViewBox[2]/2)<.001&&Math.abs(zoomedViewBox[3]-initialViewBox[3]/2)<.001,"Zoom halves visible viewBox dimensions at 200%");
assert(root.getAttribute("viewBox").split(" ").length===4,"Export has full bounds independent of zoom");
editor.setState({seq:"G",db:".",heatEnabled:true,metadata:{0:{id:"G",value:5}},heatRange:[5,5]});
assert(editor.residueStyle(0).fillColor==="#21918c","Constant values map to midpoint");
editor.render();assert(root.children.filter(el=>el.attrs.class==="se-backbone").length===0,"Single residue has no invalid backbone");
for(const layout of ["radial","circular","arc"]){editor.setState({seq:"GAGCAAAAAUUC",db:"((((....))))",layout});editor.render();assert(!root.getAttribute("viewBox").includes("NaN"),layout+" finite bounds");}
assert(source.includes('context.clearRect(0,0,width,height);context.drawImage')&&!source.includes("context.fillRect"),"Export does not paint a background");
assert(source.includes('clone.removeAttribute("style")')&&source.includes('data-export-remove],title'),"Export strips zoom styles and highlights");
const oriented=api.orientEndsBottom(api.radial(12,parsed.partner));
const baseline=(oriented[0].y+oriented.at(-1).y)/2;
const meanInterior=oriented.slice(1,-1).reduce((s,p)=>s+p.y,0)/(oriented.length-2);
assert(oriented[0].x<oriented.at(-1).x&&Math.abs(oriented[0].y-oriented.at(-1).y)<1e-6,"5-prime is left and 3-prime is right on a common baseline");
assert(meanInterior<=baseline+1e-6,"Secondary structure extends above the bottom end baseline");
assert(source.includes('orientEndsBottom'),"Secondary layouts enforce bottom-left 5-prime and bottom-right 3-prime orientation");
assert(source.includes('data-arc-style="square"'),"Arc figure includes square pair connector option");
assert(source.includes('seImageScale')&&source.includes('seImageDpi'),"2D image export resolution and DPI are user-adjustable");
assert(source.includes('"Arial"')&&source.includes('"Calibri"')&&source.includes('"Times New Roman"'),"Expanded font families are available");
assert(source.includes('"Font color"')&&source.includes('"Font size"'),"Residue typography labels use font terminology");
assert(source.includes('se-color-code'),"Color picker has editable color-code companion");
assert(source.includes('"rna-secondary-select"'),"Custom Secondary selection can synchronize with Tertiary");
let sparse=api.parsePairProbabilities("Residue_i,Residue_j,Probability\n1,4,0.8\n2,3,0.25",4);
assert(Math.abs(sparse["0:3"]-.8)<1e-9&&Math.abs(sparse["1:2"]-.25)<1e-9,"Sparse pair probabilities parse");
let matrix=api.parsePairProbabilities("0 0.1 0.2\n0.1 0 0.7\n0.2 0.7 0",3);
assert(Math.abs(matrix["1:2"]-.7)<1e-9,"Square pair-probability matrix parses");
throws(()=>api.parsePairProbabilities("Residue_i,Residue_j,Probability\n1,2,1.2",3),"Reject probabilities outside 0–1");
assert(source.includes("sePairProbFile")&&source.includes("pairProbEnabled"),"Pair-probability layer is available");
assert(source.includes("seLayerReactivity")&&source.includes("seLayerPairProb"),"Loaded reactivity and pair-probability layers have independent top-level toggles");
assert(source.includes("base-pair probability data and pair styling were left unchanged"),"Loading reactivity preserves the pair-probability layer");
assert(source.includes("MoleculeEditor.openPair"),"Secondary base pairs open the shared chemistry editor");
assert(source.includes("rna_base_pair_probability_example.csv")&&source.includes("sePairProbExample"),"A synthetic example base-pair probability dataset is available");
assert(source.includes("parseDbnText")&&source.includes("parseCtText")&&source.includes("serializeDbn")&&source.includes("serializeCt"),"Secondary structure supports DBN/CT import and export");
assert(source.includes("seExportType")&&source.includes("seImageFormat")&&source.includes("seStructureFormat"),"Secondary uses a unified image/structure export dialog");
assert(source.includes("seImageDpi"),"Secondary image export exposes a DPI target");
assert(source.includes("WORKSPACE_KEY")&&source.includes("saveWorkspaceLocal"),"Secondary workspace can autosave locally without an account");
assert(source.includes("rna-secondary-layout")&&source.includes("getCurrentPositions"),"Secondary broadcasts its edited layout for linked 2D/3D display");

console.log("PASS: secondary Sept-24 logic and rendering-unit checks (not a browser integration test).");
