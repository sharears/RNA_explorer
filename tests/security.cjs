const fs=require("node:fs");
const assert=require("node:assert/strict");

const projectSource=fs.readFileSync("project-session.js","utf8");
const projectApi=new Function(projectSource+"\nreturn ProjectSession;")();
assert.doesNotThrow(()=>projectApi.validateProject({schema:"rna-explorer-project",version:1,secondary:{sequence:"G",structure:"."}}));
assert.throws(
  ()=>projectApi.validateProject(JSON.parse('{"schema":"rna-explorer-project","version":1,"secondary":{"sequence":"G","structure":".","constructor":{"prototype":{"polluted":true}}}}')),
  /forbidden field/i,
  "Project import rejects prototype-pollution keys"
);
let deep={schema:"rna-explorer-project",version:1,secondary:{sequence:"G",structure:"."}},cursor=deep.secondary;
for(let i=0;i<45;i++){cursor.child={};cursor=cursor.child;}
assert.throws(()=>projectApi.validateProject(deep),/nested too deeply/i,"Project import rejects pathological nesting");

const chemistrySource=fs.readFileSync("chemistry-editor.js","utf8");
const chemistryApi=new Function(chemistrySource+"\nreturn MoleculeEditor;")();
assert.doesNotThrow(()=>chemistryApi.restoreSessionSnapshot({savedBases:{A:{atoms:[["X1","C",10,20,0]],bonds:[]}}}));
assert.throws(
  ()=>chemistryApi.restoreSessionSnapshot({savedBases:{A:{atoms:[['X\" onload=\"alert(1)','C',10,20,0]],bonds:[]}}}),
  /identifier is invalid/i,
  "Saved chemistry rejects markup-bearing atom identifiers"
);
assert.throws(
  ()=>chemistryApi.restoreSessionSnapshot({savedBases:{A:{atoms:[["X1","C","not-a-number",20,0]],bonds:[]}}}),
  /coordinates are invalid/i,
  "Saved chemistry rejects non-numeric coordinates"
);
assert(!chemistrySource.includes("g.innerHTML=bondLines"),"Chemistry bonds are not rendered through innerHTML");

const tertiarySource=fs.readFileSync("tertiary.js","utf8");
assert(tertiarySource.includes("https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js"),"3Dmol dependency is version-pinned");
assert(!tertiarySource.includes("https://3Dmol.org/build/3Dmol-min.js"),"Unversioned 3Dmol fallback is removed");
assert(tertiarySource.includes('script.referrerPolicy="no-referrer"'),"Third-party script request omits referrer");
assert(!tertiarySource.includes('box.innerHTML="<strong>Residue information · "+state.heatTheme'),"Restored heat theme is not inserted through innerHTML");

const secondarySource=fs.readFileSync("secondary.js","utf8");
assert(secondarySource.includes("sessionStorage"),"Automatic workspace recovery uses session storage");
assert(secondarySource.includes("legacy.removeItem(WORKSPACE_KEY)"),"Legacy persistent autosave is removed after migration");

const html=fs.readFileSync("index.html","utf8");
assert(html.includes("Content-Security-Policy"),"A browser Content Security Policy is present");
assert(html.includes('object-src \'none\''),"CSP blocks plugin/object content");
assert(html.includes('base-uri \'self\''),"CSP restricts base URL changes");
assert(html.includes('name="referrer" content="no-referrer"'),"Referrer leakage is disabled");

const workflow=fs.readFileSync(".github/workflows/static-checks.yml","utf8");
assert(/permissions:\s*\n\s+contents:\s*read/.test(workflow),"GitHub Actions token is read-only");

console.log("PASS: RNA Explorer security regression checks.");
