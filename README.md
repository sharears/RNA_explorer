# RNA Structure Explorer

An interactive teaching site that follows one RNA molecule from its chemical building blocks to primary, secondary, and tertiary structure.

## Explore

The site includes:

- Building blocks: phosphoric acid, ribose, and the four RNA bases
- Nucleoside formation: simplified base–ribose condensation and the N-glycosidic bond
- Nucleotide formation: addition of 5′ phosphate
- Primary structure: a 5′ → 3′ chain-growth animation and interactive sequence
- Secondary structure: an interactive tRNA cloverleaf
- Tertiary structure: a rotatable C4′ residue trace of yeast tRNA-Phe derived from [PDB 1EHZ](https://www.rcsb.org/structure/1EHZ)

Chemical animations are teaching diagrams. They show atom connectivity and formal condensation bookkeeping, rather than cellular biosynthetic mechanisms.

## Run locally

This is a dependency-free static site. Open `index.html` in a browser, or serve the directory with any static-file server.

## Files

- `index.html` — page structure
- `styles.css` — styling and animations
- `app.js` — navigation, primary sequence, secondary structure, and 3D trace
- `chemistry.js`, `journey.js`, and `primary-animation.js` — chemical and chain-growth animations
