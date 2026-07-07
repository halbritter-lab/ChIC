// useTheme.js — dark/light theme toggle with localStorage persistence.
import { ref } from 'vue';

const STORAGE_KEY = 'theme';

export function useTheme() {
  // Persisted preference; defaults to light when unset.
  const isDark = ref(localStorage.getItem(STORAGE_KEY) === 'dark');

  // Reflect the current preference onto <body> so global .dark-theme rules apply, and keep the
  // <html data-chic-theme> hook (set pre-mount by the inline script in index.html) in sync so the
  // themed base background stays correct after an in-session toggle.
  const applyTheme = () => {
    document.body.classList.toggle('dark-theme', isDark.value);
    const root = document.documentElement;
    if (isDark.value) root.setAttribute('data-chic-theme', 'dark');
    else root.removeAttribute('data-chic-theme');
  };

  const toggleTheme = () => {
    isDark.value = !isDark.value;
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light');
    applyTheme();
  };

  return { isDark, toggleTheme, applyTheme };
}
