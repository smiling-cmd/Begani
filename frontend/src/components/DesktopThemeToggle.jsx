import { useContext } from 'react';
import { Moon, Sun } from 'lucide-react';
import ThemeContext from '../context/ThemeContextValue';
import './DesktopThemeToggle.css';

// Light / dark switch pinned to the top right of every signed-in page on desktop.
// Phones have their own in the top bar, and the sidebar keeps its copy.
export default function DesktopThemeToggle() {
  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme || 'light';
  const toggleTheme = themeContext?.toggleTheme || (() => {});
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="desktop-theme-toggle"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
