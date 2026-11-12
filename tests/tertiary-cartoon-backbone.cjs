// Run with: node tests/tertiary-cartoon-backbone.cjs
// Native 3Dmol.js cartoon compatibility regression; no browser/network required.
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","tertiary.js"),"utf8");
const explorer=vm.runInNewContext(source+"\nTertiaryExplorer;",{console});
assert.equal(typeof explorer.withCanonicalCartoonResidues,"function");
assert.ok(!source.includes("viewer.addCurve({points"),"No additional cartoon backbone wire");
assert.ok(!source.includes("addCartoonBackboneTrace"),"Previous parallel trace was removed");
assert.ok(source.includes("installNativeCartoonCompatibility()"),"Native renderer is patched for canonical-name recognition");
const atom=(resn,hetflag,atom="P")=>({resn,hetflag,atom,x:10,y:12,z:14});
const residues=[
  {chain:"A",resi:1,icode:"",resn:"A",atoms:[atom("A",false)]},
  {chain:"A",resi:2,icode:"",resn:"PSU",atoms:[atom("PSU",true),atom("PSU",true,"C4'")]},
  {chain:"A",resi:3,icode:"",resn:"1MA",atoms:[atom("1MA",true)]},
  {chain:"A",resi:4,icode:"",resn:"5MC",atoms:[atom("5MC",true)]},
  {chain:"A",resi:5,icode:"",resn:"UNX",atoms:[atom("UNX",true)]}
];
const before=JSON.stringify(residues);
let count=0;
const result=explorer.withCanonicalCartoonResidues(residues,n=>{
  count=n;
  assert.equal(residues[0].atoms[0].resn,"A");
  assert.equal(residues[1].atoms[0].resn,"U","Pseudouridine must be recognized as RNA in cartoon");
  assert.equal(residues[2].atoms[0].resn,"A","Methyladenosine must be recognized as RNA in cartoon");
  assert.equal(residues[3].atoms[0].resn,"C","Methylcytidine must be recognized as RNA in cartoon");
  assert.equal(residues[4].atoms[0].resn,"UNX","Unknown modifications cannot be assigned an invented base");
  assert.equal(residues[1].atoms[0].hetflag,false,"Known nucleotide no longer stops native ribbon");
  assert.equal(residues[4].atoms[0].hetflag,true,"Unknown component remains HETATM");
  return "rendered";
});
assert.equal(result,"rendered");
assert.equal(count,3,"Exactly three modified nucleotide residues normalized");
assert.equal(JSON.stringify(residues),before,"Original residue names and flags restored after rendering");
assert.throws(()=>explorer.withCanonicalCartoonResidues(residues,()=>{throw Error("GPU failure");}),/GPU failure/);
assert.equal(JSON.stringify(residues),before,"Original chemical metadata restored even when rendering throws");
console.log("PASS: Native RNA cartoon recognizes modified nucleotides without overlay or lasting atom mutation.");
