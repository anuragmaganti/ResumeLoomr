import { useEffect, useState } from 'react';

import {
  readLocalStorageItem,
  writeLocalStorageItem,
} from '../lib/browserStorage.js';

const THEME_STORAGE_KEY = 'resumeloomr:theme';

function readInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const savedTheme = readLocalStorageItem(THEME_STORAGE_KEY);
  return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'light';
}

export function useAppTheme() {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeLocalStorageItem(THEME_STORAGE_KEY, theme);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', theme === 'dark' ? '#0f1726' : '#3158d5');

    const favicon = document.querySelector('#app-favicon');
    favicon?.setAttribute('href', theme === 'dark' ? '/favicon-dark.png' : '/favicon-light.png');
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
