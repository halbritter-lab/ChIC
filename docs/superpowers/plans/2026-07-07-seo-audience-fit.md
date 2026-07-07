# ChIC Findability & Audience-Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ChIC web app findable by, and legible to, the readership of the ChIC manuscript by adding static SEO metadata, social/academic previews, structured data, an OG image, audience-fit crawlable content, and sitemap/robots plumbing — with no new dependencies and no change to the calculator.

**Architecture:** All SEO metadata and a crawlable content shell become **static in `index.html`** (Vite preserves them through the build and rewrites `%BASE_URL%`). The Vue app mounts over the shell (progressive enhancement, not cloaking). The redundant client-side meta injection is removed from `App.vue`. The OG image is generated once from ChIC-only assets with system tools and committed as a static PNG.

**Tech Stack:** Vue 3 + Vite 6 (client-rendered, GitHub Pages), plain HTML/JSON-LD, `rsvg-convert` + ImageMagick for the one-time OG image. No new runtime or build dependencies.

**Spec:** `docs/superpowers/specs/2026-07-07-seo-audience-fit-design.md` (reviewed by Codex high — "ship-with-fixes", all folded in).

## Global Constraints

- **Canonical URL (single source of absolute URLs):** `https://halbritter-lab.github.io/ChIC/` — used verbatim in canonical, `og:url`, `og:image`, `twitter:image`, `DC.identifier`, and every JSON-LD `url`/`@id`.
- **No new dependencies** (runtime or build). OG image uses already-installed system tools.
- **No `citation_*` Google Scholar tags anywhere** — paper linkage is via Dublin Core + JSON-LD `isBasedOn` + the visible "How to cite" block only.
- **DFG / Heisenberg-Programm marks must NOT appear in the OG image** — ChIC lab assets only (prior written DFG consent is required for the DFG mark; the OG card must not create a new surface carrying it).
- **`FAQPage` is semantic-only** — Google retired FAQ rich results in 2026; do not claim a rich result.
- **Do not touch** `formulasConfig.js`, `config.js`, `ChartDisplay.vue`, `useDataPersistence.js`, router, mixins, `vite.config.js`, or any calculator/model logic.
- **600-LOC cap** stays satisfied; `App.vue` only shrinks.
- **Audience vocabulary** (use exactly): polycystic liver disease (PLD), ADPLD, ADPKD, height-adjusted total liver volume (htTLV), total liver volume (TLV), liver events, risk prediction/stratification, classes A–E, liver growth rate (LGR), genes PKD1/PKD2/GANAB/PRKCSH/SEC63.
- **Verification is by evidence** (build + `grep`/`identify` on `dist/`), not a test framework — none exists for HTML.
- Branch: `seo-audience-fit`. A concurrent session is active in this repo — **re-confirm `git branch --show-current` == `seo-audience-fit` before each commit.**

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `scripts/og-image.svg` | Human-editable 1200×630 source for the social card (ChIC logo + title). Kept for regeneration. |
| `public/og-image.png` | Committed 1200×630 social image (< 150 KB), referenced by OG/Twitter tags. |
| `index.html` | Static `<head>` SEO metadata, JSON-LD `@graph`, and the crawlable pre-mount shell + `<noscript>`. |
| `public/robots.txt` | Allow-all + `Sitemap:` reference. |
| `public/sitemap.xml` | One URL with `lastmod`/`changefreq`/`priority`. |
| `src/App.vue` | Remove the now-redundant client-side `updateMetaTag` helper + calls. |
| `docs/RECOMMENDATIONS.md`, `README.md` | Point the roadmap at this work; note SEO is wired (DOI/PMID still TBD). |

---

### Task 1: Generate the Open Graph social image

**Files:**
- Create: `scripts/og-image.svg`
- Create: `public/og-image.png` (generated, committed)

**Interfaces:**
- Produces: `public/og-image.png` — a 1200×630 PNG at the canonical path `…/ChIC/og-image.png`, referenced by Task 2's `og:image`/`twitter:image` and Task 3's JSON-LD `image`/`primaryImageOfPage`.

- [ ] **Step 1: Write the SVG source** — `scripts/og-image.svg`. ChIC assets only; no DFG/Heisenberg marks.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="16" height="630" fill="#00bf7d"/>
  <rect x="0" y="606" width="1200" height="24" fill="#00bf7d"/>
  <image xlink:href="../public/ChICLogo_JustLiver_2026-07-02.png"
         x="770" y="115" width="380" height="380" preserveAspectRatio="xMidYMid meet"/>
  <text x="72" y="240" font-family="'DejaVu Sans','Liberation Sans',sans-serif"
        font-size="58" font-weight="700" fill="#1a1a1a">Charit&#233; Imaging</text>
  <text x="72" y="308" font-family="'DejaVu Sans','Liberation Sans',sans-serif"
        font-size="58" font-weight="700" fill="#1a1a1a">Classification (ChIC)</text>
  <text x="72" y="376" font-family="'DejaVu Sans','Liberation Sans',sans-serif"
        font-size="32" fill="#333333">Polycystic liver disease progression &#183; classes A&#8211;E</text>
  <text x="72" y="430" font-family="'DejaVu Sans','Liberation Sans',sans-serif"
        font-size="28" fill="#0a7f66">Free risk-stratification tool &#183; htTLV &#215; age</text>
  <text x="72" y="560" font-family="'DejaVu Sans','Liberation Sans',sans-serif"
        font-size="26" fill="#666666">halbritter-lab.github.io/ChIC</text>
