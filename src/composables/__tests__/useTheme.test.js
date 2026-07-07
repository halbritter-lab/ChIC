import { describe, it, expect, beforeEach } from 'vitest';
import { useTheme } from '@/composables/useTheme.js';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    document.documentElement.removeAttribute('data-chic-theme');
  });

  it('applyTheme keeps the <html data-chic-theme> pre-mount hook in sync with the body class', () => {
    // Dark: both the body class and the html attribute the index.html splash reads must be set,
    // so the themed background stays correct after an in-session toggle (no flash next paint).
    localStorage.setItem('theme', 'dark');
    const { applyTheme } = useTheme();
    applyTheme();
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    expect(document.documentElement.getAttribute('data-chic-theme')).toBe('dark');
  });

  it('toggleTheme flips both the body class and the html attribute and persists the choice', () => {
    const { toggleTheme } = useTheme();
    toggleTheme(); // light -> dark
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-chic-theme')).toBe('dark');
    toggleTheme(); // dark -> light
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.hasAttribute('data-chic-theme')).toBe(false);
  });
});
