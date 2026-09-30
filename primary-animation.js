const primaryGrowth = { count: 0, timer: null, done: false, running: false };

function cancelPrimaryAnimation() {
  if (primaryGrowth.timer !== null) clearTimeout(primaryGrowth.timer);
  primaryGrowth.timer = null;
  primaryGrowth.running = false;
}

// A connectivity diagram, not a reaction mechanism. Each incoming unit is already a nucleotide:
 // base + ribose + 5′ phosphate. Chain growth connects the previous 3′ oxygen to that nucleotide phosphate.
function growthDiagram(count) {
  const visible = Math.min(count, 5);
  const fragments = [];
  const line = (x1,y1,x2,y2,cls='')=>`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const label = (x,y,t,cls='')=>`<text x="${x}" y="${y}" class="${cls}">${t}</text>`;
  for(let i=0;i<visible;i++) {
    const x=118+i*190, last=i===visible-1;
    const base=RNA_SEQUENCE[i];
    const phosphateX=x-82, phosphateY=208;
    const pOtop=[phosphateX,phosphateY-31],pOleft=[phosphateX-32,phosphateY+3],pObottom=[phosphateX,phosphateY+34],pObridge=[phosphateX+31,phosphateY-6];
    fragments.push(`<g class="growth-residue ${last?'arriving-residue':''}" data-position="${i+1}" data-nucleotide-phosphate="attached">
      <g class="growth-phosphate detailed-phosphate" aria-label="5 prime phosphate group already attached to nucleotide">
        ${line(phosphateX,phosphateY-7,pOtop[0],pOtop[1]+7,'phosphate-bond phosphate-double-1')}
        ${line(phosphateX+5,phosphateY-5,pOtop[0]+5,pOtop[1]+9,'phosphate-bond phosphate-double-2')}
        ${line(phosphateX-8,phosphateY+2,pOleft[0]+8,pOleft[1]-1,'phosphate-bond')}
        ${line(phosphateX,phosphateY+8,pObottom[0],pObottom[1]-8,'phosphate-bond')}
        ${line(phosphateX+8,phosphateY-1,pObridge[0]-8,pObridge[1]+1,'phosphate-bond')}
        ${line(pObridge[0]+8,pObridge[1],x-55,177,'nucleotide-phosphate-bond')}
        <circle class="phosphate-atom phosphorus" cx="${phosphateX}" cy="${phosphateY}" r="10"/>${label(phosphateX,phosphateY+4,'P','growth-phosphate-label')}
        <circle class="phosphate-atom oxygen" cx="${pOtop[0]}" cy="${pOtop[1]}" r="8"/>${label(pOtop[0],pOtop[1]+4,'O','growth-oxygen-label')}
        <circle class="phosphate-atom oxygen" cx="${pOleft[0]}" cy="${pOleft[1]}" r="8"/>${label(pOleft[0],pOleft[1]+4,'O⁻','growth-oxygen-label')}
        <circle class="phosphate-atom oxygen" cx="${pObottom[0]}" cy="${pObottom[1]}" r="8"/>${label(pObottom[0],pObottom[1]+4,'O⁻','growth-oxygen-label')}
        <circle class="phosphate-atom oxygen bridge" cx="${pObridge[0]}" cy="${pObridge[1]}" r="8"/>${label(pObridge[0],pObridge[1]+4,'O','growth-oxygen-label')}
      </g>
      <path d="M ${x-35} 120 L ${x} 95 L ${x+35} 120 L ${x+22} 165 L ${x-22} 165 Z"/>
      ${label(x,95,'O')}${label(x+35,120,'1′')}${label(x+22,165,'2′')}${label(x-22,165,'3′')}${label(x-35,120,'4′')}
      ${line(x+35,120,x+55,70)}<circle cx="${x+55}" cy="55" r="23" style="fill:${BASE_COLORS[base]}"/>
      ${label(x+55,56,base,'growth-base')}${label(x+55,22,String(i+1),'growth-position')}
      ${line(x+22,165,x+22,193)}${label(x+22,202,'OH')}
      ${line(x-35,120,x-55,120)}${label(x-55,120,'5′')}${line(x-55,120,x-55,177)}${label(x-55,184,'O')}
      ${line(x-22,165,x-22,247)}${label(x-22,253,last?'OH':'O')}
      ${last?label(x-22,292,'3′ end','end-label'):''}
      <title>Nucleotide ${i+1}: base + ribose + attached 5′ phosphate</title>
    </g>`);
    if(i>0) {
      const prev=x-190;
      fragments.push(`<g class="growth-link ${last?'new-growth-link':''}" data-link="${i}-${i+1}">
        ${line(prev-22,247,pOleft[0]-8,pOleft[1],'inter-nucleotide-link')}
        <title>Residue ${i} O3′ connects to the phosphate already attached to nucleotide ${i+1}, forming a 3′–5′ phosphodiester linkage.</title>
      </g>`);
    }
  }
  return `<svg viewBox="0 0 1030 345" class="growth-svg" role="img" aria-label="${visible} complete nucleotides connected from 5′ to 3′. Each nucleotide already carries its phosphate before the inter-nucleotide linkage forms.">
    ${fragments.join('')}${label(32,292,'5′ end','end-label')}
    <path class="growth-direction" d="M 160 323 L 900 323 L 885 316 M 900 323 L 885 330"/>
    ${label(530,312,'Link nucleotides: 5′ → 3′','direction-label')}</svg>`;
}

function renderPrimaryGrowth() {
  const compact=primaryGrowth.count>5;
  const diagram=document.getElementById('chainGrowth');
  if(primaryGrowth.count<=5) diagram.innerHTML=growthDiagram(primaryGrowth.count);
  diagram.classList.toggle('chain-to-letters',compact);
  document.getElementById('sequenceReveal').hidden=!compact;
  document.querySelectorAll('#primarySequence .nt').forEach((el,i)=>{
    const built=i<primaryGrowth.count;
    el.classList.toggle('unbuilt',!built);
    el.disabled=!built;
    el.setAttribute('aria-hidden',String(!built));
  });
  document.getElementById('growthCount').textContent=`${primaryGrowth.count} / ${RNA_SEQUENCE.length} nucleotides`;
  document.getElementById('growthReplay').textContent=primaryGrowth.running?'Restart animation':'Replay animation';
}

function playPrimaryAnimation() {
  cancelPrimaryAnimation();
  primaryGrowth.done=false;
  primaryGrowth.running=true;
  primaryGrowth.count=1;
  document.getElementById('growthStatus').textContent='Each incoming unit is already a nucleotide with base, ribose, and phosphate. The growing RNA connects its 3′ oxygen to the phosphate of the next nucleotide.';
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    primaryGrowth.count=RNA_SEQUENCE.length;
    primaryGrowth.done=true;
    primaryGrowth.running=false;
    document.getElementById('chainGrowth').innerHTML=growthDiagram(5);
    renderPrimaryGrowth();
    document.getElementById('growthStatus').textContent='Completed 5′ → 3′ chain. Motion is reduced according to your device preference.';
    return;
  }
  renderPrimaryGrowth();
  function advance() {
    primaryGrowth.timer=null;
    primaryGrowth.count++;
    if(primaryGrowth.count===6) document.getElementById('growthStatus').textContent='Now represent each nucleotide by its base letter. The same order continues from 5′ to 3′.';
    if(primaryGrowth.count===RNA_SEQUENCE.length) {
      primaryGrowth.done=true;
      primaryGrowth.running=false;
      document.getElementById('growthStatus').textContent='The chain is complete. These letters describe its primary structure. Select a nucleotide to follow it into the next views.';
    }
    renderPrimaryGrowth();
    if(primaryGrowth.running) primaryGrowth.timer=setTimeout(advance,primaryGrowth.count<=5?1400:35);
  }
  primaryGrowth.timer=setTimeout(advance,1400);
}

function enterPrimaryAnimation() {
  if(!primaryGrowth.done) playPrimaryAnimation();
  else renderPrimaryGrowth();
}

function setupPrimaryAnimation() {
  const stage=document.querySelector('#scene-primary .sequence-stage');
  stage.classList.add('growing-sequence-stage');
  const sequence=document.getElementById('primarySequence');
  const label=stage.querySelector('.sequence-label');
  // Put direction markers at the actual first and last letters, even on wrapped rows.
  label.remove();
  const reveal=document.createElement('div');reveal.id='sequenceReveal';reveal.hidden=true;
  sequence.before(reveal);reveal.appendChild(sequence);
  sequence.firstElementChild.classList.add('sequence-start');
  sequence.lastElementChild.classList.add('sequence-end');
  const animation=document.createElement('div');animation.id='chainGrowth';animation.className='chain-growth';
  reveal.before(animation);
  const status=document.createElement('p');status.id='growthStatus';status.setAttribute('aria-live','polite');
  stage.prepend(status);
  const counter=document.createElement('p');counter.id='growthCount';animation.before(counter);
  stage.querySelector('.stage-note').remove();
  const note=document.createElement('p');note.className='chemical-note';
  note.textContent='Schematic connectivity: each enlarged unit is already a nucleotide (base + ribose + phosphate). The animation only illustrates the new 3′–5′ linkage between nucleotides. In cells, RNA polymerases use nucleoside triphosphates and release pyrophosphate; this is not a reaction mechanism.';
  stage.appendChild(note);
  const replay=document.createElement('button');replay.id='growthReplay';replay.className='primary-action replay-connection';replay.type='button';replay.textContent='Replay animation';
  const copy=document.querySelector('#scene-primary .scene-copy');
  copy.querySelector('.fact-panel').before(replay);
  replay.addEventListener('click',playPrimaryAnimation);
}
