// src/config/links.js — external links, repo coordinates, and contact info.
// Single source of truth for every GitHub/contact URL used in the UI, so a link
// change (repo move, category rename) happens in exactly one place. Clinical/UI
// constants live in config.js; this module owns outward links only.

const REPO = 'https://github.com/halbritter-lab/ChIC';
const SAFE_REPORT_PARAMS = new Set([
  'acknowledgeBanner',
  'showFooter',
  'showCitation',
  'showDocumentation',
  'showControls',
]);

export const LINKS = {
  repo: REPO,
  documentation: `${REPO}/blob/main/README.md`,
  // Open-ended feedback / questions -> the repository's Feedback discussion category.
  feedbackDiscussions: `${REPO}/discussions/new?category=feedback`,
  // Structured bug reports -> the prefilled Issue Form (see buildBugReportUrl).
  bugReportTemplate: `${REPO}/issues/new?template=bug_report.yml&labels=bug`,
  // Human contact fallback (kept alongside the GitHub channels).
  contactEmail: 'jan.halbritter@charite.de',
};

export function sanitizeBugReportPageUrl(rawUrl) {
  if (rawUrl === undefined || rawUrl === null || String(rawUrl).trim() === '') return undefined;

  try {
    const page = new URL(String(rawUrl));
    if (page.protocol !== 'https:' && page.protocol !== 'http:') return undefined;

    page.username = '';
    page.password = '';
    page.hash = '';
    for (const key of [...page.searchParams.keys()]) {
      if (!SAFE_REPORT_PARAMS.has(key)) page.searchParams.delete(key);
    }
    for (const key of SAFE_REPORT_PARAMS) {
      const safeValue = page.searchParams
        .getAll(key)
        .find((value) => value === 'true' || value === 'false');
      page.searchParams.delete(key);
      if (safeValue) page.searchParams.set(key, safeValue);
    }
    return page.toString();
  } catch {
    return undefined;
  }
}

/**
 * Build a "Report a bug" URL that prefills the Issue Form with reproduction
 * context. GitHub prefills a form field by matching a query-param name to the
 * field's `id` in bug_report.yml, so the keys here (`version`, `page-url`) MUST
 * stay in sync with those ids.
 *
 * @param {{ version?: string, url?: string }} ctx
 * @returns {string} absolute URL to the prefilled new-issue form
 */
export function buildBugReportUrl({ version, url } = {}) {
  const report = new URL(LINKS.bugReportTemplate);
  if (version) report.searchParams.set('version', String(version));
  const safePageUrl = sanitizeBugReportPageUrl(url);
  if (safePageUrl) report.searchParams.set('page-url', safePageUrl);
  return report.toString();
}
