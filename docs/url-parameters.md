# URL parameters

[← Documentation home](README.md)

The Charité Imaging Classification tool supports **URL query parameters** that preset the input fields and control which parts of the interface are shown. This makes it easy to share a specific configuration, deep-link into the tool with predefined settings or embed it in **kiosk/embed mode**.

## Available parameters

### Input presets

| Parameter   | Description                                       |
| ----------- | ------------------------------------------------- |
| `patientId` | Sets the patient's ID.                            |
| `age`       | Sets the patient's age (years).                   |
| `height`    | Sets the patient's height in meters.              |
| `tlv`       | Sets the Total Liver Volume (TLV) in milliliters. |

> When `patientId`, `age`, and `tlv` are all present, the tool auto-calculates and plots the point on load.

### Display toggles

Each accepts `true` or `false`.

| Parameter           | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `acknowledgeBanner` | Presets the disclaimer-banner acknowledgement state. |
| `showFooter`        | Controls the visibility of the footer.               |
| `showCitation`      | Toggles the display of citation information.         |
| `showDocumentation` | Determines whether the documentation link is shown.  |
| `showControls`      | Enables or disables the user-input controls.         |

## Usage examples

**Set ID and age** — presets the patient's ID to `12345` and age to `50`:

```
https://halbritter-lab.github.io/ChIC/?patientId=12345&age=50
```

**Set all inputs and acknowledge the banner** — ID `12345`, age `50`, TLV `15000` ml:

```
https://halbritter-lab.github.io/ChIC/?patientId=12345&age=50&tlv=15000&acknowledgeBanner=true
```

**Embed / kiosk mode** — hide the footer and controls, but keep the citation and documentation link:

```
https://halbritter-lab.github.io/ChIC/?showFooter=false&showCitation=true&showDocumentation=true&showControls=false
```
