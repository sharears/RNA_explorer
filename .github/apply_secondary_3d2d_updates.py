from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    return out


# -----------------------------------------------------------------------------
# Secondary Structure: adaptive backbone gap + per-residue circle override.
# -----------------------------------------------------------------------------
p = Path("secondary.js")
text = p.read_text()

text = replace_once(
    text,
    '''  function residueStyle(i) {\n    return {...settings,fillColor:heatEnabled&&metadata[i]?.value!=null?heatColor(metadata[i].value):settings.fillColor||colors[seq[i]],...residueOverrides[i]};\n  }''',
    '''  function residueStyle(i) {\n    return {...settings,fillColor:heatEnabled&&metadata[i]?.value!=null?heatColor(metadata[i].value):settings.fillColor||colors[seq[i]],...residueOverrides[i]};\n  }\n  function residueTextClearance(i) {\n    const s=residueStyle(i);\n    if(s.circleVisible!==false)return 0;\n    const size=Number(s.letterSize)||16;\n    // Scale the backbone gap with the residue label, but cap it so extreme\n    // font sizes do not erase whole backbone segments.\n    return Math.min(18,Math.max(7,size*.62+2));\n  }''',
    "secondary text clearance helper",
)

text = replace_once(
    text,
    '''      const g=svg("g",{class:"se-backbone",role:"button",tabindex:0,"aria-label":`Backbone ${i+1}–${i+2}`,"data-backbone":i});\n      g.append(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:bs.backColor,"stroke-width":bs.backWidth,opacity:bs.backOpacity}));\n      g.append(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"transparent","stroke-width":14,"pointer-events":"stroke","data-export-remove":""}));''',
    '''      const g=svg("g",{class:"se-backbone",role:"button",tabindex:0,"aria-label":`Backbone ${i+1}–${i+2}`,"data-backbone":i});\n      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;\n      let trimA=residueTextClearance(i),trimB=residueTextClearance(i+1);\n      if(trimA+trimB>len-4){const scale=Math.max(0,(len-4)/Math.max(1,trimA+trimB));trimA*=scale;trimB*=scale;}\n      g.append(svg("line",{x1:a.x+dx/len*trimA,y1:a.y+dy/len*trimA,x2:b.x-dx/len*trimB,y2:b.y-dy/len*trimB,stroke:bs.backColor,"stroke-width":bs.backWidth,opacity:bs.backOpacity,"data-backbone-visible":""}));\n      g.append(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"transparent","stroke-width":14,"pointer-events":"stroke","data-export-remove":""}));''',
    "secondary backbone gap",
)

text = replace_once(
    text,
    '''  const residueFields=[\n    ["fillColor","Circle fill","color"],["circleColor","Circle outline color","color"],\n    ["circleWidth","Circle outline thickness","number",0,8,.5],''',
    '''  const residueFields=[\n    ["circleVisible","Show circle for selected residue","checkbox"],\n    ["fillColor","Circle fill","color"],["circleColor","Circle outline color","color"],\n    ["circleWidth","Circle outline thickness","number",0,8,.5],''',
    "individual circle field",
)

text = replace_once(
    text,
    '''  function localFields(fields,prefix){\n    return fields.map(([k,label,type,min,max,step])=>'<label>'+label+(type==="select"\n      ?'<select id="'+prefix+k+'">'+min.map(v=>'<option value="'+v+'">'+v+'</option>').join("")+'</select>'\n      :'<input id="'+prefix+k+'" type="'+type+'" '+(type==="number"?'min="'+min+'" max="'+max+'" step="'+step+'"':'')+'>')+'</label>').join("");\n  }''',
    '''  function localFields(fields,prefix){\n    return fields.map(([k,label,type,min,max,step])=>'<label>'+label+(type==="select"\n      ?'<select id="'+prefix+k+'">'+min.map(v=>'<option value="'+v+'">'+v+'</option>').join("")+'</select>'\n      :type==="checkbox"?'<input id="'+prefix+k+'" type="checkbox">'\n      :'<input id="'+prefix+k+'" type="'+type+'" '+(type==="number"?'min="'+min+'" max="'+max+'" step="'+step+'"':'')+'>')+'</label>').join("");\n  }''',
    "local checkbox fields",
)

