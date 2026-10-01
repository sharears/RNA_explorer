const GuidedStructureTransitions = (() => {
  const state={secondaryReady:true,tertiaryReady:true,miniFeature:"glycosidic",yaw:-0.55,pitch:0.34,zoom:1,panX:0,panY:0,dragging:false,dragMode:"rotate",lastX:0,lastY:0,labelsOn:true,
    realPairKey:"gc",realPairModels:null,realLessonModels:null,realPairPromise:null};

  const PAIR_LESSONS={
    au:{
      title:"A–U Watson–Crick pair",
      copy:"Adenine and uracil can align their Watson–Crick edges and form two hydrogen bonds.",
      bonds:[["A N6–H","U O4"],["U N3–H","A N1"]],
      left:{name:"Adenine",kind:"purine",labels:[["N6–H",66,38],["N1",91,100]]},
      right:{name:"Uracil",kind:"pyrimidine",labels:[["O4",330,38],["N3–H",306,100]]}
    },
    gc:{
      title:"G–C Watson–Crick pair",
      copy:"Guanine and cytosine can form three hydrogen bonds through their Watson–Crick edges.",
      bonds:[["C N4–H","G O6"],["G N1–H","C N3"],["G N2–H","C O2"]],
      left:{name:"Guanine",kind:"purine",labels:[["O6",70,30],["N1–H",93,84],["N2–H",88,132]]},
      right:{name:"Cytosine",kind:"pyrimidine",labels:[["N4–H",330,30],["N3",307,84],["O2",312,132]]}
    },
    gu:{
      title:"G–U wobble pair",
      copy:"G–U is a common non-Watson–Crick pair in RNA. The bases shift relative to a standard Watson–Crick geometry and still form favorable hydrogen bonds.",
      bonds:[["U N3–H","G O6"],["G N1–H","U O2"]],
      left:{name:"Guanine",kind:"purine",labels:[["O6",70,44],["N1–H",94,105]]},
      right:{name:"Uracil",kind:"pyrimidine",labels:[["N3–H",307,44],["O2",310,105]]}
    }
  };

  const MINI_LESSONS={
    glycosidic:{
      title:"Glycosidic torsion χ",
      definition:"χ describes how the nucleobase is oriented relative to ribose around the glycosidic bond.",
      notice:"Follow the four highlighted atoms. The central C1′–N bond is the axis around which the base orientation changes.",
      points:[
        {id:"O4′",x:-1.8,y:.1,z:.2,c:"#87a9cc"},{id:"C1′",x:-.7,y:0,z:.4,c:"#ffffff"},
        {id:"N9",x:.55,y:.15,z:-.25,c:"#ffffff"},{id:"C4",x:1.7,y:.7,z:.15,c:"#f2c66d"},
        {id:"C2′",x:-1.1,y:-1,z:-.2,c:"#5d7080"},{id:"C8",x:1.2,y:-.55,z:.35,c:"#5d7080"}
      ],
      bonds:[["O4′","C1′"],["C1′","C2′"],["C1′","N9"],["N9","C4"],["N9","C8"],["C4","C8"]],
      highlight:["O4′","C1′","N9","C4"],guide:[["C1′","N9"]]
    },
    pucker:{
      title:"Sugar pucker",
      definition:"The five-membered ribose ring is not flat. Different ring atoms can lie above or below the average ring plane.",
      notice:"The complete nucleotide stays visible while the five ribose-ring atoms are highlighted. Rotate it edge-on to see that the sugar is puckered rather than flat.",
      points:[
        {id:"O4′",x:-1.25,y:.75,z:0,c:"#87a9cc"},{id:"C1′",x:.2,y:1.15,z:.38,c:"#ffffff"},
        {id:"C2′",x:1.25,y:.15,z:-.46,c:"#f2c66d"},{id:"C3′",x:.65,y:-1.1,z:.52,c:"#74d7b6"},
        {id:"C4′",x:-.9,y:-.85,z:-.12,c:"#ffffff"}
      ],
      bonds:[["O4′","C1′"],["C1′","C2′"],["C2′","C3′"],["C3′","C4′"],["C4′","O4′"]],
      highlight:["O4′","C1′","C2′","C3′","C4′"]
    },
    backbone:{
      title:"Backbone torsions α–ζ",
      definition:"Six torsion angles describe rotations along the phosphodiester backbone: α, β, γ, δ, ε and ζ.",
      notice:"The complete nucleotide stays visible while four atoms defining one backbone torsion are emphasized. In the full RNA viewer you can choose α, β, γ, δ, ε or ζ individually.",
      points:[
        {id:"O3′(i−1)",x:-2.1,y:-.4,z:.25,c:"#87a9cc"},{id:"P",x:-.8,y:.35,z:-.3,c:"#f2c66d"},
        {id:"O5′",x:.35,y:-.25,z:.4,c:"#ffffff"},{id:"C5′",x:1.5,y:.45,z:-.35,c:"#ffffff"},
        {id:"C4′",x:2.3,y:-.35,z:.2,c:"#5d7080"}
      ],
      bonds:[["O3′(i−1)","P"],["P","O5′"],["O5′","C5′"],["C5′","C4′"]],
      highlight:["O3′(i−1)","P","O5′","C5′"],guide:[["P","O5′"]]
    },
    stacking:{
      title:"Base stacking",
      definition:"Neighboring nucleobases often pack with their approximately planar aromatic surfaces above one another.",
      notice:"Both complete nucleotides remain visible while their bases are highlighted. Rotate them to see the face-to-face overlap that distinguishes stacking from edge-to-edge base pairing.",
      points:[
        {id:"A1",x:-1.2,y:.55,z:.5,c:"#f2c66d"},{id:"A2",x:0,y:1.05,z:.5,c:"#f2c66d"},{id:"A3",x:1.2,y:.55,z:.5,c:"#f2c66d"},
        {id:"A4",x:1.2,y:-.55,z:.5,c:"#f2c66d"},{id:"A5",x:0,y:-1.05,z:.5,c:"#f2c66d"},{id:"A6",x:-1.2,y:-.55,z:.5,c:"#f2c66d"},
        {id:"B1",x:-.9,y:.7,z:-.65,c:"#74d7b6"},{id:"B2",x:.3,y:1.2,z:-.65,c:"#74d7b6"},{id:"B3",x:1.5,y:.7,z:-.65,c:"#74d7b6"},
        {id:"B4",x:1.5,y:-.4,z:-.65,c:"#74d7b6"},{id:"B5",x:.3,y:-.9,z:-.65,c:"#74d7b6"},{id:"B6",x:-.9,y:-.4,z:-.65,c:"#74d7b6"}
      ],
      bonds:[["A1","A2"],["A2","A3"],["A3","A4"],["A4","A5"],["A5","A6"],["A6","A1"],["B1","B2"],["B2","B3"],["B3","B4"],["B4","B5"],["B5","B6"],["B6","B1"]],
      highlight:["A1","A2","A3","A4","A5","A6","B1","B2","B3","B4","B5","B6"],guide:[["A2","B2"],["A5","B5"]]
    },
    basepair:{
      title:"Base pairing in 3D",
      definition:"A real RNA base pair is an atom-by-atom interaction between complete nucleotides, not a pair of abstract polygons.",
      notice:"Rotate the nucleotide pair. Carbon is green, oxygen red, nitrogen blue, hydrogen white, and phosphorus orange. Dashed white lines mark the hydrogen bonds.",
      generator:"realpair"
    },
    helix:{
      title:"RNA helix",
      definition:"Paired nucleotides can form a repeating helical arrangement in which pairing and stacking occur together.",
      notice:"Rotate the model and follow the two strands as they wind around the same axis.",
      generator:"helix"
    },
    loopjunction:{
      title:"Loops & junctions",
      definition:"Loops redirect the backbone; junctions are regions where multiple helical segments meet.",
      notice:"These regions organize how stems are connected in space rather than simply filling gaps between helices.",
      generator:"junction"
    },
    tertiarycontact:{
      title:"Tertiary contacts",
      definition:"Residues far apart in sequence can come close together after the RNA folds in three dimensions.",
      notice:"Sequence distance and spatial distance are different. A tertiary contact can connect distant parts of the chain.",
      generator:"contact"
    }
  };

  const ELEMENT_COLORS={C:"#33cc66",O:"#ff3b30",N:"#2f6bff",H:"#ffffff",P:"#ff9f0a",S:"#ffd60a"};
  const COVALENT_RADII={C:.76,N:.71,O:.66,H:.31,P:1.07,S:1.05};
  const BASE_RING_NAMES={A:["N9","C8","N7","C5","C6","N1","C2","N3","C4"],G:["N9","C8","N7","C5","C6","N1","C2","N3","C4"],C:["N1","C2","N3","C4","C5","C6"],U:["N1","C2","N3","C4","C5","C6"]};
  const SUGAR_RING_NAMES=["O4'","C1'","C2'","C3'","C4'"];
  const MINI_VIEWS={
    glycosidic:{yaw:-.38,pitch:.28,zoom:1.05},
    pucker:{yaw:-.62,pitch:.58,zoom:1.08},
    backbone:{yaw:-.48,pitch:.34,zoom:1.02},
    stacking:{yaw:-.68,pitch:.5,zoom:.96},
    basepair:{yaw:0,pitch:0,zoom:1.04},
    helix:{yaw:-.55,pitch:.34,zoom:1},
    loopjunction:{yaw:-.55,pitch:.34,zoom:1},
    tertiarycontact:{yaw:-.55,pitch:.34,zoom:1}
  };
  const REAL_PAIR_DEFS={
    gc:{label:"G–C Watson–Crick",residues:[["G",1,"G1"],["C",72,"C72"]],hbonds:[["C72","N4","G1","O6"],["G1","N1","C72","N3"],["G1","N2","C72","O2"]]},
    au:{label:"A–U Watson–Crick",residues:[["A",5,"A5"],["U",68,"U68"]],hbonds:[["A5","N6","U68","O4"],["U68","N3","A5","N1"]]},
    gu:{label:"G–U wobble",residues:[["G",4,"G4"],["U",69,"U69"]],hbonds:[["U69","N3","G4","O6"],["G4","N1","U69","O2"]]}
  };
  const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  function atomElement(atomName,raw=""){
    const e=String(raw||"").trim().toUpperCase();if(ELEMENT_COLORS[e])return e;
    const m=String(atomName||"").toUpperCase().match(/[A-Z]/);return m&&ELEMENT_COLORS[m[0]]?m[0]:"C";
  }
  function parsePdbAtoms(text){
    const out=[];
    String(text||"").split(/\r?\n/).forEach(line=>{
      if(!line.startsWith("ATOM  ")&&!line.startsWith("HETATM"))return;
      const chain=line.slice(21,22).trim(),resi=Number.parseInt(line.slice(22,26).trim(),10);
      const name=line.slice(12,16).trim(),resn=line.slice(17,20).trim().toUpperCase();
      const x=Number.parseFloat(line.slice(30,38)),y=Number.parseFloat(line.slice(38,46)),z=Number.parseFloat(line.slice(46,54));
      if(chain!=="A"||!Number.isFinite(resi)||![x,y,z].every(Number.isFinite))return;
      out.push({name,resn,resi,x,y,z,element:atomElement(name,line.slice(76,78))});
    });
    return out;
  }
  const vsub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const vdot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const vcross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const vscale=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
  const vnorm=a=>{const n=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/n,y:a.y/n,z:a.z/n};};
  function orientRealPair(points,def,byId){
    const hb=def.hbonds[0];if(!hb)return;
    const donor=byId.get(hb[0]+":"+hb[1]),accept=byId.get(hb[2]+":"+hb[3]);if(!donor||!accept)return;
    const [baseName,,prefix]=def.residues[0],ring=/^[AG]$/.test(baseName)?["N9","C4","C8"]:["N1","C2","C6"];
    const r0=byId.get(prefix+":"+ring[0]),r1=byId.get(prefix+":"+ring[1]),r2=byId.get(prefix+":"+ring[2]);if(!r0||!r1||!r2)return;
    let z=vnorm(vcross(vsub(r1,r0),vsub(r2,r0)));
    let x=vsub(accept,donor);x=vsub(x,vscale(z,vdot(x,z)));x=vnorm(x);
    let y=vnorm(vcross(z,x));
    const center=points.reduce((o,p)=>({x:o.x+p.x/points.length,y:o.y+p.y/points.length,z:o.z+p.z/points.length}),{x:0,y:0,z:0});
    points.forEach(p=>{const d=vsub(p,center);p.x=vdot(d,x);p.y=vdot(d,y);p.z=vdot(d,z);});
    const glyco=def.residues.map(([b,,pre])=>byId.get(pre+":"+(/[AG]/.test(b)?"N9":"N1"))).filter(Boolean);
    if(glyco.length&&glyco.reduce((s,p)=>s+p.y,0)/glyco.length>0)points.forEach(p=>p.y*=-1);
  }
  function normalizeRealPair(def,allAtoms){
    const points=[],bonds=[],guide=[],byId=new Map(),highlight=new Set();
    def.residues.forEach(([resn,resi,prefix])=>{
      const atoms=allAtoms.filter(a=>a.resi===resi&&a.resn===resn);
      if(!atoms.length)throw new Error("Could not find "+resn+resi+" in the 1EHZ coordinate file.");
      atoms.forEach(a=>{
        const id=prefix+":"+a.name;
        const point={id,x:a.x,y:a.y,z:a.z,element:a.element,showLabel:a.element!=="C"||a.name==="C1'"};
        points.push(point);byId.set(id,point);
        if((BASE_RING_NAMES[resn]||[]).includes(a.name)||a.name==="C1'")highlight.add(id);
      });
      for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
        const a=atoms[i],b=atoms[j],cut=(COVALENT_RADII[a.element]||.75)+(COVALENT_RADII[b.element]||.75)+.42;
        const d=distance3(a,b);
        if(d>.45&&d<=cut)bonds.push([prefix+":"+a.name,prefix+":"+b.name]);
      }
    });
    def.hbonds.forEach(([donorPrefix,donorName,acceptPrefix,acceptName],i)=>{
      const donor=byId.get(donorPrefix+":"+donorName),accept=byId.get(acceptPrefix+":"+acceptName);
      if(!donor||!accept)return;
      const dx=accept.x-donor.x,dy=accept.y-donor.y,dz=accept.z-donor.z,len=Math.hypot(dx,dy,dz)||1;
      const hid="HbondH"+i;
      const h={id:hid,x:donor.x+dx/len*.98,y:donor.y+dy/len*.98,z:donor.z+dz/len*.98,element:"H",showLabel:true};
      points.push(h);byId.set(hid,h);bonds.push([donorPrefix+":"+donorName,hid]);guide.push([hid,acceptPrefix+":"+acceptName]);
      highlight.add(donorPrefix+":"+donorName);highlight.add(acceptPrefix+":"+acceptName);highlight.add(hid);
    });
    orientRealPair(points,def,byId);
    const scale=.34;points.forEach(p=>{p.x*=scale;p.y*=scale;p.z*=scale;});
    return {points,bonds,guide,highlight:[...highlight],label:def.label,source:"PDB 1EHZ"};
  }
  function normalizeRealNucleotides(allAtoms,residues,highlightSpecs=[],guideSpecs=[]){
    const points=[],bonds=[],byId=new Map(),selected=[];
    residues.forEach(([resn,resi,prefix])=>{
      const atoms=allAtoms.filter(a=>a.resi===resi&&a.resn===resn);if(!atoms.length)throw new Error("Could not find "+resn+resi+" in 1EHZ.");
      selected.push({resn,resi,prefix,atoms});
      atoms.forEach(a=>{const id=prefix+":"+a.name,p={id,x:a.x,y:a.y,z:a.z,element:a.element,showLabel:a.element!=="C"||a.name==="C1'"};points.push(p);byId.set(id,p);});
      for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
        const a=atoms[i],b=atoms[j],cut=(COVALENT_RADII[a.element]||.75)+(COVALENT_RADII[b.element]||.75)+.42,d=distance3(a,b);
        if(d>.45&&d<=cut)bonds.push([prefix+":"+a.name,prefix+":"+b.name]);
      }
    });
    for(let i=0;i<selected.length-1;i++){
      const a=selected[i],b=selected[i+1];if(b.resi-a.resi!==1)continue;
      const o=a.atoms.find(x=>x.name==="O3'"||x.name==="O3*"),p=b.atoms.find(x=>x.name==="P");
      if(o&&p&&distance3(o,p)<2.1)bonds.push([a.prefix+":"+o.name,b.prefix+":P"]);
    }
    const highlight=highlightSpecs.map(([prefix,name])=>prefix+":"+name).filter(id=>byId.has(id));
    const guide=guideSpecs.map(([aPrefix,aName,bPrefix,bName])=>[aPrefix+":"+aName,bPrefix+":"+bName]).filter(([a,b])=>byId.has(a)&&byId.has(b));
    const center=points.reduce((o,p)=>({x:o.x+p.x/points.length,y:o.y+p.y/points.length,z:o.z+p.z/points.length}),{x:0,y:0,z:0});
    const scale=.38;points.forEach(p=>{p.x=(p.x-center.x)*scale;p.y=(p.y-center.y)*scale;p.z=(p.z-center.z)*scale;});
    return {points,bonds,guide,highlight};
  }
  function buildRealLessonModels(allAtoms){
    const ring=(base,prefix)=>(BASE_RING_NAMES[base]||[]).map(name=>[prefix,name]);
    return {
      glycosidic:normalizeRealNucleotides(allAtoms,[["G",1,"G1"]],[["G1","O4'"],["G1","C1'"],["G1","N9"],["G1","C4"]],[["G1","C1'","G1","N9"]]),
      pucker:normalizeRealNucleotides(allAtoms,[["G",1,"G1"]],SUGAR_RING_NAMES.map(name=>["G1",name])),
      backbone:normalizeRealNucleotides(allAtoms,[["C",2,"C2"]],[["C2","P"],["C2","O5'"],["C2","C5'"],["C2","C4'"]],[["C2","O5'","C2","C5'"]]),
      stacking:normalizeRealNucleotides(allAtoms,[["G",1,"G1"],["C",2,"C2"]],[...ring("G","G1"),...ring("C","C2")])
    };
  }
  async function loadRealPairModels(){
    if(state.realPairModels)return state.realPairModels;
    if(state.realPairPromise)return state.realPairPromise;
    state.realPairPromise=fetch("https://files.rcsb.org/download/1EHZ.pdb")
      .then(r=>{if(!r.ok)throw new Error("Could not load the 1EHZ teaching coordinates.");return r.text();})
      .then(text=>{
        const atoms=parsePdbAtoms(text),models={};
        Object.entries(REAL_PAIR_DEFS).forEach(([key,def])=>{models[key]=normalizeRealPair(def,atoms);});
        state.realPairModels=models;state.realLessonModels=buildRealLessonModels(atoms);state.realPairPromise=null;return models;
      })
      .catch(error=>{state.realPairPromise=null;throw error;});
    return state.realPairPromise;
  }
  function inferMiniElement(id){
    const atom=String(id||"").split(":").pop();
    const m=atom.match(/^([A-Z])/);return m&&ELEMENT_COLORS[m[1]]?m[1]:"C";
  }

  function helixModel(){
    const points=[],bonds=[],highlight=[];
    for(let i=0;i<8;i++){
      const a=i*.68, y=(i-3.5)*.55;
      const p1={id:"L"+i,x:1.25*Math.cos(a),y,z:1.25*Math.sin(a),c:"#f2c66d"};
      const p2={id:"R"+i,x:1.25*Math.cos(a+Math.PI),y,z:1.25*Math.sin(a+Math.PI),c:"#74d7b6"};
      points.push(p1,p2);highlight.push(p1.id,p2.id);
      if(i){bonds.push(["L"+(i-1),"L"+i],["R"+(i-1),"R"+i]);}
      bonds.push(["L"+i,"R"+i]);
    }
    return {points,bonds,highlight,guide:[]};
  }
  function junctionModel(){
    const points=[{id:"J",x:0,y:0,z:0,c:"#ffffff"}],bonds=[],highlight=["J"];
    [[-2,1.3,.2],[2,1.3,-.3],[0,-2,.45]].forEach((end,a)=>{
      for(let i=1;i<=4;i++){
        const t=i/4,id="B"+a+"_"+i;
        points.push({id,x:end[0]*t,y:end[1]*t,z:end[2]*t,c:a===0?"#f2c66d":a===1?"#74d7b6":"#87a9cc"});
        bonds.push([i===1?"J":"B"+a+"_"+(i-1),id]);highlight.push(id);
      }
    });
    return {points,bonds,highlight,guide:[]};
  }
  function contactModel(){
    const points=[],bonds=[],highlight=[],guide=[];
    for(let i=0;i<7;i++){
      const p={id:"A"+i,x:-1.4+i*.45,y:-1.5+i*.45,z:.45*Math.sin(i),c:"#87a9cc"};
      const q={id:"B"+i,x:1.4-i*.34,y:-1.4+i*.46,z:-.45*Math.sin(i),c:"#74d7b6"};
      points.push(p,q);highlight.push(p.id,q.id);
      if(i){bonds.push(["A"+(i-1),"A"+i],["B"+(i-1),"B"+i]);}
    }
    guide.push(["A5","B5"]);
    return {points,bonds,highlight,guide};
  }

  function isJourney(){return document.body.dataset.pageMode==="journey";}
  const $=id=>document.getElementById(id);

  function pairBondSegments(a,b,order){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ox=-dy/len*3.2,oy=dx/len*3.2;
    const shifts=order===1?[0]:order===2?[-1,1]:[-1.4,0,1.4];
    return shifts.map(s=>({x1:a.x+ox*s,y1:a.y+oy*s,x2:b.x+ox*s,y2:b.y+oy*s}));
  }
  const PAIR_CLEAN_LABELS={
    A:{N6:"NH₂",N9:"N",N7:"N",N1:"N",N3:"N"},
    G:{O6:"O",N1:"N–H",N2:"H₂N",N9:"N",N7:"N",N3:"N"},
    C:{N4:"H₂N",N3:"N",O2:"O",N1:"N"},
    U:{O4:"O",N3:"N–H",O2:"O",N1:"N"}
  };
  function pairDiagram(key){
    const l=PAIR_LESSONS[key]||PAIR_LESSONS.au;
    const setup=key==="gc"?["GC","G","C"]:key==="gu"?["GU","G","U"]:["AU","A","U"];
    const graph=typeof MoleculeEditor!=="undefined"?MoleculeEditor.pairTemplate(...setup):null;
    if(!graph)return '<p class="gps-mini-loading">Chemical base-pair drawing unavailable.</p>';
    const map=new Map(graph.atoms.map(a=>[a.id,a]));
    const bonds=graph.bonds.map(b=>{
      const a=map.get(b.a),d=map.get(b.b);if(!a||!d)return"";
      return pairBondSegments(a,d,b.order).map(s=>'<line class="gps-chem-bond" x1="'+s.x1+'" y1="'+s.y1+'" x2="'+s.x2+'" y2="'+s.y2+'"/>').join("");
    }).join("");
    const hbonds=graph.hbonds.map(h=>{const a=map.get(h.a),b=map.get(h.b);return a&&b?'<line class="gps-chem-hbond" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>':"";}).join("");
    const labels=graph.atoms.map(a=>{
      if(a.element==="C")return"";
      const side=a.id.startsWith("L_")?setup[1]:setup[2],name=String(a.label||a.id).replace(/^[LR]_/,""),label=PAIR_CLEAN_LABELS[side]?.[name]||a.element;
      return '<text class="gps-chem-label" x="'+a.x+'" y="'+(a.y+5)+'">'+label+'</text>';
    }).join("");
    const centers=["L_","R_"].map(prefix=>{
      const atoms=graph.atoms.filter(a=>a.id.startsWith(prefix)),x=atoms.reduce((s,a)=>s+a.x,0)/atoms.length,y=atoms.reduce((s,a)=>s+a.y,0)/atoms.length;
      return {x,y};
    });
    const rMarks=[["L_",setup[1]],["R_",setup[2]]].map(([prefix,b])=>{
      const id=prefix+(/[AG]/.test(b)?"N9":"N1"),a=map.get(id);if(!a)return"";
      return '<line class="gps-chem-r-link" x1="'+a.x+'" y1="'+(a.y+5)+'" x2="'+a.x+'" y2="'+(a.y+28)+'"/><text class="gps-chem-r" x="'+a.x+'" y="'+(a.y+45)+'">R</text>';
    }).join("");
    return '<svg viewBox="40 45 700 370" class="gps-pair-svg gps-chemical-pair-svg" role="img" aria-label="'+l.title+' chemical structure">'+
      bonds+hbonds+rMarks+labels+
      '<text class="gps-base-symbol" x="'+centers[0].x+'" y="'+(centers[0].y+8)+'">'+setup[1]+'</text>'+
      '<text class="gps-base-symbol" x="'+centers[1].x+'" y="'+(centers[1].y+8)+'">'+setup[2]+'</text>'+
      '<text class="gps-base-name" x="'+centers[0].x+'" y="405">'+l.left.name+'</text><text class="gps-base-name" x="'+centers[1].x+'" y="405">'+l.right.name+'</text></svg>';
  }

  function secondaryTransitionMarkup(){
    return '<section class="guided-transition gps-secondary-transition" id="guidedSecondaryTransition">'+
      '<div class="gps-transition-copy"><span class="fact-label">PRIMARY → SECONDARY</span><h2>How can one RNA chain make a secondary structure?</h2>'+
      '<p>The chain can bend back toward itself. When compatible nucleobases meet, they can form base pairs. Several pairs together create stems, loops and other secondary-structure elements.</p>'+
      '<div class="gps-step-row"><button type="button" class="active" data-gps-secondary-step="fold">1 · Shape the chain</button><button type="button" data-gps-secondary-step="pair">2 · Reveal base pairs</button><button type="button" data-gps-secondary-step="more">3 · Look closer</button></div>'+
      '<div class="gps-secondary-copy" id="gpsSecondaryCopy"></div>'+
      '<button class="primary-action" type="button" id="gpsContinueSecondary">Continue to the full secondary structure →</button></div>'+
      '<div class="gps-transition-visual"><div id="gpsSecondaryVisual"></div></div></section>';
  }

  function tertiaryTransitionMarkup(){
    return '<section class="guided-transition gps-tertiary-transition" id="guidedTertiaryTransition">'+
      '<div class="gps-transition-copy"><span class="fact-label">SECONDARY → TERTIARY</span><h2>Secondary structure tells us who pairs. What does the RNA look like in 3D?</h2>'+
      '<p>Before opening the full molecule, explore the local geometric features used to describe RNA in three dimensions.</p>'+
      '<div class="gps-feature-grid">'+
      Object.entries(MINI_LESSONS).map(([key,v])=>'<button type="button" data-gps-mini-feature="'+key+'" class="'+(key==="glycosidic"?"active":"")+'">'+v.title+'</button>').join("")+
      '</div><article class="gps-mini-copy"><h3 id="gpsMiniTitle"></h3><p id="gpsMiniDefinition"></p><p><strong>What should I notice?</strong> <span id="gpsMiniNotice"></span></p></article>'+
      '<button class="primary-action" type="button" id="gpsContinueTertiary">Continue to the full tertiary structure →</button></div>'+
      '<div class="gps-transition-visual"><div class="gps-mini-toolbar"><span>Drag to rotate</span><button type="button" id="gpsMiniReset">Reset view</button></div><div class="gps-real-pair-tabs" id="gpsRealPairTabs" hidden><button type="button" class="active" data-gps-real-pair="gc">G–C</button><button type="button" data-gps-real-pair="au">A–U</button><button type="button" data-gps-real-pair="gu">G–U</button></div><svg id="gpsMini3D" viewBox="0 0 640 520" role="img" aria-label="Interactive 3D teaching model"></svg><div class="gps-element-legend" aria-label="Element colors"><span><i data-element="C"></i>Carbon</span><span><i data-element="O"></i>Oxygen</span><span><i data-element="N"></i>Nitrogen</span><span><i data-element="H"></i>Hydrogen</span><span><i data-element="P"></i>Phosphorus</span></div><p class="gps-mini-caption" id="gpsMiniCaption">Interactive teaching model</p></div></section>';
  }

  function secondaryInlineMarkup(){
    return '<section class="guided-inline-lesson secondary-inline-lesson" id="guidedSecondaryLesson" aria-labelledby="guidedSecondaryLessonTitle">'+
      '<div class="guided-inline-heading"><span class="fact-label">BASE PAIRS IN THIS SECONDARY STRUCTURE</span><h3 id="guidedSecondaryLessonTitle">What do the connections between residues mean?</h3>'+
      '<p>The radial structure above shows which residues are paired. Start with three common RNA pair types. We can add a larger non-standard base-pair library later.</p></div>'+
      '<div class="guided-basepair-grid"><div class="guided-basepair-copy">'+
      '<div class="gps-pair-tabs"><button type="button" data-gps-pair="au" class="active">A–U · Watson–Crick</button><button type="button" data-gps-pair="gc">G–C · Watson–Crick</button><button type="button" data-gps-pair="gu">G–U · wobble</button></div>'+
      '<div id="gpsPairText"></div><p class="guided-nonstandard-note"><strong>RNA can do more.</strong> Many non-Watson–Crick base pairs use different nucleobase edges and orientations; that deeper library can be added here later.</p></div>'+
      '<div class="gps-pair-stage" id="gpsPairStage"></div></div></section>';
  }
  function buildSecondaryTransition(){
    const scene=$("scene-secondary");if(!scene||$("guidedSecondaryLesson")||!isJourney())return;
    scene.insertAdjacentHTML("beforeend",secondaryInlineMarkup());
    document.querySelectorAll("[data-gps-pair]").forEach(b=>b.addEventListener("click",()=>renderPair(b.dataset.gpsPair)));
    renderPair("au");
  }
  const FOLD_LETTERS=["U","A","G","G","A","G","C","A","U","G","U","U","C","A","G","U"];
  const FOLDED_POINTS=[[70,220],[100,205],[132,186],[162,162],[184,132],[190,100],[200,70],[225,48],[258,40],[291,48],[316,70],[326,100],[332,132],[354,162],[384,186],[416,205]];
  const STRAIGHT_POINTS=FOLDED_POINTS.map((_,i)=>[48+i*33,125]);
  const FOLD_PAIRS=[
    {a:3,b:12,type:"G–C"},{a:4,b:11,type:"A–U"},{a:5,b:10,type:"G–U"},{a:6,b:9,type:"C–G"}
  ];
  function chainGroup(points,cls){
    const circles=points.map((p,i)=>'<g class="gps-fold-residue"><circle cx="'+p[0]+'" cy="'+p[1]+'" r="13"/><text x="'+p[0]+'" y="'+(p[1]+4)+'">'+FOLD_LETTERS[i]+'</text></g>').join("");
    const backbone=points.slice(1).map((p,i)=>'<line x1="'+points[i][0]+'" y1="'+points[i][1]+'" x2="'+p[0]+'" y2="'+p[1]+'"/>').join("");
    return '<g class="'+cls+'"><g class="gps-fold-backbone">'+backbone+'</g>'+circles+'</g>';
  }
  function renderFoldVisual(showPairs=false){
    const pairLines=showPairs?FOLD_PAIRS.map((pair,i)=>{
      const a=FOLDED_POINTS[pair.a],b=FOLDED_POINTS[pair.b];
      return '<g class="gps-fold-pair-group pair-'+i+'"><line class="gps-fold-pair" x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'"/><text x="'+((a[0]+b[0])/2)+'" y="'+((a[1]+b[1])/2-5)+'">'+pair.type+'</text></g>';
    }).join(""):"";
    const aria=showPairs?"A radial hairpin-like RNA chain with base-pair connections revealed one by one.":"A straight RNA chain bends into a radial hairpin-like path without showing any base pairs.";
    return '<div class="gps-fold-card"><svg viewBox="0 0 520 255" class="gps-fold-svg '+(showPairs?"pairing-view":"shape-view")+'" role="img" aria-label="'+aria+'">'+
      (showPairs?chainGroup(FOLDED_POINTS,"gps-chain-fixed")+pairLines:chainGroup(STRAIGHT_POINTS,"gps-chain-straight")+chainGroup(FOLDED_POINTS,"gps-chain-folded"))+
      '<text class="gps-fold-caption straight" x="260" y="238">'+(showPairs?"radial shape stays fixed while pairs appear":"straight primary chain")+'</text>'+
      (!showPairs?'<text class="gps-fold-caption folded" x="260" y="238">radial / hairpin-like shape · no base pairs yet</text>':"")+
      '</svg><div class="gps-fold-actions"><button type="button" id="gpsFoldPlay">'+(showPairs?"Replay base pairs":"Replay shape change")+'</button><span>'+(showPairs?"The chain does not move during this step.":"First change the shape only; do not imply what causes the fold.")+'</span></div></div>';
  }
  function playFold(){
    const svg=document.querySelector(".gps-fold-svg");if(!svg)return;
    svg.classList.remove("animate");void svg.getBoundingClientRect();svg.classList.add("animate");
  }

  function renderSecondaryStep(step){
    document.querySelectorAll("[data-gps-secondary-step]").forEach(b=>b.classList.toggle("active",b.dataset.gpsSecondaryStep===step));
    const copy=$("gpsSecondaryCopy"),visual=$("gpsSecondaryVisual");if(!copy||!visual)return;
    if(step==="fold"){
      copy.innerHTML='<h3>First, change the shape of the chain</h3><p>Start with a straight teaching representation. Watch the same continuous RNA backbone bend and make a U-turn into a radial, hairpin-like layout. No base pairs are shown during this step, so the animation does not claim whether pairing or folding happened first.</p>';
      visual.innerHTML=renderFoldVisual(false);$("gpsFoldPlay")?.addEventListener("click",playFold);setTimeout(playFold,50);return;
    }
    if(step==="pair"){
      copy.innerHTML='<h3>Now reveal the base-pair connections</h3><p>Keep the radial shape fixed. Base-pair connections appear one by one across the two sides of the folded chain, including A–U, G–C and a G–U wobble example.</p>';
      visual.innerHTML=renderFoldVisual(true);$("gpsFoldPlay")?.addEventListener("click",playFold);setTimeout(playFold,50);return;
    }
    copy.innerHTML='<h3>Zoom in: what does one of those lines mean chemically?</h3><p>A secondary-structure line is shorthand for an atom-level interaction. Compare standard Watson–Crick pairs with the common G–U wobble. RNA can also use other non-Watson–Crick edges and orientations.</p>'+
      '<div class="gps-pair-tabs"><button type="button" data-gps-pair="au" class="active">A–U</button><button type="button" data-gps-pair="gc">G–C</button><button type="button" data-gps-pair="gu">G–U wobble</button></div><div id="gpsPairText"></div>'+
      '<div class="gps-nonstandard-list"><span>G–U wobble</span><span>Sheared G–A</span><span>Hoogsteen / reverse-Hoogsteen geometries</span><span>Other edge combinations</span></div>';
    visual.innerHTML='<div class="gps-pair-stage" id="gpsPairStage"></div>';
    document.querySelectorAll("[data-gps-pair]").forEach(b=>b.addEventListener("click",()=>renderPair(b.dataset.gpsPair)));
    renderPair("au");
  }
  function renderPair(key){
    const lesson=PAIR_LESSONS[key]||PAIR_LESSONS.au;
    document.querySelectorAll("[data-gps-pair]").forEach(b=>b.classList.toggle("active",b.dataset.gpsPair===key));
    const stage=$("gpsPairStage"),text=$("gpsPairText");if(stage)stage.innerHTML=pairDiagram(key);
    if(text)text.innerHTML='<strong>'+lesson.title+'</strong><p>'+lesson.copy+'</p><ul>'+lesson.bonds.map(x=>'<li>'+x[0]+' ··· '+x[1]+'</li>').join("")+'</ul>';
  }

  function buildTertiaryTransition(){
    const scene=$("scene-tertiary"),learning=$("tertiaryLearning");if(!scene||!learning||!isJourney())return;
    if(!learning.classList.contains("guided-inline-lesson")){
      learning.classList.add("guided-inline-lesson","tertiary-inline-lesson");
      scene.appendChild(learning);
      const title=$("tertiaryLearningTitle"),intro=learning.querySelector(".tertiary-learning-intro"),show=$("teLearningShow");
      if(title)title.textContent="Explore the structural features inside this 3D RNA";
      if(intro)intro.textContent="The full 3D structure above is the RNA you just saw in 2D. Choose a feature below to study it with a small interactive model, then use “Show me in the 3D structure” to highlight a representative example in the full RNA.";
      if(show)show.textContent="Show me in the 3D structure";
      const card=learning.querySelector(".tertiary-learning-card");
      const mini=document.createElement("div");mini.className="gps-inline-mini-shell";mini.id="gpsInlineMiniShell";
      mini.innerHTML='<div class="gps-mini-toolbar inline"><span>Left drag: rotate · Right/Ctrl drag: pan · Wheel: zoom · Double-click: reset</span><div><button type="button" id="gpsLabelsToggle">Labels: on</button><button type="button" id="gpsMiniReset">Reset / center</button></div></div>'+
        '<div class="gps-real-pair-tabs" id="gpsRealPairTabs" hidden><button type="button" class="active" data-gps-real-pair="gc">G–C</button><button type="button" data-gps-real-pair="au">A–U</button><button type="button" data-gps-real-pair="gu">G–U</button></div>'+
        '<svg id="gpsMini3D" viewBox="0 0 640 520" role="img" aria-label="Interactive molecular teaching model"></svg>'+
        '<div class="gps-element-legend" aria-label="Element colors"><span><i data-element="C"></i>Carbon</span><span><i data-element="O"></i>Oxygen</span><span><i data-element="N"></i>Nitrogen</span><span><i data-element="H"></i>Hydrogen</span><span><i data-element="P"></i>Phosphorus</span><span class="gps-hbond-key"><i></i>H-bond</span></div>'+
        '<p class="gps-mini-caption" id="gpsMiniCaption">Interactive stick model</p>';
      learning.insertBefore(mini,card);
    }
    document.querySelectorAll("[data-learning-feature]").forEach(b=>b.addEventListener("click",()=>{state.miniFeature=b.dataset.learningFeature;resetMiniView();renderMiniLesson();}));
    document.querySelectorAll("[data-gps-real-pair]").forEach(b=>b.addEventListener("click",()=>{state.realPairKey=b.dataset.gpsRealPair;resetMiniView("basepair");renderMiniLesson();}));
    $("gpsMiniReset")?.addEventListener("click",()=>{resetMiniView();renderMiniModel();});
    $("gpsLabelsToggle")?.addEventListener("click",()=>{state.labelsOn=!state.labelsOn;$("gpsLabelsToggle").textContent="Labels: "+(state.labelsOn?"on":"off");renderMiniModel();});
    const svg=$("gpsMini3D");
    if(svg&&!svg.dataset.interactionsReady){
      svg.dataset.interactionsReady="true";
      svg.addEventListener("contextmenu",e=>e.preventDefault());
      svg.addEventListener("wheel",e=>{e.preventDefault();state.zoom=Math.max(.42,Math.min(3.2,state.zoom*(e.deltaY<0?1.1:.91)));renderMiniModel();},{passive:false});
      svg.addEventListener("dblclick",e=>{e.preventDefault();resetMiniView();renderMiniModel();});
      svg.addEventListener("pointerdown",e=>{
        if(![0,1,2].includes(e.button))return;
        e.preventDefault();state.dragging=true;state.dragMode=(e.button===2||e.ctrlKey||e.metaKey||e.button===1)?"pan":"rotate";state.lastX=e.clientX;state.lastY=e.clientY;svg.setPointerCapture(e.pointerId);
      });
      svg.addEventListener("pointermove",e=>{if(!state.dragging)return;const dx=e.clientX-state.lastX,dy=e.clientY-state.lastY;
        if(state.dragMode==="pan"){state.panX+=dx;state.panY+=dy;}else{state.yaw+=dx*.0085;state.pitch=Math.max(-1.48,Math.min(1.48,state.pitch+dy*.0085));}
        state.lastX=e.clientX;state.lastY=e.clientY;renderMiniModel();
      });
      const end=e=>{state.dragging=false;if(e?.pointerId!==undefined&&svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);};svg.addEventListener("pointerup",end);svg.addEventListener("pointercancel",end);
    }
    renderMiniLesson();
  }
  function resetMiniView(feature=state.miniFeature){
    const view=MINI_VIEWS[feature]||MINI_VIEWS.glycosidic;
    state.yaw=view.yaw;state.pitch=view.pitch;state.zoom=view.zoom;state.panX=0;state.panY=0;state.dragging=false;
  }
  function modelForLesson(){
    const lesson=MINI_LESSONS[state.miniFeature]||MINI_LESSONS.glycosidic;
    if(lesson.generator==="realpair")return state.realPairModels?.[state.realPairKey]||{...lesson,points:[],bonds:[],guide:[],highlight:[]};
    if(["glycosidic","pucker","backbone","stacking"].includes(state.miniFeature)){
      return state.realLessonModels?.[state.miniFeature]?{...lesson,...state.realLessonModels[state.miniFeature]}:{...lesson,points:[],bonds:[],guide:[],highlight:[]};
    }
    if(lesson.generator==="helix")return {...lesson,...helixModel()};
    if(lesson.generator==="junction")return {...lesson,...junctionModel()};
    if(lesson.generator==="contact")return {...lesson,...contactModel()};
    return lesson;
  }
  function rotatePoint(p){
    const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cp-z*sp,z2=p.y*sp+z*cp;
    return {...p,rx:x,ry:y,rz:z2};
  }
  function renderMiniModel(){
    const svg=$("gpsMini3D");if(!svg)return;const model=modelForLesson();
    if(!model.points?.length){
      svg.innerHTML='<text x="320" y="260" text-anchor="middle" class="gps-mini-loading">Loading molecular coordinates…</text>';
      svg.dataset.feature=state.miniFeature;return;
    }
    const pts=model.points.map(rotatePoint),map=new Map(pts.map(p=>[p.id,p]));
    const scale=(state.miniFeature==="basepair"?70:76)*state.zoom,cx=320+state.panX,cy=255+state.panY;
    const screen=p=>({x:cx+p.rx*scale,y:cy-p.ry*scale});
    const elementOf=p=>p.element||inferMiniElement(p.id);
    const bond=(a,b)=>{
      const p=map.get(a),q=map.get(b);if(!p||!q)return"";
      const A=screen(p),B=screen(q),mx=(A.x+B.x)/2,my=(A.y+B.y)/2,ca=ELEMENT_COLORS[elementOf(p)]||"#33cc66",cb=ELEMENT_COLORS[elementOf(q)]||"#33cc66";
      return '<line class="gps-stick-bond" x1="'+A.x+'" y1="'+A.y+'" x2="'+mx+'" y2="'+my+'" stroke="'+ca+'"/><line class="gps-stick-bond" x1="'+mx+'" y1="'+my+'" x2="'+B.x+'" y2="'+B.y+'" stroke="'+cb+'"/>';
    };
    const highlighted=new Set(model.highlight||[]),hasFocusedFeature=highlighted.size>0&&highlighted.size<pts.length;
    const bonds=(model.bonds||[]).map(x=>{
      const p=map.get(x[0]),q=map.get(x[1]);if(!p||!q)return"";
      const html=bond(x[0],x[1]),focus=highlighted.has(x[0])&&highlighted.has(x[1]);
      return '<g class="'+(focus?"gps-feature-bond":"gps-context-bond")+'" opacity="'+(hasFocusedFeature&&!focus?".32":"1")+'">'+html+'</g>';
    }).join("");
    const guides=(model.guide||[]).map(x=>{const p=map.get(x[0]),q=map.get(x[1]);if(!p||!q)return"";const A=screen(p),B=screen(q);return '<line class="gps-mini-guide" x1="'+A.x+'" y1="'+A.y+'" x2="'+B.x+'" y2="'+B.y+'"/>';}).join("");
    const nodes=pts.slice().sort((a,b)=>a.rz-b.rz).map(p=>{
      const S=screen(p),element=elementOf(p),color=ELEMENT_COLORS[element]||"#33cc66",focus=highlighted.has(p.id);
      const radius=element==="H"?(focus?4.8:3.2):(focus?3.8:2.1);
      const dot='<circle class="gps-stick-atom '+(element==="H"?"hydrogen ":"")+(focus?"feature-highlight":"context-atom")+'" r="'+radius+'" fill="'+color+'"/>';
      const label=state.labelsOn&&p.showLabel!==false?'<text class="gps-stick-label" y="-8">'+String(p.id).split(":").pop()+'</text>':"";
      return '<g class="gps-stick-node '+(focus?"feature-highlight":"context-node")+'" opacity="'+(hasFocusedFeature&&!focus?".38":"1")+'" data-element="'+element+'" transform="translate('+S.x+' '+S.y+')">'+dot+label+'</g>';
    }).join("");
    svg.innerHTML='<g>'+bonds+guides+nodes+'</g>';
    svg.dataset.feature=state.miniFeature;svg.dataset.yaw=state.yaw.toFixed(3);svg.dataset.pitch=state.pitch.toFixed(3);svg.dataset.zoom=state.zoom.toFixed(3);
  }
  function renderMiniLesson(){
    const l=MINI_LESSONS[state.miniFeature]||MINI_LESSONS.glycosidic;
    document.querySelectorAll("[data-gps-real-pair]").forEach(b=>b.classList.toggle("active",b.dataset.gpsRealPair===state.realPairKey));
    const pairMode=state.miniFeature==="basepair";
    if($("gpsRealPairTabs"))$("gpsRealPairTabs").hidden=!pairMode;
    const title=$("gpsMiniTitle"),definition=$("gpsMiniDefinition"),notice=$("gpsMiniNotice");
    if(title)title.textContent=pairMode?(REAL_PAIR_DEFS[state.realPairKey]?.label||l.title):l.title;
    if(definition)definition.textContent=l.definition;if(notice)notice.textContent=l.notice;
    const realContext=["glycosidic","pucker","backbone","stacking","basepair"].includes(state.miniFeature);
    if($("gpsMiniCaption"))$("gpsMiniCaption").textContent=pairMode?"Complete nucleotides · PDB 1EHZ · yellow dotted lines = H-bonds":realContext?"Complete nucleotide context · PDB 1EHZ · highlighted atoms mark the feature":"Interactive stick model · element-colored atoms";
    renderMiniModel();
    if(realContext&&(!state.realPairModels||!state.realLessonModels)){
      loadRealPairModels().then(()=>{if(["glycosidic","pucker","backbone","stacking","basepair"].includes(state.miniFeature))renderMiniLesson();}).catch(error=>{
        const svg=$("gpsMini3D");if(svg)svg.innerHTML='<text x="320" y="250" text-anchor="middle" class="gps-mini-loading">Could not load the atom-level base-pair example.</text><text x="320" y="278" text-anchor="middle" class="gps-mini-loading small">'+String(error.message||error)+'</text>';
      });
    }
  }

  function activateOverlay(){/* Same-page teaching: no interstitial overlay. */}
  function showSecondaryWorkspace(){state.secondaryReady=true;}
  function showTertiaryWorkspace(){state.tertiaryReady=true;if(typeof TertiaryExplorer!=="undefined")TertiaryExplorer.render();}
  function enter(sceneName){
    if(!isJourney())return;
    if(sceneName==="secondary")buildSecondaryTransition();
    if(sceneName==="tertiary"){buildTertiaryTransition();if(typeof TertiaryExplorer!=="undefined")TertiaryExplorer.render();}
  }
  function resetForJourney(){state.secondaryReady=true;state.tertiaryReady=true;}
  function setup(){if(!isJourney())return;buildSecondaryTransition();buildTertiaryTransition();}
  return {setup,enter,showSecondaryWorkspace,showTertiaryWorkspace,resetForJourney,getState:()=>({...state})};
})();
