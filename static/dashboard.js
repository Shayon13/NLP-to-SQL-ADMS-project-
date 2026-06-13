/*
   NeuralQuery Dashboard — dashboard.js
   Handles: Translator, Visualizations, Schema Map, Query Logs
    */

// State
let currentSQL    = '';
let currentLogic  = '';
let activeView    = 'translator';
let vizChart      = null;
let schemaData    = { tables: [] };

// View Switcher
function switchView(view) {
    activeView = view;

    // hide all workspace panels
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');

    // sync nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.view === view);
    });
    // sync sidebar items
    document.querySelectorAll('.sidebar-item').forEach(i => {
        i.classList.toggle('active', i.dataset.view === view);
    });

    // lazy-load
    if (view === 'visualizations') renderVisualizations();
    if (view === 'logs')           loadQueryLogs();
    if (view === 'schema')         renderSchemaMap();
}

//  SQL Dialect
function getDialect() {
    return document.getElementById('dialectSelect')?.value || 'postgresql';
}

function updateDialectBadge() {
    const sel   = document.getElementById('dialectSelect');
    const badge = document.getElementById('sqlDialect');
    const labels = {
        postgresql: 'PostgreSQL',
        standard:   'Standard SQL',
        mysql:      'MySQL',
        sqlite:     'SQLite'
    };
    if (badge && sel) badge.textContent = labels[sel.value] || sel.value;
}

//SQL Syntax Highlighte
function highlightSQL(sql) {
    if (!sql) return '';
    const esc = sql
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const keywords  = /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|WITH|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|LIKE|ILIKE|CAST|ASC|DESC|PRIMARY|KEY|FOREIGN|REFERENCES|RETURNING|TOP|ROWNUM|AUTO_INCREMENT|AUTOINCREMENT|UNSIGNED|VARCHAR|INTEGER|BIGINT|TEXT|BOOLEAN|TIMESTAMP|DATE|NUMERIC|DECIMAL|FLOAT|DOUBLE)\b/gi;
    const functions = /\b(COUNT|SUM|AVG|MAX|MIN|COALESCE|NULLIF|NOW|CURRENT_DATE|CURRENT_TIMESTAMP|DATE_TRUNC|DATE_PART|EXTRACT|TO_CHAR|TO_DATE|CONCAT|SUBSTRING|SUBSTR|UPPER|LOWER|TRIM|LENGTH|ROUND|FLOOR|CEIL|ABS|ARRAY_AGG|STRING_AGG|GROUP_CONCAT|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|IFNULL|NVL|IIF|STRFTIME|DATETIME|DATE_FORMAT)\b/gi;

    return esc
        .replace(/--[^\n]*/g,   m => `<span class="cm">${m}</span>`)
        .replace(/'[^']*'/g,    m => `<span class="str">${m}</span>`)
        .replace(/\b(\d+)\b/g,  (_, n) => `<span class="num">${n}</span>`)
        .replace(functions,     m => `<span class="fn">${m}</span>`)
        .replace(keywords,      m => `<span class="kw">${m}</span>`);
}

// Main Translation 
async function handleTranslation() {
    const input = document.getElementById('nlpInput').value.trim();
    if (!input) { showNotification('Please describe your query first.', 'error'); return; }

    const genBtn     = document.getElementById('genBtn');
    const spinner    = document.getElementById('spinner');
    const genBtnText = document.getElementById('genBtnText');
    const genIcon    = document.getElementById('genIcon');

    genBtn.disabled       = true;
    spinner.style.display = 'block';
    genBtnText.textContent = 'Generating…';
    genIcon.style.display  = 'none';

    const sqlOut   = document.getElementById('sqlOutput');
    const logicOut = document.getElementById('logicExplanation');
    sqlOut.innerHTML = '<span class="cm">-- Analyzing your query, please wait…</span>';
    sqlOut.classList.remove('placeholder');
    logicOut.textContent = 'Processing…';

    try {
        const schema  = document.getElementById('schemaInput').value.trim();
        const dialect = getDialect();

        const res = await fetch('/translate', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ query: input, schema, dialect })
        });

        if (res.status === 401) { window.location.href = '/login'; return; }

        const data = await res.json();
        if (data.status === 'success') {
            currentSQL   = data.sql;
            currentLogic = data.logic;
            sqlOut.innerHTML     = highlightSQL(data.sql);
            logicOut.textContent = data.logic;
            addToHistorySidebar(input);
            showNotification('SQL generated successfully!', 'success');
        } else {
            showNotification(data.message || 'Generation failed. Please try again.', 'error');
        }
    } catch (err) {
        showNotification('Connection error. Is the server running?', 'error');
        console.error(err);
    } finally {
        genBtn.disabled        = false;
        spinner.style.display  = 'none';
        genBtnText.textContent = 'Generate SQL';
        genIcon.style.display  = 'inline';
    }
}