text = replace_once(
    text,
    '''      collection[i][k]=e.target.type==="number"?Number(e.target.value):e.target.value;render();''',
    '''      collection[i][k]=e.target.type==="checkbox"?e.target.checked:e.target.type==="number"?Number(e.target.value):e.target.value;render();''',
    "local checkbox binding",
)

text = replace_once(
    text,
    '''    residueFields.forEach(([k])=>$("seResidue-"+k).value=r[k]);''',
    '''    residueFields.forEach(([k])=>{const el=$("seResidue-"+k);if(el.type==="checkbox")el.checked=r[k]!==false;else el.value=r[k];});''',
    "local checkbox panel sync",
)

text = replace_once(
    text,
    '''      setSourceNote("Derived from 3D coordinates · "+source+(Number.isFinite(pairsDetected)?" · "+pairsDetected+" base pairs":"")+". Browser geometry inference; verify with a dedicated annotation tool for publication-grade assignments.");''',
    '''      const detectedCww=Number(meta.detectedCwwCount),omitted=Number(meta.omittedPairCount);\n      setSourceNote("3D-derived · cWW only · experimental. This view contains only cWW pairs detected from the 3D coordinates"+(Number.isFinite(detectedCww)?" ("+detectedCww+" detected)":"")+(Number.isFinite(pairsDetected)?"; "+pairsDetected+" are displayed":"")+(Number.isFinite(omitted)&&omitted>0?" and "+omitted+" competing/crossing pair"+(omitted===1?" was":"s were")+" omitted for the current dot-bracket layout":"")+". The detector is still being evaluated for accuracy. Treat this as a rough visualization for learning and exploration, not as a publication-ready secondary-structure annotation.");''',
    "derived secondary warning",
)

p.write_text(text)


# -----------------------------------------------------------------------------
# Homepage cover: comic-style non-italic bubble, slightly higher.
# -----------------------------------------------------------------------------
p = Path("styles.css")
text = p.read_text()
text = replace_once(text, "  top:7%;", "  top:2%;", "home bubble position")
text = replace_once(
    text,
    '  font:italic 600 clamp(.76rem,1.1vw,.98rem)/1.45 Georgia,serif;',
    '  font:600 clamp(.76rem,1.1vw,.98rem)/1.45 "Comic Sans MS","Comic Sans",cursive;\n  font-style:normal;',
    "home bubble comic font",
)
text = replace_once(
    text,
    '  .home-thought-bubble{top:5%;right:4%;width:46%;padding:12px 13px;font-size:.72rem}',
    '  .home-thought-bubble{top:1%;right:4%;width:46%;padding:12px 13px;font-size:.72rem}',
    "home bubble mobile position",
)
p.write_text(text)


# -----------------------------------------------------------------------------
# Tertiary: port the validated cWW geometry definitions into browser JS and use
# them for 3D -> 2D generation. Standard A/G/C/U residues are pair candidates,
# matching detect_cww_directory_v0_1.py default policy.
# -----------------------------------------------------------------------------
p = Path("tertiary.js")
text = p.read_text()

