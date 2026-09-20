const fs=require("node:fs");
const assert=require("node:assert/strict");
const source=fs.readFileSync("chemistry-editor.js","utf8");
const api=new Function(source+"\nreturn MoleculeEditor;")();
for(const base of ["A","G","C","U"]){
  const graph=api.getBaseGraph(base);
  assert(graph.atoms.length>=8,base+" template has atoms");
  assert(graph.bonds.length>=8,base+" template has bonds");
}
assert.equal(api.pairTemplate("GC","G","C").hbonds.length,3,"G-C WCF has three guide H-bonds");
assert.equal(api.pairTemplate("GC","C","G").hbonds.length,3,"C-G reverse orientation is supported");
assert.equal(api.pairTemplate("AU","A","U").hbonds.length,2,"A-U WCF has two guide H-bonds");
assert.equal(api.pairTemplate("AU","U","A").hbonds.length,2,"U-A reverse orientation is supported");
assert.equal(api.pairTemplate("GU","G","U").hbonds.length,2,"G-U wobble has two guide H-bonds");
assert.equal(api.pairTemplate("GU","U","G").hbonds.length,2,"U-G reverse orientation is supported");
for(const phrase of ["Add atom","Add bond","H-bond","Delete","Charge −","Charge +","Single","Double","Triple"]){
  assert(source.includes(phrase),"Editor exposes "+phrase);
}
console.log("PASS: molecular editor templates and editing tools.");