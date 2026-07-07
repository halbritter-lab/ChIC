# ChIC Findability & Audience-Fit — Design Spec

- **Date:** 2026-07-07
- **Status:** Draft for review (Codex high + author)
- **Author:** Bernt Popp (with Claude Code)
- **Scope:** Make the ChIC web app findable by, and legible to, the readership of the ChIC manuscript (JHEP Reports Short Communication). SEO metadata, social/academic previews, structured data, and audience-fit crawlable content. **No new runtime dependencies. No change to the clinical model, calculator logic, or App.vue state.**

---

## 1. Context & Goals

ChIC is a Vue 3 + Vite SPA (client-rendered, GitHub Pages) implementing the **Charité Imaging Classification** for Polycystic Liver Disease (PLD) progression. It is the interactive companion to the manuscript _"The Charité Imaging Classification (ChIC): Improving Individual Risk Prediction in Polycystic Liver Disease"_ — whose Methods section carries a literal placeholder, "the application (`link_to_be_inserted_when_the_app_is_hosted_publicly`) … are freely available." **The paper is the #1 discovery channel; guideline citations (KDIGO 2025, ERN RARE-Liver 2026, which cite the predecessor Sierks et al.) and web search are secondary.**

**The problem (verified against the code):**

- `index.html` `<head>` is effectively empty — only `<title>` + favicons. No description, canonical, Open Graph, Twitter Card, or structured data in the static HTML.
- The only metadata is injected **client-side** in `App.vue` `onMounted` via `updateMetaTag` (`App.vue:422–433`, called `:503–512`). Social and academic scrapers (X/Twitter, LinkedIn, Slack, WhatsApp, **Google Scholar**, ResearchGate, ORCID) do **not** run JavaScript, so they see the empty shell → **blank preview cards, no academic linkage.**
- That injected copy is developer-centric ("a Vue.js web application"); its keywords omit the entire clinical vocabulary the audience actually searches.
- `robots.txt` does not reference the sitemap; `sitemap.xml` has one bare `<loc>`, no `<lastmod>`.
- A Google Search Console verification file already exists (`public/google3fdf6e14e925e463.html`) but the sitemap is not wired for submission.

**Success criteria:**

1. A shared link to the app renders a rich preview card (title, description, image) on X/Twitter, LinkedIn, Slack, WhatsApp, and iMessage — verified against the raw HTML, no JS.
2. The raw HTML (`curl`, no JS) contains an audience-accurate title, meta description, canonical URL, Open Graph + Twitter tags, JSON-LD, and human-readable prose using the manuscript vocabulary.
3. `sitemap.xml` is valid and referenced by `robots.txt`; ready to submit in the existing GSC property.
4. Structured data validates (Google Rich Results Test / schema.org validator) with no errors; the FAQ is rich-result eligible.
5. Academic linkage to the paper is wired and one edit away from activation once the DOI/PMID exist.
6. `npm run build` succeeds; `npx eslint` clean on touched files; app behaviour unchanged (calculator, disclaimer gate, query-param embed mode, PWA).

**Non-goals (YAGNI, locked):** no prerender/SSR build step; no new dependencies (runtime or build); no restructuring of the in-app calculator UI or App.vue state/logic beyond deleting the now-redundant client-side meta injection; no change to the validated statistical model, thresholds, or class semantics; no custom domain (canonical stays GitHub Pages).

---

## 2. Audience & Keyword Model (ground truth for all copy)

Extracted from `ChIC_3rdDraft_Clean_2026-07-06.docx` and `_Supplement_2026-07-06.docx`. **All titles, descriptions, keywords, and prose in this spec must draw from this vocabulary — not developer jargon.**

**Primary audience:** nephrologists and hepatologists managing ADPKD/ADPLD/PLD; radiologists performing liver volumetry; clinical trialists stratifying enrolment; PLD researchers.

**Canonical terms (use these exact words):** Polycystic Liver Disease (PLD); Autosomal Dominant Polycystic Liver Disease (ADPLD); Autosomal Dominant Polycystic Kidney Disease (ADPKD); height-adjusted total liver volume (htTLV); total liver volume (TLV); liver events; risk prediction / risk stratification; Charité Imaging Classification (ChIC); classes A–E; liver growth rate (LGR); genes _PKD1, PKD2, GANAB, PRKCSH, SEC63_; Mayo Imaging Classification (analog for context).

**Manuscript keyword line (verbatim):** Volume classification, polycystic disease, ADPLD, ADPKD, PLD, total liver volume, liver events, _PKD1, PKD2, GANAB, PRKCSH, SEC63_.