// Sidebar History 
function addToHistorySidebar(query) {
    const list  = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    if (empty) empty.style.display = 'none';

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div class="history-item-query">${escHtml(query)}</div>
        <div class="history-item-time">Just now</div>`;
    item.onclick = () => document.getElementById('nlpInput').value = query;
    list.prepend(item);
}

function loadHistory(query, sql, logic) {
    switchView('translator');
    document.getElementById('nlpInput').value = query;
    currentSQL   = sql.replace(/\\n/g, '\n');
    currentLogic = logic;
    const sqlOut = document.getElementById('sqlOutput');
    sqlOut.classList.remove('placeholder');
    sqlOut.innerHTML = highlightSQL(currentSQL);
    document.getElementById('logicExplanation').textContent = currentLogic;
}

function clearHistory() {
    openClearModal();
}

//Query Log Tab
async function loadQueryLogs() {
    const container = document.getElementById('logsTableBody');
    if (!container) return;
    container.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">Loading logs…</td></tr>';

    try {
        const res  = await fetch('/history');
        const data = await res.json();
        if (data.status !== 'success' || !data.history.length) {
            container.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No query history yet. Generate your first SQL query above.</td></tr>';
            return;
        }
        container.innerHTML = data.history.map(h => `
            <tr id="log-row-${h.id}">
                <td class="log-td">
                    <div class="log-nl">${escHtml(h.natural_query)}</div>
                    <div class="log-sql-preview">${escHtml((h.sql || '').split('\n')[0].slice(0,80))}…</div>
                </td>
                <td class="log-td log-time">${h.created_at || '—'}</td>
                <td class="log-td" style="text-align:center">
                    <button class="icon-btn" title="View detail" onclick="openDetailModal(${JSON.stringify(h.natural_query)},${JSON.stringify(h.sql)},${JSON.stringify(h.logic)},${JSON.stringify(h.dialect||'postgresql')},${JSON.stringify(h.created_at||'')})">
                        <i class="ri-eye-line"></i>
                    </button>
                </td>
                <td class="log-td" style="text-align:center">
                    <button class="icon-btn danger-btn" title="Delete" onclick="deleteLog(${h.id})">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            </tr>`).join('');
    } catch {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--red)">Failed to load logs.</td></tr>';
    }
}

function deleteLog(id) {
    // Find preview text from the row
    const row = document.getElementById('log-row-' + id);
    const preview = row ? row.querySelector('.log-nl')?.textContent?.slice(0, 60) + '…' : `Entry #${id}`;
    openDeleteModal(id, preview);
}

function filterLogs() {
    const q = document.getElementById('logSearch').value.toLowerCase();
    document.querySelectorAll('#logsTableBody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

//Visualizations Tab
async function renderVisualizations() {
    try {
        const res  = await fetch('/history');
        const data = await res.json();
        const history = data.history || [];

        // Query type breakdown
        const types = { SELECT: 0, JOIN: 0, 'GROUP BY': 0, Aggregate: 0, Other: 0 };
        history.forEach(h => {
            const sql = (h.sql || '').toUpperCase();
            if (sql.includes('JOIN'))          types.JOIN++;
            else if (sql.includes('GROUP BY')) types['GROUP BY']++;
            else if (/COUNT|SUM|AVG|MAX|MIN/.test(sql)) types.Aggregate++;
            else if (sql.includes('SELECT'))   types.SELECT++;
            else                               types.Other++;
        });

        // Queries per day (last 7 days)
        const dayMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            dayMap[d.toLocaleDateString('en-US', { month:'short', day:'numeric' })] = 0;
        }
        history.forEach(h => {
            if (!h.created_at) return;
            const parts = h.created_at.split(',')[0] || h.created_at;
            // e.g. "Apr 29, 14:30" → "Apr 29"
            const dayKey = parts.replace(/,.*/, '').trim();
            if (dayMap[dayKey] !== undefined) dayMap[dayKey]++;
        });

        renderDonut('vizDonut', Object.keys(types), Object.values(types));
        renderBar('vizBar', Object.keys(dayMap), Object.values(dayMap));

        // Stats summary
        document.getElementById('vizTotal').textContent    = history.length;
        document.getElementById('vizToday').textContent    = Object.values(dayMap).slice(-1)[0] || 0;
        const topType = Object.entries(types).sort((a,b) => b[1]-a[1])[0];
        document.getElementById('vizTopType').textContent  = topType ? topType[0] : '—';

    } catch (e) { console.error('Viz error', e); }
}

function renderDonut(canvasId, labels, values) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (window._donutChart) window._donutChart.destroy();
    window._donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: values,
                backgroundColor: ['#4F9CF9','#22D3EE','#10B981','#F59E0B','#8B5CF6'],
                borderColor: '#0c0f1a', borderWidth: 3 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 12 } } }
            }
        }
    });
}

