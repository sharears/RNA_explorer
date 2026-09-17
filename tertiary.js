const TertiaryExplorer = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const VIEW = { width: 720, height: 520, cx: 360, cy: 260 };
  const PALETTES = {
    viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
    magma: ["#000004", "#51127c", "#b73779", "#fc8961", "#fcfdbf"],
    blueRed: ["#2166ac", "#92c5de", "#f7f7f7", "#f4a582", "#b2182b"],
    cividis: ["#00224e", "#434e6c", "#7d7c78", "#bcae6c", "#fee838"]
  };
  const REGION_COLORS = {
    "Acceptor stem": "#74d7b6",
    "D arm": "#d9808e",
    "Anticodon arm": "#e8bb69",
    "Variable region": "#87a9cc",
    "T arm": "#a78bfa",
    "3′ CCA end": "#f0a36f",
    "Connector": "#8fa2b3"
  };

  const state = {
    sequence: "",
    coords: [],
    structure: "",
    colors: {},
    names: {},
    onSelect: () => {},
    selected: 0,
    rotationX: -0.28,
    rotationY: -0.6,
    zoom: 1,
    panX: 0,
    panY: 0,
    pointer: null,
    representation: "residues",
    colorMode: "nucleotide",
    showPairs: true,
    showIndices: true,
    indexSelection: new Set(),
    metadata: {},
    heatEnabled: false,
    heatTheme: "viridis",
    heatRange: [0, 1],
    secondaryIsDefault: true,
    proximityEnabled: false,
    proximityCutoff: 12,
    measureEnabled: false,
    measureA: null,
    measureB: null,
    split: false
  };

  let center3D = [0, 0, 0];
  let pairs = [];
  let partner = [];
  let setupDone = false;

  const $ = id => document.getElementById(id);
  const svg = (name, attrs = {}) => {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function parseStructure(structure, n) {
    const stack = [], parsedPairs = [], parsedPartner = Array(n).fill(-1);
    [...structure].forEach((c, i) => {
      if (c === "(") stack.push(i);
      else if (c === ")") {
        const a = stack.pop();
        if (a === undefined) return;
        parsedPairs.push([a, i]);
        parsedPartner[a] = i;
        parsedPartner[i] = a;
      }
    });
    return { pairs: parsedPairs.sort((a, b) => a[0] - b[0]), partner: parsedPartner };
  }

  function regionFor(index) {
    const p = index + 1;
    if ((p >= 1 && p <= 7) || (p >= 66 && p <= 72)) return "Acceptor stem";
    if (p >= 10 && p <= 25) return "D arm";
    if (p >= 26 && p <= 44) return "Anticodon arm";
    if (p >= 45 && p <= 48) return "Variable region";
    if (p >= 49 && p <= 65) return "T arm";
    if (p >= 73 && p <= 76) return "3′ CCA end";
    return "Connector";
  }

  function regionIndices(region) {
    return state.sequence.split("").map((_, i) => i).filter(i => regionFor(i) === region);
  }

  function distance3D(a, b) {
    return Math.hypot(
      state.coords[a][0] - state.coords[b][0],
      state.coords[a][1] - state.coords[b][1],
      state.coords[a][2] - state.coords[b][2]
    );
  }

  function heatColor(value) {
    const [min, max] = state.heatRange;
    const t = max === min ? 0.5 : clamp((value - min) / (max - min), 0, 1);
    const stops = PALETTES[state.heatTheme] || PALETTES.viridis;
    const x = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    const f = x - i;
    return "#" + [1, 3, 5].map(k => {
      const a = parseInt(stops[i].slice(k, k + 2), 16);
      const b = parseInt(stops[i + 1].slice(k, k + 2), 16);
      return Math.round(a * (1 - f) + b * f).toString(16).padStart(2, "0");
    }).join("");
  }

  function residueColor(index) {
    if (state.colorMode === "region") return REGION_COLORS[regionFor(index)];
    if (state.colorMode === "metadata" && state.heatEnabled && state.metadata[index]?.value != null) {
      return heatColor(state.metadata[index].value);
    }
    return state.colors[state.sequence[index]] || "#8fa2b3";
  }

  function rawProject(point) {
    let [x, y, z] = point.map((value, i) => value - center3D[i]);
    const cy = Math.cos(state.rotationY), sy = Math.sin(state.rotationY);
    const cx = Math.cos(state.rotationX), sx = Math.sin(state.rotationX);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    const scale = 7;
    return { x: VIEW.cx + x1 * scale, y: VIEW.cy + y1 * scale, z: z2 };
  }

  function projectPoint(point) {
    const p = rawProject(point);
    return {
      x: VIEW.cx + (p.x - VIEW.cx) * state.zoom + state.panX,
      y: VIEW.cy + (p.y - VIEW.cy) * state.zoom + state.panY,
      z: p.z
    };
  }

  function smoothPath(points) {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      d += ` Q ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
    }
    const last = points.at(-1);
    const before = points.at(-2);
    d += ` Q ${before.x.toFixed(2)} ${before.y.toFixed(2)} ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    return d;
  }

  function defaultIndexSelection() {
    return new Set(state.sequence.split("").map((_, i) => i).filter(i => i === 0 || (i + 1) % 5 === 0 || i === state.sequence.length - 1));
  }

  function nearbyResidues(index) {
    if (!state.proximityEnabled) return [];
    return state.coords.map((_, i) => i).filter(i => {
      if (i === index || Math.abs(i - index) <= 1) return false;
      return distance3D(index, i) <= state.proximityCutoff;
    });
  }

  function tooltipText(index) {
    const base = state.sequence[index];
    const p = partner[index];
    const info = state.metadata[index]?.value;
    return {
      title: `${state.names[base] || base} · ${base}${index + 1}`,
      rows: [
        `Region: ${regionFor(index)}`,
        p >= 0 ? `Paired with: ${state.sequence[p]}${p + 1}` : "Paired with: none",
        `Residue information: ${info == null ? "No value" : info}`
      ]
    };
  }

  function showTooltip(event, index) {
    const tip = $("teTooltip");
    const viewport = $("tertiaryViewport");
    if (!tip || !viewport) return;
    const data = tooltipText(index);
    tip.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = data.title;
    tip.append(strong);
    data.rows.forEach(row => {
      const div = document.createElement("div");
      div.textContent = row;
      tip.append(div);
    });
    const rect = viewport.getBoundingClientRect();
    tip.style.left = clamp(event.clientX - rect.left + 14, 8, Math.max(8, rect.width - 220)) + "px";
    tip.style.top = clamp(event.clientY - rect.top + 14, 8, Math.max(8, rect.height - 110)) + "px";
    tip.hidden = false;
  }

  function hideTooltip() {
    if ($("teTooltip")) $("teTooltip").hidden = true;
  }

  function updateSelectedCopy() {
    const panel = document.querySelector("#scene-tertiary .selected-residue-copy");
    if (!panel) return;
    const i = state.selected;
    const p = partner[i];
    const info = state.metadata[i]?.value;
    const pairText = p >= 0 ? ` Paired with ${state.sequence[p]}${p + 1}.` : " Unpaired in the secondary structure.";
    const infoText = info == null ? "" : ` Residue information: ${info}.`;
    panel.textContent = `${regionFor(i)}.${pairText}${infoText} Left-drag to rotate, mouse wheel to zoom, right-drag to pan.`;
  }

  function renderHeatLegend() {
    const box = $("teHeatLegend");
    if (!box) return;
    const active = state.colorMode === "metadata" && state.heatEnabled;
    box.hidden = !active;
    if (!active) return;
    const stops = PALETTES[state.heatTheme] || PALETTES.viridis;
    box.innerHTML = `<strong>Residue information · ${state.heatTheme}</strong><div class="te-heat-bar"></div><p>${state.heatRange[0]} → ${state.heatRange[1]} · Same linear scale as the secondary structure.</p>`;
    box.querySelector(".te-heat-bar").style.background = `linear-gradient(to right,${stops.join(",")})`;
  }

  function renderRegionLegend() {
    const box = $("teRegionLegend");
    if (!box) return;
    box.hidden = state.colorMode !== "region";
    if (box.hidden) return;
    box.replaceChildren();
    Object.entries(REGION_COLORS).forEach(([name, color]) => {
      const item = document.createElement("span");
      const swatch = document.createElement("i");
      swatch.style.background = color;
      item.append(swatch, document.createTextNode(name));
      box.append(item);
    });
  }

  function drawPairConnections(root, projected) {
    if (!state.showPairs) return;
    const selectedPartner = partner[state.selected];
    pairs.forEach(([a, b]) => {
      const selectedPair = (a === state.selected && b === selectedPartner) || (b === state.selected && a === selectedPartner);
      const group = svg("g", { class: `te-pair${selectedPair ? " selected" : ""}` });
      const line = svg("line", {
        x1: projected[a].x, y1: projected[a].y,
        x2: projected[b].x, y2: projected[b].y,
        class: "te-pair-line"
      });
      const hit = svg("line", {
        x1: projected[a].x, y1: projected[a].y,
        x2: projected[b].x, y2: projected[b].y,
        class: "te-pair-hit"
      });
      const choose = event => {
        event.stopPropagation();
        state.onSelect(a);
      };
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-label", `Secondary-structure pair ${a + 1}–${b + 1}`);
      group.addEventListener("pointerdown", event => event.stopPropagation());
      group.addEventListener("click", choose);
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          state.onSelect(a);
        }
      });
      group.append(line, hit);
      root.append(group);
    });
  }

  function drawMeasurement(root, projected) {
    const status = $("teMeasureStatus");
    if (!state.measureEnabled) {
      if (status) status.textContent = "Select two residues to measure a C4′–C4′ distance.";
      return;
    }
    if (state.measureA == null) {
      if (status) status.textContent = "Measurement mode: choose the first residue.";
      return;
    }
    if (state.measureB == null) {
      if (status) status.textContent = `First residue: ${state.sequence[state.measureA]}${state.measureA + 1}. Choose the second residue.`;
      return;
    }
    const a = state.measureA, b = state.measureB;
    const pa = projected[a], pb = projected[b];
    root.append(svg("line", { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: "te-measure-line" }));
    const label = svg("text", {
      x: (pa.x + pb.x) / 2,
      y: (pa.y + pb.y) / 2 - 7,
      class: "te-measure-label"
    });
    const d = distance3D(a, b);
    label.textContent = `${d.toFixed(1)} Å`;
    root.append(label);
    if (status) status.textContent = `${state.sequence[a]}${a + 1} ↔ ${state.sequence[b]}${b + 1}: ${d.toFixed(2)} Å between C4′ atoms.`;
  }

  function chooseResidue(index) {
    if (state.measureEnabled) {
      if (state.measureA == null || state.measureB != null) {
        state.measureA = index;
        state.measureB = null;
      } else if (index !== state.measureA) {
        state.measureB = index;
      }
    }
    state.onSelect(index);
  }

  function renderNodes(root, projected) {
    const proximity = new Set(nearbyResidues(state.selected));
    projected.map((point, index) => ({ ...point, index }))
      .sort((a, b) => a.z - b.z)
      .forEach(point => {
        const i = point.index;
        const base = state.sequence[i];
        const selected = i === state.selected;
        const pairedSelected = partner[state.selected] === i;
        const nearby = proximity.has(i);

        if (nearby) {
          root.append(svg("circle", {
            cx: point.x, cy: point.y, r: 13,
            class: "te-proximity-halo"
          }));
        }

        const showAllNodes = state.representation !== "tube";
        if (!showAllNodes && !selected && !pairedSelected && !nearby) return;

        const radius = selected ? 11 : pairedSelected ? 9 : 6.5;
        const group = svg("g", {
          class: `tertiary-node${selected ? " selected" : ""}${pairedSelected ? " paired-selected" : ""}${nearby ? " nearby" : ""}`,
          transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,
          tabindex: "0",
          role: "button",
          "aria-label": `${state.names[base] || base}, position ${i + 1}, ${regionFor(i)}`
        });
        group.append(svg("circle", {
          r: radius,
          fill: residueColor(i),
          opacity: clamp(0.72 + point.z / 100, 0.58, 1)
        }));
        if (selected || state.representation === "residues") {
          const text = svg("text", { y: 0.5 });
          text.textContent = base;
          group.append(text);
        }
        group.addEventListener("pointerdown", event => event.stopPropagation());
        group.addEventListener("click", event => {
          event.stopPropagation();
          chooseResidue(i);
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            chooseResidue(i);
          }
        });
        group.addEventListener("pointerenter", event => showTooltip(event, i));
        group.addEventListener("pointermove", event => showTooltip(event, i));
        group.addEventListener("pointerleave", hideTooltip);
        root.append(group);
      });

    if (state.proximityEnabled) {
      const status = $("teProximityStatus");
      const list = [...proximity].sort((a, b) => distance3D(state.selected, a) - distance3D(state.selected, b));
      if (status) {
        status.textContent = list.length
          ? `${list.length} non-neighboring residues within ${state.proximityCutoff} Å of ${state.sequence[state.selected]}${state.selected + 1}: ${list.slice(0, 8).map(i => state.sequence[i] + (i + 1)).join(", ")}${list.length > 8 ? "…" : ""}`
          : `No non-neighboring residues within ${state.proximityCutoff} Å of ${state.sequence[state.selected]}${state.selected + 1}.`;
      }
    } else if ($("teProximityStatus")) {
      $("teProximityStatus").textContent = "Highlights C4′ spatial neighbors that are not immediate sequence neighbors.";
    }
  }

  function renderIndices(root, projected) {
    if (!state.showIndices) return;
    state.indexSelection.forEach(i => {
      if (!projected[i]) return;
      const label = svg("text", {
        x: projected[i].x + 10,
        y: projected[i].y - 10,
        class: "te-index-label"
      });
      label.textContent = String(i + 1);
      root.append(label);
    });
  }

  function renderMiniSecondary() {
    const panel = $("tertiaryMiniPanel");
    const root = $("tertiaryMiniSvg");
    if (!panel || !root) return;
    panel.hidden = !state.split || !state.secondaryIsDefault;
    if (panel.hidden) return;
    root.replaceChildren();

    let positions;
    try {
      if (typeof SecondaryExplorer !== "undefined" && SecondaryExplorer.radial) {
        positions = SecondaryExplorer.radial(state.sequence.length, partner);
      }
    } catch (_) {}
    if (!positions?.length) return;

    const minX = Math.min(...positions.map(p => p.x)), maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y)), maxY = Math.max(...positions.map(p => p.y));
    const pad = 34, width = 340, height = 430;
    const scale = Math.min((width - 2 * pad) / Math.max(1, maxX - minX), (height - 2 * pad) / Math.max(1, maxY - minY));
    const map = positions.map(p => ({
      x: pad + (p.x - minX) * scale,
      y: pad + (p.y - minY) * scale
    }));

    pairs.forEach(([a, b]) => {
      root.append(svg("line", {
        x1: map[a].x, y1: map[a].y, x2: map[b].x, y2: map[b].y,
        class: `te-mini-pair${a === state.selected || b === state.selected ? " selected" : ""}`
      }));
    });

    const backbone = svg("polyline", {
      points: map.map(p => `${p.x},${p.y}`).join(" "),
      class: "te-mini-backbone"
    });
    root.append(backbone);

    map.forEach((p, i) => {
      const selected = i === state.selected;
      const mate = partner[state.selected] === i;
      const group = svg("g", {
        class: `te-mini-node${selected ? " selected" : ""}${mate ? " paired-selected" : ""}`,
        transform: `translate(${p.x} ${p.y})`,
        tabindex: "0",
        role: "button",
        "aria-label": `${state.sequence[i]}${i + 1}`
      });
      group.append(svg("circle", { r: selected ? 7 : 4.5, fill: residueColor(i) }));
      if (selected) {
        const label = svg("text", { y: -10 });
        label.textContent = `${state.sequence[i]}${i + 1}`;
        group.append(label);
      }
      group.addEventListener("click", () => state.onSelect(i));
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          state.onSelect(i);
        }
      });
      root.append(group);
    });
  }

  function render(selected = state.selected) {
    state.selected = clamp(selected, 0, Math.max(0, state.sequence.length - 1));
    const root = $("tertiarySvg");
    if (!root || !state.coords.length) return;
    root.replaceChildren();
    const projected = state.coords.map(projectPoint);

    drawPairConnections(root, projected);

    const backbone = svg("path", {
      d: smoothPath(projected),
      class: `tertiary-backbone ${state.representation}`
    });
    root.append(backbone);

    renderNodes(root, projected);
    renderIndices(root, projected);
    drawMeasurement(root, projected);
    renderMiniSecondary();
    renderHeatLegend();
    renderRegionLegend();
    updateSelectedCopy();
    updateControls();
  }

  function changeZoom(factor, clientX, clientY) {
    const viewport = $("tertiaryViewport");
    const rect = viewport.getBoundingClientRect();
    const px = clientX == null ? VIEW.cx : (clientX - rect.left) / rect.width * VIEW.width;
    const py = clientY == null ? VIEW.cy : (clientY - rect.top) / rect.height * VIEW.height;
    const oldZoom = state.zoom;
    const newZoom = clamp(oldZoom * factor, 0.45, 5);
    const baseX = (px - VIEW.cx - state.panX) / oldZoom;
    const baseY = (py - VIEW.cy - state.panY) / oldZoom;
    state.zoom = newZoom;
    state.panX = px - VIEW.cx - baseX * newZoom;
    state.panY = py - VIEW.cy - baseY * newZoom;
    render();
  }

  function resetView() {
    state.rotationX = -0.28;
    state.rotationY = -0.6;
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    render();
  }

  function focusIndices(indices, maxZoom = 2.6) {
    if (!indices?.length) return;
    const raw = indices.map(i => rawProject(state.coords[i]));
    const minX = Math.min(...raw.map(p => p.x)), maxX = Math.max(...raw.map(p => p.x));
    const minY = Math.min(...raw.map(p => p.y)), maxY = Math.max(...raw.map(p => p.y));
    const width = Math.max(55, maxX - minX), height = Math.max(55, maxY - minY);
    state.zoom = clamp(Math.min(560 / width, 380 / height) * 0.9, 1, maxZoom);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    state.panX = -(cx - VIEW.cx) * state.zoom;
    state.panY = -(cy - VIEW.cy) * state.zoom;
    render();
  }

  function centerSelected() {
    focusIndices([state.selected], 2.8);
  }

  function buildIndexChoices() {
    const box = $("teIndexChoices");
    if (!box) return;
    box.replaceChildren();
    state.sequence.split("").forEach((base, i) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = state.indexSelection.has(i);
      input.addEventListener("change", () => {
        if (input.checked) state.indexSelection.add(i);
        else state.indexSelection.delete(i);
        render();
      });
      label.append(input, document.createTextNode(`${base}${i + 1}`));
      box.append(label);
    });
  }

  function updateControls() {
    const color = $("teColorMode");
    const metaOption = color?.querySelector('option[value="metadata"]');
    if (metaOption) metaOption.disabled = !state.heatEnabled;
    if (color && color.value !== state.colorMode) color.value = state.colorMode;
    if ($("teZoomValue")) $("teZoomValue").textContent = Math.round(state.zoom * 100) + "%";
    if ($("teSplit")) {
      $("teSplit").checked = state.split && state.secondaryIsDefault;
      $("teSplit").disabled = !state.secondaryIsDefault;
    }
    if ($("teMappingStatus")) {
      $("teMappingStatus").textContent = state.secondaryIsDefault
        ? "Secondary and tertiary selections are synchronized for the default 1EHZ tRNA."
        : "3D mapping paused: the Secondary tab currently contains a custom sequence/structure. Restore the default tRNA to synchronize the views.";
    }
    if ($("teMeasureToggle")) {
      $("teMeasureToggle").setAttribute("aria-pressed", String(state.measureEnabled));
      $("teMeasureToggle").textContent = state.measureEnabled ? "Stop measuring" : "Measure C4′ distance";
    }
  }

  function setupControls() {
    const box = $("tertiaryControls");
    if (!box) return;
    box.innerHTML = `
      <div class="te-controls">
        <details open>
          <summary>3D display</summary>
          <label>Representation
            <select id="teRepresentation">
              <option value="residues">Residues + tube</option>
              <option value="trace">Trace + residues</option>
              <option value="tube">Tube</option>
            </select>
          </label>
          <label>Color by
            <select id="teColorMode">
              <option value="nucleotide">Nucleotide</option>
              <option value="region">Secondary element</option>
              <option value="metadata" disabled>Residue information</option>
            </select>
          </label>
          <label class="te-check"><input id="teShowPairs" type="checkbox" checked> Show secondary-structure pair connections</label>
          <label class="te-check"><input id="teShowIndices" type="checkbox" checked> Show residue indices</label>
        </details>
        <details>
          <summary>Residue index</summary>
          <p>Default labels: 1, every 5 residues, and the final residue.</p>
          <details class="te-index-dropdown"><summary>Choose indices</summary><div id="teIndexChoices"></div></details>
          <div class="te-button-row">
            <button type="button" id="teIndexDefault">Default</button>
            <button type="button" id="teIndexAll">All</button>
            <button type="button" id="teIndexNone">None</button>
          </div>
        </details>
        <details open>
          <summary>Explore structure</summary>
          <label class="te-check"><input id="teProximity" type="checkbox"> Highlight 3D proximity</label>
          <label>Proximity cutoff (Å)<input id="teProximityCutoff" type="number" min="6" max="30" step="0.5" value="12"></label>
          <p id="teProximityStatus">Highlights C4′ spatial neighbors that are not immediate sequence neighbors.</p>
          <button type="button" id="teMeasureToggle" aria-pressed="false">Measure C4′ distance</button>
          <p id="teMeasureStatus">Select two residues to measure a C4′–C4′ distance.</p>
          <label class="te-check"><input id="teSplit" type="checkbox"> 2D + 3D linked view</label>
          <p id="teMappingStatus"></p>
        </details>
        <details>
          <summary>Focus on structural region</summary>
          <div class="te-button-row te-region-buttons">
            <button type="button" data-te-region="Acceptor stem">Acceptor</button>
            <button type="button" data-te-region="Anticodon arm">Anticodon</button>
            <button type="button" data-te-region="elbow">D/T-loop elbow</button>
            <button type="button" data-te-region="full">Full structure</button>
          </div>
        </details>
        <div class="te-region-legend" id="teRegionLegend" hidden></div>
      </div>`;

    $("teRepresentation").value = state.representation;
    $("teColorMode").value = state.colorMode;
    $("teShowPairs").checked = state.showPairs;
    $("teShowIndices").checked = state.showIndices;
    $("teProximityCutoff").value = state.proximityCutoff;

    $("teRepresentation").addEventListener("change", e => { state.representation = e.target.value; render(); });
    $("teColorMode").addEventListener("change", e => { state.colorMode = e.target.value; render(); });
    $("teShowPairs").addEventListener("change", e => { state.showPairs = e.target.checked; render(); });
    $("teShowIndices").addEventListener("change", e => { state.showIndices = e.target.checked; render(); });
    $("teProximity").addEventListener("change", e => { state.proximityEnabled = e.target.checked; render(); });
    $("teProximityCutoff").addEventListener("input", e => {
      if (!e.target.checkValidity()) return;
      state.proximityCutoff = Number(e.target.value);
      render();
    });
    $("teMeasureToggle").addEventListener("click", () => {
      state.measureEnabled = !state.measureEnabled;
      if (!state.measureEnabled) {
        state.measureA = null;
        state.measureB = null;
      }
      render();
    });
    $("teSplit").addEventListener("change", e => {
      state.split = e.target.checked && state.secondaryIsDefault;
      render();
    });
    $("teIndexDefault").addEventListener("click", () => {
      state.indexSelection = defaultIndexSelection();
      buildIndexChoices();
      render();
    });
    $("teIndexAll").addEventListener("click", () => {
      state.indexSelection = new Set(state.sequence.split("").map((_, i) => i));
      buildIndexChoices();
      render();
    });
    $("teIndexNone").addEventListener("click", () => {
      state.indexSelection.clear();
      buildIndexChoices();
      render();
    });
    box.querySelectorAll("[data-te-region]").forEach(button => button.addEventListener("click", () => {
      const region = button.dataset.teRegion;
      if (region === "full") resetView();
      else if (region === "elbow") focusIndices([...regionIndices("D arm"), ...regionIndices("T arm")], 2.0);
      else focusIndices(regionIndices(region));
    }));

    buildIndexChoices();
  }

  function setupStageInteractions() {
    const viewport = $("tertiaryViewport");
    const root = $("tertiarySvg");
    root.setAttribute("tabindex", "0");
    root.setAttribute("aria-label", "Interactive C4-prime trace of yeast phenylalanine tRNA. Left-drag to rotate, mouse wheel to zoom, right-drag to pan.");

    viewport.addEventListener("wheel", event => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 560 : 1);
      changeZoom(Math.exp(-clamp(delta, -200, 200) * 0.003), event.clientX, event.clientY);
    }, { passive: false });

    viewport.addEventListener("pointerdown", event => {
      if (event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      state.pointer = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.toggle("te-rotating", event.button === 0);
      viewport.classList.toggle("te-panning", event.button === 2);
    });

    viewport.addEventListener("pointermove", event => {
      if (!state.pointer || event.pointerId !== state.pointer.id) return;
      const dx = event.clientX - state.pointer.x;
      const dy = event.clientY - state.pointer.y;
      if (state.pointer.button === 0) {
        state.rotationY += dx * 0.011;
        state.rotationX += dy * 0.011;
      } else {
        const rect = viewport.getBoundingClientRect();
        state.panX += dx / rect.width * VIEW.width;
        state.panY += dy / rect.height * VIEW.height;
      }
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
      render();
    });

    const endPointer = event => {
      if (!state.pointer || event.pointerId !== state.pointer.id) return;
      state.pointer = null;
      viewport.classList.remove("te-rotating", "te-panning");
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    };
    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);
    viewport.addEventListener("contextmenu", event => event.preventDefault());

    root.addEventListener("keydown", event => {
      const step = 0.12;
      if (event.key === "ArrowLeft") state.rotationY -= step;
      else if (event.key === "ArrowRight") state.rotationY += step;
      else if (event.key === "ArrowUp") state.rotationX -= step;
      else if (event.key === "ArrowDown") state.rotationX += step;
      else if (event.key === "+" || event.key === "=") return changeZoom(1.2);
      else if (event.key === "-") return changeZoom(0.8);
      else return;
      event.preventDefault();
      render();
    });

    $("teZoomIn").addEventListener("click", () => changeZoom(1.25));
    $("teZoomOut").addEventListener("click", () => changeZoom(0.8));
    $("teResetView").addEventListener("click", resetView);
    $("teCenterSelected").addEventListener("click", centerSelected);
  }

  function applyMetadata(detail) {
    if (!detail?.isDefault) {
      state.metadata = {};
      state.heatEnabled = false;
      if (state.colorMode === "metadata") state.colorMode = "nucleotide";
      render();
      return;
    }
    state.metadata = detail.metadata || {};
    state.heatEnabled = Boolean(detail.heatEnabled) && Object.keys(state.metadata).length > 0;
    state.heatTheme = detail.heatTheme || "viridis";
    state.heatRange = Array.isArray(detail.heatRange) ? detail.heatRange : [0, 1];
    if (!state.heatEnabled && state.colorMode === "metadata") state.colorMode = "nucleotide";
    render();
  }

  function setup(config) {
    if (setupDone) return;
    setupDone = true;
    state.sequence = config.sequence;
    state.coords = config.coords;
    state.structure = config.structure;
    state.colors = config.colors;
    state.names = config.names;
    state.onSelect = config.onSelect;
    center3D = state.coords.reduce((acc, point) => acc.map((value, i) => value + point[i] / state.coords.length), [0, 0, 0]);
    const parsed = parseStructure(state.structure, state.sequence.length);
    pairs = parsed.pairs;
    partner = parsed.partner;
    state.indexSelection = defaultIndexSelection();

    setupControls();
    setupStageInteractions();

    $("followButton")?.addEventListener("click", () => {
      let next = state.selected;
      while (next === state.selected) next = Math.floor(Math.random() * state.sequence.length);
      state.onSelect(next);
    });

    window.addEventListener("rna-metadata-change", event => applyMetadata(event.detail));
    window.addEventListener("rna-secondary-context", event => {
      state.secondaryIsDefault = Boolean(event.detail?.isDefault);
      if (!state.secondaryIsDefault) state.split = false;
      render();
    });

    render();
  }

  return { setup, render };
})();