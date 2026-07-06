// useTheme.js — dark/light theme toggle with localStorage persistence.
import { ref } from 'vue';

const STORAGE_KEY = 'theme';

export function useTheme() {
  // Persisted preference; defaults to light when unset.
  const isDark = ref(localStorage.getItem(STORAGE_KEY) === 'dark');

  // Reflect the current preference onto <body> so global .dark-theme rules apply.
  const applyTheme = () => {
    document.body.classList.toggle('dark-theme', isDark.value);
  };

  const toggleTheme = () => {
    isDark.value = !isDark.value;
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light');
    applyTheme();
  };

  return { isDark, toggleTheme, applyTheme };
}
