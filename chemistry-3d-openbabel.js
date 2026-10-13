(() => {
  "use strict";

  // Browser-native geometry engine. OpenChemLib is vendored in the repository so
  // RNA Explorer does not depend on a runtime CDN or unsafe-eval.
  const OCL_VERSION = "9.25.1";
  const MODULE_URL = new URL("./vendor/openchemlib/openchemlib.js", document.baseURI).href;
  const RESOURCE_URL = new URL("./vendor/openchemlib/resources.json", document.baseURI).href;
  let oclPromise = null;

  const ATOMIC_SYMBOL = {
    1:"H",5:"B",6:"C",7:"N",8:"O",9:"F",14:"Si",15:"P",16:"S",17:"Cl",35:"Br",53:"I"
  };
  const IDEAL_HBOND_DISTANCE = 2.90;

  function atomChargeRecords(graph) {
    const entries = (graph.atoms || []).map((atom, i) => [i + 1, Number(atom.charge || 0)]).filter(([, charge]) => charge !== 0);
    const lines = [];
    for (let i = 0; i < entries.length; i += 8) {
      const chunk = entries.slice(i, i + 8);
      lines.push("M  CHG" + String(chunk.length).padStart(3, " ") + chunk.map(([idx, charge]) => String(idx).padStart(4, " ") + String(charge).padStart(4, " ")).join(""));
    }
    return lines;
  }

  function graphToMolBlock(graph) {
    const atoms = Array.isArray(graph?.atoms) ? graph.atoms : [];
    const bonds = Array.isArray(graph?.bonds) ? graph.bonds : [];
    if (!atoms.length) throw new Error("Draw at least one atom before generating molecular geometry.");
    if (atoms.length > 999 || bonds.length > 999) throw new Error("This preview currently supports up to 999 atoms and 999 bonds.");
    const idToIndex = new Map(atoms.map((atom, i) => [atom.id, i + 1]));
    const atomById = new Map(atoms.map(atom => [atom.id, atom]));
    const cx = atoms.reduce((sum, atom) => sum + Number(atom.x || 0), 0) / atoms.length;
    const cy = atoms.reduce((sum, atom) => sum + Number(atom.y || 0), 0) / atoms.length;
    const lengths = bonds.map(bond => {
      const a = atomById.get(bond.a), b = atomById.get(bond.b);
      return a && b ? Math.hypot(Number(b.x || 0) - Number(a.x || 0), Number(b.y || 0) - Number(a.y || 0)) : 0;
    }).filter(value => value > 5).sort((a, b) => a - b);
    const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 68;
    const scale = 1.45 / Math.max(20, median || 68);
    const lines = [
      "RNA Explorer",
      "  RNAExplorer  geometry",
      "",
      String(atoms.length).padStart(3, " ") + String(bonds.length).padStart(3, " ") + "  0  0  0  0            999 V2000"
    ];
    atoms.forEach(atom => {
      const x = (Number(atom.x || 0) - cx) * scale;
      const y = -(Number(atom.y || 0) - cy) * scale;
      const element = String(atom.element || "C").slice(0, 3);
      lines.push(x.toFixed(4).padStart(10, " ") + y.toFixed(4).padStart(10, " ") + "    0.0000 " + element.padEnd(3, " ") + " 0  0  0  0  0  0  0  0  0  0  0  0");
    });
    bonds.forEach(bond => {
      const a = idToIndex.get(bond.a), b = idToIndex.get(bond.b), order = Math.max(1, Math.min(3, Number(bond.order || 1)));
      if (!a || !b) throw new Error("A bond references a missing atom.");
      lines.push(String(a).padStart(3, " ") + String(b).padStart(3, " ") + String(order).padStart(3, " ") + "  0  0  0  0");
    });
    lines.push(...atomChargeRecords(graph));
    lines.push("M  END", "");
    return lines.join("\n");
  }

  async function getOpenChemLib() {
    if (oclPromise) return oclPromise;
    oclPromise = (async () => {
      const OCL = await import(MODULE_URL);
      if (!OCL?.Molecule || !OCL?.ConformerGenerator || !OCL?.ForceFieldMMFF94) {
        throw new Error("The OpenChemLib geometry components are unavailable.");
      }
      if (OCL.Resources?.registerFromUrl) await OCL.Resources.registerFromUrl(RESOURCE_URL);
      return OCL;
    })().catch(error => {
      oclPromise = null;
      throw error;
    });
    return oclPromise;
  }

  function connectedComponents(graph) {
    const atoms = Array.isArray(graph?.atoms) ? graph.atoms : [];
    const ids = new Set(atoms.map(atom => atom.id));
    const adjacency = new Map(atoms.map(atom => [atom.id, []]));
    (graph.bonds || []).forEach(bond => {
      if (!ids.has(bond.a) || !ids.has(bond.b)) return;
      adjacency.get(bond.a).push(bond.b);
      adjacency.get(bond.b).push(bond.a);
    });
    const seen = new Set(), components = [];
    atoms.forEach(atom => {
      if (seen.has(atom.id)) return;
      const stack = [atom.id], component = [];
      seen.add(atom.id);
      while (stack.length) {
        const id = stack.pop(); component.push(id);
        (adjacency.get(id) || []).forEach(next => { if (!seen.has(next)) { seen.add(next); stack.push(next); } });
      }
      components.push(component);
    });
    return components;
  }

  function subgraph(graph, ids) {
    const keep = new Set(ids);
    return {
      atoms: (graph.atoms || []).filter(atom => keep.has(atom.id)).map(atom => ({...atom})),
      bonds: (graph.bonds || []).filter(bond => keep.has(bond.a) && keep.has(bond.b)).map(bond => ({...bond})),
      hbonds: (graph.hbonds || []).filter(bond => keep.has(bond.a) && keep.has(bond.b)).map(bond => ({...bond}))
    };
  }

  function drawingMetrics(graph) {
    const atoms = graph.atoms || [], byId = new Map(atoms.map(atom => [atom.id, atom]));
    const lengths = (graph.bonds || []).map(bond => {
      const a = byId.get(bond.a), b = byId.get(bond.b);
      return a && b ? Math.hypot(Number(b.x || 0) - Number(a.x || 0), Number(b.y || 0) - Number(a.y || 0)) : 0;
    }).filter(value => value > 5).sort((a,b) => a-b);
    const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 68;
    const cx = atoms.length ? atoms.reduce((sum,a) => sum + Number(a.x || 0), 0) / atoms.length : 0;
    const cy = atoms.length ? atoms.reduce((sum,a) => sum + Number(a.y || 0), 0) / atoms.length : 0;
    return { cx, cy, scale: 1.45 / Math.max(20, median || 68) };
  }

  function moleculeToModel(mol, originalGraph, prefix="G") {
    const originalIds = (originalGraph.atoms || []).map(atom => atom.id);
    const atomCount = mol.getAllAtoms();
    const atoms = [];
    let hydrogenSerial = 1;
    for (let i = 0; i < atomCount; i++) {
      const atomicNo = mol.getAtomicNo(i);
      const element = ATOMIC_SYMBOL[atomicNo] || "X";
      const x = Number(mol.getAtomX(i)), y = Number(mol.getAtomY(i)), z = Number(mol.getAtomZ(i));
      if (![x, y, z].every(Number.isFinite)) throw new Error("OpenChemLib returned non-numeric coordinates.");
      atoms.push({ id: originalIds[i] || `${prefix}_H${hydrogenSerial++}`, element, x, y, z });
    }
    const bonds = [];
    for (let i = 0; i < mol.getAllBonds(); i++) {
      const ai = mol.getBondAtom(0, i), bi = mol.getBondAtom(1, i);
      const a = atoms[ai], b = atoms[bi];
      if (!a || !b) continue;
      const order = Math.max(1, Math.min(3, Number(mol.getBondOrder(i) || 1)));
      bonds.push({ id: `${prefix}_b${i}`, a: a.id, b: b.id, order });
    }
    return { atoms, bonds };
  }

  const vsub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:(a.z||0)-(b.z||0)});
  const vadd = (a,b) => ({x:a.x+b.x,y:a.y+b.y,z:(a.z||0)+(b.z||0)});
  const vmul = (a,s) => ({x:a.x*s,y:a.y*s,z:(a.z||0)*s});
  const vdot = (a,b) => a.x*b.x+a.y*b.y+(a.z||0)*(b.z||0);
  const vcross = (a,b) => ({x:a.y*(b.z||0)-(a.z||0)*b.y,y:(a.z||0)*b.x-a.x*(b.z||0),z:a.x*b.y-a.y*b.x});
  function vnorm(v) { const d=Math.hypot(v.x,v.y,v.z||0)||1; return {x:v.x/d,y:v.y/d,z:(v.z||0)/d}; }
  function centroid(points) {
    if (!points.length) return {x:0,y:0,z:0};
    return points.reduce((sum,p)=>({x:sum.x+p.x,y:sum.y+p.y,z:sum.z+(p.z||0)}),{x:0,y:0,z:0});
  }
  function choosePerpendicular(axis) {
    const reference = Math.abs(axis.z || 0) < .8 ? {x:0,y:0,z:1} : {x:0,y:1,z:0};
    return vnorm(vcross(reference, axis));
  }

  function align3DToDrawing(model, componentGraph, fullGraph) {
    const generatedById = new Map(model.atoms.map(atom => [atom.id, atom]));
    const metrics = drawingMetrics(fullGraph);
    const mapped = (componentGraph.atoms || []).filter(atom => generatedById.has(atom.id));
    if (!mapped.length) return model;
    const targetFor = atom => ({x:(Number(atom.x||0)-metrics.cx)*metrics.scale,y:-(Number(atom.y||0)-metrics.cy)*metrics.scale,z:0});
    const generatedCenter = centroid(mapped.map(atom => generatedById.get(atom.id)));
    const targetCenter = centroid(mapped.map(targetFor));
    if (mapped.length === 1) {
      const delta = vsub(targetCenter, generatedCenter);
      return {...model, atoms:model.atoms.map(atom=>({...atom,...vadd(atom,delta)}))};
    }

    let first=mapped[0], second=mapped[1], bestDistance=-1;
    for(let i=0;i<mapped.length;i++) for(let j=i+1;j<mapped.length;j++) {
      const a=targetFor(mapped[i]),b=targetFor(mapped[j]),d=Math.hypot(b.x-a.x,b.y-a.y);
      if(d>bestDistance){bestDistance=d;first=mapped[i];second=mapped[j];}
    }
    const gA=generatedById.get(first.id),gB=generatedById.get(second.id),tA=targetFor(first),tB=targetFor(second);
    const g1=vnorm(vsub(gB,gA)),t1=vnorm(vsub(tB,tA));
    let third=null,bestPerp=-1;
    mapped.forEach(atom=>{
      if(atom.id===first.id||atom.id===second.id)return;
      const t=targetFor(atom),v=vsub(t,tA),perp=vsub(v,vmul(t1,vdot(v,t1))),d=Math.hypot(perp.x,perp.y,perp.z||0);
      if(d>bestPerp){bestPerp=d;third=atom;}
    });
    let g2,t2;
    if(third && bestPerp>1e-4){
      const gv=vsub(generatedById.get(third.id),gA),tv=vsub(targetFor(third),tA);
      g2=vnorm(vsub(gv,vmul(g1,vdot(gv,g1))));
      t2=vnorm(vsub(tv,vmul(t1,vdot(tv,t1))));
      if(!Number.isFinite(g2.x+g2.y+g2.z))g2=choosePerpendicular(g1);
      if(!Number.isFinite(t2.x+t2.y+t2.z))t2=choosePerpendicular(t1);
    } else {
      g2=choosePerpendicular(g1);t2=choosePerpendicular(t1);
    }
    const g3=vnorm(vcross(g1,g2)),t3=vnorm(vcross(t1,t2));
    const atoms=model.atoms.map(atom=>{
      const v=vsub(atom,generatedCenter),u1=vdot(v,g1),u2=vdot(v,g2),u3=vdot(v,g3);
      const transformed=vadd(targetCenter,vadd(vmul(t1,u1),vadd(vmul(t2,u2),vmul(t3,u3))));
      return {...atom,x:transformed.x,y:transformed.y,z:transformed.z};
    });
    return {...model,atoms};
  }

  function modelBondMedian(model, originalBondIds=null) {
    const byId=new Map(model.atoms.map(atom=>[atom.id,atom]));
    const distances=model.bonds.filter(bond=>!originalBondIds||originalBondIds.has(`${bond.a}|${bond.b}`)||originalBondIds.has(`${bond.b}|${bond.a}`)).map(bond=>{
      const a=byId.get(bond.a),b=byId.get(bond.b);return a&&b?Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z):0;
    }).filter(v=>v>1e-6).sort((a,b)=>a-b);
    return distances.length?distances[Math.floor(distances.length/2)]:1.5;
  }

  function align2DToDrawing(model, componentGraph) {
    const originalById=new Map(componentGraph.atoms.map(atom=>[atom.id,atom]));
    const mapped=model.atoms.filter(atom=>originalById.has(atom.id));
    if(!mapped.length)return [];
    const gc={x:mapped.reduce((s,a)=>s+a.x,0)/mapped.length,y:mapped.reduce((s,a)=>s+a.y,0)/mapped.length};
    const tc={x:mapped.reduce((s,a)=>s+Number(originalById.get(a.id).x||0),0)/mapped.length,y:mapped.reduce((s,a)=>s+Number(originalById.get(a.id).y||0),0)/mapped.length};
    const originalBondIds=new Set(componentGraph.bonds.flatMap(b=>[`${b.a}|${b.b}`,`${b.b}|${b.a}`]));
    const generatedMedian=modelBondMedian(model,originalBondIds);
    const scale=68/Math.max(.25,generatedMedian);
    const candidates=[1,-1].map(reflect=>{
      let A=0,B=0;
      mapped.forEach(atom=>{
        const g={x:(atom.x-gc.x)*scale,y:(atom.y-gc.y)*scale*reflect},t={x:Number(originalById.get(atom.id).x||0)-tc.x,y:Number(originalById.get(atom.id).y||0)-tc.y};
        A+=g.x*t.x+g.y*t.y;B+=g.x*t.y-g.y*t.x;
      });
      const theta=Math.atan2(B,A),c=Math.cos(theta),s=Math.sin(theta);let error=0;
      const coords=new Map();
      mapped.forEach(atom=>{
        const gx=(atom.x-gc.x)*scale,gy=(atom.y-gc.y)*scale*reflect,x=tc.x+gx*c-gy*s,y=tc.y+gx*s+gy*c,target=originalById.get(atom.id);
        coords.set(atom.id,{x,y});error+=(x-target.x)**2+(y-target.y)**2;
      });
      return {coords,error};
    }).sort((a,b)=>a.error-b.error);
    return componentGraph.atoms.map(atom=>({id:atom.id,...(candidates[0].coords.get(atom.id)||{x:atom.x,y:atom.y})}));
  }

  function componentMap(components) {
    const map=new Map();
    components.forEach((ids,index)=>ids.forEach(id=>map.set(id,index)));
    return map;
  }

  function translateComponent(atoms, componentIds, delta) {
    const keep=new Set(componentIds);
    atoms.forEach(atom=>{
      if(!keep.has(atom.id))return;
      atom.x+=delta.x;atom.y+=delta.y;atom.z+=delta.z||0;
    });
  }

  // Explicit dotted H-bonds in the drawing are interaction constraints.  We keep
  // each covalent component's internally generated geometry, preserve its drawn
  // orientation, then gently translate disconnected components so the explicit
  // donor/acceptor contacts sit at a chemically sensible heavy-atom distance.
  // This is an educational idealization, not a full intermolecular optimization.
  function satisfyExplicitInteractions(atoms, graph, components) {
    const hbonds=(graph.hbonds||[]).filter(h=>h&&h.a&&h.b);
    if(!hbonds.length||components.length<2)return;
    const compByAtom=componentMap(components);
    const drawingById=new Map((graph.atoms||[]).map(a=>[a.id,a]));
    const anchor=0;
    for(let iteration=0;iteration<10;iteration++){
      const byId=new Map(atoms.map(a=>[a.id,a]));
      const corrections=components.map(()=>({x:0,y:0,z:0,n:0}));
      hbonds.forEach(h=>{
        const ci=compByAtom.get(h.a),cj=compByAtom.get(h.b);if(ci===undefined||cj===undefined||ci===cj)return;
        const a=byId.get(h.a),b=byId.get(h.b);if(!a||!b)return;
        const da=drawingById.get(h.a),db=drawingById.get(h.b);
        let direction;
        if(da&&db){direction=vnorm({x:Number(db.x||0)-Number(da.x||0),y:-(Number(db.y||0)-Number(da.y||0)),z:0});}
        else direction=vnorm(vsub(b,a));
        const desired=vmul(direction,IDEAL_HBOND_DISTANCE),actual=vsub(b,a),error=vsub(desired,actual);
        if(ci!==anchor){corrections[ci].x-=error.x*.5;corrections[ci].y-=error.y*.5;corrections[ci].z-=error.z*.5;corrections[ci].n++;}
        if(cj!==anchor){corrections[cj].x+=error.x*.5;corrections[cj].y+=error.y*.5;corrections[cj].z+=error.z*.5;corrections[cj].n++;}
      });
      let moved=false;
      corrections.forEach((c,index)=>{
        if(!c.n||index===anchor)return;
        const delta={x:(c.x/c.n)*.72,y:(c.y/c.n)*.72,z:(c.z/c.n)*.72};
        if(Math.hypot(delta.x,delta.y,delta.z)>.002)moved=true;
        translateComponent(atoms,components[index],delta);
      });
      if(!moved)break;
    }
  }

  function interactionRecords(graph, atoms) {
    const byId=new Map(atoms.map(a=>[a.id,a]));
    return (graph.hbonds||[]).map((h,index)=>{
      const a=byId.get(h.a),b=byId.get(h.b);
      if(!a||!b)return null;
      return {
        id:h.id||`h${index+1}`,
        a:h.a,b:h.b,
        distance:Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),
        explicit:true
      };
    }).filter(Boolean);
  }

  async function conformComponent(componentGraph, OCL, optimize, index, fullGraph) {
    if(componentGraph.atoms.length===1){
      const metrics=drawingMetrics(fullGraph),a=componentGraph.atoms[0];
      return {atoms:[{id:a.id,element:a.element,x:(a.x-metrics.cx)*metrics.scale,y:-(a.y-metrics.cy)*metrics.scale,z:0}],bonds:[],forceField:null};
    }
    let mol=OCL.Molecule.fromMolfile(graphToMolBlock(componentGraph));
    if(!mol||!mol.getAllAtoms())throw new Error("OpenChemLib could not parse this molecular graph.");
    const generator=new OCL.ConformerGenerator(0);
    const conformed=generator.getOneConformerAsMolecule(mol);
    if(conformed)mol=conformed;
    let forceField=null;
    if(optimize){
      const ff=new OCL.ForceFieldMMFF94(mol,"MMFF94");
      ff.minimise({maxIts:1800,gradTol:1e-4,funcTol:1e-6});
      forceField="MMFF94";
    }
    const model=moleculeToModel(mol,componentGraph,`C${index+1}`);
    return {...align3DToDrawing(model,componentGraph,fullGraph),forceField};
  }

  async function generate3D(graph, optimize=false) {
    const OCL=await getOpenChemLib();
    const components=connectedComponents(graph);
    const atoms=[],bonds=[];
    for(let i=0;i<components.length;i++){
      const component=subgraph(graph,components[i]);
      let model;
      try{model=await conformComponent(component,OCL,optimize,i,graph);}
      catch(error){
        if(optimize)throw new Error("MMFF94 optimization is unavailable for one component: "+(error?.message||error));
        throw error;
      }
      atoms.push(...model.atoms);bonds.push(...model.bonds);
    }
    satisfyExplicitInteractions(atoms,graph,components);
    const hbonds=interactionRecords(graph,atoms);
    return {
      atoms,bonds,hbonds,
      forceField:optimize?"MMFF94":null,
      source:"OpenChemLib",
      geometryMode:optimize?"optimized":"ideal",
      componentCount:components.length,
      relativePlacementPreserved:true,
      interactionLayoutPreserved:true,
      interactionConstraint:hbonds.length?`explicit H-bonds normalized near ${IDEAL_HBOND_DISTANCE.toFixed(1)} Å`:null,
      hydrogensAdded:atoms.length>(graph.atoms||[]).length
    };
  }

  async function generateIdeal(graph){return generate3D(graph,false);}
  async function generateOptimized(graph){return generate3D(graph,true);}

  async function generate2D(graph) {
    const OCL=await getOpenChemLib();
    const components=connectedComponents(graph),coordinates=[];
    for(let i=0;i<components.length;i++){
      const component=subgraph(graph,components[i]);
      if(component.atoms.length===1){coordinates.push({id:component.atoms[0].id,x:component.atoms[0].x,y:component.atoms[0].y});continue;}
      let mol=OCL.Molecule.fromMolfile(graphToMolBlock(component));
      if(!mol||!mol.getAllAtoms())throw new Error("OpenChemLib could not parse this molecular graph.");
      mol.inventCoordinates();
      const model=moleculeToModel(mol,component,`D${i+1}`);
      coordinates.push(...align2DToDrawing(model,component));
    }
    return {coordinates,source:"OpenChemLib",mode:"ideal2D",componentCount:components.length,relativePlacementPreserved:true};
  }

  window.Chemistry3DForceField = {
    // generate remains an alias for the pre-existing optimized behavior so older
    // callers do not silently change semantics.
    generate:generateOptimized,
    generateIdeal,
    generateOptimized,
    generate2D,
    graphToMolBlock,
    preload:getOpenChemLib,
    getEngineInfo:()=>({
      name:"OpenChemLib",
      version:OCL_VERSION,
      primary3D:"drawing-faithful ideal conformer",
      optionalOptimization:"MMFF94 per covalent component; explicit interaction layout retained",
      twoD:"inventCoordinates",
      disconnectedComponents:"generated independently, aligned to the drawing, then positioned by explicit H-bond constraints",
      explicitInteractions:`shown and placed near ${IDEAL_HBOND_DISTANCE.toFixed(1)} Å`,
      fallback:"RNA Explorer rough preview",
      uffAvailable:false
    })
  };

  // Load the enhanced molecular-drawing 3D viewer after the rest of the classic
  // scripts have initialized. Keeping this as a separate file makes the viewer
  // replaceable without coupling it to the geometry engine.
  function loadEnhancedViewer(){
    if(document.querySelector('script[data-rna-chem-3d-viewer="1"]'))return;
    const script=document.createElement("script");
    script.src=new URL("./chemistry-3d-viewer.js?v=1",document.baseURI).href;
    script.dataset.rnaChem3dViewer="1";
    script.defer=true;
    document.head.appendChild(script);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loadEnhancedViewer,{once:true});
  else setTimeout(loadEnhancedViewer,0);
})();