**Query intents to satisfy (representative, not literal keyword-stuffing):** "polycystic liver disease classification tool", "PLD risk prediction", "height-adjusted total liver volume calculator", "htTLV", "ADPLD progression", "liver volume classification ADPKD", "Charité Imaging Classification", "ChIC".

**Clinical facts for prose (verbatim-safe from the manuscript):**

- ChIC groups patients by **age and htTLV** into **five classes A (mild) – E (severe)**, with compound annual growth-rate cut-offs of `<1, ≥1–<2, ≥2–<3, ≥3–<4, ≥4 %/year`.
- Developed and validated with **585 patients** from **three international referral centres** (Charité Berlin, Radboud UMC, Mayo Clinic) plus **two previous cohorts** (GEnPoLD, INT-PLD).
- Higher classes carry higher risk of **liver events** (hazard ratios rising to ~18× for class E vs class A).
- It is **informational/educational, for research and clinical context — not a diagnostic device** (this framing is load-bearing; see `disclaimerMixin.js`).

**Provenance / citation chain:**

- **This paper:** _The Charité Imaging Classification (ChIC): Improving Individual Risk Prediction in Polycystic Liver Disease_ — Brigl CB, Sierks D, Duijzer R, … Halbritter J (corresponding). JHEP Reports, 2026. **DOI/PMID: TBD (fill at publication).**
- **Predecessor 1 (origin of the classification):** Sierks D, et al. _Modelling polycystic liver disease progression using age-adjusted liver volumes and targeted mutational analysis._ JHEP Rep. 2022;4(11):100579. **PMID 36246085**, DOI 10.1016/j.jhepr.2022.100579.
- **Predecessor 2 (ADPLD validation):** Schönauer R, et al. _Sex, Genotype, and Liver Volume Progression as Risk of Hospitalization Determinants in ADPLD._ Gastroenterology. 2024;166(5):902-14. **PMID 38101549**.

---

## 3. Decisions Log (locked)

| #    | Decision                                                                                                                                                                             | Rationale                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **Canonical URL = `https://halbritter-lab.github.io/ChIC/`** (hardcoded, absolute).                                                                                                 | User decision; matches the live deploy. Kept in one commented "SEO CONFIG" block so a future domain change is a single find/replace. |
| D-2  | **All SEO metadata is static in `index.html`**; the client-side `updateMetaTag` injection in `App.vue` is **removed**.                                                              | Scrapers don't run JS. Static tags cover every crawler; also trims the App.vue god file. Static + app describe the same subject → progressive enhancement, not cloaking. |
| D-3  | **Crawlable prose lives inside the `#app` mount node** (Vue replaces it on mount) **plus a `<noscript>` fallback**, styled as an intentional branded landing to avoid an ugly flash. | Non-JS crawlers/scrapers get full content; interactive users get the app. No cloaking (equivalent subject matter both ways).        |
| D-4  | **OG image is built only from ChIC lab logo assets. The DFG and Heisenberg-Programm marks are excluded.**                                                                           | Standing constraint: the DFG/Heisenberg logo needs prior written DFG consent before shipping. The OG card must not create a new surface that carries it. |
| D-5  | **Google Scholar Highwire `citation_*` tags are authored but commented out** until the DOI/PMID exist; Dublin Core + JSON-LD `isBasedOn` linkage ships now.                          | Live `citation_*` tags on a tool page risk Scholar indexing the tool as the article. DC + `isBasedOn` are safe and unambiguous.     |
| D-6  | **No new dependencies.** OG image is generated once by an available local tool (browser screenshot of a self-contained HTML template, or ImageMagick) and committed as a static PNG. | Honors the repo's "no deps unless asked" rule; the image is a build _input_, not a build step.                                       |
| D-7  | **Absolute URLs (canonical, `og:image`) are hardcoded to production.** Relative asset refs continue to use `%BASE_URL%`.                                                            | OG/canonical require absolute URLs; `%BASE_URL%` is a path (`/ChIC/`), not a full origin. Harmless in dev.                          |
| D-8  | Age range wording in prose says **"from age 15"** and avoids pinning an upper bound.                                                                                                | The repo is internally inconsistent (README 15–85 vs app cap 80); SEO copy must not assert a number that contradicts the UI.        |

---

## 4. Deliverables

### 4.1 Static `<head>` metadata (`index.html`)

Insert a single, commented **"SEO CONFIG"** block into `<head>` (after the charset/viewport lines, before favicons). Exact content:

**Primary:**

