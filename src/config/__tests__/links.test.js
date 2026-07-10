import { describe, it, expect } from 'vitest';
import { LINKS, buildBugReportUrl, sanitizeBugReportPageUrl } from '../links.js';

describe('LINKS', () => {
  it('points every GitHub link at the halbritter-lab/ChIC repo', () => {
    expect(LINKS.repo).toBe('https://github.com/halbritter-lab/ChIC');
    expect(LINKS.documentation).toContain('halbritter-lab/ChIC');
    expect(LINKS.feedbackDiscussions).toContain('halbritter-lab/ChIC/discussions/new');
    expect(LINKS.feedbackDiscussions).toContain('category=feedback');
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

  it('omits prefill params when no context is given', () => {
    const url = buildBugReportUrl();
    expect(url).not.toContain('version=');
    expect(url).not.toContain('page-url=');
  });
});

describe('sanitizeBugReportPageUrl', () => {
  it('keeps only known non-clinical display toggles', () => {
    const input =
      'https://user:secret@example.test/ChIC/?patientId=SECRET-1&age=50&height=1.75&tlv=15000&showFooter=false&showCitation=true&unknown=private#patient-fragment';

    expect(sanitizeBugReportPageUrl(input)).toBe(
      'https://example.test/ChIC/?showFooter=false&showCitation=true'
    );
  });

  it.each([
    ['acknowledgeBanner', 'yes'],
    ['showFooter', 'SECRET-PATIENT-42'],
    ['showCitation', 'TRUE'],
    ['showDocumentation', '1'],
    ['showControls', ' false '],
  ])('removes invalid values for %s', (key, value) => {
    const page = new URL('https://example.test/ChIC/');
    page.searchParams.set(key, value);

    expect(sanitizeBugReportPageUrl(page)).toBe('https://example.test/ChIC/');
  });

  it('removes encoded credential and fragment-like text under allowlisted keys', () => {
    const input =
      'https://example.test/ChIC/?showFooter=user%3Asecret%40example.test&showCitation=%23patient-fragment';

    expect(sanitizeBugReportPageUrl(input)).toBe('https://example.test/ChIC/');
  });

  it('normalizes mixed duplicate toggles to the first exact valid value', () => {
    const input =
      'https://example.test/ChIC/?showControls=private&showControls=false&showControls=true&showFooter=SECRET&showFooter=true&showFooter=false';

    expect(sanitizeBugReportPageUrl(input)).toBe(
      'https://example.test/ChIC/?showFooter=true&showControls=false'
    );
  });

  it.each([undefined, '', 'not a url', 'javascript:alert(1)', 'file:///tmp/private'])(
    'omits unsafe or unparseable context: %s',
    (input) => expect(sanitizeBugReportPageUrl(input)).toBeUndefined()
  );

  it('sanitizes inside buildBugReportUrl so callers cannot bypass the boundary', () => {
    const report = new URL(
      buildBugReportUrl({
        version: '1.2.3',
        url: 'https://example.test/ChIC/?patientId=P1&age=40&showControls=false',
      })
    );

    expect(report.searchParams.get('version')).toBe('1.2.3');
    expect(report.searchParams.get('page-url')).toBe(
      'https://example.test/ChIC/?showControls=false'
    );
    expect(report.href).not.toContain('patientId');
    expect(report.href).not.toContain('age%3D40');
  });
});