</svg>
```

- [ ] **Step 2: Rasterize to a temp PNG**

Run:
```bash
rsvg-convert -w 1200 -h 630 scripts/og-image.svg -o /tmp/og-raw.png
```
Expected: no output, exit 0; `/tmp/og-raw.png` created.

- [ ] **Step 3: Flatten, strip metadata, and write the committed PNG**

Run:
```bash
magick /tmp/og-raw.png -background white -flatten -strip public/og-image.png
identify -format "%wx%h %B bytes\n" public/og-image.png
```
Expected: `1200x630 <N> bytes`.

- [ ] **Step 4: Enforce the < 150 KB budget (only if needed)**

If `<N>` from Step 3 is ≥ 150000, reduce the palette and rewrite:
```bash
magick /tmp/og-raw.png -background white -flatten -strip -colors 128 PNG8:public/og-image.png
identify -format "%wx%h %B bytes\n" public/og-image.png
```
Expected: `1200x630 <N>` with `<N> < 150000`. (If still over, drop `-colors` to 64.)

- [ ] **Step 5: Visual sanity check**

Open `public/og-image.png` and confirm: ChIC liver logo visible top-right, title + subline legible, green accent bars, **no DFG/Heisenberg logo present**. (If the logo failed to embed, the right side will be blank — re-check the relative path in the SVG.)

- [ ] **Step 6: Commit**

```bash
git add scripts/og-image.svg public/og-image.png
git commit -m "feat(seo): add 1200x630 Open Graph social image (ChIC assets only)"
```

---

### Task 2: Static `<head>` SEO metadata

**Files:**
- Modify: `index.html` — delete the existing `<title>` (line ~52); insert the SEO block just before `</head>`.

**Interfaces:**
- Consumes: `public/og-image.png` (Task 1) via absolute URL.
- Produces: static description/canonical/OG/Twitter/DC tags in `dist/index.html` for scrapers.

- [ ] **Step 1: Remove the old `<title>`**

In `index.html`, delete the single line:
```html
<title>Charité Imaging Classification</title>
```
(There must be exactly one `<title>` after this task — Task 2 re-adds it in the block below.)

- [ ] **Step 2: Insert the SEO block immediately before `</head>`**

```html
    <!-- ==================== SEO CONFIG — single source of absolute URLs ====================
         Canonical origin is hardcoded. If the app ever moves to a custom domain, change every
         https://halbritter-lab.github.io/ChIC/ occurrence in this block AND in the JSON-LD below. -->
    <title>ChIC — Charité Imaging Classification for Polycystic Liver Disease (PLD)</title>
    <meta name="description" content="Free interactive tool that classifies polycystic liver disease (PLD) progression from height-adjusted total liver volume (htTLV) and age to predict liver-event risk in ADPKD and ADPLD." />
    <meta name="keywords" content="polycystic liver disease, PLD, ADPLD, ADPKD, height-adjusted total liver volume, htTLV, total liver volume, liver events, risk prediction, volume classification, Charité Imaging Classification, ChIC, PKD1, PKD2, GANAB, PRKCSH, SEC63" />
    <meta name="author" content="Carolin Beatrice Brigl, Bernt Popp, Jan Halbritter" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#00bf7d" />
    <link rel="canonical" href="https://halbritter-lab.github.io/ChIC/" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Charité Imaging Classification (ChIC)" />
    <meta property="og:title" content="ChIC — Charité Imaging Classification for Polycystic Liver Disease" />
    <meta property="og:description" content="Classify PLD progression from height-adjusted total liver volume (htTLV) and age to predict liver-event risk in ADPKD and ADPLD. Free, research-based." />
    <meta property="og:url" content="https://halbritter-lab.github.io/ChIC/" />
    <meta property="og:image" content="https://halbritter-lab.github.io/ChIC/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Charité Imaging Classification (ChIC) — polycystic liver disease progression by class A–E" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="ChIC — Charité Imaging Classification for Polycystic Liver Disease" />
    <meta name="twitter:description" content="Classify PLD progression from htTLV and age to predict liver-event risk in ADPKD and ADPLD. Free, research-based." />
    <meta name="twitter:image" content="https://halbritter-lab.github.io/ChIC/og-image.png" />
    <meta name="twitter:image:alt" content="ChIC — polycystic liver disease progression classes A–E" />

    <!-- Dublin Core (academic indexers) -->
    <meta name="DC.title" content="Charité Imaging Classification (ChIC) for Polycystic Liver Disease" />
    <meta name="DC.creator" content="Brigl, Carolin Beatrice" />
    <meta name="DC.creator" content="Popp, Bernt" />
    <meta name="DC.creator" content="Halbritter, Jan" />
    <meta name="DC.subject" content="Polycystic Liver Disease; ADPLD; ADPKD; height-adjusted total liver volume; risk stratification" />
    <meta name="DC.description" content="Interactive classification of polycystic liver disease progression using height-adjusted total liver volume and age to predict liver-event risk." />
    <meta name="DC.publisher" content="Charité – Universitätsmedizin Berlin" />
    <meta name="DC.type" content="InteractiveResource" />
    <meta name="DC.format" content="text/html" />
    <meta name="DC.identifier" content="https://halbritter-lab.github.io/ChIC/" />
    <meta name="DC.language" content="en" />
    <meta name="DC.rights" content="MIT License" />

    <!-- NOTE: Google Scholar citation_* tags are intentionally NOT emitted. This is a software
         tool page, not an article/abstract page; emitting them risks Scholar misattributing the
         tool as the paper. Paper linkage lives in the JSON-LD (isBasedOn) and the visible
         "How to cite" block in the body. -->
    <!-- ==================== /SEO CONFIG ==================== -->
