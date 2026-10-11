(() => {
  "use strict";

  const CDN_BASE = "https://cdn.jsdelivr.net/gh/partridgejiang/cheminfo-to-web@master/OpenBabel3/OpenBabel-js/bin/";
  const SCRIPT_URL = CDN_BASE + "openbabel.js";
  let modulePromise = null;

  function loadOpenBabelScript() {
    if (typeof window.OpenBabelModule === "function") return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rna-openbabel="1"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("OpenBabel JavaScript failed to load.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.rnaOpenbabel = "1";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("OpenBabel JavaScript failed to load.")), { once: true });
      document.head.append(script);
    });
  }

  function getOpenBabel() {
    if (modulePromise) return modulePromise;
    modulePromise = (async () => {
      await loadOpenBabelScript();
      if (typeof window.OpenBabelModule !== "function") throw new Error("OpenBabelModule is unavailable after loading the WebAssembly wrapper.");
      return await new Promise((resolve, reject) => {
        let settled = false;
        const finish = value => { if (!settled) { settled = true; resolve(value); } };
        const fail = error => { if (!settled) { settled = true; reject(error instanceof Error ? error : new Error(String(error))); } };
        let mod;
        try {
          mod = window.OpenBabelModule({
            locateFile: path => CDN_BASE + path,
            onAbort: reason => fail(new Error("OpenBabel aborted: " + reason))
          });
        } catch (error) {
          fail(error);
          return;
        }
        if (mod && typeof mod.then === "function") {
          mod.then(finish, fail);
          return;
        }
        if (!mod) {
          fail(new Error("OpenBabel did not create a module instance."));
          return;
        }
        if (mod.calledRun || mod.runtimeInitialized) {
          finish(mod);
          return;
        }
        const prior = mod.onRuntimeInitialized;
        mod.onRuntimeInitialized = () => {
          try { if (typeof prior === "function") prior(); } catch (_) {}
          finish(mod);
        };
        setTimeout(() => fail(new Error("OpenBabel initialization timed out.")), 45000);
      });
    })().catch(error => {
      modulePromise = null;
      throw error;
    });
    return modulePromise;
  }

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
    const cx = atoms.reduce((sum, atom) => sum + Number(atom.x || 0), 0) / atoms.length;
    const cy = atoms.reduce((sum, atom) => sum + Number(atom.y || 0), 0) / atoms.length;
    const lengths = bonds.map(bond => {
      const a = atoms.find(atom => atom.id === bond.a), b = atoms.find(atom => atom.id === bond.b);
      return a && b ? Math.hypot(Number(b.x || 0) - Number(a.x || 0), Number(b.y || 0) - Number(a.y || 0)) : 0;
    }).filter(value => value > 5);
    lengths.sort((a, b) => a - b);
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

  function parseMolBlock(block, originalGraph) {
    const lines = String(block || "").replace(/\r/g, "").split("\n");
    if (lines.length < 5) throw new Error("OpenBabel returned an invalid MOL block.");
    const countsIndex = lines.findIndex(line => /V2000/.test(line));
    if (countsIndex < 0) throw new Error("OpenBabel returned an unsupported MOL format.");
    const counts = lines[countsIndex];
    const atomCount = Number.parseInt(counts.slice(0, 3), 10), bondCount = Number.parseInt(counts.slice(3, 6), 10);
    if (!Number.isFinite(atomCount) || atomCount < 1 || !Number.isFinite(bondCount)) throw new Error("OpenBabel MOL counts are invalid.");
    const originalIds = (originalGraph.atoms || []).map(atom => atom.id);
    const atoms = [];
    for (let i = 0; i < atomCount; i++) {
      const line = lines[countsIndex + 1 + i] || "";
      const x = Number.parseFloat(line.slice(0, 10)), y = Number.parseFloat(line.slice(10, 20)), z = Number.parseFloat(line.slice(20, 30));
      const element = line.slice(31, 34).trim() || "C";
      if (![x, y, z].every(Number.isFinite)) throw new Error("OpenBabel returned non-numeric 3D coordinates.");
      atoms.push({ id: originalIds[i] || ("FF_H" + (i - originalIds.length + 1)), element, x, y, z });
    }
    const bonds = [];
    for (let i = 0; i < bondCount; i++) {
      const line = lines[countsIndex + 1 + atomCount + i] || "";
      const ai = Number.parseInt(line.slice(0, 3), 10) - 1, bi = Number.parseInt(line.slice(3, 6), 10) - 1, order = Number.parseInt(line.slice(6, 9), 10) || 1;
      if (atoms[ai] && atoms[bi]) bonds.push({ id: "ffb" + i, a: atoms[ai].id, b: atoms[bi].id, order: Math.max(1, Math.min(3, order)) });
    }
    return { atoms, bonds };
  }

  function safeDelete(obj) {
    try { if (obj && typeof obj.delete === "function") obj.delete(); } catch (_) {}
  }

  function findForceField(OB, name) {
    try {
      if (!OB?.OBForceField?.FindForceField) return null;
      return OB.OBForceField.FindForceField(name);
    } catch (_) {
      try { return new OB.OBForceField.FindForceField(name); } catch (_) { return null; }
    }
  }

  async function generate(graph) {
    const OB = await getOpenBabel();
    const input = graphToMolBlock(graph);
    let conv = null, mol = null;
    try {
      conv = new OB.ObConversionWrapper();
      if (!conv.setInFormat("", "mol")) throw new Error("OpenBabel MOL input support is unavailable.");
      mol = new OB.OBMol();
      if (!conv.readString(mol, input)) throw new Error("OpenBabel could not read the molecular drawing.");
      const gen3d = OB?.OBOp?.FindType ? OB.OBOp.FindType("Gen3D") : null;
      if (!gen3d || !gen3d.Do(mol, "")) throw new Error("OpenBabel Gen3D could not generate a conformer for this structure.");

      let forceField = "OpenBabel Gen3D";
      for (const name of ["MMFF94", "UFF"]) {
        const ff = findForceField(OB, name);
        if (!ff) continue;
        let setup = false;
        try { setup = Boolean(ff.Setup(mol)); } catch (_) { setup = false; }
        if (!setup) continue;
        try {
          if (typeof ff.ConjugateGradients === "function") ff.ConjugateGradients(300);
          else if (typeof ff.SteepestDescent === "function") ff.SteepestDescent(300);
          if (typeof ff.GetCoordinates === "function") ff.GetCoordinates(mol);
        } catch (_) {}
        forceField = name;
        break;
      }

      if (!conv.setOutFormat("", "mol")) throw new Error("OpenBabel MOL output support is unavailable.");
      const output = conv.writeString(mol, false);
      const model = parseMolBlock(output, graph);
      if (!model.atoms.length) throw new Error("No optimized atoms were returned.");
      return { ...model, forceField, source: "OpenBabel WebAssembly", hydrogensAdded: model.atoms.length > graph.atoms.length };
    } finally {
      safeDelete(mol);
      safeDelete(conv);
    }
  }

  window.Chemistry3DForceField = {
    generate,
    graphToMolBlock,
    parseMolBlock,
    preload: getOpenBabel,
    getEngineInfo: () => ({ name: "OpenBabel WebAssembly", primary: "MMFF94", fallback: "UFF", cdn: CDN_BASE })
  };
})();
