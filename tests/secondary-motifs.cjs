const assert=require("node:assert/strict");
const fs=require("node:fs");
const src=fs.readFileSync(__dirname+"/../secondary-motifs.js","utf8");
const api=new Function("document",src+"\nreturn SecondaryMotifExplorer;")({readyState:"loading",addEventListener(){}});
const identify=api.identify;
const ex=(dot,type,size,indices)=>{
 const m=identify("A".repeat(dot.length),dot).find(x=>x.type===type&&x.size===size);
 assert.ok(m,"Missing "+type+" ("+size+") in "+dot);
 assert.deepEqual(m.indices,indices,"Incorrect highlighted residues for "+type);
 return m;
};
// Hairpin includes only its own closing pair and loop; hairpin loop has no pair.
assert.deepEqual(ex("(...)","hairpin",3,[0,1,2,3,4]).pairs,[[0,4]]);
assert.deepEqual(ex("(...)","hairpinLoop",3,[1,2,3]).pairs,[]);
assert.deepEqual(ex("(((....)))","hairpin",4,[2,3,4,5,6,7]).pairs,[[2,7]]);
ex("(((....)))","hairpinLoop",4,[3,4,5,6]);
// Stem is maximal and requires >=3 consecutive base pairs, even if it ends in a hairpin.
assert.deepEqual(ex("(((....)))","stem",3,[0,1,2,7,8,9]).pairs,[[0,9],[1,8],[2,7]]);
assert.equal(identify("A".repeat(8),"((....))").some(x=>x.type==="stem"),false,"Two base pairs are not a stem");
assert.equal(identify("A".repeat(7),"((...))").filter(x=>x.type==="stem").length,0);
assert.equal(identify("A".repeat(11),"(((.....)))").filter(x=>x.type==="stem").length,1);
// Bulge and internal loops use only their unpaired residues.
ex("(.(..))","bulge",1,[1]);
ex("((..).)","bulge",1,[5]);
ex("(.(..).)","internal",2,[1,6]);
// Multibranch junction marks closing-pair boundary and unpaired loop; not stems.
const junction=ex("((..)(..)....)","junction",4,[0,1,4,5,8,9,10,11,12,13]);
assert.equal(junction.pairs.length,3);
const trna="(((((((..((((........)))).(((((.......))))).....(((((.......))))))))))))....";
const counts=Object.fromEntries(["stem","hairpin","hairpinLoop","internal","bulge","junction"].map(t=>[t,identify("A".repeat(trna.length),trna).filter(x=>x.type===t).length]));
assert.deepEqual(counts,{stem:4,hairpin:3,hairpinLoop:3,internal:0,bulge:0,junction:1});
assert.deepEqual(identify("AAA","(()"),[],"Unbalanced notation");
assert.deepEqual(identify("AAAA","([)]"),[],"Unsupported notation");
assert.deepEqual(identify("AAA","(...)"),[],"Sequence/structure mismatch");
console.log("PASS: six classes, exact hairpin boundaries, all four tRNA stems, motif counts, invalid input");
