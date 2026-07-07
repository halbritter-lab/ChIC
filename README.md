<p align="center">
   <img src="public/ChICLogo_Full_2026-07-02.png" alt="Charité Imaging Classification logo" width="240" height="240">
</p>

<h1 align="center">Charité Imaging Classification (ChIC)</h1>

<p align="center">
  An interactive web app for the prognostic assessment of <strong>Polycystic Liver Disease</strong> progression.
</p>

<p align="center">
  <a href="https://github.com/halbritter-lab/ChIC/actions/workflows/ci.yml"><img src="https://github.com/halbritter-lab/ChIC/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://halbritter-lab.github.io/ChIC/"><img src="https://img.shields.io/badge/Live%20app-ChIC-00bf7d?logo=github&logoColor=white" alt="Live app"></a>
  <a href="docs/README.md"><img src="https://img.shields.io/badge/Documentation-read-2496ED" alt="Documentation"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6">
  <img src="https://img.shields.io/badge/Chart.js-4-FF6384?logo=chartdotjs&logoColor=white" alt="Chart.js 4">
  <img src="https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white" alt="PWA ready">
</p>

---

## About

The **Charité Imaging Classification (ChIC)** helps clinicians and researchers assess and visualize the progression of **Polycystic Liver Disease**. It stratifies prognosis from **height-adjusted total liver volume (htTLV)** and **age**, assigning a Charité Imaging Class (**A–E**) and estimating the future risk of liver events. All computation runs in your browser and no data leaves your device. Try it [here](https://halbritter-lab.github.io/ChIC/).

> ChIC is an **informational, educational, and research tool — not a diagnostic device.** See the full disclaimer [here](docs/disclaimer.md).

## Documentation

Full documentation lives in [**`docs/`**](docs/README.md):

| Page                                               | What it covers                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Clinical background](clinical-background.md)   | What PLD is, the science behind the classification, its publication history and the model. |
| [User guide](user-guide.md)                     | Features and an annotated walkthrough of every part of the interface.                       |
| [Data formats](data-formats.md)                 | Batch **import** (Excel / CSV / JSON) and **export** (Excel / CSV / JSON / PNG) reference.  |
| [URL parameters](url-parameters.md)             | Preset inputs and embed/kiosk mode via URL query parameters.                                |
| [Privacy & offline use](privacy-and-offline.md) | Client-side data storage and Progressive Web App (PWA) install/offline behaviour.           |
| [Disclaimer](disclaimer.md)                     | Full disclaimer and usage guidelines.                                                       |
| [Citation & credits](citation.md)               | How to cite the ChIC, plus creators and contributors.                                           |

## Quick start

```bash
npm ci         # install dependencies (Node 20 — see .nvmrc)
npm run dev    # dev server on http://localhost:8137
npm run build  # production build -> dist/
npm test       # run the Vitest suite
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide and quality gates, and [AGENTS.md](AGENTS.md) for architecture, conventions, and load-bearing invariants.

## Tech stack

**Vue 3** + **Vite 6** · **Chart.js 4** · **exceljs** · **vite-plugin-pwa** · ESLint + Prettier + Vitest. Plain JavaScript, deployed to **GitHub Pages**.

## Citation

If you use ChIC in research or publication, please cite the ChIC paper (DOI/PMID forthcoming). Details in [Citation & credits](docs/citation.md).

## License

[MIT](LICENSE) © 2026 Carolin Brigl and contributors.

## Contact

Email <jan.halbritter@charite.de> or [open an issue](https://github.com/halbritter-lab/ChIC/issues).
