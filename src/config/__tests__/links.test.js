import { describe, it, expect } from 'vitest';
import { LINKS, buildBugReportUrl } from '../links.js';

describe('LINKS', () => {
  it('points every GitHub link at the halbritter-lab/ChIC repo', () => {
    expect(LINKS.repo).toBe('https://github.com/halbritter-lab/ChIC');
    expect(LINKS.documentation).toContain('halbritter-lab/ChIC');
    expect(LINKS.feedbackDiscussions).toContain('halbritter-lab/ChIC/discussions/new');
    expect(LINKS.feedbackDiscussions).toContain('category=ideas');
    expect(LINKS.contactEmail).toBe('jan.halbritter@charite.de');
  });
});

describe('buildBugReportUrl', () => {
  it('targets the bug_report.yml issue form with the bug label', () => {
    const url = buildBugReportUrl();
    expect(url).toContain('halbritter-lab/ChIC/issues/new');
    expect(url).toContain('template=bug_report.yml');
    expect(url).toContain('labels=bug');
  });

  it('prefills version and page-url using the exact form field ids, URL-encoded', () => {
    const url = buildBugReportUrl({
      version: '1.2.3',
      url: 'https://example.com/ChIC/?age=50&tlv=1',
    });
    const params = new URL(url).searchParams;
    // Keys must match the bug_report.yml field ids exactly for GitHub to prefill them.
    expect(params.get('version')).toBe('1.2.3');
    expect(params.get('page-url')).toBe('https://example.com/ChIC/?age=50&tlv=1');
    // Encoding: the & inside the page URL must be escaped, not treated as a separator.
    expect(url).toContain('page-url=https%3A%2F%2Fexample.com%2FChIC%2F%3Fage%3D50%26tlv%3D1');
  });

  it('omits prefill params when no context is given', () => {
    const url = buildBugReportUrl();
    expect(url).not.toContain('version=');
    expect(url).not.toContain('page-url=');
  });
});
