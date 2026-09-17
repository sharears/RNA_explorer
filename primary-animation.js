const primaryGrowth = { count: 0, timer: null, done: false, running: false };

function cancelPrimaryAnimation() {
  if (primaryGrowth.timer !== null) clearTimeout(primaryGrowth.timer);
  primaryGrowth.timer = null;
  primaryGrowth.running = false;
}

// A connectivity diagram, not a reaction mechanism. P stands for a phosphate group.
function growthDiagram(count) {
  const visible = Math.min(count, 5);
  const fragments = [];
  const line = (x1,y1,x2,y2,cls='')=>`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const label = (x,y,t,cls='')=>`<text x="${x}" y="${y}" class="${cls}">${t}</text>`;
  for(let i=0;i<visible;i++) {
    const x=100+i*180, last=i===visible-1;
    const base=RNA_SEQUENCE[i];
    // Ribose ring: O4′ at the top; base at C1′, OH at C2′, extension at C3′.
    fragments.push(`<g class="growth-residue ${last?'arriving-residue':''}" data-position="${i+1}">
      <path d="M ${x-35} 120 L ${x} 95 L ${x+35} 120 L ${x+22} 165 L ${x-22} 165 Z"/>
      ${label(x,95,'O')}${label(x+35,120,'1′')}${label(x+22,165,'2′')}${label(x-22,165,'3′')}${label(x-35,120,'4′')}
      ${line(x+35,120,x+55,70)}<circle cx="${x+55}" cy="55" r="23" style="fill:${BASE_COLORS[base]}"/>
      ${label(x+55,56,base,'growth-base')}${label(x+55,22,String(i+1),'growth-position')}
      ${line(x+22,165,x+22,193)}${label(x+22,202,'OH')}
      ${line(x-35,120,x-55,120)}${label(x-55,120,'5′')}${line(x-55,120,x-55,215)}${label(x-55,215,i===0?'HO':'O')}
      ${line(x-22,165,x-22,250)}${label(x-22,250,last?'OH':'O')}
      ${last?label(x-22,291,'3′ end','end-label'):''}</g>`);
    if(i>0) {
      const prev=x-180;
      fragments.push(`<g class="growth-link ${last?'new-growth-link':''}" data-link="${i}-${i+1}">
        ${line(prev-22,250,prev+75,250)}${line(prev+75,250,x-55,215)}
        <circle cx="${prev+75}" cy="250" r="17"/>${label(prev+75,250,'P')}
        <title>Residue ${i} O3′–P–O5′ residue ${i+1}: 3′–5′ phosphodiester linkage</title></g>`);
    }
  }
  return `<svg viewBox="0 0 1000 345" class="growth-svg" role="img" aria-label="${visible} nucleotides connected from 5′ to 3′. New nucleotides attach at the growing 3′ end.">
    ${fragments.join('')}${label(45,291,'5′ end','end-label')}
    <path class="growth-direction" d="M 160 323 L 860 323 L 845 316 M 860 323 L 845 330"/>
    ${label(500,312,'Chain growth: 5′ → 3′','direction-label')}</svg>`;
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
  document.getElementById('growthStatus').textContent='Start at the 5′ end. Each new nucleotide joins the growing 3′ end through a phosphodiester linkage.';
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
  note.textContent='Schematic connectivity: pentagon = ribose; P = phosphate group. The first five residues are enlarged, then the full 76-residue tRNA sequence appears. In cells, RNA polymerases use nucleoside triphosphates and release pyrophosphate; free monophosphates do not simply join together.';
  stage.appendChild(note);
  const replay=document.createElement('button');replay.id='growthReplay';replay.className='primary-action replay-connection';replay.type='button';replay.textContent='Replay animation';
  const copy=document.querySelector('#scene-primary .scene-copy');
  copy.querySelector('.fact-panel').before(replay);
  replay.addEventListener('click',playPrimaryAnimation);
}
