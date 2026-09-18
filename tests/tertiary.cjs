const fs = require("fs");
const assert = require("assert");

const root = __dirname + "/..";
const read = file => fs.readFileSync(root + "/" + file, "utf8");

for (const file of ["app.js","chemistry.js","journey.js","primary-animation.js","secondary.js","tertiary.js"]) {
  const source = read(file);
  assert.doesNotThrow(() => new Function(source), file + " should parse as JavaScript");
}

const html = read("index.html");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepStrictEqual([...new Set(duplicates)], [], "index.html should not contain duplicate IDs");

[
  "tertiaryControls","tertiaryViewport","tertiaryMolecularViewer","teMolecularStatus","tertiaryMiniPanel",
  "tertiaryMiniSvg","teZoomIn","teZoomOut","teResetView","teCenterSelected"
].forEach(id => assert(ids.includes(id), "Missing tertiary control #" + id));

assert(html.includes('script src="tertiary.js'), "tertiary.js must be loaded");
assert(html.includes('stylesheet" href="tertiary.css'), "tertiary.css must be loaded");

const app = read("app.js");
const seq = app.match(/const RNA_SEQUENCE = "([ACGU]+)"/);
assert(seq, "RNA sequence should be present in app.js");
assert.strictEqual(seq[1].length, 76, "Default tRNA sequence should contain 76 residues");

const coordBlock = app.match(/const TERTIARY_COORDS = \[([\s\S]*?)\n\];/);
assert(coordBlock, "TERTIARY_COORDS should be present");
const coords = [...coordBlock[1].matchAll(/\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\]/g)];
assert.strictEqual(coords.length, 76, "The C4-prime trace should contain one coordinate per residue");

const secondary = read("secondary.js");
assert(secondary.includes('"rna-secondary-context"'), "Secondary view should broadcast mapping context");
assert(secondary.includes('"rna-metadata-change"'), "Secondary view should broadcast residue metadata");

const tertiary = read("tertiary.js");
[
  "PyMOL-style sticks",
  "Show mapped secondary-structure pair connections",
  "Highlight 3D proximity",
  "Measure C4′ distance",
  "2D + 3D linked view",
  "Secondary element",
  "Residue information",
  "cdn.jsdelivr.net/npm/3dmol@2.5.5",
  "files.rcsb.org/download/1EHZ.pdb",
  "viewer.addModel",
  "viewer.setClickable"
].forEach(text => assert(tertiary.includes(text), "Missing tertiary feature: " + text));

assert(!html.includes('id="tertiarySvg"'), "Legacy SVG tertiary canvas should be removed");
assert(html.includes("All-atom molecular coordinates"), "Tertiary description should identify the all-atom model");
console.log("tertiary molecular/static checks passed");
