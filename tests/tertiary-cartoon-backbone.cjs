// Run with: node tests/tertiary-cartoon-backbone.cjs
// Geometry-only regression: no network, 3D renderer, or browser required.
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","tertiary.js"),"utf8");
const explorer=vm.runInNewContext(source+"\nTertiaryExplorer;",{console});
assert.equal(typeof explorer.cartoonBackboneRuns,"function");
const atom=(atom,x)=>({atom,x,y:0,z:0});
const residue=(i)=>({resi:i+1,chain:"A",icode:"",atoms:[
  atom("C4'",i*6),atom("O3'",i*6+2),atom("P",i*6-2)
]});
const baseline=Array.from({length:5},(_,i)=>residue(i));
const clone=value=>JSON.parse(JSON.stringify(value));
const runs=(residues,visible)=>explorer.cartoonBackboneRuns(residues,visible);
const lengths=rs=>rs.map(run=>run.length).join(",");
assert.equal(lengths(runs(baseline)),"5","Covalently continuous RNA should form one trace");
const missingP=clone(baseline);missingP[2].atoms=missingP[2].atoms.filter(a=>a.atom!=="P");
assert.equal(lengths(runs(missingP)),"2,3","Missing P cannot be bridged");
const missingO3=clone(baseline);missingO3[1].atoms=missingO3[1].atoms.filter(a=>a.atom!=="O3'");
assert.equal(lengths(runs(missingO3)),"2,3","Missing O3' must split the trace into two valid runs");
const wide=clone(baseline);wide[3].atoms.find(a=>a.atom==="P").x+=30;
assert.equal(lengths(runs(wide)),"3,2","Large O3'-P gap must not be bridged");
const chain=clone(baseline);chain[3].chain="B";
assert.equal(lengths(runs(chain)),"3","Separate chains must not be linked");
const numbering=clone(baseline);numbering[2].resi=100;
assert.equal(lengths(runs(numbering)),"2,2","Numbering gaps are not interpolated");
const hidden=runs(baseline,i=>i<3);
assert.equal(lengths(hidden),"3","Isolated/hidden RNA may not be bridged");
const alternate=clone(baseline);
alternate[2].atoms.forEach(a=>a.atom=a.atom.replaceAll("'","*"));
assert.equal(lengths(runs(alternate)),"5","C4*/O3* legacy RNA atom names are supported");
console.log("PASS: Cartoon RNA backbone bridges only chemically validated consecutive residues.");