cww_block = r'''  const CWW_RING_ATOMS={
    A:["N9","C8","N7","C5","C6","N1","C2","N3","C4"],
    G:["N9","C8","N7","C5","C6","N1","C2","N3","C4"],
    C:["N1","C2","N3","C4","C5","C6"],U:["N1","C2","N3","C4","C5","C6"]
  };
  const CWW_EDGE_ATOMS={A:["N1","N6"],G:["O6","N1","N2"],C:["N4","N3","O2"],U:["O4","N3","O2"]};
  const CWW_CUTOFFS={center:15,vertical:2.5,normal:65,glycoMin:4.5,edgeAngle:55,contact:3.7,minInplane:3.5};
  const cwwVec=(x,y,z)=>({x:Number(x),y:Number(y),z:Number(z)});
  const cwwSub=(a,b)=>cwwVec(a.x-b.x,a.y-b.y,a.z-b.z);
  const cwwDot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cwwCross=(a,b)=>cwwVec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
  const cwwNorm=a=>Math.hypot(a.x,a.y,a.z);
  const cwwScale=(a,s)=>cwwVec(a.x*s,a.y*s,a.z*s);
  function cwwNormalize(a){const n=cwwNorm(a);return n>1e-12?cwwScale(a,1/n):null;}
  function cwwMean(points){return points.reduce((s,p)=>cwwVec(s.x+p.x/points.length,s.y+p.y/points.length,s.z+p.z/points.length),cwwVec(0,0,0));}
  function cwwAtom(residue,name){
    const hits=(residue?.atoms||[]).filter(a=>atomName(a)===name);if(!hits.length)return null;
    hits.sort((a,b)=>{
      const oa=Number(a.occupancy??a.occ??-1),ob=Number(b.occupancy??b.occ??-1);if(ob!==oa)return ob-oa;
      return String(a.altLoc??a.altloc??"").localeCompare(String(b.altLoc??b.altloc??""));
    });return hits[0];
  }
  function cwwCoord(residue,name){const a=cwwAtom(residue,name);return a?cwwVec(a.x,a.y,a.z):null;}
  function cwwCoords(residue,names){return names.map(name=>[name,cwwCoord(residue,name)]).filter(([,p])=>p);}
  function cwwBestFitPlane(points){
    if(points.length<3)return null;const center=cwwMean(points);
    const a=[[0,0,0],[0,0,0],[0,0,0]];
    points.forEach(p=>{const q=cwwSub(p,center);a[0][0]+=q.x*q.x;a[0][1]+=q.x*q.y;a[0][2]+=q.x*q.z;a[1][1]+=q.y*q.y;a[1][2]+=q.y*q.z;a[2][2]+=q.z*q.z;});
    a[1][0]=a[0][1];a[2][0]=a[0][2];a[2][1]=a[1][2];
    const v=[[1,0,0],[0,1,0],[0,0,1]];
    for(let iter=0;iter<30;iter++){
      let p=0,q=1,max=Math.abs(a[0][1]);[[0,2],[1,2]].forEach(([i,j])=>{const x=Math.abs(a[i][j]);if(x>max){max=x;p=i;q=j;}});if(max<1e-10)break;
      const app=a[p][p],aqq=a[q][q],apq=a[p][q],phi=.5*Math.atan2(2*apq,aqq-app),c=Math.cos(phi),s=Math.sin(phi);
      for(let k=0;k<3;k++)if(k!==p&&k!==q){const akp=a[k][p],akq=a[k][q];a[k][p]=a[p][k]=c*akp-s*akq;a[k][q]=a[q][k]=s*akp+c*akq;}
      a[p][p]=c*c*app-2*s*c*apq+s*s*aqq;a[q][q]=s*s*app+2*s*c*apq+c*c*aqq;a[p][q]=a[q][p]=0;
      for(let k=0;k<3;k++){const vkp=v[k][p],vkq=v[k][q];v[k][p]=c*vkp-s*vkq;v[k][q]=s*vkp+c*vkq;}
    }
    let idx=0;if(a[1][1]<a[idx][idx])idx=1;if(a[2][2]<a[idx][idx])idx=2;
    const normal=cwwNormalize(cwwVec(v[0][idx],v[1][idx],v[2][idx]));return normal?{center,normal}:null;
  }
  function cwwFitNucleotide(residue,index){
    const base=String(residue?.resn||"").trim().toUpperCase();if(!/^[ACGU]$/.test(base))return null;
    const ring=cwwCoords(residue,CWW_RING_ATOMS[base]).map(([,p])=>p);if(ring.length<5)return null;
    const plane=cwwBestFitPlane(ring);if(!plane)return null;
    const edge=cwwCoords(residue,CWW_EDGE_ATOMS[base]).map(([,p])=>p);if(!edge.length)return null;
    const edgeCenter=cwwMean(edge),raw=cwwSub(edgeCenter,plane.center),wcVec=cwwNormalize(cwwSub(raw,cwwScale(plane.normal,cwwDot(raw,plane.normal))));if(!wcVec)return null;
    const glycoAtom=base==="A"||base==="G"?"N9":"N1",c1=cwwCoord(residue,"C1'"),gly=cwwCoord(residue,glycoAtom);if(!c1||!gly)return null;
    return {index,residue,base,center:plane.center,normal:plane.normal,wcVec,glycoVec:cwwSub(gly,c1),glycoAtom};
  }
  function cwwAngleDeg(a,b,fold180=false){const na=cwwNorm(a),nb=cwwNorm(b);if(!na||!nb)return 180;let x=cwwDot(a,b)/(na*nb);if(fold180)x=Math.abs(x);return Math.acos(clamp(x,-1,1))*180/Math.PI;}
  function cwwContactCount(a,b){
    const left=cwwCoords(a.residue,CWW_EDGE_ATOMS[a.base]),right=cwwCoords(b.residue,CWW_EDGE_ATOMS[b.base]);let count=0,min=Infinity;
    left.forEach(([nameA,p])=>{if(!/^[NO]/.test(nameA))return;right.forEach(([nameB,q])=>{if(!/^[NO]/.test(nameB))return;const d=pointDistance(p,q);if(d<=CWW_CUTOFFS.contact){count++;min=Math.min(min,d);}});});
    return {count,min:Number.isFinite(min)?min:NaN};
  }
  function cwwClassify(a,b){
    const dvec=cwwSub(b.center,a.center),centerDistance=cwwNorm(dvec),normalAngle=cwwAngleDeg(a.normal,b.normal,true);
    const vertical=(Math.abs(cwwDot(dvec,a.normal))+Math.abs(cwwDot(dvec,b.normal)))/2;
    const in1=cwwNorm(cwwSub(dvec,cwwScale(a.normal,cwwDot(dvec,a.normal)))),rev=cwwScale(dvec,-1),in2=cwwNorm(cwwSub(rev,cwwScale(b.normal,cwwDot(rev,b.normal)))),inplane=(in1+in2)/2;
    const gly1=cwwCoord(a.residue,a.glycoAtom),gly2=cwwCoord(b.residue,b.glycoAtom),glycoDistance=gly1&&gly2?pointDistance(gly1,gly2):NaN;
    const cisScore=cwwDot(cwwCross(dvec,a.glycoVec),cwwCross(dvec,b.glycoVec));
    const p12=cwwSub(dvec,cwwScale(a.normal,cwwDot(dvec,a.normal))),p21=cwwSub(rev,cwwScale(b.normal,cwwDot(rev,b.normal)));
    const edgeAngle1=cwwAngleDeg(a.wcVec,p12),edgeAngle2=cwwAngleDeg(b.wcVec,p21),contacts=cwwContactCount(a,b);
    const ok=centerDistance<=CWW_CUTOFFS.center&&vertical<=CWW_CUTOFFS.vertical&&normalAngle<=CWW_CUTOFFS.normal&&Number.isFinite(glycoDistance)&&glycoDistance>=CWW_CUTOFFS.glycoMin&&inplane>=CWW_CUTOFFS.minInplane&&cisScore>=0&&edgeAngle1<=CWW_CUTOFFS.edgeAngle&&edgeAngle2<=CWW_CUTOFFS.edgeAngle&&contacts.count>=1;
    return {isCww:ok,centerDistance,vertical,inplane,normalAngle,glycoDistance,cisScore,edgeAngle1,edgeAngle2,nWcContacts:contacts.count,minWcContactDistance:contacts.min};
  }
  function detectCwwPairs(residues){
    const fitted=residues.map((r,i)=>cwwFitNucleotide(r,i)).filter(Boolean),cell=CWW_CUTOFFS.center,buckets=new Map();
    const cellKey=(x,y,z)=>x+","+y+","+z;
    fitted.forEach(nt=>{const c=[Math.floor(nt.center.x/cell),Math.floor(nt.center.y/cell),Math.floor(nt.center.z/cell)];nt.cell=c;const key=cellKey(...c);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(nt);});
    const detected=[];let candidateCount=0;
    fitted.forEach(a=>{for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
      const list=buckets.get(cellKey(a.cell[0]+dx,a.cell[1]+dy,a.cell[2]+dz))||[];
      list.forEach(b=>{if(b.index<=a.index||pointDistance(a.center,b.center)>CWW_CUTOFFS.center)return;candidateCount++;const geom=cwwClassify(a,b);if(geom.isCww)detected.push({i:a.index,j:b.index,identity:a.base+b.base,geom});});
    }});
    return {detected,candidateCount,fittedCount:fitted.length};
  }
  function deriveSecondaryFromResidues(residues){
    if(!Array.isArray(residues)||residues.length<2)throw new Error("Choose an RNA chain before generating a 2D structure.");
    if(residues.length>1000)throw new Error("3D → 2D generation currently supports RNA chains up to 1,000 residues.");
    const sequence=residues.map(r=>r.base).join(""),unknown=[...sequence].map((b,i)=>b==="?"?i+1:null).filter(Boolean);
    if(unknown.length)throw new Error("Cannot derive a complete 2D structure because "+unknown.length+" residue"+(unknown.length===1?" is":"s are")+" not recognized as A, C, G, or U (first: "+unknown.slice(0,8).join(", ")+(unknown.length>8?", …":"")+").");
    const result=detectCwwPairs(residues),detected=result.detected;
    if(!detected.length)throw new Error("No cWW pairs passed the current geometry detector for this chain.");
    const ranked=detected.slice().sort((a,b)=>b.geom.nWcContacts-a.geom.nWcContacts||(a.geom.minWcContactDistance||99)-(b.geom.minWcContactDistance||99)||a.geom.vertical-b.geom.vertical||(a.geom.edgeAngle1+a.geom.edgeAngle2)-(b.geom.edgeAngle1+b.geom.edgeAngle2));
    const chosen=[],used=new Set(),crosses=(x,y)=>chosen.some(p=>(p.i<x&&x<p.j&&p.j<y)||(x<p.i&&p.i<y&&y<p.j));
    ranked.forEach(pair=>{if(used.has(pair.i)||used.has(pair.j)||crosses(pair.i,pair.j))return;chosen.push(pair);used.add(pair.i);used.add(pair.j);});chosen.sort((a,b)=>a.i-b.i);
    const chars=Array(sequence.length).fill(".");chosen.forEach(({i,j})=>{chars[i]="(";chars[j]=")";});
    return {sequence,structure:chars.join(""),pairs:chosen,detectedPairs:detected,candidateCount:result.candidateCount,fittedCount:result.fittedCount,omittedCount:detected.length-chosen.length};
  }
  function generateSecondaryFrom3D(){'''