```

- [ ] **Step 3: Build and verify the tags survive into `dist/`**

Run:
```bash
npm run build
grep -c 'og:image\|twitter:card\|rel="canonical"\|DC.creator\|height-adjusted total liver volume' dist/index.html
grep -o '<title>[^<]*</title>' dist/index.html
```
Expected: the count is ≥ 5; exactly one `<title>` line prints, containing "ChIC — Charité Imaging Classification for Polycystic Liver Disease (PLD)".

- [ ] **Step 4: Confirm no duplicate `<title>` and no `citation_` tags**

Run:
```bash
grep -c '<title>' dist/index.html; grep -c 'citation_' dist/index.html
```
Expected: `1` then `0`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(seo): static head metadata (OG, Twitter, Dublin Core, canonical)"
```

---

### Task 3: JSON-LD structured data

**Files:**
- Modify: `index.html` — add one `<script type="application/ld+json">` before `</head>` (after the SEO block).

**Interfaces:**
- Consumes: canonical URL, `public/og-image.png`.
- Produces: a validated schema.org `@graph` describing the tool, page, condition, FAQ, and the paper chain.

- [ ] **Step 1: Insert the JSON-LD script before `</head>`**

```html
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebApplication",
          "@id": "https://halbritter-lab.github.io/ChIC/#webapp",
          "name": "Charité Imaging Classification (ChIC)",
          "alternateName": "ChIC",
          "url": "https://halbritter-lab.github.io/ChIC/",
          "description": "Free interactive tool that classifies polycystic liver disease (PLD) progression from height-adjusted total liver volume (htTLV) and age to predict liver-event risk in ADPKD and ADPLD.",
          "applicationCategory": "HealthApplication",
          "operatingSystem": "Any (web browser)",
          "browserRequirements": "Requires JavaScript.",
          "isAccessibleForFree": true,
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "inLanguage": "en",
          "softwareVersion": "0.2.1",
          "image": "https://halbritter-lab.github.io/ChIC/og-image.png",
          "license": "https://opensource.org/licenses/MIT",
          "codeRepository": "https://github.com/halbritter-lab/ChIC",
          "sameAs": "https://github.com/halbritter-lab/ChIC",
          "about": { "@id": "https://halbritter-lab.github.io/ChIC/#pld" },
          "audience": { "@type": "MedicalAudience", "audienceType": ["Clinician", "Medical researcher"] },
          "author": [
            { "@type": "Person", "name": "Carolin Beatrice Brigl" },
            { "@type": "Person", "name": "Bernt Popp" },
            { "@type": "Person", "name": "Jan Halbritter" }
          ],
          "publisher": { "@type": "Organization", "name": "Charité – Universitätsmedizin Berlin", "url": "https://www.charite.de/" },
          "isBasedOn": { "@id": "https://halbritter-lab.github.io/ChIC/#paper" },
          "citation": [
            { "@id": "https://halbritter-lab.github.io/ChIC/#sierks2022" },
            { "@id": "https://halbritter-lab.github.io/ChIC/#schonauer2024" }
          ]
        },
        {
          "@type": "MedicalWebPage",
          "@id": "https://halbritter-lab.github.io/ChIC/#page",
          "url": "https://halbritter-lab.github.io/ChIC/",
          "name": "Charité Imaging Classification (ChIC) for Polycystic Liver Disease",
          "description": "Interactive classification of polycystic liver disease progression using height-adjusted total liver volume and age to predict liver-event risk in ADPKD and ADPLD.",
          "inLanguage": "en",
          "about": { "@id": "https://halbritter-lab.github.io/ChIC/#pld" },
          "medicalAudience": [
            { "@id": "https://schema.org/Clinician" },
            { "@id": "https://schema.org/MedicalResearcher" }
          ],
          "primaryImageOfPage": "https://halbritter-lab.github.io/ChIC/og-image.png",
          "lastReviewed": "2026-07-07",
          "dateModified": "2026-07-07",
          "mainEntity": { "@id": "https://halbritter-lab.github.io/ChIC/#webapp" }
        },
        {
          "@type": "MedicalCondition",
          "@id": "https://halbritter-lab.github.io/ChIC/#pld",
          "name": "Polycystic Liver Disease",
          "alternateName": ["PLD", "Autosomal Dominant Polycystic Liver Disease (ADPLD)"],
          "associatedAnatomy": { "@type": "AnatomicalStructure", "name": "Liver" }
        },
        {
          "@type": "FAQPage",
          "@id": "https://halbritter-lab.github.io/ChIC/#faq",
          "mainEntity": [
            { "@type": "Question", "name": "What is height-adjusted total liver volume (htTLV)?",
              "acceptedAnswer": { "@type": "Answer", "text": "htTLV is total liver volume (in millilitres, from MRI or CT) divided by the patient's height in metres. ChIC uses htTLV together with age to place a patient in a progression class." } },
            { "@type": "Question", "name": "What do the ChIC classes A–E mean?",
              "acceptedAnswer": { "@type": "Answer", "text": "ChIC assigns one of five classes, A (mild) to E (severe), from a patient's age and htTLV, corresponding to compound annual liver-growth-rate bands of under 1%, 1–2%, 2–3%, 3–4%, and 4% or more per year. Higher classes carry a higher risk of future liver events." } },
            { "@type": "Question", "name": "Is ChIC a diagnostic device?",
              "acceptedAnswer": { "@type": "Answer", "text": "No. ChIC is an informational and educational research tool for risk stratification, not a diagnostic device. It does not replace clinical judgement." } },
            { "@type": "Question", "name": "How does ChIC differ from the Mayo Imaging Classification?",
              "acceptedAnswer": { "@type": "Answer", "text": "The Mayo Imaging Classification stratifies kidney disease in ADPKD using height-adjusted total kidney volume. ChIC applies an analogous compound-exponential-growth model to the liver, using height-adjusted total liver volume to predict liver events in PLD." } },
            { "@type": "Question", "name": "Which genes cause polycystic liver disease?",
              "acceptedAnswer": { "@type": "Answer", "text": "PLD is most often associated with variants in PKD1, PKD2 and GANAB (in ADPKD) and PRKCSH and SEC63 (in ADPLD)." } },
            { "@type": "Question", "name": "How do I cite ChIC?",
              "acceptedAnswer": { "@type": "Answer", "text": "Cite the ChIC manuscript (Brigl et al., JHEP Reports, 2026) together with the originating studies Sierks et al., JHEP Reports 2022 (PMID 36246085) and Schönauer et al., Gastroenterology 2024 (PMID 38101549)." } }
          ]
        },
        {
          "@type": "ScholarlyArticle",
          "@id": "https://halbritter-lab.github.io/ChIC/#paper",
          "headline": "The Charité Imaging Classification (ChIC): Improving Individual Risk Prediction in Polycystic Liver Disease",
          "author": [
            { "@type": "Person", "name": "Carolin Beatrice Brigl" },
            { "@type": "Person", "name": "Dana Sierks" },
            { "@type": "Person", "name": "Reneé Duijzer" },
            { "@type": "Person", "name": "Adriana Gregory" },
            { "@type": "Person", "name": "Bernt Popp" },
            { "@type": "Person", "name": "Thula Cannon Walter-Rittel" },
            { "@type": "Person", "name": "Robin Schmidt" },
            { "@type": "Person", "name": "Cassie Howe" },
            { "@type": "Person", "name": "Hana Yang" },
            { "@type": "Person", "name": "Conrad Cruz" },
            { "@type": "Person", "name": "Kai-Uwe Eckardt" },
            { "@type": "Person", "name": "Timothy Kline" },
            { "@type": "Person", "name": "Ria Anne-Rose Schönauer" },
            { "@type": "Person", "name": "Peter Harris" },
            { "@type": "Person", "name": "Joost Drenth" },
            { "@type": "Person", "name": "Marie Hogan" },
            { "@type": "Person", "name": "Jan Halbritter" }
          ],
          "isPartOf": { "@type": "Periodical", "name": "JHEP Reports" },
          "datePublished": "2026",
          "creativeWorkStatus": "In press"
        },
        {
          "@type": "ScholarlyArticle",
          "@id": "https://halbritter-lab.github.io/ChIC/#sierks2022",
          "headline": "Modelling polycystic liver disease progression using age-adjusted liver volumes and targeted mutational analysis",
          "author": [
            { "@type": "Person", "name": "Dana Sierks" },
            { "@type": "Person", "name": "Ria Anne-Rose Schönauer" },
            { "@type": "Person", "name": "Jan Halbritter" }
          ],
          "isPartOf": { "@type": "Periodical", "name": "JHEP Reports" },
          "datePublished": "2022",
          "sameAs": "https://pubmed.ncbi.nlm.nih.gov/36246085/"
        },
        {
          "@type": "ScholarlyArticle",
          "@id": "https://halbritter-lab.github.io/ChIC/#schonauer2024",
          "headline": "Sex, Genotype, and Liver Volume Progression as Risk of Hospitalization Determinants in Autosomal Dominant Polycystic Liver Disease",
          "author": [
            { "@type": "Person", "name": "Ria Anne-Rose Schönauer" },
            { "@type": "Person", "name": "Dana Sierks" },
            { "@type": "Person", "name": "Jan Halbritter" }
          ],
          "isPartOf": { "@type": "Periodical", "name": "Gastroenterology" },
          "datePublished": "2024",
          "sameAs": "https://pubmed.ncbi.nlm.nih.gov/38101549/"
        }
      ]
    }
    </script>
```

