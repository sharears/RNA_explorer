from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"marker not found in {path}: {old[:120]!r}")
    p.write_text(s.replace(old, new, 1))


# ---- Secondary structure transform state ----
replace_once(
    "secondary.js",
    'let manualOffsets={}, pinnedResidues=new Set(), dragMode="residue", flexDrag=true, nodeDrag=null, suppressNodeClick=false;',
    'let manualOffsets={}, pinnedResidues=new Set(), dragMode="residue", flexDrag=true, nodeDrag=null, suppressNodeClick=false;\n  let wholeRotation=0,selectionRotation=0,selectionScale=1;'
)
replace_once(
    "secondary.js",
    'version:2,sequence:seq,structure:db,layout,arcPairStyle,manualOffsets,zoom,panX,panY,',
    'version:3,sequence:seq,structure:db,layout,arcPairStyle,manualOffsets,zoom,panX,panY,wholeRotation,selectionRotation,selectionScale,'
)
replace_once(
    "secondary.js",
    'manualOffsets=w.manualOffsets||{};zoom=Number(w.zoom)||1;panX=Number(w.panX)||0;panY=Number(w.panY)||0;',
    'manualOffsets=w.manualOffsets||{};zoom=Number(w.zoom)||1;panX=Number(w.panX)||0;panY=Number(w.panY)||0;\n      wholeRotation=Number(w.wholeRotation)||0;selectionRotation=Number(w.selectionRotation)||0;selectionScale=Math.max(.35,Math.min(3,Number(w.selectionScale)||1));'
)
replace_once(
    "secondary.js",
    '''    return out.map((p,i)=>({x:p.x+(manualOffsets[i]?.x||0),y:p.y+(manualOffsets[i]?.y||0)}));\n  }''',
    '''    let transformed=out.map((p,i)=>({x:p.x+(manualOffsets[i]?.x||0),y:p.y+(manualOffsets[i]?.y||0)}));
    const transformPoint=(p,c,degrees,scale=1)=>{
      const angle=degrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),x=(p.x-c.x)*scale,y=(p.y-c.y)*scale;
      return {x:c.x+x*cos-y*sin,y:c.y+x*sin+y*cos};
    };
    if(transformed.length&&Math.abs(wholeRotation)>1e-8){
      const c={x:transformed.reduce((sum,p)=>sum+p.x,0)/transformed.length,y:transformed.reduce((sum,p)=>sum+p.y,0)/transformed.length};
      transformed=transformed.map(p=>transformPoint(p,c,wholeRotation,1));
    }
    const chosen=[...selectedResidues].filter(i=>i>=0&&i<transformed.length);
    if(chosen.length&&(Math.abs(selectionRotation)>1e-8||Math.abs(selectionScale-1)>1e-8)){
      const c={x:chosen.reduce((sum,i)=>sum+transformed[i].x,0)/chosen.length,y:chosen.reduce((sum,i)=>sum+transformed[i].y,0)/chosen.length};
      const selectedSet=new Set(chosen);
      transformed=transformed.map((p,i)=>selectedSet.has(i)?transformPoint(p,c,selectionRotation,selectionScale):p);
    }
    return transformed;
  }'''
)
replace_once(
    "secondary.js",
    'pairChemistry={};manualOffsets={};pinnedResidues=new Set();zoom=1;panX=panY=0;',
    'pairChemistry={};manualOffsets={};pinnedResidues=new Set();zoom=1;panX=panY=0;wholeRotation=0;selectionRotation=0;selectionScale=1;'
)
replace_once(
    "secondary.js",
    'pairChemistry={};manualOffsets={};pinnedResidues=new Set();zoom=1;$("seMetadataFile")',
    'pairChemistry={};manualOffsets={};pinnedResidues=new Set();zoom=1;wholeRotation=0;selectionRotation=0;selectionScale=1;$("seMetadataFile")'
)
replace_once(
    "secondary.js",
    'getCurrentPositions(){return coordinates().map(p=>({x:p.x,y:p.y}));},',
    '''getCurrentPositions(){return coordinates().map(p=>({x:p.x,y:p.y}));},
    setWholeRotation(degrees=0){wholeRotation=Math.max(-180,Math.min(180,Number(degrees)||0));render();return wholeRotation;},
    setSelectionTransform({rotation=selectionRotation,scale=selectionScale}={}){
      selectionRotation=Math.max(-180,Math.min(180,Number(rotation)||0));
      selectionScale=Math.max(.35,Math.min(3,Number(scale)||1));
      render();return {rotation:selectionRotation,scale:selectionScale};
    },
    getTransformState(){return {wholeRotation,selectionRotation,selectionScale};},'''
)

# ---- Replace learning logic with the staged, tested v2 source ----
Path("learning-tools.js").write_text(Path("learning-tools-v2.js").read_text())

# ---- Homepage + asset wiring ----
p = Path("index.html")
s = p.read_text()
marker = '''      </section>\n\n\n      <section class="home-discovery" id="tutorials"'''
if marker not in s:
    marker = '''      </section>\n\n      <section class="home-discovery" id="tutorials"'''
fact = '''      </section>

      <section class="home-fact-strip" id="rnaFactStrip" aria-labelledby="rnaFactLabel">
        <span class="home-fact-label" id="rnaFactLabel">Did you know?</span>
        <p id="rnaFactText">RNA can fold into precise three-dimensional shapes, not just carry genetic information.</p>
        <button type="button" id="rnaFactNext" aria-label="Show another RNA fact">Another fact ↻</button>
      </section>

      <section class="home-discovery" id="tutorials"'''
if marker not in s:
    raise SystemExit("home discovery marker not found")
s = s.replace(marker, fact, 1)
s = s.replace(
    "This first deck is intentionally short; more topic-specific decks can be added later.",
    "Choose a level, flip each card, and mark whether you knew it. Each level has 20 cards and becomes progressively more challenging.",
    1,
)
s = s.replace(
    '<div class="flashcard-progress"><span id="flashcardProgress">1 / 10</span>',
    '<div class="flashcard-progress"><span id="flashcardProgress">Starter · 1 / 20</span>',
    1,
)
# Add one dedicated stylesheet for the new controls/learning UI.
if "secondary-selection-tools.css" not in s:
    css_match = re.search(r'(<link[^>]+href="learning-tools\.css\?v=[^"]+"[^>]*>)', s)
    if not css_match:
        raise SystemExit("learning-tools stylesheet marker not found")
    s = s[:css_match.end()] + '\n  <link rel="stylesheet" href="secondary-selection-tools.css?v=1">' + s[css_match.end():]
# Cache-bust updated scripts.
s = re.sub(r'secondary\.js\?v=[^"\']+', 'secondary.js?v=secondary-23', s, count=1)
s = re.sub(r'learning-tools\.js\?v=[^"\']+', 'learning-tools.js?v=learning-tools-2', s, count=1)
if "secondary-selection-tools.js" not in s:
    app_marker = '<script src="app.js?v=modern-ui-2"></script>'
    if app_marker not in s:
        app_match = re.search(r'<script src="app\.js\?v=[^"]+"></script>', s)
        if not app_match:
            raise SystemExit("app script marker not found")
        insert_at = app_match.end()
        s = s[:insert_at] + '\n  <script src="secondary-selection-tools.js?v=1"></script>' + s[insert_at:]
    else:
        s = s.replace(app_marker, app_marker + '\n  <script src="secondary-selection-tools.js?v=1"></script>', 1)
p.write_text(s)

print("PATCH_OK")
