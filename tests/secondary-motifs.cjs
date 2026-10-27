const assert=require("node:assert/strict");
const fs=require("node:fs");
const script=fs.readFileSync(__dirname+"/../secondary-motifs.js","utf8");
// Keep DOM-dependent setup dormant while exercising the same real parser shipped to browsers.
const fakeDocument={readyState:"loading",addEventListener(){}};
const tools=new Function("document",script+"\nreturn SecondaryMotifExplorer;")(fakeDocument);
const identify=tools.identify;
const example=(sequence,structure,type,size,indices)=>{
 const found=identify(sequence,structure);
 const hit=found.find(m=>m.type===type&&m.size===size);
 assert.ok(hit,"missing "+type+" motif of size "+size+" from "+structure);
 assert.deepEqual(hit.indices,indices,"wrong loop residues for "+type+" in "+structure);
};
example("AAAAA","(...)","hairpin",3,[1,2,3]);
example("AAAAAA","(....)","hairpin",4,[1,2,3,4]);
example("AAAAAAA","(.(..))","bulge",1,[1]);
example("AAAAAAAA","((..).)","bulge",1,[5]);
example("AAAAAAAA","(.(..).)","internal",2,[1,6]);
example("AAAAAAAAAAAAA","((..)(..)....)","junction",4,[9,10,11,12]);
assert.equal(identify("AAAA","(())").filter(m=>m.type==="hairpin").length,0,"fully stacked pairs are not hairpin loops");
assert.deepEqual(identify("AAA","(()"),[],"unbalanced brackets should be rejected");
assert.deepEqual(identify("AAAA","([)]"),[],"unsupported pseudoknot notation should be rejected");
assert.deepEqual(identify("AAA","(...)"),[],"sequence and bracket lengths must match");
// Nested pairs must be classified by immediate child branches, not all internal pairs.
const nested=identify("AAAAAAAA","(.(..).)");
assert.equal(nested.filter(m=>m.type==="internal").length,1);
assert.equal(nested.filter(m=>m.type==="hairpin").length,1);
console.log("PASS: motif parser handles hairpins, bulges, internal loops, junctions, and invalid data");