- [ ] **Step 2: Build and validate the JSON parses**

Run:
```bash
npm run build
node -e "const h=require('fs').readFileSync('dist/index.html','utf8'); const m=h.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/); if(!m){console.error('NO JSON-LD IN DIST');process.exit(1)} const o=JSON.parse(m[1]); console.log('nodes:', o['@graph'].map(n=>n['@type']).join(', '));"
```
Expected: `nodes: WebApplication, MedicalWebPage, MedicalCondition, FAQPage, ScholarlyArticle, ScholarlyArticle, ScholarlyArticle` (JSON parsed without throwing — this catches trailing-comma/encoding errors).

- [ ] **Step 3: Manual schema.org validation (record result)**

Copy the JSON-LD from `dist/index.html` into <https://validator.schema.org/>. Expected: parses, all seven nodes recognized, **zero errors**. (Warnings about optional recommended properties are acceptable.) Note the outcome in the commit message if anything unexpected appears.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(seo): JSON-LD @graph (WebApplication, MedicalWebPage, FAQ, paper chain)"
```

---

### Task 4: Crawlable pre-mount content shell + `<noscript>`

**Files:**
- Modify: `index.html` — replace `<div id="app"></div>` with the shell; expand the existing `<noscript>`.

**Interfaces:**
- Consumes: `public/favicon.png` (already present) for the shell logo.
- Produces: static, human-readable prose (H1, glossary, FAQ, how-to-cite) visible to non-JS agents; Vue overwrites it on mount.

- [ ] **Step 1: Replace the empty `#app` div with the shell**