text = sub_once(
    text,
    r'''  function canonicalGeometryCandidate\(residues,i,j\)\{.*?  function generateSecondaryFrom3D\(\)\{''',
    cww_block,
    "replace 3D-to-2D detector",
    flags=re.S,
)

text = replace_once(
    text,
    '''    state.derivedSecondary={sequence:derived.sequence,structure:derived.structure,chainId:chain.id,source:state.currentFileName,pairCount:derived.pairs.length,candidateCount:derived.candidateCount};''',
    '''    state.derivedSecondary={sequence:derived.sequence,structure:derived.structure,chainId:chain.id,source:state.currentFileName,pairCount:derived.pairs.length,detectedCwwCount:derived.detectedPairs.length,omittedPairCount:derived.omittedCount,candidateCount:derived.candidateCount};''',
    "derived metadata",
)

text = replace_once(
    text,
    '''      SecondaryExplorer.loadDerived(derived.sequence,derived.structure,{source:state.currentFileName+" · chain "+(chain.id||"(blank)"),pairCount:derived.pairs.length});''',
    '''      SecondaryExplorer.loadDerived(derived.sequence,derived.structure,{source:state.currentFileName+" · chain "+(chain.id||"(blank)"),pairCount:derived.pairs.length,detectedCwwCount:derived.detectedPairs.length,omittedPairCount:derived.omittedCount});''',
    "derived warning metadata pass",
)

