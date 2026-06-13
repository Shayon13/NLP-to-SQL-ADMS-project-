/*
   NeuralQuery — settings.js
   */

// ── Load all saved preferences on page load
document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle
    const theme = NQTheme.getTheme();
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.checked = (theme === 'light');
    updateThemeLabel(theme);

    // Dialect pref
    const dialect = localStorage.getItem('nq-dialect') || 'postgresql';
    const dialectEl = document.getElementById('dialectPref');
    if (dialectEl) dialectEl.value = dialect;

    // Schema open pref
    const schemaOpen = localStorage.getItem('nq-schema-open') === 'true';
    const schemaEl = document.getElementById('schemaPref');
    if (schemaEl) schemaEl.checked = schemaOpen;

    // Auto-format pref
    const autoformat = localStorage.getItem('nq-autoformat') === 'true';
    const autoEl = document.getElementById('autoformatPref');
    if (autoEl) autoEl.checked = autoformat;

    updatePreviewCard(theme);
});

// ── Theme Toggle ──
function handleThemeToggle(checkbox) {
    const theme = checkbox.checked ? 'light' : 'dark';
    NQTheme.applyTheme(theme);
    updateThemeLabel(theme);
    updatePreviewCard(theme);
    showToast(theme === 'light' ? '☀️ Light mode enabled' : '🌙 Dark mode enabled');
}

function updateThemeLabel(theme) {
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'light' ? 'Light' : 'Dark';
}

function updatePreviewCard(theme) {
    const inner = document.getElementById('previewInner');
    const title = document.getElementById('previewTitle');
    const card  = document.getElementById('previewCard');
    if (!inner) return;

    if (theme === 'light') {
        inner.style.background = '#FFFFFF';
        if (card) card.style.borderColor = 'rgba(100,116,139,0.18)';
        if (title) title.style.color = '#0F172A';
    } else {
        inner.style.background = '#0c0f1a';
        if (card) card.style.borderColor = 'rgba(99,179,237,0.12)';
        if (title) title.style.color = '#E2E8F0';
    }
}

// ── Generic preference saver ──
function savePref(key, value) {
    localStorage.setItem(key, value);
    showToast('✓ Preference saved');
}

// ── Export History ──
async function exportHistory() {
    try {
        const res  = await fetch('/history');
        const data = await res.json();
        if (data.status !== 'success') { showToast('Failed to fetch history', 'error'); return; }
        const blob = new Blob([JSON.stringify(data.history, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `neuralquery_history_${Date.now()}.json`;
        a.click();
        showToast('✓ History exported!');
    } catch {
        showToast('Export failed. Please try again.', 'error');
    }
}

// ── Clear All History ──
async function clearAllHistory() {
    if (!confirm('This will hide all query history from your view.\nYour data is preserved on the server.\n\nContinue?')) return;
    try {
        const res  = await fetch('/history/clear', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('✓ History cleared');
        } else {
            showToast('Failed to clear history', 'error');
        }
    } catch {
        showToast('Failed to clear history', 'error');
    }
}

// ── Toast Notification ──
function showToast(msg, type) {
    const t = document.getElementById('saveToast');
    if (!t) return;
    t.textContent = msg;
    if (type === 'error') {
        t.style.background = 'rgba(239,68,68,0.15)';
        t.style.borderColor = 'rgba(239,68,68,0.3)';
        t.style.color = '#fca5a5';
    } else {
        t.style.background = 'rgba(16,185,129,0.15)';
        t.style.borderColor = 'rgba(16,185,129,0.3)';
        t.style.color = 'var(--green)';
    }
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, 2200);
}
