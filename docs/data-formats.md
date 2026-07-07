# Data formats

[← Documentation home](README.md)

ChIC reads and writes patient data entirely in your browser — no data leaves your device. See more about privacy and offline use [here](privacy-and-offline.md).

## Import — batch upload

The application supports uploading multiple patient records at once in three formats:

| Format           | Description                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Excel (XLSX)** | Each row contains: **ID**, **Age** (years), **Height** (meters), **TLV** (milliliters), and optionally **Group** and **GroupColor**. |
| **CSV**          | Comma-separated values with the same column structure as the Excel format — universally compatible with all spreadsheet apps.        |
| **JSON**         | An array of patient objects with the properties: `id`, `age`, `height`, `tlv`, `group` (optional), `groupColor` (optional).          |

All imported records are added to the chart and data table for immediate visualization and analysis. Height-adjusted TLV, class and LGR are re-computed on load. Records without a height are estimated from the cohort-mean height and flagged as estimates.

## Export

Data can be exported in several formats for flexibility:

| Format           | Best for                                                                |
| ---------------- | ----------------------------------------------------------------------- |
| **Excel (XLSX)** | Spreadsheet analysis, with proper number formatting.                    |
| **CSV**          | Universal compatibility with all spreadsheet applications.              |
| **JSON**         | Further processing or integration with other applications.              |
| **PNG**          | Downloading the chart as an image — ideal for presentations or reports. |

All tabular export formats include the complete data-table columns: **ID**, **Age (y)**, **Height (m)**, **TLV (ml)**, **htTLV**, **Class**, and **LGR (% / y)**, with consistent number formatting.