```html
<title>ChIC — Charité Imaging Classification for Polycystic Liver Disease (PLD)</title>
<meta
  name="description"
  content="Free interactive tool that classifies polycystic liver disease (PLD) progression from height-adjusted total liver volume (htTLV) and age to predict liver-event risk in ADPKD and ADPLD."
/>
<meta
  name="keywords"
  content="polycystic liver disease, PLD, ADPLD, ADPKD, height-adjusted total liver volume, htTLV, total liver volume, liver events, risk prediction, volume classification, Charité Imaging Classification, ChIC, PKD1, PKD2, GANAB, PRKCSH, SEC63"
/>
<meta name="author" content="Carolin Beatrice Brigl, Dana Sierks, Ria Schönauer, Bernt Popp, Jan Halbritter" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#00bf7d" />
<link rel="canonical" href="https://halbritter-lab.github.io/ChIC/" />
```

**Open Graph:**

```html
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
```

**Twitter:**

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="ChIC — Charité Imaging Classification for Polycystic Liver Disease" />
<meta name="twitter:description" content="Classify PLD progression from htTLV and age to predict liver-event risk in ADPKD and ADPLD. Free, research-based." />
<meta name="twitter:image" content="https://halbritter-lab.github.io/ChIC/og-image.png" />
<meta name="twitter:image:alt" content="ChIC — polycystic liver disease progression classes A–E" />
```

**Dublin Core (academic indexers):** `DC.title`, `DC.creator` (repeat per author), `DC.subject`, `DC.description`, `DC.publisher` = "Charité – Universitätsmedizin Berlin", `DC.type` = "InteractiveResource", `DC.format` = "text/html", `DC.identifier` = canonical URL, `DC.language` = "en", `DC.rights` = "MIT License".

**Google Scholar (commented, D-5):** a clearly-labelled `<!-- Google Scholar citation tags — UNCOMMENT AND FILL AT PUBLICATION -->` block containing `citation_title`, `citation_author` (repeat per author, "Last, First"), `citation_journal_title` = "JHEP Reports", `citation_publication_date` = "2026", `citation_doi`, `citation_pmid` — with `TODO:` placeholders for DOI/PMID.

### 4.2 Structured data — JSON-LD `@graph` (`index.html`, one `<script type="application/ld+json">`)

A single `@graph` with these nodes (IDs cross-referenced):

1. **`WebApplication`** (`@id` = canonical `#webapp`): `name` "Charité Imaging Classification (ChIC)", `alternateName` "ChIC", `url`, `description` (audience copy), `applicationCategory` "HealthApplication", `operatingSystem` "Any (web browser)", `browserRequirements` "Requires JavaScript.", `isAccessibleForFree` true, `offers` {`@type` Offer, `price` "0", `priceCurrency` "USD"}, `inLanguage` "en", `softwareVersion` "0.2.1" (from `package.json`), `image` = og-image URL, `license` "https://opensource.org/licenses/MIT", `about` → `#pld`, `audience` → MedicalAudience {Clinician, MedicalResearcher}, `isBasedOn` → `#paper`, `citation` → [`#sierks2022`, `#schonauer2024`], `author`/`publisher` → Organization "Charité – Universitätsmedizin Berlin".
2. **`MedicalWebPage`** (`#page`): `about` → `#pld`, `medicalAudience` [Clinician, MedicalResearcher], `lastReviewed` "2026-07-07", `mainEntity` → `#webapp`.
3. **`MedicalCondition`** (`#pld`): `name` "Polycystic Liver Disease", `alternateName` ["PLD", "ADPLD"], `associatedAnatomy` liver, `code`/`sameAs` where safe (e.g. Orphanet/OMIM link for PLD — optional, only if a stable URL is certain).
4. **`FAQPage`** (`#faq`): `mainEntity` = the same Q&A pairs rendered in the visible content (§4.4) — kept in sync.
5. **`ScholarlyArticle`** ×3 (`#paper`, `#sierks2022`, `#schonauer2024`): `headline`, `author` list, `isPartOf` Periodical (journal name), `datePublished`, `sameAs` = DOI/PubMed URL. `#paper` DOI/PMID are `TODO` placeholders; the two predecessors are fully populated (PMID 36246085, 38101549).

**Validation gate:** the JSON must pass the schema.org validator and Google Rich Results Test with zero errors before commit.

### 4.3 Open Graph image (`public/og-image.png`)