function renderBar(canvasId, labels, values) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (window._barChart) window._barChart.destroy();
    window._barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Queries', data: values,
                backgroundColor: 'rgba(79,156,249,0.5)',
                borderColor: '#4F9CF9', borderWidth: 2, borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Schema Map Tab
function renderSchemaMap() {
    const canvas = document.getElementById('schemaCanvas');
    if (!canvas || !canvas.getContext) return;
    drawSchema(canvas);
}

function addSchemaTable() {
    const name = document.getElementById('newTableName').value.trim();
    if (!name) return;
    schemaData.tables.push({ name, columns: ['id INTEGER PRIMARY KEY', 'created_at TIMESTAMP'] });
    document.getElementById('newTableName').value = '';
    renderSchemaCards();
}

function addColumn(tableIdx) {
    const input = document.getElementById(`colInput-${tableIdx}`);
    const col   = input.value.trim();
    if (!col) return;
    schemaData.tables[tableIdx].columns.push(col);
    input.value = '';
    renderSchemaCards();
}

function removeTable(idx) {
    schemaData.tables.splice(idx, 1);
    renderSchemaCards();
}

function removeColumn(tIdx, cIdx) {
    schemaData.tables[tIdx].columns.splice(cIdx, 1);
    renderSchemaCards();
}

function renderSchemaCards() {
    const container = document.getElementById('schemaCards');
    if (!container) return;
    container.innerHTML = schemaData.tables.map((tbl, ti) => `
        <div class="schema-card">
            <div class="schema-card-head">
                <span class="schema-table-name"><i class="ri-table-line"></i> ${escHtml(tbl.name)}</span>
                <button class="icon-btn danger-btn" onclick="removeTable(${ti})"><i class="ri-delete-bin-line"></i></button>
            </div>
            <div class="schema-cols">
                ${tbl.columns.map((c,ci) => `
                    <div class="schema-col-row">
                        <span class="schema-col-text">${escHtml(c)}</span>
                        <button class="schema-col-del" onclick="removeColumn(${ti},${ci})">×</button>
                    </div>`).join('')}
            </div>
            <div class="schema-add-col">
                <input class="schema-col-input" id="colInput-${ti}" placeholder="e.g. email VARCHAR(255) NOT NULL" onkeydown="if(event.key==='Enter') addColumn(${ti})">
                <button class="icon-btn" onclick="addColumn(${ti})"><i class="ri-add-line"></i></button>
            </div>
        </div>`).join('') || '<div style="color:var(--muted);font-size:13px;padding:20px 0">No tables defined yet. Add one above.</div>';
}

