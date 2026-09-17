/* Numbered structural formulas: connectivity and bond order, not a stereochemical projection.
 * Condensation schemes are formal atom bookkeeping, not biosynthetic mechanisms.
 */
const chemistry = { base: 'C', step: 0, busy: false, timer: null };
const chemicalNames = {
  A: ['Adenine', 'Adenosine', 'Adenosine 5′-monophosphate (AMP)'],
  G: ['Guanine', 'Guanosine', 'Guanosine 5′-monophosphate (GMP)'],
  C: ['Cytosine', 'Cytidine', 'Cytidine 5′-monophosphate (CMP)'],
  U: ['Uracil', 'Uridine', 'Uridine 5′-monophosphate (UMP)']
};
function chemicalDiagram(base, step, overview = false, hidePhosphate = false) {
  const linked = step >= 1, phosphorylated = step >= 2;
  const purine = base === 'A' || base === 'G';
  const attach = purine ? 'N9' : 'N1';
  const atoms = [], bonds = [], labels = [];
  const a = (id, x, y, text, kind = '') => { atoms.push({id,x,y,text,kind}); return id; };
  const b = (from, to, order = 1, kind = '') => bonds.push({from,to,order,kind});
  // Ribofuranose connectivity, with sugar carbon positions explicitly identified.
  a('c1',490,280,'C1′'); a('c2',455,370,'C2′'); a('c3',355,370,'C3′');
  a('c4',320,280,'C4′'); a('or',405,235,'O'); a('c5',280,210,'C5′');
  [['c1','c2'],['c2','c3'],['c3','c4'],['c4','or'],['or','c1'],['c4','c5']].forEach(p=>b(...p));
  a('oh2',475,430,'OH'); a('oh3',335,430,'OH'); b('c2','oh2'); b('c3','oh3');
  a('o5',220,210,'O'); b('c5','o5');
  if (!phosphorylated) { a('h5',220,157,'H',step===1&&!hidePhosphate?'leaving':''); b('o5','h5'); }
  if (!linked) { a('oh1',535,335,'OH','leaving'); b('c1','oh1'); }
  // Neutral acid convention keeps the two formal condensation equations atom-balanced.
  a('p',110,210,'P'); a('po',110,140,'O'); a('poh',45,210,'HO'); a('poh2',110,275,'OH');
  b('p','po',2); b('p','poh'); b('p','poh2');
  if (!phosphorylated) { a('leaveP',155,255,'OH',step===1?'leaving':''); b('p','leaveP'); }
  else b('p','o5',1,'formed phosphate-bond');
  if (purine) {
    a('n',600,230,'N9','base'); a('c8',565,170,'C8','base'); a('n7',610,125,'N7','base');
    a('c5b',665,155,'C5','base'); a('c4b',655,220,'C4','base');
    a('c6',720,120,'C6','base'); a('n1',775,150,base==='G'?'N1–H':'N1','base');
    a('c2b',775,215,'C2','base'); a('n3',715,250,'N3','base');
    [['n','c8',1],['c8','n7',2],['n7','c5b',1],['c5b','c4b',2],['c4b','n',1],
     ['c5b','c6',1],['c6','n1',base==='A'?2:1],['n1','c2b',1],['c2b','n3',2],['n3','c4b',1]].forEach(p=>b(...p));
    a('ex6',720,57,base==='A'?'NH₂':'O','base'); b('c6','ex6',base==='A'?1:2);
    if (base==='G') { a('ex2',852,237,'NH₂','base'); b('c2b','ex2'); }
  } else {
    a('n',600,230,'N1','base'); a('c2b',650,260,'C2','base'); a('n3',700,230,base==='U'?'N3–H':'N3','base');
    a('c4b',700,170,'C4','base'); a('c5b',650,140,'C5','base'); a('c6',600,170,'C6','base');
    [['n','c2b',1],['c2b','n3',1],['n3','c4b',base==='C'?2:1],['c4b','c5b',1],['c5b','c6',2],['c6','n',1]].forEach(p=>b(...p));
    a('ex2',650,325,'O','base'); b('c2b','ex2',2);
    a('ex4',755,135,base==='C'?'NH₂':'O','base'); b('c4b','ex4',base==='C'?1:2);
  }
  if (!linked) { a('hn',555,260,'H','leaving'); b('n','hn'); }
  else b('c1','n',1,'formed glycosidic-bond');
  labels.push(`<text x="390" y="487" class="chem-label">${linked ? chemicalNames[base][1] + ' · nucleoside' : 'Ribofuranose (ribose)'}</text>`);
  if(!hidePhosphate) labels.push(`<text x="120" y="340" class="chem-label">${phosphorylated?'5′-phosphate':'Phosphoric acid'}</text>`);
  labels.push(`<text x="690" y="385" class="chem-label">${chemicalNames[base][0]} · ${purine?'purine':'pyrimidine'}</text>`);
  const hidden = hidePhosphate ? ['p','po','poh','poh2','leaveP'] : [];
  const lines = bonds.filter(p=>!hidden.includes(p.from)&&!hidden.includes(p.to)).map(({from,to,order,kind})=>{
    const p=atoms.find(v=>v.id===from), q=atoms.find(v=>v.id===to);
    const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy), ox=-dy/len*3,oy=dx/len*3;
    const line=(shift)=>`<line x1="${p.x+ox*shift}" y1="${p.y+oy*shift}" x2="${q.x+ox*shift}" y2="${q.y+oy*shift}"/>`;
    const title=kind.includes('glycosidic')?`C1′–${attach} N-glycosidic bond`:kind.includes('phosphate')?'5′-O–P phosphoester bond':'';
    const leaving = p.kind==='leaving'||q.kind==='leaving';
    return `<g class="chem-bonds ${kind} ${leaving?'departing-bond':''}" ${title?`role="button" tabindex="0" data-bond="${title}" aria-label="${title}"`:''}>${title?`<title>${title}</title><line class="bond-hit" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`:''}${order===2?line(-1)+line(1):line(0)}</g>`;
  }).join('');
  const texts=atoms.filter(p=>!hidden.includes(p.id)).map(p=>`<text x="${p.x}" y="${p.y}" style="--travel-x:${(p.text==='H'?810:775)-p.x}px;--travel-y:${455-p.y}px" class="chem-atom ${p.kind}">${p.text}</text>`).join('');
  return `<svg class="reaction-svg" viewBox="${hidePhosphate?'190 0 710 520':'0 0 900 520'}" role="img" aria-label="${chemicalNames[base][step]}: numbered chemical connectivity diagram. ${linked?`C1′ joined to ${attach}.`:'Highlighted ribose OH and base H form water.'} ${phosphorylated?'5′ oxygen bonded to phosphorus.':''}" style="--base-color:${BASE_COLORS[base]}">${lines}${texts}${labels.join('')}${!overview&&step>0?`<g class="water-product"><text x="785" y="455">+ H₂O</text><text x="785" y="485" class="chem-label">released this step</text></g>`:''}</svg>`;
}