Replace this line in `index.html`:
```html
    <div id="app"></div>
```
with:
```html
    <div id="app">
      <!-- Static pre-mount / no-JS landing. Vue replaces this on mount (progressive
           enhancement — same subject matter as the app, not cloaking). Non-JS crawlers and
           link-preview scrapers index this content. The scoped <style> is removed with the shell. -->
      <style>
        .chic-seo-shell { max-width: 820px; margin: 0 auto; padding: 40px 24px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; line-height: 1.55; }
        .chic-seo-shell img { width: 96px; height: auto; display: block; margin: 0 auto 16px; }
        .chic-seo-shell h1 { font-size: 1.6rem; text-align: center; margin: 0 0 8px; }
        .chic-seo-shell .chic-disclaimer { text-align: center; font-weight: 600; color: #0a7f66; margin: 0 0 24px; }
        .chic-seo-shell h2 { font-size: 1.15rem; margin: 28px 0 8px; }
        .chic-seo-shell dt { font-weight: 600; margin-top: 10px; }
        .chic-seo-shell dd { margin: 0 0 4px 0; }
        .chic-seo-shell details { margin: 8px 0; }
        .chic-seo-shell summary { font-weight: 600; cursor: pointer; }
        .chic-seo-shell a { color: #0a7f66; }
        .chic-seo-shell .chic-loading { text-align: center; color: #666; margin-top: 28px; font-size: 0.9rem; }
      </style>
      <div class="chic-seo-shell">
        <img src="./favicon.png" alt="Charité Imaging Classification logo" width="96" />
        <h1>Charité Imaging Classification (ChIC) for Polycystic Liver Disease</h1>
        <p class="chic-disclaimer">Informational and educational; not a diagnostic device.</p>

        <p>ChIC is a free, research-based tool that classifies <strong>polycystic liver disease (PLD)</strong>
        progression by age and <strong>height-adjusted total liver volume (htTLV)</strong> into five classes,
        A (mild) to E (severe), to help clinicians and researchers estimate the risk of future
        <strong>liver events</strong> in <strong>ADPKD</strong> and <strong>ADPLD</strong>.</p>

        <h2>How the classes work</h2>
        <p>htTLV = total liver volume (ml) ÷ height (m). Patients are placed in classes A–E by compound
        annual liver-growth-rate bands (&lt;1%, 1–2%, 2–3%, 3–4%, ≥4% per year); higher classes carry a
        higher risk of liver events. ChIC was developed and validated in 585 patients from three
        international referral centres (Charité Berlin, Radboud UMC, Mayo Clinic) and two previous cohorts.</p>

        <h2>Key terms</h2>
        <dl>
          <dt>PLD</dt><dd>Polycystic liver disease — fluid-filled cysts replacing liver tissue.</dd>
          <dt>ADPLD</dt><dd>Autosomal dominant polycystic liver disease (isolated liver involvement).</dd>
          <dt>ADPKD</dt><dd>Autosomal dominant polycystic kidney disease, which often includes PLD.</dd>
          <dt>htTLV</dt><dd>Height-adjusted total liver volume (ml/m).</dd>
          <dt>TLV</dt><dd>Total liver volume (ml), measured from MRI or CT.</dd>
          <dt>Liver events</dt><dd>Cyst complications, procedures, or medication for PLD (e.g. hemorrhage, infection, aspiration sclerotherapy, resection, transplantation).</dd>
          <dt>LGR</dt><dd>Liver growth rate (percent per year).</dd>
        </dl>

        <h2>Frequently asked questions</h2>
        <details><summary>What is height-adjusted total liver volume (htTLV)?</summary>
          <p>htTLV is total liver volume (ml, from MRI or CT) divided by the patient's height in metres. ChIC uses htTLV with age to assign a progression class.</p></details>
        <details><summary>What do the ChIC classes A–E mean?</summary>
          <p>Five classes from A (mild) to E (severe), set by age and htTLV and mapping to annual liver-growth-rate bands of &lt;1%, 1–2%, 2–3%, 3–4%, and ≥4%. Higher classes carry higher liver-event risk.</p></details>
        <details><summary>Is ChIC a diagnostic device?</summary>
          <p>No. ChIC is an informational and educational research tool for risk stratification, not a diagnostic device, and does not replace clinical judgement.</p></details>
        <details><summary>How does ChIC differ from the Mayo Imaging Classification?</summary>
          <p>The Mayo Imaging Classification stratifies kidney disease in ADPKD using height-adjusted total kidney volume. ChIC applies an analogous compound-exponential-growth model to the liver using htTLV.</p></details>
        <details><summary>Which genes cause polycystic liver disease?</summary>
          <p>PLD is most often associated with variants in <em>PKD1</em>, <em>PKD2</em> and <em>GANAB</em> (ADPKD) and <em>PRKCSH</em> and <em>SEC63</em> (ADPLD).</p></details>

        <h2>How to cite</h2>
        <p>Cite the ChIC manuscript (Brigl et al., <em>JHEP Reports</em>, 2026) together with the originating
        studies: Sierks et al., <em>JHEP Reports</em> 2022
        (<a href="https://pubmed.ncbi.nlm.nih.gov/36246085/">PMID 36246085</a>) and Schönauer et al.,
        <em>Gastroenterology</em> 2024 (<a href="https://pubmed.ncbi.nlm.nih.gov/38101549/">PMID 38101549</a>).</p>

        <p><a href="https://github.com/halbritter-lab/ChIC">Source code on GitHub</a></p>

        <p class="chic-loading">Loading the interactive ChIC tool…</p>
      </div>
    </div>
```

