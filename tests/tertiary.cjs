const fs = require("fs");
const assert = require("assert");

const root = __dirname + "/..";
const read = file => fs.readFileSync(root + "/" + file, "utf8");

for (const file of ["app.js","export-tools.js","chemistry.js","journey.js","primary-animation.js","secondary.js","tertiary.js"]) {
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
  "Ball &amp; stick",
  "RNA backbone",
  "Molecular surface",
  "Color by",
  "Chain",
  "Element",
  "Show mapped secondary-structure pair connections",
  "Highlight 3D proximity",
  "possible H-bond contacts",
  "Distance · 2 atoms",
  "Angle · 3 atoms",
  "Dihedral · 4 atoms",
  "2D + 3D linked view",
  "Secondary element",
  "Residue information",
  "Sequence-linked selection",
  "Select range",
  "Select around current residue",
  "Create object from selection",
  "Isolate",
  "Export Tertiary Structure",
  "PDB",
  "mmCIF",
  "Enable clipping slab",
  "Compare / align structures",
  "RMSD",
  "Saved camera views",
  "Orthographic projection",
  "Full-screen viewer",
  "Uniform custom color",
  "Select RNA chain",
  "Invert",
  "Alignment scope",
  "Show aligned comparison",
  "cdn.jsdelivr.net/npm/3dmol@2.5.5",
  "files.rcsb.org/download/1EHZ.pdb",
  "viewer.addModel",
  "viewer.setClickable",
  "Import PDB / mmCIF",
  "Load from RCSB PDB",
  "tePdbId",
  "fetchRcsbCif",
  "RCSB PDB · ",
  "I confirm that the Secondary and 3D inputs describe the same RNA molecule",
  "teImageScale",
  "teImageDpi",
  "SVG (raster embedded)",
  "rna-secondary-layout",
  "secondaryLayoutPositions",
  "setWidth(width)",
  "pngURI()",
  "sequence identity and residue count match"
].forEach(text => assert(tertiary.includes(text), "Missing tertiary feature: " + text));

const tertiaryApi = new Function(tertiary + "\nreturn TertiaryExplorer;")();
assert.strictEqual(tertiaryApi.normalizeBase("PSU"), "U", "Pseudouridine normalizes to U");
assert.strictEqual(tertiaryApi.normalizeBase("2MG"), "G", "Modified guanosine normalizes to G");
assert.strictEqual(tertiaryApi.normalizeBase("XYZ"), "?", "Unknown modification is flagged");
assert.strictEqual(tertiaryApi.normalizePdbId("1ehz"),"1EHZ","PDB IDs are normalized to uppercase");
assert.throws(()=>tertiaryApi.normalizePdbId("bad"),/four-character/i,"Invalid PDB IDs are rejected");
assert(Math.abs(tertiaryApi.atomDistance({x:0,y:0,z:0},{x:3,y:4,z:0})-5)<1e-9,"Atom distance calculation is correct");
assert(Math.abs(tertiaryApi.atomAngle({x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0})-90)<1e-9,"Atom angle calculation is correct");
assert(Math.abs(Math.abs(tertiaryApi.atomDihedral({x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0},{x:0,y:1,z:1}))-90)<1e-9,"Atom dihedral calculation is correct");
const fakeChain = {residues:[{base:"A"},{base:"C"},{base:"G"},{base:"U"}]};
assert.strictEqual(tertiaryApi.compareChain(fakeChain,"ACGU").exact,true,"Exact sequence mapping is recognized");
assert.strictEqual(tertiaryApi.compareChain(fakeChain,"ACGA").mismatches.length,1,"Sequence mismatch is detected");
assert.strictEqual(tertiaryApi.compareChain(fakeChain,"ACG").lengthMatch,false,"Length mismatch is detected");

const ref = [{x:0,y:0,z:0},{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}];
const moved = ref.map(p => ({x:-p.y+5,y:p.x-2,z:p.z+3}));
const fit = tertiaryApi.hornFit(moved,ref);
assert(fit.rmsd < 0.001, "Rigid-body alignment should recover a transformed coordinate set");

const pdb = tertiaryApi.serializePdb([{atom:"P",resn:"G",chain:"A",resi:1,x:1,y:2,z:3,elem:"P",hetflag:false}]);
assert(pdb.includes("ATOM") && pdb.includes("END"), "PDB exporter should emit coordinate records");
const cif = tertiaryApi.serializeCif([{atom:"P",resn:"G",chain:"A",resi:1,x:1,y:2,z:3,elem:"P",hetflag:false}]);
assert(cif.includes("_atom_site.Cartn_x") && cif.includes("data_rna_explorer"), "mmCIF exporter should emit an atom_site loop");

assert(tertiary.includes("handleAtomMeasurementClick"), "Atom-click measurement workflow should be available");
assert(tertiary.includes("teMeasurementList")&&tertiary.includes("teMeasureClear"), "Multiple measurements can be listed and cleared");
assert(tertiary.includes("getCurrentPositions")&&tertiary.includes("secondaryLayoutPositions"), "Linked 2D/3D view preserves the edited Secondary layout when available");
assert(tertiary.includes('root.replaceChildren(...[...source.childNodes].map(node=>node.cloneNode(true)))'), "Linked 2D view clones the actual Secondary SVG so residue letters and styling are preserved");
assert(tertiary.includes("safeViewerResize")&&tertiary.includes("scheduleViewerLayout"), "Tertiary viewer is explicitly resized after visibility/layout changes");
assert(tertiary.includes("SVG (raster embedded)")&&tertiary.includes("teImageDpi"), "Tertiary image export exposes PNG/PDF/SVG plus DPI control");
assert(!html.includes('id="tertiarySvg"'), "Legacy SVG tertiary canvas should be removed");
assert(html.includes("All-atom molecular coordinates"), "Tertiary description should identify the all-atom model");
console.log("tertiary molecular/static checks passed");