- **Spec:** 1200×630 PNG, < 150 KB, sRGB.
- **Design:** ChIC wordmark/logo (from `ChICLogo_Full` or `ChICLogo_JustLiver`) on a brand background (`#00bf7d` accent / white), with one line of text: "Charité Imaging Classification" and a subline "Polycystic liver disease progression · classes A–E". **No DFG or Heisenberg-Programm marks (D-4).**
- **Generation (D-6, no new deps):** author a self-contained HTML template at `scripts/og-image.html` (inline CSS, logo embedded), screenshot it at 1200×630 via the local browser tool; or composite via ImageMagick if available. Commit the resulting PNG. The HTML template is kept in `scripts/` for future regeneration.
- **Fallback:** if no rasteriser is available, ship an optimized 1200×630 letterboxed crop of the existing ChIC logo as a stopgap and note it in the publication checklist.

### 4.4 Static crawlable content (inside `#app`, `index.html`)

Replace the empty `<div id="app"></div>` with a mount node that contains a **static landing shell** Vue overwrites on mount. Requirements:

- Semantic HTML: one `<h1>`, section headings, a definition list for the glossary, and `<details>`/`<summary>` (or `<h3>`+`<p>`) for the FAQ.
- **Content outline (all drawn from §2):**
  - **H1:** "Charité Imaging Classification (ChIC) for Polycystic Liver Disease"
  - **What it is / who it's for:** 2–3 sentences — a free, research-based tool that classifies PLD progression by age and htTLV into classes A–E to help clinicians and researchers estimate liver-event risk in ADPKD and ADPLD.
  - **How the classes work:** htTLV = TLV ÷ height; classes A–E by compound annual growth-rate bands; higher class → higher liver-event risk. One line on the 585-patient, multi-centre basis.
  - **Glossary** (`<dl>`): PLD, ADPLD, ADPKD, htTLV, TLV, liver events, LGR.
  - **FAQ** (mirrors `#faq` JSON-LD): "What is htTLV?"; "What do ChIC classes A–E mean?"; "Is ChIC a diagnostic device?" (→ reinforces the disclaimer: informational/educational, not diagnostic); "How does ChIC differ from the Mayo Imaging Classification?"; "Which genes cause PLD?"; "How do I cite ChIC?"
  - **How to cite:** this paper (DOI/PMID TBD) + predecessors (PMID 36246085, 38101549), with links.
  - **Links:** source code (GitHub), the paper, the two predecessor papers.
