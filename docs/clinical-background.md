# Clinical background

[← Documentation home](README.md)

## Introduction

The Charité Imaging Classification (ChIC) for Polycystic Liver Disease (PLD) is an interactive web application designed to assist in the prognostic assessment of Autosomal Dominant Polycystic Liver Disease (ADPLD) and PLD in the context of Autosomal Dominant Polycystic Kidney Disease (ADPKD). Based on a recent study titled "ChIC Paper" ([PMID:TBD](https://pubmed.ncbi.nlm.nih.gov/TBD/)), the tool visualizes disease progression and estimates the future risk of liver events in individuals with PLD.

PLD is characterized by numerous fluid-filled cysts arising from the intrahepatic biliary epithelia. It is a mostly genetic cholangiopathy with significant clinical heterogeneity: some patients never experience symptoms, while others require medication, procedural intervention, or — in rare cases — liver transplantation. ChIC uses **height-adjusted total liver volume (htTLV)** and **age**, leveraging data from three tertiary care centers and two previous studies to provide prognostic risk stratification in PLD.

## Tool development

The principle of the Charité Imaging Classification was first published in **2022**, highlighting its application in the study of PLD in the context of both ADPKD and ADPLD. This first version used a **three-group system** and the endpoint _"liver hospitalizations."_
See [PMID:36246085](https://pubmed.ncbi.nlm.nih.gov/36246085/).

The tool was **validated in a second study of ADPLD-only patients in 2024.**
See [PMID:38101549](https://pubmed.ncbi.nlm.nih.gov/38101549/).

In **2026** the classification underwent significant revision:

- Expanded to a **five-group system (Classes A–E)** to better cover the range of disease presentation.
- Adopted **htTLV** and an expanded endpoint, _"liver events,"_ to better align with progress in the PLD field.
- Extended coverage to **ages 15–85** with improved stratification of patients under 30.

See [PMID:TBD](https://pubmed.ncbi.nlm.nih.gov/TBD/).

## The classification model

ChIC assigns a **Charité Imaging Class** by comparing a patient's htTLV against four exponential, age-dependent threshold curves:

| Class       | Liver growth rate | Progression |
| ----------- | ----------------- | ----------- |
| **Class A** | < 1 % / year      | Very slow   |
| **Class B** | 1–2 % / year      | Slow        |
| **Class C** | 2–3 % / year      | Moderate    |
| **Class D** | 3–4 % / year      | Rapid       |
| **Class E** | > 4 % / year      | Very rapid  |

Height-adjusted total liver volume is computed as `htTLV = TLV / height` (TLV in ml, height in m). The liver growth rate (LGR, % / year) is derived from serial measurements. The clinical model and all tunable constants are defined in the source (`src/domain/classification.js` and `src/config/config.js`); see [AGENTS.md](../AGENTS.md) for details.

## Technical overview

The application is built with **Vue.js** and **Chart.js** for a responsive, interactive experience. Controls and input fields sit on the left, the chart on the right — a layout designed for ease of use and clear data presentation.

## References

- **Mayo Clinic ADPKD imaging classification** — the analogous kidney model that ChIC is built on:
  <https://www.mayo.edu/research/documents/pkd-center-adpkd-classification/doc-20094754>
- **Related tools from the Halbritter Lab:**
  [ADPKD risk](https://halbritter-lab.github.io/adpkd-risk/) · the predecessor [PLD progression grouper](https://halbritter-lab.github.io/pld-progression-grouper/)
