import { useLayoutEffect, useState } from 'react';
import ThemeContext from './ThemeContextValue';

const storageKey = 'begani-theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (
    localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light'
  ));

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);
    // Colours the phone's status bar to match the page so the app looks edge to edge.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#131815' : '#fbf8f0');
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