- [ ] **Step 2: Expand the existing `<noscript>`**

Replace the existing `<noscript>…</noscript>` block (the "doesn't work properly without JavaScript" message) with:
```html
    <noscript>
      <div style="max-width:820px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;">
        <p><strong>The interactive ChIC tool requires JavaScript.</strong> Please enable it to enter patient data and see the classification chart.</p>
        <p>ChIC classifies polycystic liver disease (PLD) progression from height-adjusted total liver volume (htTLV) and age. <strong>Informational and educational; not a diagnostic device.</strong></p>
        <p>Read the paper: Sierks et al., <em>JHEP Reports</em> 2022 (<a href="https://pubmed.ncbi.nlm.nih.gov/36246085/">PMID 36246085</a>) and Schönauer et al., <em>Gastroenterology</em> 2024 (<a href="https://pubmed.ncbi.nlm.nih.gov/38101549/">PMID 38101549</a>). <a href="https://github.com/halbritter-lab/ChIC">Source code</a>.</p>
      </div>
    </noscript>
```

- [ ] **Step 3: Build and verify the shell reaches `dist/`**

Run:
```bash
npm run build
grep -c 'chic-seo-shell\|How to cite\|Which genes cause polycystic liver disease' dist/index.html
```
Expected: count ≥ 2 (the prose is in the built HTML).