text = replace_once(
    text,
    '''    if(status){status.hidden=false;status.textContent="Derived from 3D coordinates · "+derived.pairs.length+" base pairs selected from "+derived.candidateCount+" geometry candidates. G–C, A–U, and G–U pairs are inferred from expected donor/acceptor distances plus base-plane geometry; crossing candidates are omitted from the dot-bracket output.";}''',
    '''    if(status){status.hidden=false;status.textContent="Experimental cWW-only 3D → 2D · "+derived.detectedPairs.length+" cWW pairs detected; "+derived.pairs.length+" displayed"+(derived.omittedCount?"; "+derived.omittedCount+" competing/crossing pair"+(derived.omittedCount===1?" omitted":"s omitted"):"")+". The cWW detector is still being evaluated for accuracy. Use this as a rough visualization for learning/exploration, not as a publication-ready secondary-structure annotation.";}''',
    "derived status warning",
)

text = replace_once(
    text,
    '''    extractChains();chooseBestChain();populateChainSelect();buildResidueLookup();evaluateMapping();''',
    '''    extractChains();\n    if(!sourceIsDefault&&state.chains.length>1){state.activeChain=null;state.chainNeedsChoice=true;}else chooseBestChain();\n    populateChainSelect();buildResidueLookup();evaluateMapping();''',
    "explicit chain selection for multi-chain input",
)

