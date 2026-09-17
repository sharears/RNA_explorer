const RNA_SEQUENCE = "GCGGAUUUAGCUCAGUUGGGAGAGCGCCAGACUGAAGAUCUGGAGGUCCUGUGUUCGAUCCACAGAAUUCGCACCA";
const TRNA_DOT_BRACKET = "(((((((..((((........)))).(((((.......))))).....(((((.......))))))))))))....";
const BASE_NAMES = { A: "Adenine", G: "Guanine", C: "Cytosine", U: "Uracil" };
const BASE_COLORS = { A: "#b55d6a", G: "#2f6b57", C: "#c89b4a", U: "#5d7fa3" };
const SCENES = ["blocks", "nucleoside", "nucleotide", "primary", "secondary", "tertiary"];
const SCENE_LABELS = ["Building blocks", "Nucleoside", "Nucleotide", "Primary", "Secondary", "Tertiary"];
const NS = "http://www.w3.org/2000/svg";

// C4′ coordinates from the experimentally determined yeast tRNA-Phe structure, PDB 1EHZ.
const TERTIARY_COORDS = [
  [50.968,49.231,54.309],[56.836,48.075,56.049],[62.769,46.443,54.422],[66.749,44.634,50.114],
  [67.927,42.844,44.191],[66.579,44.400,38.565],[64.055,47.852,34.101],[66.105,52.236,29.628],
  [64.531,52.215,22.904],[59.058,48.375,20.709],[60.091,42.608,23.221],[64.121,39.544,26.594],
  [69.102,41.516,29.762],[74.612,43.815,30.626],[78.274,48.248,31.867],[80.514,52.486,33.353],
  [84.176,55.886,36.150],[80.100,59.412,35.902],[80.105,62.508,30.407],[80.529,60.879,23.849],
  [75.622,58.001,23.580],[76.292,51.916,21.581],[76.705,45.975,20.257],[74.313,40.622,18.747],
  [69.170,38.275,16.491],[63.938,40.267,14.143],[61.594,44.378,10.321],[62.918,48.099,5.246],
  [67.384,49.009,1.027],[72.933,47.996,-1.281],[77.346,43.848,-2.300],[72.103,39.570,-2.726],
  [74.457,33.095,-5.870],[70.295,33.326,-11.163],[65.999,34.348,-7.216],[65.801,33.698,-1.565],
  [66.976,32.279,4.107],[71.783,31.310,7.804],[76.728,36.038,4.591],[80.351,38.970,7.985],
  [80.498,45.168,6.953],[77.769,50.433,7.372],[73.059,54.264,8.204],[67.971,56.191,10.523],
  [64.255,55.158,15.248],[63.911,55.833,21.859],[62.482,60.255,26.545],[66.046,56.424,30.251],
  [61.796,55.006,32.810],[59.218,60.444,34.331],[59.365,65.668,37.334],[62.118,69.559,40.905],
  [67.174,70.724,43.912],[72.524,67.496,40.026],[75.687,68.934,38.291],[79.735,74.239,36.678],
  [76.829,69.964,33.385],[74.279,63.972,33.383],[70.618,58.472,33.026],[73.252,56.436,38.285],
  [75.643,58.316,43.840],[71.882,60.684,48.244],[66.263,61.750,50.244],[60.204,61.569,49.339],
  [55.988,59.170,46.060],[53.671,55.677,41.542],[53.319,50.645,38.320],[55.168,44.940,37.012],
  [57.582,39.880,39.400],[59.348,35.925,43.805],[59.688,34.434,49.701],[57.653,35.834,55.450],
  [53.508,38.772,58.837],[47.463,40.541,58.985],[42.564,38.194,56.568],[37.607,38.379,58.569]
];

const state = {
  sceneIndex: 0,
  selectedResidue: 0,
  selectedBase: "A",
  rotationX: -0.28,
  rotationY: -0.6,
  dragging: false,
  dragMoved: false,
  lastPointer: null,
  secondarySequence: RNA_SEQUENCE,
  secondaryStructure: TRNA_DOT_BRACKET,
  secondaryLayout: "radial",
  secondarySelectedResidue: 0
};

