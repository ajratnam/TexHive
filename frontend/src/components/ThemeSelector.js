import React, { useState, useEffect } from 'react';

function ThemeSelector() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.remove(
      'light-theme',
      'solarized-theme',
      'dracula-theme',
      'monokai-theme',
      'nord-theme',
      'gruvbox-theme',
      'cobalt-theme'
    );
    if (theme !== 'dark') {
      document.documentElement.classList.add(`${theme}-theme`);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleThemeChange = (event) => {
    setTheme(event.target.value);
  };

  return (
    <select id="theme-selector" value={theme} onChange={handleThemeChange}>
      <option value="dark">Dark</option>
      <option value="light">Light</option>
      <option value="solarized">Solarized</option>
      <option value="dracula">Dracula</option>
      <option value="monokai">Monokai</option>
      <option value="nord">Nord</option>
      <option value="gruvbox">Gruvbox</option>
      <option value="cobalt">Cobalt</option>
    </select>
  );
}

export default ThemeSelector;
