# RNA Structure Explorer

**An interactive, browser-based environment for learning, drawing, visualizing, and exploring RNA structure from chemical building blocks to 3D structure.**

🌐 **Live site:** https://sharears.github.io/RNA_explorer/

RNA Structure Explorer is designed to make RNA structure easier to learn and explore without requiring users to install specialized molecular-visualization or RNA software.

The site combines a **guided learning path** with independent **molecular drawing, secondary-structure, and tertiary-structure workspaces**. Users can start with the fundamentals of RNA chemistry or directly open the tools they need.

> **Status:** Beta  
> RNA Structure Explorer is intended for education, visualization, and exploratory analysis. It is not a folding simulation or a replacement for dedicated structure-prediction or structural-validation software.

---

## What can you do with RNA Structure Explorer?

There are two main ways to use the site:

### Learn

Follow RNA structure from its chemical components to its three-dimensional fold:

1. **Building blocks** — phosphate, ribose, and the RNA nucleobases
2. **Nucleoside** — formation of the base–ribose unit
3. **Nucleotide** — addition of phosphate
4. **Primary structure** — RNA sequence and the 5′ → 3′ direction
5. **Secondary structure** — base pairing and RNA 2D organization
6. **Tertiary structure** — the three-dimensional arrangement of RNA

The guided pathway uses the same example RNA across the structural views so that residues and structural features can be followed from sequence to secondary and tertiary structure.

---

## Explore

The exploration workspaces can be opened independently. There is no required order.

### 1. Molecular Drawing

The molecular drawing workspace provides an interactive environment for exploring RNA chemistry.

Users can:

- View and edit RNA nucleobases
- Work with adenine, guanine, cytosine, uracil, ribose, and phosphate
- Add or delete atoms
- Add or delete bonds
- Change bond orders
- Modify formal charges
- Move atoms and reorganize molecular drawings
- Explore standard Watson–Crick base pairs
- Explore the G•U wobble pair
- Modify existing base-pair models
- Construct custom molecular interactions

The goal is to provide a lightweight, browser-based molecular editor focused on RNA chemistry rather than a full replacement for general-purpose chemical drawing software.

---

### 2. Secondary Structure

The secondary-structure workspace allows users to build, inspect, edit, and customize RNA 2D structures.

#### Structure input

You can enter:

- An RNA sequence
- A dot-bracket secondary structure

The sequence and structure are checked before rendering.

RNA Structure Explorer also supports common RNA secondary-structure file formats, including:

- **DBN / dot-bracket files**
- **CT files**

The current beta supports RNA structures of up to **1,000 nucleotides**.

#### Multiple visualization layouts

The same RNA can be viewed using:

- **Radial layout**
- **Circular layout**
- **Arc layout**

This makes it possible to examine the same base-pairing information from different structural perspectives.

#### Interactive editing and navigation

Users can:

- Select individual residues
- Select base pairs
- Modify base-pair appearance
- Move and reposition residues
- Zoom and pan through the structure
- Control residue labels and residue indices
- Customize backbone, residues, base pairs, and annotations
- Adjust fonts, sizes, line widths, opacity, and other visual properties

#### Experimental or residue-level data

Residue-level numerical information can be loaded from CSV files and mapped directly onto the RNA structure.

The expected CSV format is:

```text
Residue_Index,Residue_ID,Residue_Information
1,G,0.12
2,C,0.78
3,A,0.35
```

This can be used for data such as:

- Chemical probing reactivity
- Experimental measurements
- Scores
- Per-residue annotations
- Other numerical residue-level information

Several color palettes are available for visualizing these values.

#### Base-pair probabilities

Base-pair probabilities can also be added independently of residue-level data.

Probability information can be supplied as either:

**Sparse CSV**

```text
Residue_i,Residue_j,Probability
1,72,0.96
2,71,0.91
3,70,0.84
```

or as a **base-pair probability matrix**.

Base pairs can then be colored according to their probabilities.

Residue-level information and base-pair probabilities can be displayed independently or together.

#### Custom legends

Legends for residue information and base-pair probabilities can be customized and repositioned to prepare clearer figures.

---

## 3. Tertiary Structure

The tertiary-structure workspace provides an interactive all-atom 3D view of RNA.

The default example uses the experimentally determined structure of **yeast phenylalanine tRNA (PDB 1EHZ)**.

Users can also upload their own:

- **PDB files**
- **mmCIF files**

### 3D interaction

The viewer supports:

- Rotation
- Zooming
- Panning
- Residue selection
- Centering on selected residues
- Different molecular representations
- Different coloring modes
- Residue labels and indices
- Structure measurements
- Inspection of molecular contacts
- Base-pair and hydrogen-bond visualization
- Selection and highlighting of structural regions

The 3D viewer is rendered using **3Dmol.js**.

---

## 3D Learning Lab

The tertiary-structure workspace also contains a learning environment for locating important structural concepts directly in an experimentally determined RNA structure.

Topics currently include:

- **Glycosidic angle (χ)**
- **Sugar pucker**
- **Backbone torsions (α–ζ)**
- **Base stacking**
- **Base pairing and hydrogen bonds**
- **RNA helices**
- **Loops and junctions**
- **Tertiary contacts**

