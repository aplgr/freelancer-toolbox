(function () {
  const KEY = "theme";
  const root = document.documentElement;
  const toggle = document.getElementById("themeSwitch");
  const tag = document.getElementById("themeTag");
  const label = document.getElementById("themeSwitchLabel");
  const year = document.getElementById("year");

  if (year) year.textContent = new Date().getFullYear();

  function setHomeLink() {
    const home = document.querySelector('.pill a[aria-label="Landing page"]');
    if (!home) return;

    const path = window.location.pathname || '/';
    const marker = '/tools/';
    let basePath = path;

    const idx = path.indexOf(marker);
    if (idx !== -1) {
      // Keep the trailing slash right before "tools". Example: /repo/tools/x/ -> /repo/
      basePath = path.slice(0, idx + 1);
    } else {
      // If we're on /repo/index.html, strip the filename.
      if (basePath.endsWith('.html')) {
        basePath = basePath.slice(0, basePath.lastIndexOf('/') + 1);
      }
      if (!basePath.endsWith('/')) basePath += '/';
    }

    home.setAttribute('href', basePath);
    home.setAttribute('title', 'Back to landing page');
  }


  function systemPrefersDark() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      return false;
    }
  }

  function readTheme() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch (e) {}
    return systemPrefersDark() ? "dark" : "light";
  }

  function writeTheme(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {}
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    if (toggle) toggle.checked = isDark;
    if (tag) tag.textContent = isDark ? "Dark" : "Light";
    if (label) label.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  }

  const initial = readTheme();
  applyTheme(initial);
  setHomeLink();

  if (toggle) {
    toggle.addEventListener("change", function () {
      const theme = toggle.checked ? "dark" : "light";
      writeTheme(theme);
      applyTheme(theme);
    });
  }
})();
