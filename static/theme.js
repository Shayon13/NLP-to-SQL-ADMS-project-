/*
   NeuralQuery — theme.js
   Applies saved theme before first paint (no flash of wrong theme)
   */
(function () {
    const KEY = 'nq-theme';

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(KEY, theme);
        document.querySelectorAll('.theme-toggle-input').forEach(t => {
            t.checked = (theme === 'light');
        });
        document.querySelectorAll('.theme-icon').forEach(i => {
            i.textContent = theme === 'light' ? '☀️' : '🌙';
        });
    }

    function getTheme() {
        return localStorage.getItem(KEY) || 'dark';
    }

    function toggleTheme() {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        return next;
    }

    applyTheme(getTheme());
    window.NQTheme = { applyTheme, getTheme, toggleTheme };
})();
