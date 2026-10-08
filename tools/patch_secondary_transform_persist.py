from pathlib import Path

p = Path("secondary.js")
s = p.read_text()
old = '''  function commitSelectionTransform(){
    const chosen=[...selectedResidues].filter(i=>i>=0&&i<seq.length);
    if(!chosen.length||(Math.abs(selectionRotation)<=1e-8&&Math.abs(selectionScale-1)<=1e-8))return false;
    const final=coordinates();
    const center={x:chosen.reduce((sum,i)=>sum+final[i].x,0)/chosen.length,y:chosen.reduce((sum,i)=>sum+final[i].y,0)/chosen.length};
    const inverseSelected=(p)=>{
      const angle=-selectionRotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),scale=1/selectionScale;
      const x=(p.x-center.x)*scale,y=(p.y-center.y)*scale;
      return {x:center.x+x*cos-y*sin,y:center.y+x*sin+y*cos};
    };
    const wholeAngle=-wholeRotation*Math.PI/180,wholeCos=Math.cos(wholeAngle),wholeSin=Math.sin(wholeAngle);
    chosen.forEach(i=>{
      const before=inverseSelected(final[i]),dx=final[i].x-before.x,dy=final[i].y-before.y;
      const localDx=dx*wholeCos-dy*wholeSin,localDy=dx*wholeSin+dy*wholeCos,base=manualOffsets[i]||{x:0,y:0};
      manualOffsets[i]={x:(Number(base.x)||0)+localDx,y:(Number(base.y)||0)+localDy};
    });
    selectionRotation=0;selectionScale=1;
    return true;
  }'''
new = '''  function commitSelectionTransform(){
    const chosen=[...selectedResidues].filter(i=>i>=0&&i<seq.length);
    if(!chosen.length||(Math.abs(selectionRotation)<=1e-8&&Math.abs(selectionScale-1)<=1e-8))return false;
    // Capture exactly what the user sees, then bake that displacement into
    // per-residue manual offsets before the selection is changed or cleared.
    const final=coordinates();
    selectionRotation=0;selectionScale=1;
    const before=coordinates();
    const wholeAngle=-wholeRotation*Math.PI/180,wholeCos=Math.cos(wholeAngle),wholeSin=Math.sin(wholeAngle);
    chosen.forEach(i=>{
      const dx=final[i].x-before[i].x,dy=final[i].y-before[i].y;
      // manualOffsets are stored before whole-structure rotation.
      const localDx=dx*wholeCos-dy*wholeSin,localDy=dx*wholeSin+dy*wholeCos,base=manualOffsets[i]||{x:0,y:0};
      manualOffsets[i]={x:(Number(base.x)||0)+localDx,y:(Number(base.y)||0)+localDy};
    });
    return true;
  }'''
if old not in s:
    raise SystemExit("commitSelectionTransform anchor missing")
p.write_text(s.replace(old, new, 1))

p = Path("index.html")
s = p.read_text()
old = "secondary.js?v=secondary-24"
new = "secondary.js?v=secondary-25"
if old not in s:
    raise SystemExit("secondary cache anchor missing")
p.write_text(s.replace(old, new, 1))