text = replace_once(
    text,
    '''      '<div class="te-button-row"><button type="button" id="teGenerateSecondary">Generate 2D from 3D</button><button type="button" id="teOpenDerivedSecondary" hidden>Open generated 2D in Secondary workspace</button></div>'+\n      '<p id="teDerivedStatus" class="te-derived-status te-tool-note" role="status" hidden></p>'+''',
    '''      '<div class="te-button-row"><button type="button" id="teGenerateSecondary">Generate 2D from 3D</button><button type="button" id="teOpenDerivedSecondary" hidden>Open generated 2D in Secondary workspace</button></div>'+\n      '<p class="te-derived-warning te-tool-note"><strong>Experimental:</strong> automatic 3D → 2D shows only cWW base pairs detected from coordinates. The detector is still being evaluated for accuracy; treat the result as a rough learning/exploration view, not a publication-ready secondary-structure annotation.</p>'+\n      '<p id="teDerivedStatus" class="te-derived-status te-tool-note" role="status" hidden></p>'+''',
    "persistent cww warning",
)

text = replace_once(
    text,
    '''    $("teGenerateSecondary").addEventListener("click",()=>{const button=$("teGenerateSecondary"),status=$("teDerivedStatus");button.disabled=true;if(status){status.hidden=false;status.textContent="Deriving base pairs from the active 3D RNA chain…";}try{generateSecondaryFrom3D();}catch(error){if(status){status.hidden=false;status.textContent="3D → 2D generation failed: "+error.message;}}finally{button.disabled=false;}});''',
    '''    $("teGenerateSecondary").addEventListener("click",()=>{const button=$("teGenerateSecondary"),status=$("teDerivedStatus");button.disabled=true;if(status){status.hidden=false;status.textContent="Detecting cWW pairs from the active 3D RNA chain…";}try{generateSecondaryFrom3D();}catch(error){if(status){status.hidden=false;status.textContent="3D → 2D generation failed: "+error.message;}}finally{button.disabled=false;}});''',
    "generate status copy",
)

p.write_text(text)


# Cache-bust changed assets.
p = Path("index.html")
text = p.read_text()
text = text.replace('styles.css?v=learning-chemistry-2', 'styles.css?v=home-secondary-3')
text = text.replace('secondary.js?v=secondary-21', 'secondary.js?v=secondary-22')
text = text.replace('tertiary.js?v=tertiary-11', 'tertiary.js?v=tertiary-12')
p.write_text(text)
