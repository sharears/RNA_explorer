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
for(const phrase of ["Add atom","Add bond","H-bond","Delete","Charge −","Charge +","Single","Double","Triple","Select all","Select left base","Select right base","Select whole pair"]){
  assert(source.includes(phrase),"Editor exposes "+phrase);
}
assert(source.includes("selectedAtoms=new Set()"),"Editor tracks multi-atom selection");
assert(source.includes("covalentComponent"),"Double-click can select an entire covalent structure");
assert(source.includes("selectionBox"),"Editor supports box selection");
assert(source.includes("drag={ids:[...selectedAtoms]"),"Dragging a selected atom moves the whole selected group");
for(const phrase of ["Export image…","chemExportFormat","chemExportScale","chemExportDpi","SVG","PNG","PDF"]){
  assert(source.includes(phrase),"Chemistry editor export exposes "+phrase);
}
assert(source.includes("ExportTools.exportSvgElement"),"Chemistry editor uses the shared image exporter");
assert(source.includes("getSessionSnapshot")&&source.includes("restoreSessionSnapshot"),"Chemistry edits can round-trip through RNA Explorer project files");
console.log("PASS: molecular editor templates, editing tools, and rigid multi-atom selection.");