- [ ] **Step 4: Verify the app still mounts over the shell (no leftover shell after mount)**

Run `npm run preview` (serves `dist/` on port 8138) and open it, or `npm run dev` (port 8137). Confirm:
- The static shell shows for a beat, then the ChIC app (disclaimer modal / calculator) renders in its place.
- After mount, the "Loading the interactive ChIC tool…" text and the glossary are **gone** (Vue replaced `#app`).
- The disclaimer gate, manual entry (age/height/TLV → class A–E, htTLV, LGR), and `?patientId=…&age=…&tlv=…&acknowledgeBanner=true` embed mode all behave exactly as before.

Expected: app behaves identically to `main`; no persistent duplicate content.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(seo): crawlable pre-mount content shell + richer noscript"
```

---

### Task 5: robots.txt + sitemap.xml

**Files:**
- Modify: `public/robots.txt`
- Modify: `public/sitemap.xml`

**Interfaces:**
- Produces: a sitemap reference for crawlers and GSC submission.

- [ ] **Step 1: Rewrite `public/robots.txt`**

```text
User-agent: *
Allow: /

Sitemap: https://halbritter-lab.github.io/ChIC/sitemap.xml
```

- [ ] **Step 2: Rewrite `public/sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://halbritter-lab.github.io/ChIC/</loc>
    <lastmod>2026-07-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 3: Build and verify both copy into `dist/`**

Run:
```bash
npm run build
grep -q 'Sitemap: https://halbritter-lab.github.io/ChIC/sitemap.xml' dist/robots.txt && echo robots-ok
node -e "require('fs').readFileSync('dist/sitemap.xml','utf8').includes('<lastmod>2026-07-07</lastmod>') && console.log('sitemap-ok')"
```
Expected: `robots-ok` and `sitemap-ok`.

- [ ] **Step 4: Commit**

```bash
git add public/robots.txt public/sitemap.xml
git commit -m "feat(seo): reference sitemap from robots; add lastmod/changefreq/priority"
```

---

### Task 6: Remove client-side meta injection from `App.vue`

**Files:**
- Modify: `src/App.vue` — delete the `updateMetaTag` helper (~`:422–433`) and the `document.title` + four `updateMetaTag(...)` calls in `onMounted` (~`:502–512`).

**Interfaces:**
- Consumes: nothing new. Static tags from Tasks 2–3 now own all metadata.
- Produces: a smaller `onMounted` with identical user-visible behaviour.

- [ ] **Step 1: Confirm `updateMetaTag` has no other callers**

Run:
```bash
grep -rn "updateMetaTag" src/
```
Expected: only the definition (~`:423`) and the four calls in `onMounted` (~`:503–512`) — all inside `App.vue`. If any other file references it, STOP and reassess.

- [ ] **Step 2: Delete the `updateMetaTag` helper**

Remove this block from `App.vue` (the helper and its comment, ~lines 422–433):
```javascript
    // Helper function to update or create meta tags
    function updateMetaTag(name, content) {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (tag) {
        tag.setAttribute('content', content);
      } else {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        tag.setAttribute('content', content);
        document.head.appendChild(tag);
      }
    }
```

- [ ] **Step 3: Delete the title + meta calls in `onMounted`**

Remove these lines from `onMounted` (~502–512), leaving the surrounding theme/query/modal-CSS lines intact:
```javascript
      document.title = 'Charité Imaging Classification';
      updateMetaTag(
        'description',
        'Charité Imaging Classification is a Vue.js web application, based on extensive research, offering insights into Polycystic Liver Disease (PLD) progression. Developed by Bernt Popp, Ria Schönauer, Dana Sierks, and Jan Halbritter, this tool facilitates understanding of PLD for both educational and research purposes.'
      );
      updateMetaTag(
        'keywords',
        'PLD, Polycystic Liver Disease, Liver Health, Medical Research, Data Visualization, Vue.js, Web Application, Liver Disease Progression, Medical Education, Healthcare Technology'
      );
      updateMetaTag('author', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
      updateMetaTag('creator', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
```

- [ ] **Step 4: Verify no dangling reference, lint, and build**

Run:
```bash
grep -c "updateMetaTag" src/App.vue
npx eslint src/App.vue
npm run build
```
Expected: `0` (no remaining reference); eslint clean (no errors); build succeeds.

- [ ] **Step 5: Verify the static title/description win at runtime**