const blockFacts = {
  phosphate: {
    title: "Phosphate group",
    copy: "Phosphate links one ribose to the next and becomes part of RNA's repeating backbone."
  },
  ribose: {
    title: "Ribose sugar",
    copy: "Ribose is a five-carbon sugar. Its 2′-OH group helps give RNA its distinct chemistry."
  },
  base: {
    title: "Nitrogenous base",
    copy: "A, G, C, or U carries chemical information and can interact with bases elsewhere in the chain."
  }
};

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function selectResidue(index) {
  state.selectedResidue = Math.max(0, Math.min(RNA_SEQUENCE.length - 1, index));
  updateResiduePanels();
  document.querySelectorAll(".nt").forEach((node, i) => node.classList.toggle("selected", i === state.selectedResidue));
  SecondaryExplorer.followDefault(state.selectedResidue);
  if (typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render(state.selectedResidue);
}

function updateResiduePanels() {
  const base = RNA_SEQUENCE[state.selectedResidue];
  const position = state.selectedResidue + 1;
  document.querySelectorAll(".selected-residue-title").forEach(node => {
    node.textContent = `${BASE_NAMES[base]} · ${base}${position}`;
  });
  document.querySelectorAll(".selected-residue-copy").forEach(node => {
    if (node.closest("#scene-primary")) node.textContent = `Position ${position} of ${RNA_SEQUENCE.length} in this tRNA sequence.`;
    if (node.closest("#scene-secondary")) node.textContent = `Position ${position} is highlighted in the cloverleaf map.`;
    if (node.closest("#scene-tertiary")) node.textContent = `Position ${position} is highlighted in the experimental residue trace. Drag to change the view.`;
  });
}

function showScene(index) {
  cancelChemicalAnimation();
  cancelPrimaryAnimation();
  state.sceneIndex = Math.max(0, Math.min(SCENES.length - 1, index));
  const activeName = SCENES[state.sceneIndex];

  document.querySelectorAll("[data-scene-panel]").forEach(panel => {
    const active = panel.dataset.scenePanel === activeName;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });

  document.querySelectorAll(".scale-step").forEach((button, i) => {
    const active = i === state.sceneIndex;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });

  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");
  previousButton.disabled = state.sceneIndex === 0;
  nextButton.disabled = state.sceneIndex === SCENES.length - 1;
  previousButton.innerHTML = state.sceneIndex > 0 ? `<span>←</span> ${SCENE_LABELS[state.sceneIndex - 1]}` : "<span>←</span> Previous";
  nextButton.innerHTML = state.sceneIndex < SCENES.length - 1 ? `Next: ${SCENE_LABELS[state.sceneIndex + 1]} <span>→</span>` : `Journey complete <span>✓</span>`;
  document.getElementById("progressText").textContent = `${state.sceneIndex + 1} of ${SCENES.length}`;

  if (activeName === "tertiary" && typeof TertiaryExplorer !== "undefined") TertiaryExplorer.render(state.selectedResidue);
  enterChemicalScene(activeName);
  if (activeName === 'primary') enterPrimaryAnimation();
}

function setupNavigation() {
  document.querySelectorAll(".scale-step").forEach((button, index) => {
    button.addEventListener("click", () => showScene(index));
  });
  document.getElementById("previousButton").addEventListener("click", () => showScene(state.sceneIndex - 1));
  document.getElementById("nextButton").addEventListener("click", () => showScene(state.sceneIndex + 1));
}


function renderPrimary() {
  const container = document.getElementById("primarySequence");
  RNA_SEQUENCE.split("").forEach((base, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nt nt-${base.toLowerCase()}${index === state.selectedResidue ? " selected" : ""}`;
    button.textContent = base;
    button.setAttribute("aria-label", `${BASE_NAMES[base]}, position ${index + 1}`);
    button.addEventListener("click", () => selectResidue(index));
    container.appendChild(button);
  });
}

function setupSecondaryWorkspace() {
  SecondaryExplorer.setup(RNA_SEQUENCE, TRNA_DOT_BRACKET, index => selectResidue(index));
}
function renderSecondary() { SecondaryExplorer.render(); }

const center3D = TERTIARY_COORDS.reduce((acc, point) => acc.map((value, i) => value + point[i] / TERTIARY_COORDS.length), [0, 0, 0]);

function projectPoint(point) {
  let [x, y, z] = point.map((value, i) => value - center3D[i]);
  const cy = Math.cos(state.rotationY), sy = Math.sin(state.rotationY);
  const cx = Math.cos(state.rotationX), sx = Math.sin(state.rotationX);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y1 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const scale = 7.0;
  return { x: 360 + x1 * scale, y: 265 + y1 * scale, z: z2 };
}

function renderTertiary() {
  const svg = document.getElementById("tertiarySvg");
  svg.replaceChildren();
  const projected = TERTIARY_COORDS.map(projectPoint);

  for (let i = 0; i < projected.length - 1; i++) {
    svg.appendChild(svgElement("line", {
      class: "tertiary-bond", x1: projected[i].x, y1: projected[i].y,
      x2: projected[i + 1].x, y2: projected[i + 1].y,
      opacity: Math.max(.35, Math.min(.9, .62 + projected[i].z / 90))
    }));
  }

  projected.map((point, index) => ({ ...point, index })).sort((a, b) => a.z - b.z).forEach(point => {
    const base = RNA_SEQUENCE[point.index];
    const selected = point.index === state.selectedResidue;
    const radius = selected ? 12 : Math.max(5.5, Math.min(9, 7 + point.z / 25));
    const group = svgElement("g", {
      class: `tertiary-node${selected ? " selected" : ""}`,
      transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,
      tabindex: "0", role: "button", "aria-label": `${BASE_NAMES[base]}, position ${point.index + 1}`
    });
    group.appendChild(svgElement("circle", { r: radius, fill: BASE_COLORS[base], opacity: Math.max(.62, Math.min(1, .82 + point.z / 80)) }));
    if (selected) {
      const text = svgElement("text", { y: .5 });
      text.textContent = base;
      group.appendChild(text);
    }
    group.addEventListener("pointerdown", event => event.stopPropagation());
    group.addEventListener("click", () => selectResidue(point.index));
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectResidue(point.index);
      }
    });
    svg.appendChild(group);
  });
}

function setupTertiaryControls() {
  const stage = document.getElementById("tertiaryStage");
  const svg = document.getElementById("tertiarySvg");
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("aria-label", "Rotatable residue trace of yeast phenylalanine tRNA. Use arrow keys or drag to rotate.");

  stage.addEventListener("pointerdown", event => {
    state.dragging = true;
    state.dragMoved = false;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    stage.classList.add("dragging");
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", event => {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastPointer.x;
    const dy = event.clientY - state.lastPointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.dragMoved = true;
    state.rotationY += dx * .011;
    state.rotationX += dy * .011;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    renderTertiary();
  });
  const endDrag = () => { state.dragging = false; stage.classList.remove("dragging"); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  svg.addEventListener("keydown", event => {
    const step = .12;
    if (event.key === "ArrowLeft") state.rotationY -= step;
    else if (event.key === "ArrowRight") state.rotationY += step;
    else if (event.key === "ArrowUp") state.rotationX -= step;
    else if (event.key === "ArrowDown") state.rotationX += step;
    else return;
    event.preventDefault();
    renderTertiary();
  });
  document.getElementById("followButton").addEventListener("click", () => {
    let next = state.selectedResidue;
    while (next === state.selectedResidue) next = Math.floor(Math.random() * RNA_SEQUENCE.length);
    selectResidue(next);
  });
}

function setupDialog() {
  const dialog = document.getElementById("aboutDialog");
  document.getElementById("aboutButton").addEventListener("click", () => dialog.showModal());
  document.getElementById("dialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

function registerWebMCPTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = tool => {
    try {
      Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error);
    } catch (error) {
      console.error(error);
    }
  };

  register({
    name: "navigate_rna_scale",
    title: "Navigate RNA scale",
    description: "Open one of the six visible RNA learning views.",
    inputSchema: {
      type: "object",
      properties: { scale: { type: "string", enum: SCENES } },
      required: ["scale"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const index = SCENES.indexOf(input?.scale);
      if (index < 0) throw new Error("Choose a valid RNA scale.");
      showScene(index);
      return { scale: SCENES[state.sceneIndex], step: state.sceneIndex + 1 };
    }
  });

  register({
    name: "select_rna_residue",
    title: "Select RNA residue",
    description: "Highlight one residue in the sequence, secondary structure, and tertiary structure views.",
    inputSchema: {
      type: "object",
      properties: { position: { type: "integer", minimum: 1, maximum: 76 } },
      required: ["position"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!Number.isInteger(input?.position) || input.position < 1 || input.position > 76) throw new Error("Position must be an integer from 1 to 76.");
      selectResidue(input.position - 1);
      const base = RNA_SEQUENCE[state.selectedResidue];
      return { position: input.position, base, name: BASE_NAMES[base] };
    }
  });
}

function initialize() {
  if (RNA_SEQUENCE.length !== 76 || TERTIARY_COORDS.length !== RNA_SEQUENCE.length) {
    console.error("RNA data length mismatch.");
  }
  setupNavigation();
  setupChemicalJourney();
  renderPrimary();
  setupPrimaryAnimation();
  setupSecondaryWorkspace();
  renderSecondary();
  TertiaryExplorer.setup({
    sequence: RNA_SEQUENCE,
    structure: TRNA_DOT_BRACKET,
    coords: TERTIARY_COORDS,
    colors: BASE_COLORS,
    names: BASE_NAMES,
    onSelect: index => selectResidue(index)
  });
  setupDialog();
  registerWebMCPTools();
  selectResidue(0);
  showScene(0);
}

initialize();
