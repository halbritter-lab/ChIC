// src/config/links.js — external links, repo coordinates, and contact info.
// Single source of truth for every GitHub/contact URL used in the UI, so a link
// change (repo move, category rename) happens in exactly one place. Clinical/UI
// constants live in config.js; this module owns outward links only.

const REPO = 'https://github.com/halbritter-lab/ChIC';

export const LINKS = {
  repo: REPO,
  documentation: `${REPO}/blob/main/README.md`,
  // Open-ended feedback / questions -> GitHub Discussions (Ideas category).
  // The `ideas` slug is a default category created when Discussions is enabled;
  // a maintainer may rename the category in the UI without changing this slug.
  feedbackDiscussions: `${REPO}/discussions/new?category=ideas`,
  // Structured bug reports -> the prefilled Issue Form (see buildBugReportUrl).
  bugReportTemplate: `${REPO}/issues/new?template=bug_report.yml&labels=bug`,
  // Human contact fallback (kept alongside the GitHub channels).
  contactEmail: 'jan.halbritter@charite.de',
};

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
  const params = new URLSearchParams({ template: 'bug_report.yml', labels: 'bug' });
  if (version) params.set('version', String(version));
  if (url) params.set('page-url', String(url));
  return `${REPO}/issues/new?${params.toString()}`;
}
