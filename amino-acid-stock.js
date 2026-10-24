/* Editable neutral free-amino-acid templates. Structural connectivity, not absolute stereochemistry.
   Implicit H is handled by Molecular Drawing's atom/bond editor. */
const AminoAcidStock=(()=>{
  const catalog={
    ALA:["Alanine","A", [["CB","C",0,1]],[]],
    ARG:["Arginine","R", [["CB","C",0,1],["CG","C",0,2],["CD","C",0,3],["NE","N",0,4],["CZ","C",0,5],["NH1","N",-1,6],["NH2","N",1,6]],[["NE","CZ",1],["CZ","NH1",2],["CZ","NH2",1]]],
    ASN:["Asparagine","N", [["CB","C",0,1],["CG","C",0,2],["OD1","O",-1,3],["ND2","N",1,3]],[["CG","OD1",2],["CG","ND2",1]]],
    ASP:["Aspartic acid","D", [["CB","C",0,1],["CG","C",0,2],["OD1","O",-1,3],["OD2","O",1,3]],[["CG","OD1",2],["CG","OD2",1]]],
    CYS:["Cysteine","C", [["CB","C",0,1],["SG","S",0,2]],[]],
    GLN:["Glutamine","Q", [["CB","C",0,1],["CG","C",0,2],["CD","C",0,3],["OE1","O",-1,4],["NE2","N",1,4]],[["CD","OE1",2],["CD","NE2",1]]],
    GLU:["Glutamic acid","E", [["CB","C",0,1],["CG","C",0,2],["CD","C",0,3],["OE1","O",-1,4],["OE2","O",1,4]],[["CD","OE1",2],["CD","OE2",1]]],
    GLY:["Glycine","G", [],[]],
    HIS:["Histidine","H", [["CB","C",0,1],["CG","C",0,2],["ND1","N",.9,2.65],["CE1","C",.55,3.55],["NE2","N",-.55,3.55],["CD2","C",-.9,2.65]],[["CG","ND1",1],["ND1","CE1",2],["CE1","NE2",1],["NE2","CD2",1],["CD2","CG",2]]],
    ILE:["Isoleucine","I", [["CB","C",0,1],["CG1","C",-1,2],["CG2","C",1,2],["CD1","C",-1,3]],[]],
    LEU:["Leucine","L", [["CB","C",0,1],["CG","C",0,2],["CD1","C",-1,3],["CD2","C",1,3]],[]],
    LYS:["Lysine","K", [["CB","C",0,1],["CG","C",0,2],["CD","C",0,3],["CE","C",0,4],["NZ","N",0,5]],[]],
    MET:["Methionine","M", [["CB","C",0,1],["CG","C",0,2],["SD","S",0,3],["CE","C",0,4]],[]],
    PHE:["Phenylalanine","F", [["CB","C",0,1],["CG","C",0,2],["CD1","C",.95,2.55],["CE1","C",.95,3.55],["CZ","C",0,4.1],["CE2","C",-.95,3.55],["CD2","C",-.95,2.55]],[["CG","CD1",1],["CD1","CE1",2],["CE1","CZ",1],["CZ","CE2",2],["CE2","CD2",1],["CD2","CG",2]]],
    PRO:["Proline","P", [["CB","C",0,1],["CG","C",-1,1.8],["CD","C",-1.3,.65]],[["CD","N",1]]],
    SER:["Serine","S", [["CB","C",0,1],["OG","O",0,2]],[]],
    THR:["Threonine","T", [["CB","C",0,1],["OG1","O",-1,2],["CG2","C",1,2]],[]],
    TRP:["Tryptophan","W", [["CB","C",0,1],["CG","C",0,2],["CD1","C",.9,2.7],["NE1","N",.55,3.6],["CE2","C",-.55,3.6],["CD2","C",-.95,2.7],["CE3","C",-1.95,2.25],["CZ3","C",-2.85,2.9],["CH2","C",-2.75,3.9],["CZ2","C",-1.7,4.25]],[["CG","CD1",2],["CD1","NE1",1],["NE1","CE2",1],["CE2","CD2",2],["CD2","CG",1],["CD2","CE3",1],["CE3","CZ3",2],["CZ3","CH2",1],["CH2","CZ2",2],["CZ2","CE2",1]]],
    TYR:["Tyrosine","Y", [["CB","C",0,1],["CG","C",0,2],["CD1","C",.95,2.55],["CE1","C",.95,3.55],["CZ","C",0,4.1],["CE2","C",-.95,3.55],["CD2","C",-.95,2.55],["OH","O",0,5.15]],[["CG","CD1",1],["CD1","CE1",2],["CE1","CZ",1],["CZ","CE2",2],["CE2","CD2",1],["CD2","CG",2],["CZ","OH",1]]],
    VAL:["Valine","V", [["CB","C",0,1],["CG1","C",-1,2],["CG2","C",1,2]],[]]
  };
  // Side-chain atoms are y-positive from the alpha carbon; 70 px per bond.
  const backbone=[["N","N",-1,-.65],["CA","C",0,0],["C","C",1,-.65],["O","O",2,-.65],["OXT","O",1,-1.7]];
  const backboneBonds=[["N","CA",1],["CA","C",1],["C","O",2],["C","OXT",1]];
  const parent={
    CB:"CA",CG:"CB",SG:"CB",OG:"CB",OG1:"CB",CG1:"CB",CG2:"CB",
    CD:"CG",CD1:"CG",CD2:"CG",OD1:"CG",OD2:"CG",ND2:"CG",
    SD:"CG",NE:"CD",CE:"CD",CE1:"CD1",CE2:"CD2",CZ:"NE",NZ:"CE",
    OE1:"CD",OE2:"CD",NH1:"CZ",NH2:"CZ",
    OH:"CZ"
  };
  const coordinates=(name,element,x,y)=>({id:name,element,x:310+x*68,y:165+y*68,charge:0,label:name});
  function getGraph(code){
    const entry=catalog[String(code||"").toUpperCase()];
    if(!entry)throw Error("Unknown amino-acid stock structure: "+code);
    const [name,letter,side,extra]=entry;
    const atoms=backbone.map(([name,element,x,y])=>coordinates(name,element,x,y));
    side.forEach(([name,element,x,y])=>atoms.push(coordinates(name,element,x,y)));
    const bonds=backboneBonds.map(([a,b,order])=>({a,b,order}));
    const add=(a,b,order=1)=>{if(!bonds.some(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a)))bonds.push({a,b,order});};
    const explicit=new Set(extra.map(([a,b])=>a+":"+b));
    side.forEach(([atom])=>{
      const p=parent[atom];
      if(p&&!extra.some(([a,b])=>a===atom&&b===p||a===p&&b===atom))add(p,atom);
    });
    extra.forEach(([a,b,order])=>add(a,b,order));
    // In a ring, assigning an automatic parent to every ring atom would add a
    // spurious chord. Remove parent connections not present in the ring cycle.
    const aromaticCodes=new Set(["PHE","TYR","HIS","TRP"]);
    if(aromaticCodes.has(code)){
      const ringAtoms=new Set(side.filter(([n])=>!["CB","OH"].includes(n)).map(([n])=>n));
      const explicitEdges=new Set(extra.map(([a,b])=>[a,b].sort().join(":")));
      for(let i=bonds.length-1;i>=0;i--){
        const b=bonds[i],pair=[b.a,b.b].sort().join(":");
        if(ringAtoms.has(b.a)&&ringAtoms.has(b.b)&&!explicitEdges.has(pair))bonds.splice(i,1);
      }
    }
    // Valence-safe pyrrolidine ring in proline: CA–CB–CG–CD–N.
    if(code==="PRO")add("CB","CG"),add("CG","CD");
    const ids=new Set(atoms.map(a=>a.id));
    if(bonds.some(b=>!ids.has(b.a)||!ids.has(b.b)))throw Error("Invalid "+name+" stock connectivity");
    return {name,code:letter,atoms,bonds:bonds.map((b,i)=>({...b,id:"b"+i})),hbonds:[],iupac:null};
  }
  const list=()=>Object.entries(catalog).map(([code,[name]])=>({code,name}));
  return{getGraph,list};
})();
