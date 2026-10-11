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

  function atomChargeRecords(graph) {
    const entries = graph.atoms.map((atom, i) => [i + 1, Number(atom.charge || 0)]).filter(([, charge]) => charge !== 0);
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
    if (!atoms.length) throw new Error("Draw at least one atom before generating 3D geometry.");
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
      "  RNAExplorer  3D",
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
        throw new Error("The OpenChemLib 3D components are unavailable.");
      }
      if (OCL.Resources?.registerFromUrl) await OCL.Resources.registerFromUrl(RESOURCE_URL);
      return OCL;
    })().catch(error => {
      oclPromise = null;
      throw error;
    });
    return oclPromise;
  }

  function moleculeToModel(mol, originalGraph) {
    const originalIds = (originalGraph.atoms || []).map(atom => atom.id);
    const atomCount = mol.getAllAtoms();
    const atoms = [];
    for (let i = 0; i < atomCount; i++) {
      const atomicNo = mol.getAtomicNo(i);
      const element = ATOMIC_SYMBOL[atomicNo] || "X";
      const x = Number(mol.getAtomX(i)), y = Number(mol.getAtomY(i)), z = Number(mol.getAtomZ(i));
      if (![x, y, z].every(Number.isFinite)) throw new Error("OpenChemLib returned non-numeric 3D coordinates.");
      atoms.push({ id: originalIds[i] || `FF_H${i - originalIds.length + 1}`, element, x, y, z });
    }
    const bonds = [];
    for (let i = 0; i < mol.getAllBonds(); i++) {
      const ai = mol.getBondAtom(0, i), bi = mol.getBondAtom(1, i);
      const a = atoms[ai], b = atoms[bi];
      if (!a || !b) continue;
      const order = Math.max(1, Math.min(3, Number(mol.getBondOrder(i) || 1)));
      bonds.push({ id: `ffb${i}`, a: a.id, b: b.id, order });
    }
    return { atoms, bonds };
  }

  async function generate(graph) {
    const OCL = await getOpenChemLib();
    const input = graphToMolBlock(graph);
    let mol = OCL.Molecule.fromMolfile(input);
    if (!mol || !mol.getAllAtoms()) throw new Error("OpenChemLib could not parse this molecular graph.");

    // ConformerGenerator fills free valences with explicit hydrogens and creates
    // chemistry-aware 3D coordinates, including puckered saturated rings.
    const generator = new OCL.ConformerGenerator(0);
    const conformed = generator.getOneConformerAsMolecule(mol);
    if (conformed) mol = conformed;

    // MMFF94 then relaxes bond lengths, angles and torsions. OpenChemLib's browser
    // build currently exposes MMFF94 but not UFF, so unsupported structures are
    // handled by RNA Explorer's existing rough-preview fallback rather than being
    // mislabeled as UFF-optimized.
    let forceField = null;
    try {
      const ff = new OCL.ForceFieldMMFF94(mol, "MMFF94");
      ff.minimise({ maxIts: 1800, gradTol: 1e-4, funcTol: 1e-6 });
      forceField = "MMFF94";
    } catch (error) {
      throw new Error("MMFF94 optimization is unavailable for this structure: " + (error?.message || error));
    }

    const model = moleculeToModel(mol, graph);
    if (!model.atoms.length) throw new Error("OpenChemLib did not return a 3D conformer.");
    return {
      ...model,
      forceField,
      source: "OpenChemLib",
      hydrogensAdded: model.atoms.length > graph.atoms.length
    };
  }

  window.Chemistry3DForceField = {
    generate,
    graphToMolBlock,
    preload: getOpenChemLib,
    getEngineInfo: () => ({
      name: "OpenChemLib",
      version: OCL_VERSION,
      primary: "MMFF94",
      fallback: "RNA Explorer rough preview",
      uffAvailable: false
    })
  };
})();