- **`<noscript>`** immediately after `#app`: a short "JavaScript is required for the interactive tool" note plus the same core links (paper, source, predecessors), so a JS-disabled human still lands somewhere useful.
- **Styling:** inline `<style>` in `index.html` for the shell only (no dependency on the app's CSS, which loads later). Neutral, centered, branded; visible for the sub-second before Vue mounts.
- **No hidden text / no cloaking:** the shell is genuinely visible pre-mount and to non-JS agents; it is not `display:none`.

### 4.5 Crawler plumbing (`public/robots.txt`, `public/sitemap.xml`)

- `robots.txt`: keep allow-all; add `Sitemap: https://halbritter-lab.github.io/ChIC/sitemap.xml`. Use explicit `User-agent: *` / `Allow: /`.
- `sitemap.xml`: single `<url>` with `<loc>` (existing), add `<lastmod>2026-07-07</lastmod>`, `<changefreq>monthly</changefreq>`, `<priority>1.0</priority>`.

### 4.6 Remove client-side meta injection (`src/App.vue`)

- Delete the `updateMetaTag` helper (`:422–433`) and its four calls + `document.title` assignment in `onMounted` (`:502–512`), since static tags now own all of it.
- Verify no other caller of `updateMetaTag` exists (grep) before deleting.
- Leave the rest of `onMounted` (theme, query-init, modal CSS vars) untouched.
- Net effect: ~20 fewer lines in `App.vue` (helps the 600-LOC pressure), zero behaviour change for users.

---

## 5. File-by-file change list

| File                                              | Change                                                                                                          | Risk  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----- |
| `index.html`                                      | Add SEO CONFIG head block (§4.1), JSON-LD (§4.2), static shell inside `#app` + `<noscript>` + inline shell CSS (§4.4). Update `<title>`. | Med   |
| `public/og-image.png`                             | New 1200×630 social image (§4.3). ChIC assets only.                                                            | Low   |
| `scripts/og-image.html`                           | New self-contained template used to generate the OG image (kept for regen).                                    | Low   |
| `public/robots.txt`                               | Add `Sitemap:` line; explicit allow-all (§4.5).                                                                | Low   |
| `public/sitemap.xml`                              | Add `<lastmod>`, `<changefreq>`, `<priority>` (§4.5).                                                          | Low   |
| `src/App.vue`                                     | Remove `updateMetaTag` helper + calls + `document.title` (§4.6).                                               | Low   |
| `docs/superpowers/specs/2026-07-07-…-design.md`   | This spec.                                                                                                     | —     |
| `docs/RECOMMENDATIONS.md` _(optional)_            | Add a "Tier 2 — Discoverability/SEO" row pointing at this spec, so the roadmap stays the source of truth.      | Low   |
| `README.md` _(optional, publication checklist)_   | Note the canonical URL is now wired for SEO; DOI/PMID still TBD.                                               | Low   |

**Explicitly NOT touched:** `vite.config.js` (PWA manifest already has name/description), `formulasConfig.js`, `config.js`, `ChartDisplay.vue`, `useDataPersistence.js`, router, mixins, any calculator logic.

---

## 6. Verification plan (no test framework for HTML/SEO; verify by evidence)

1. **Build:** `npm run build` succeeds; `dist/index.html` contains the head block, JSON-LD, and static shell (Vite must preserve them and rewrite `%BASE_URL%` correctly).
2. **Raw HTML / no-JS:** `curl -s` (or view-source) of the built `dist/index.html` shows title, description, canonical, OG, Twitter, JSON-LD, and the prose — proving scrapers see it.
3. **Structured data:** paste the JSON-LD into the schema.org validator / Google Rich Results Test → zero errors; FAQ recognized.
4. **Social preview:** validate OG/Twitter tags parse (e.g., opengraph.xyz or the platform debuggers) against the built HTML; og-image loads and is 1200×630.
5. **Sitemap/robots:** `sitemap.xml` validates as XML; `robots.txt` lists the sitemap.
6. **App unchanged:** `npm run dev` → disclaimer gate, calculator (manual entry → class A–E, htTLV, LGR), import/export, and `?patientId=&age=&tlv=&acknowledgeBanner=true` embed mode all behave as before; the static shell is replaced cleanly by the app on mount (no persistent duplicate/FOUC after mount).
7. **Lint:** `npx eslint src/App.vue` clean.
8. **PWA intact:** service worker still registers; manifest unaffected.

---

## 7. Publication checklist (hand-off, not code)

At paper acceptance / DOI assignment, three edits activate full academic linkage:

1. **`index.html`** — uncomment and fill the Google Scholar `citation_*` block; fill `#paper` DOI/PMID in the JSON-LD.
2. **`src/components/AppFooter.vue`** — replace `pubmed.ncbi.nlm.nih.gov/TBD/` with the real PMID.
3. **`README.md`** — replace `PMID:TBD` occurrences.
4. **Manuscript** — set the tool-availability sentence URL to exactly `https://halbritter-lab.github.io/ChIC/`.
5. **GSC** — submit `https://halbritter-lab.github.io/ChIC/sitemap.xml` in the existing verified property; request indexing.

---

## 8. Risks & mitigations

| Risk                                                                                     | Mitigation                                                                                                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **FOUC** — static shell flashes before Vue mounts.                                       | Style the shell as an intentional branded landing (logo + one paragraph + skeleton), centered; it reads as a loading state, not a glitch. Mount is sub-second. |
| **Cloaking suspicion** — different content for crawlers vs users.                        | Same subject matter both ways; shell is genuinely visible pre-mount and to non-JS agents; nothing is `display:none`-hidden-from-users-only. |
| **Scholar misattribution** — tool page indexed as the article.                           | Highwire `citation_*` tags held (commented) until DOI exists; only DC + JSON-LD `isBasedOn` ship now (D-5).                     |
| **DFG/Heisenberg consent** — OG image inadvertently carries the DFG mark.               | OG image uses ChIC assets only; DFG/Heisenberg explicitly excluded (D-4); reviewer checks the committed PNG.                     |
| **Absolute-URL drift** if a custom domain is later adopted.                              | All absolute URLs sit in one commented SEO CONFIG block → single find/replace (D-1).                                            |
| **Vite strips/relocates head tags or the shell.**                                        | Verification step 1–2 inspects the built `dist/index.html`, not just source.                                                     |
| **PWA precache bloat** from the new PNG.                                                  | og-image < 150 KB; `globPatterns` already includes png — negligible; verify precache size in build output.                      |

---

## 9. Out of scope (recorded so it isn't re-litigated)

Prerender/SSR; any new dependency; in-app copy/UX restructuring; custom domain; changing thresholds/model/age caps; fixing the unrelated `TBD` PMID links (tracked in the publication checklist, not this change); the broader `docs/RECOMMENDATIONS.md` remediation program (separate spec).