function exportSchema() {
    if (!schemaData.tables.length) { showNotification('No tables to export.', 'info'); return; }
    const ddl = schemaData.tables.map(t =>
        `CREATE TABLE ${t.name} (\n  ${t.columns.join(',\n  ')}\n);`
    ).join('\n\n');
    const blob = new Blob([ddl], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'schema.sql'; a.click();
    showNotification('Schema exported as SQL!', 'success');
}

function useSchemaInTranslator() {
    if (!schemaData.tables.length) { showNotification('No schema tables defined.', 'info'); return; }
    const schemaText = schemaData.tables.map(t =>
        `${t.name}(${t.columns.map(c => c.split(' ')[0]).join(', ')})`
    ).join('\n');
    const schemaInput = document.getElementById('schemaInput');
    if (schemaInput) schemaInput.value = schemaText;
    const schemaArea = document.getElementById('schemaArea');
    if (schemaArea) { schemaArea.classList.add('open'); document.getElementById('schemaToggleText').textContent = '− Hide Schema Context'; }
    switchView('translator');
    showNotification('Schema loaded into translator!', 'success');
}

// Utilities
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showNotification(message, type) {
    const note = document.getElementById('notification');
    const colors = {
        success: { bg:'rgba(16,185,129,0.15)', border:'rgba(16,185,129,0.3)', color:'#6ee7b7' },
        error:   { bg:'rgba(239,68,68,0.15)',  border:'rgba(239,68,68,0.3)',  color:'#fca5a5' },
        info:    { bg:'rgba(79,156,249,0.15)', border:'rgba(79,156,249,0.3)', color:'#93c5fd' }
    };
    const c = colors[type] || colors.info;
    note.textContent = message;
    note.style.cssText = `display:block;background:${c.bg};border:1px solid ${c.border};color:${c.color};position:fixed;top:80px;right:24px;padding:12px 20px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.3);animation:slideIn 0.3s ease`;
    clearTimeout(note._timer);
    note._timer = setTimeout(() => { note.style.display = 'none'; }, 3500);
}

function copySQL() {
    if (!currentSQL) { showNotification('No SQL to copy yet.', 'info'); return; }
    navigator.clipboard.writeText(currentSQL).then(() => showNotification('SQL copied to clipboard!', 'success'));
}

function copyLogic() {
    if (!currentLogic) return;
    navigator.clipboard.writeText(currentLogic).then(() => showNotification('Explanation copied!', 'success'));
}

function downloadSQL() {
    if (!currentSQL) { showNotification('No SQL to download yet.', 'info'); return; }
    const blob = new Blob([currentSQL], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neuralquery_${Date.now()}.sql`;
    a.click();
    showNotification('SQL file downloaded!', 'success');
}

function formatSQL() {
    if (!currentSQL) return;
    currentSQL = currentSQL
        .replace(/\b(SELECT|FROM|WHERE|JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION ALL|UNION|ON)\b/gi, '\n$1')
        .replace(/,\s*/g, ',\n    ')
        .trim();
    document.getElementById('sqlOutput').innerHTML = highlightSQL(currentSQL);
    showNotification('SQL formatted!', 'success');
}

function setExample(btn) {
    document.getElementById('nlpInput').value = btn.textContent.trim();
    document.getElementById('nlpInput').focus();
}

function toggleSchema() {
    const area = document.getElementById('schemaArea');
    const txt  = document.getElementById('schemaToggleText');
    const open = area.classList.toggle('open');
    txt.textContent = open ? '− Hide Schema Context' : '+ Add Schema Context (optional)';
}

function toggleDropdown() {
    document.getElementById('dropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
    if (!e.target.closest('.user-menu')) document.getElementById('dropdown').classList.remove('open');
});

// ── Enter key
document.getElementById('nlpInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) handleTranslation();
});

// ── Init 
(function loadPreferences() {
    // Restore saved SQL dialect
    const savedDialect = localStorage.getItem('nq-dialect');
    if (savedDialect) {
        const sel = document.getElementById('dialectSelect');
        if (sel) { sel.value = savedDialect; updateDialectBadge(); }
    }
    // Restore schema-open pref
    if (localStorage.getItem('nq-schema-open') === 'true') {
        const area = document.getElementById('schemaArea');
        const txt  = document.getElementById('schemaToggleText');
        if (area) { area.classList.add('open'); if(txt) txt.textContent = '− Hide Schema Context'; }
    }
})();
switchView('translator');


/* ════════════════════════════════════════════════════════════
   MODAL SYSTEM — NeuralQuery
   Three modals: Detail View | Delete Confirm | Clear Confirm
════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────
const _modal = {
    detailData: {},
    deleteId:   null,
};

// ── Core open / close ──────────────────────────────────────
function openModal(backdropId) {
    const backdrop = document.getElementById(backdropId);
    if (!backdrop) return;
    document.body.classList.add('modal-open');
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => backdrop.classList.add('open'));
    });
}

function closeModal(backdropId) {
    const backdrop = document.getElementById(backdropId);
    if (!backdrop) return;
    backdrop.classList.remove('open');
    backdrop.addEventListener('transitionend', () => {
        backdrop.style.display = 'none';
        document.body.classList.remove('modal-open');
    }, { once: true });
}

function handleBackdropClick(e, backdropId) {
    if (e.target.id === backdropId) closeModal(backdropId);
}

// Close on Escape key
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['detailBackdrop', 'deleteBackdrop', 'clearBackdrop'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.classList.contains('open')) closeModal(id);
    });
});

// ── MODAL 1: Query Detail ──────────────────────────────────
function openDetailModal(query, sql, logic, dialect, createdAt) {
    _modal.detailData = { query, sql, logic, dialect, createdAt };

    // Populate fields
    document.getElementById('detailQuery').textContent  = query;
    document.getElementById('detailLogic').textContent  = logic || 'No explanation available.';
    document.getElementById('detailModalFootTime').textContent = createdAt || '—';
    document.getElementById('detailModalTime').textContent     = createdAt ? `Generated ${createdAt}` : 'Query record';

    // SQL with syntax highlighting
    const cleanSQL = (sql || '').replace(/\\n/g, '\n');
    document.getElementById('detailSQL').innerHTML = highlightSQL(cleanSQL);

    // Dialect pill
    const dialectLabels = {
        postgresql: 'PostgreSQL', standard: 'Standard SQL',
        mysql: 'MySQL', sqlite: 'SQLite'
    };
    document.getElementById('detailDialect').innerHTML =
        `<i class="ri-database-line"></i> ${dialectLabels[dialect] || dialect || 'PostgreSQL'}`;

    // Reset copy button state
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) { copyBtn.innerHTML = '<i class="ri-clipboard-line"></i> Copy SQL'; }

    openModal('detailBackdrop');
}

function modalCopySQL() {
    const sql = (_modal.detailData.sql || '').replace(/\\n/g, '\n');
    if (!sql) return;
    navigator.clipboard.writeText(sql).then(() => {
        // Flash the SQL box
        const box = document.getElementById('detailSQLBox');
        box.classList.remove('copy-flash');
        void box.offsetWidth; // reflow
        box.classList.add('copy-flash');

        // Update button text temporarily
        const btn = document.getElementById('copyBtn');
        btn.innerHTML = '<i class="ri-check-line"></i> Copied!';
        setTimeout(() => {
            btn.innerHTML = '<i class="ri-clipboard-line"></i> Copy SQL';
            box.classList.remove('copy-flash');
        }, 2000);
    });
}

function modalLoadInTranslator() {
    const d = _modal.detailData;
    loadHistory(d.query, d.sql, d.logic);
    closeModal('detailBackdrop');
    showNotification('Query loaded into translator!', 'success');
}

// ── MODAL 2: Delete Confirmation ──────────────────────────
function openDeleteModal(id, previewText) {
    _modal.deleteId = id;
    const preview = document.getElementById('deleteQueryPreview');
    if (preview) preview.textContent = `"${previewText}"`;
    openModal('deleteBackdrop');
}

async function executeDelete() {
    const id  = _modal.deleteId;
    const btn = document.getElementById('deleteConfirmBtn');
    if (!id) return;

    // Loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="ri-loader-4-line"></i> Deleting…';

    await fetch(`/history/${id}`, { method: 'DELETE' });

    const row = document.getElementById('log-row-' + id);
    if (row) {
        row.style.transition = 'opacity 0.3s, transform 0.3s';
        row.style.opacity    = '0';
        row.style.transform  = 'translateX(-10px)';
        setTimeout(() => row.remove(), 300);
    }

    closeModal('deleteBackdrop');
    showNotification('Entry deleted from history.', 'success');

    // Reset button
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="ri-delete-bin-line"></i> Delete';
    }, 400);
}

// ── MODAL 3: Clear All Confirmation ───────────────────────
async function openClearModal() {
    // Show entry count in the warning
    try {
        const res  = await fetch('/history');
        const data = await res.json();
        const count = data.history?.length || 0;
        const lbl = document.getElementById('clearCountLabel');
        if (lbl) lbl.textContent = count > 0 ? `${count} entr${count === 1 ? 'y' : 'ies'}` : 'all entries';
    } catch { /* skip */ }
    openModal('clearBackdrop');
}

async function executeClearAll() {
    const btn = document.querySelector('#clearBackdrop .nq-btn-danger');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ri-loader-4-line"></i> Clearing…'; }

    try {
        const res  = await fetch('/history');
        const data = await res.json();
        if (data.status === 'success') {
            await Promise.all(data.history.map(h =>
                fetch(`/history/${h.id}`, { method: 'DELETE' })
            ));
        }
    } catch { /* silently continue */ }

    // Clear sidebar
    document.getElementById('historyList').innerHTML =
        '<div id="historyEmpty" style="padding:12px;font-size:12px;color:var(--dim)">No queries yet</div>';

    // Clear logs table if visible
    const logsBody = document.getElementById('logsTableBody');
    if (logsBody) {
        logsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No query history yet. Generate your first SQL query above.</td></tr>';
    }

    closeModal('clearBackdrop');
    showNotification('All history cleared successfully.', 'success');

    if (btn) {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="ri-spam-2-line"></i> Clear Everything';
        }, 400);
    }
}