Run `npm run dev` (port 8137), open the app, and check `document.title` in DevTools console and the `<meta name="description">` content in Elements. Expected: title is "ChIC — Charité Imaging Classification for Polycystic Liver Disease (PLD)" (from static HTML, not overwritten), and there is exactly one `meta[name="description"]` with the audience-fit copy.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue
git commit -m "refactor(seo): drop client-side meta injection; static head owns metadata"
```

---

### Task 7: Point the roadmap and README at the SEO work

**Files:**
- Modify: `docs/RECOMMENDATIONS.md` — add a discoverability row.
- Modify: `README.md` — one line noting SEO is wired; DOI/PMID still TBD.

**Interfaces:**
- Produces: documentation so the roadmap stays the source of truth (AGENTS.md rule).

- [ ] **Step 1: Add a Tier-2 SEO row to `docs/RECOMMENDATIONS.md`**

Under the "## Tier 2 — Cleanup & hygiene" table, add a final row:
```markdown
| 2.7 | **Discoverability / SEO for the paper's audience.** Static head metadata was client-side only (invisible to scrapers); no OG/Twitter/JSON-LD/sitemap wiring. | `index.html`, `App.vue:503`, `public/sitemap.xml`, `public/robots.txt` | Implemented per `docs/superpowers/specs/2026-07-07-seo-audience-fit-design.md`: static head meta, OG/Twitter, JSON-LD, crawlable shell, sitemap/robots. DOI/PMID activation tracked in that spec's publication checklist. | **M** |
```

- [ ] **Step 2: Add an SEO note to `README.md`**

Immediately after the "Please explore the [Charité Imaging Classification](...) app" line, add:
```markdown
> The app ships static SEO metadata, Open Graph/Twitter cards, and schema.org structured data for discoverability by the PLD clinical/research audience. Academic linkage and the DOI/PMID are finalized at publication — see `docs/superpowers/specs/2026-07-07-seo-audience-fit-design.md`.
```

- [ ] **Step 3: Verify markdown is intact**

Run:
```bash
grep -c "2026-07-07-seo-audience-fit-design.md" docs/RECOMMENDATIONS.md README.md
```
Expected: `2` (one hit in each file — `grep -c` prints a per-file count; confirm each shows `1`).

- [ ] **Step 4: Commit**

```bash
git add docs/RECOMMENDATIONS.md README.md
git commit -m "docs(seo): record discoverability work in roadmap and README"
```

---

## Final verification (after all tasks)

- [ ] **Full build is clean**

```bash
npm run build
```
Expected: succeeds; no new warnings beyond the pre-existing baseline.

- [ ] **Raw-HTML / no-JS scraper view has everything**

```bash
grep -o '<title>[^<]*</title>' dist/index.html
grep -c 'og:image\|twitter:card\|application/ld+json\|rel="canonical"\|chic-seo-shell' dist/index.html
```
Expected: one audience-fit title; count ≥ 5.

- [ ] **OG image is correct**

```bash
identify -format "%wx%h %B bytes\n" dist/og-image.png
```
Expected: `1200x630 <bytes>` with bytes < 150000.

- [ ] **Lint clean on the only touched source file**

```bash
npx eslint src/App.vue
```
Expected: no errors.

- [ ] **App behaviour unchanged** — disclaimer gate, calculator (class A–E / htTLV / LGR), import/export, embed mode, PWA registration all work in `npm run preview`.

- [ ] **Social preview spot-check** — paste `https://halbritter-lab.github.io/ChIC/` (after deploy) or the built HTML into a validator (opengraph.xyz / platform debugger); confirm title, description, and 1200×630 image render.

---

## Self-Review (completed by planner)

**Spec coverage:** §4.1 head meta → Task 2; §4.2 JSON-LD → Task 3; §4.3 OG image → Task 1; §4.4 shell + noscript → Task 4; §4.5 robots/sitemap → Task 5; §4.6 remove client meta → Task 6; §5 optional docs → Task 7; §6 verification → per-task + final block. All Decisions D-1…D-8 honored (canonical single-source, static tags, shell-in-#app, DFG-excluded OG, no citation_*, no-deps generation, absolute URLs hardcoded, "from age 15" wording not asserted numerically in shell).

**Placeholder scan:** No "TBD/TODO/handle appropriately" in executable steps. DOI/PMID are deliberately absent from the `#paper` node (per D-5) and tracked in the spec's publication checklist — not a plan placeholder.

**Type/string consistency:** Canonical URL string, `og-image.png` path, `#webapp/#page/#pld/#faq/#paper/#sierks2022/#schonauer2024` IDs, and the class-band wording (`<1, 1–2, 2–3, 3–4, ≥4 %/yr`) are identical across Tasks 2, 3, and 4. `updateMetaTag` name matches the code being deleted in Task 6.