Rather than presenting these ideas only as definitions, RNA Structure Explorer highlights examples directly within the 3D molecule.

---

## Linked 2D and 3D exploration

RNA Explorer can connect secondary- and tertiary-structure views when they represent the same RNA molecule.

This makes it possible to select a residue in one representation and follow it in the other.

Custom secondary and 3D structures are linked only after sequence/residue validation and confirmation that they correspond to the same molecule.

An experimental **3D → 2D** workflow can also identify candidate cis Watson–Crick/Watson–Crick (cWW) interactions from 3D geometry and generate a simplified secondary-structure representation.

> The 3D → 2D feature is experimental and is intended for learning and exploratory visualization. It should not be treated as a publication-ready RNA secondary-structure annotation method.

---

## Export figures

RNA Structure Explorer includes built-in figure export tools.

Supported figure formats include:

- **SVG**
- **PNG**
- **PDF**

This allows customized RNA diagrams to be saved for presentations, teaching materials, exploratory analysis, or further editing in graphics software.

---

## Save and reopen projects

A working RNA Explorer session can be saved from the **Project** menu.

Choose:

**More options → Save Project**

RNA Explorer creates an `.rnaexplorer.json` project file containing supported workspace information from the molecular drawing, secondary-structure, and tertiary-structure environments.

Later, choose:

**More options → Open Project**

to restore the saved workspace and continue working.

No user account or cloud storage is required for this feature.

---

## Search

RNA Explorer includes an integrated search tool for finding features and controls.

For example, users can search for terms such as:

- `PDB`
- `hydrogen bonds`
- `probability`
- `generate 2D`
- `reactivity`

The search can direct the user to the appropriate workspace and control.

---

## Who is this for?

RNA Structure Explorer is being developed primarily for:

- Undergraduate students learning RNA structure
- Instructors teaching biochemistry, molecular biology, or structural biology
- Students learning the relationship between RNA sequence, secondary structure, and tertiary structure
- Researchers or students who want a quick browser-based RNA visualization environment
- Anyone who wants to explore RNA structures without first installing specialized software

The emphasis is on **accessibility, interaction, and structural understanding**.

---

## Getting started

The easiest way to use RNA Structure Explorer is through the hosted website:

**https://sharears.github.io/RNA_explorer/**

No account is required.

Choose **Learn** to follow the guided RNA-structure pathway or **Explore** to open one of the independent workspaces.

---

## Run locally

RNA Structure Explorer is a browser-based static web application and does not require a build step.

Clone the repository:

```bash
git clone https://github.com/sharears/RNA_explorer.git
cd RNA_explorer
```

For the most reliable local behavior, serve the directory with a local web server rather than opening `index.html` directly.

For example, with Python:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Some functionality, including external structure retrieval and libraries used by the 3D viewer or PDF export, requires an internet connection.

---

## Project structure

Some of the main files are:

```text
RNA_explorer/
│
├── index.html                Main application interface
├── app.js                    Navigation and application-level behavior
├── styles.css                Main application styling
│
├── chemistry.js              Introductory RNA chemistry content
├── chemistry-editor.js       Interactive molecular drawing workspace
├── chemistry-editor.css
│
├── journey.js                Guided RNA learning pathway
├── guided-transitions.js     Guided transitions between learning stages
├── guided-transitions.css
├── primary-animation.js      Primary-structure animations
│
├── secondary.js              Secondary-structure editor and visualization
├── secondary.css
│
├── tertiary.js               3D RNA exploration and structural tools
├── tertiary.css
│
├── export-tools.js           SVG, PNG, and PDF export utilities
├── project-session.js        Save and restore RNA Explorer projects
│
├── data/                     Example/supporting data
└── assets/                   Images and other site assets
```

---

## Scientific scope and limitations

RNA Structure Explorer is designed primarily as an **educational and exploratory visualization environment**.

A few important distinctions:

- Simplified chemical animations illustrate molecular connectivity and chemical concepts; they are not simulations of cellular biosynthetic pathways.
- Primary, secondary, and tertiary views describe different representations of RNA structure and do not imply a sequential folding mechanism.
- The secondary-structure editor visualizes user-supplied or generated structural information; it is not currently an RNA folding-prediction engine.
- Experimental 3D → 2D annotation features should be interpreted as exploratory tools.
- Structural results intended for publication should be independently validated with appropriate specialized software and methods.

---

## Example structure

The default tertiary-structure example is:

**Yeast phenylalanine tRNA — PDB 1EHZ**

RCSB PDB: https://www.rcsb.org/structure/1EHZ

This experimentally determined structure provides a common molecule that can be followed across the learning and visualization components of RNA Structure Explorer.

---

## Feedback and questions

RNA Structure Explorer is actively being developed.

Suggestions, bug reports, questions, and feedback are welcome.

**Md. Sharear Saon, Ph.D.**  
Email: sharearsaon@outlook.com

You can also use the **Feedback & Questions** link directly within RNA Structure Explorer.

---

## License

This project is released under the **MIT License**.

See [`LICENSE`](LICENSE) for details.

---

## Citation

RNA Structure Explorer is currently under active development. Citation information will be added if/when a corresponding publication or archived software release becomes available.
