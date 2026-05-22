/**
 * SBCC Void audit + global search
 * Red ✕ on checkable items → audit-safe void log with Reason + Opportunity fields
 */
(function () {
  function detectStorageNs() {
    try {
      if (localStorage.getItem('pb_profile') != null || document.title.includes('Pombomb')) return 'pb';
    } catch (_) {}
    return 'sbcc';
  }

  const NS = detectStorageNs();
  const VOID_KEY = NS + '_void_audit';

  function loadVoidMap() {
    try {
      const raw = localStorage.getItem(VOID_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveVoidMap(map) {
    try {
      localStorage.setItem(VOID_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function isVoided(id) {
    return !!loadVoidMap()[id];
  }

  function getVoidRecord(id) {
    return loadVoidMap()[id] || null;
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return escHtml(s).replace(/'/g, '&#39;');
  }

  let voidTarget = null;

  function ensureVoidModal() {
    if (document.getElementById('void-modal-overlay')) return;
    const el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'void-modal-overlay';
    el.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-title" id="void-modal-title">Void item</div>
        <div class="modal-sub" id="void-modal-sub">Audit record — voided items stay visible with reason. Search finds them later.</div>
        <form id="void-modal-form">
          <div class="profile-field" style="margin-bottom:10px">
            <label>Item</label>
            <div id="void-item-preview" style="font-size:.78rem;padding:8px 10px;background:var(--offset);border-radius:var(--r);line-height:1.4"></div>
          </div>
          <div class="profile-field" style="margin-bottom:10px">
            <label for="void-reason">Reason <span style="color:var(--red)">*</span></label>
            <textarea id="void-reason" required placeholder="Why is this voided? (required for audit)" style="min-height:72px"></textarea>
          </div>
          <div class="profile-field" style="margin-bottom:10px">
            <label for="void-opportunity">Opportunity for someone else</label>
            <input id="void-opportunity" type="text" placeholder="Name, org, or contact — so others can look this up">
          </div>
          <div class="profile-field" style="margin-bottom:10px">
            <label for="void-notes">Additional notes</label>
            <textarea id="void-notes" placeholder="Optional audit detail" style="min-height:56px"></textarea>
          </div>
        </form>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="void-modal-cancel">Cancel</button>
          <button type="button" class="btn-primary" id="void-modal-submit" style="background:var(--red)">Void item</button>
        </div>
      </div>`;
    el.addEventListener('click', (e) => {
      if (e.target === el) closeVoidModal();
    });
    document.body.appendChild(el);
    document.getElementById('void-modal-cancel')?.addEventListener('click', closeVoidModal);
    document.getElementById('void-modal-submit')?.addEventListener('click', submitVoid);
  }

  function openVoidModal(id, meta) {
    ensureVoidModal();
    const existing = getVoidRecord(id);
    voidTarget = { id, ...meta };

    const title = document.getElementById('void-modal-title');
    const sub = document.getElementById('void-modal-sub');
    const preview = document.getElementById('void-item-preview');
    const form = document.getElementById('void-modal-form');
    const submit = document.getElementById('void-modal-submit');

    if (existing) {
      title.textContent = 'Void record (audit)';
      sub.textContent = 'This item was voided. Record is permanent for audit lookup.';
      preview.innerHTML = `<div class="void-readonly">
        <p><strong>${escHtml(existing.taskText || meta.taskText || id)}</strong></p>
        <dl>
          <dt>Voided</dt><dd>${escHtml(existing.voidedAt || '')}</dd>
          <dt>Reason</dt><dd>${escHtml(existing.reason)}</dd>
          ${existing.opportunityFor ? `<dt>Opportunity for</dt><dd>${escHtml(existing.opportunityFor)}</dd>` : ''}
          ${existing.notes ? `<dt>Notes</dt><dd>${escHtml(existing.notes)}</dd>` : ''}
        </dl>
      </div>`;
      form.style.display = 'none';
      submit.style.display = 'none';
    } else {
      title.textContent = 'Void item';
      sub.textContent = 'Audit record — voided items stay visible with reason. Search finds them later.';
      preview.textContent = meta.taskText || id;
      form.style.display = 'block';
      submit.style.display = '';
      document.getElementById('void-reason').value = '';
      document.getElementById('void-opportunity').value = '';
      document.getElementById('void-notes').value = '';
    }

    document.getElementById('void-modal-overlay').classList.add('open');
  }

  function closeVoidModal() {
    document.getElementById('void-modal-overlay')?.classList.remove('open');
    voidTarget = null;
  }

  function submitVoid() {
    if (!voidTarget) return;
    const reason = document.getElementById('void-reason')?.value?.trim();
    if (!reason) {
      document.getElementById('void-reason')?.focus();
      return;
    }
    const map = loadVoidMap();
    map[voidTarget.id] = {
      taskId: voidTarget.id,
      taskText: voidTarget.taskText || '',
      label: voidTarget.label || '',
      group: voidTarget.group || '',
      reason,
      opportunityFor: document.getElementById('void-opportunity')?.value?.trim() || '',
      notes: document.getElementById('void-notes')?.value?.trim() || '',
      voidedAt: new Date().toISOString(),
    };
    saveVoidMap(map);
    if (typeof doneMem !== 'undefined' && doneMem.includes(voidTarget.id)) {
      doneMem = doneMem.filter((x) => x !== voidTarget.id);
      try {
        localStorage.setItem(NS + '_done', JSON.stringify(doneMem));
      } catch (_) {}
    }
    closeVoidModal();
    refreshAllTaskViews();
  }

  window.openVoidModal = openVoidModal;

  function voidButtonHtml(id, taskText, meta) {
    const v = isVoided(id);
    return `<button type="button" class="task-void-btn${v ? ' voided' : ''}" title="${v ? 'View void record' : 'Void item'}" data-void-id="${escAttr(id)}" data-void-text="${escAttr(taskText)}" data-void-label="${escAttr(meta.label || '')}" data-void-group="${escAttr(meta.group || '')}" aria-label="Void">✕</button>`;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.task-void-btn');
    if (!btn) return;
    e.stopPropagation();
    openVoidModal(btn.dataset.voidId, {
      taskText: btn.dataset.voidText || '',
      label: btn.dataset.voidLabel || '',
      group: btn.dataset.voidGroup || '',
    });
  });

  function voidNoteHtml(id) {
    const rec = getVoidRecord(id);
    if (!rec) return '';
    const opp = rec.opportunityFor ? ` · Opportunity: ${escHtml(rec.opportunityFor)}` : '';
    return `<span class="task-void-note"><strong>Voided:</strong> ${escHtml(rec.reason)}${opp}</span>`;
  }

  function refreshAllTaskViews() {
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderDashboardUrgent === 'function') renderDashboardUrgent();
    if (typeof renderDashboardMonth === 'function') renderDashboardMonth();
    if (typeof renderChecklist === 'function') renderChecklist();
    if (typeof renderEdu === 'function') renderEdu();
  }

  function wrapRenderTaskItem() {
    if (typeof renderTaskItem !== 'function' || renderTaskItem._voidWrapped) return;
    const orig = renderTaskItem;
    window.renderTaskItem = function (t, compact) {
      const lc = labelColorMap[t.color] || labelColorMap.primary;
      const dn = isDone(t.id);
      const vd = isVoided(t.id);
      const div = document.createElement('div');
      div.className = 'task-item' + (dn && !vd ? ' done' : '') + (vd ? ' voided' : '');
      if (!vd) div.onclick = () => toggleDone(t.id);

      const safeText = escHtml(t.text);
      div.innerHTML = `
        <input type="checkbox" ${dn && !vd ? 'checked' : ''} ${vd ? 'disabled' : ''} onclick="event.stopPropagation();${vd ? '' : `toggleDone('${escAttr(t.id)}')`}">
        <div style="flex:1;min-width:0">
          <div class="task-text-row">
            <div class="task-text">${safeText}${t.url ? `<a href="${escAttr(t.url)}" target="_blank" rel="noopener" class="task-link" onclick="event.stopPropagation()">↗ Visit</a>` : ''}</div>
            ${voidButtonHtml(t.id, t.text, { label: t.label, group: t.group, deadline: t.deadline })}
          </div>
          ${voidNoteHtml(t.id)}
          ${!compact ? `<span class="task-deadline">${escHtml(t.deadline)}</span>` : ''}
        </div>
        <div class="task-meta">
          <span class="task-label" style="background:${lc.bg};color:${lc.color}">${escHtml(t.label)}</span>
        </div>`;
      return div;
    };
    window.renderTaskItem._voidWrapped = true;
  }

  function wrapToggleDone() {
    if (typeof toggleDone !== 'function' || toggleDone._voidWrapped) return;
    const orig = toggleDone;
    window.toggleDone = function (id) {
      if (isVoided(id)) return;
      orig(id);
    };
    window.toggleDone._voidWrapped = true;
  }

  function wrapRenderEdu() {
    if (typeof renderEdu !== 'function' || renderEdu._voidWrapped) return;
    const orig = renderEdu;
    window.renderEdu = function () {
      const table = document.getElementById('edu-table');
      if (!table) return orig();
      const phaseColors = { 'Quick Wins': 'gold', 'Production Skills': 'blue', 'Business Fundamentals': 'green', 'Advanced Skills': 'purple' };
      table.innerHTML = `<thead><tr>
        <th>Wk</th><th>Phase</th><th>Course</th><th>Platform</th><th>Time</th><th>Cert</th><th>Done</th>
      </tr></thead>`;
      const tbody = document.createElement('tbody');
      EDU_DATA.forEach((r) => {
        const eid = 'edu_' + r.week;
        const dn = isDone(eid);
        const vd = isVoided(eid);
        const lc = labelColorMap[phaseColors[r.phase]] || labelColorMap.primary;
        const tr = document.createElement('tr');
        if (dn && !vd) tr.className = 'done-row';
        if (vd) tr.className = 'tr-voided';
        tr.innerHTML = `
          <td style="font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums">${r.week}</td>
          <td><span class="task-label" style="background:${lc.bg};color:${lc.color}">${escHtml(r.phase)}</span></td>
          <td><a href="${escAttr(r.url)}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:500">${escHtml(r.course)}</a></td>
          <td style="color:var(--muted)">${escHtml(r.platform)}</td>
          <td style="color:var(--muted);font-variant-numeric:tabular-nums">${escHtml(r.hours)}</td>
          <td>${r.cert ? '<span style="color:var(--green);font-size:1rem">✓</span>' : '<span style="color:var(--faint)">–</span>'}</td>
          <td class="edu-void-cell">
            <input type="checkbox" ${dn && !vd ? 'checked' : ''} ${vd ? 'disabled' : ''} onchange="${vd ? '' : `toggleDone('${eid}')`}">
            ${voidButtonHtml(eid, r.course, { label: 'EDU', group: 'education', phase: r.phase })}
          </td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      EDU_DATA.forEach((r) => {
        if (!TASKS.find((t) => t.id === 'edu_' + r.week)) {
          TASKS.push({ id: 'edu_' + r.week, text: r.course, url: r.url, label: 'EDU', color: 'gold', category: 'education', deadline: 'Week ' + r.week, group: 'edu' });
        }
      });
    };
    window.renderEdu._voidWrapped = true;
  }

  function wrapUpdateStats() {
    if (typeof updateStats !== 'function' || updateStats._voidWrapped) return;
    const orig = updateStats;
    window.updateStats = function () {
      const total = typeof TASKS !== 'undefined' ? TASKS.length : 0;
      const voidedCount = typeof TASKS !== 'undefined' ? TASKS.filter((t) => isVoided(t.id)).length : 0;
      const doneCount = typeof TASKS !== 'undefined' ? TASKS.filter((t) => isDone(t.id) && !isVoided(t.id)).length : 0;
      const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
      const pctEl = document.getElementById('overall-pct');
      const barEl = document.getElementById('overall-bar');
      const doneEl = document.getElementById('stat-done');
      const subEl = document.getElementById('stat-sub');
      if (pctEl) pctEl.textContent = pct + '%';
      if (barEl) barEl.style.width = pct + '%';
      if (doneEl) doneEl.textContent = doneCount;
      if (subEl) subEl.textContent = 'of ' + total + ' total' + (voidedCount ? ' · ' + voidedCount + ' voided' : '');
    };
    window.updateStats._voidWrapped = true;
  }

  // ─── Global search ───
  function collectSearchCorpus() {
    const items = [];
    const voidMap = loadVoidMap();

    Object.values(voidMap).forEach((v) => {
      items.push({
        type: 'Void record',
        title: v.taskText || v.taskId,
        snippet: [v.reason, v.opportunityFor, v.notes].filter(Boolean).join(' · '),
        void: true,
        view: 'checklist',
        id: v.taskId,
      });
    });

    if (typeof TASKS !== 'undefined') {
      TASKS.forEach((t) => {
        if (voidMap[t.id]) return;
        items.push({
          type: 'Task',
          title: t.text,
          snippet: [t.label, t.deadline, t.group].filter(Boolean).join(' · '),
          view: t.group === 'urgent' || t.group === 'month' ? 'dashboard' : 'checklist',
        });
      });
    }

    if (typeof GRANTS !== 'undefined') {
      Object.entries(GRANTS).forEach(([sec, list]) => {
        (list || []).forEach((g) => {
          items.push({ type: 'Grant', title: g.name, snippet: [g.amt, g.desc, g.why, sec].join(' · '), view: 'grants' });
        });
      });
    }

    if (typeof loadProfile === 'function' && typeof PROFILE_FIELDS !== 'undefined') {
      const p = loadProfile();
      PROFILE_FIELDS.forEach((f) => {
        const val = p[f.key];
        if (val) items.push({ type: 'Profile', title: f.label, snippet: String(val).slice(0, 120), view: 'profile' });
      });
    }

    const narrativeKeys = [
      ['POMBOMB_WHAT_WE_DO', 'What we do', 'narrative'],
      ['POMBOMB_MISSION', 'Mission', 'narrative'],
      ['POMBOMB_GRANT_10K', 'Grant $10K', 'narrative'],
      ['POMBOMB_2026_GOALS', '2026 Goals', 'narrative'],
    ];
    narrativeKeys.forEach(([key, label, view]) => {
      if (typeof window[key] !== 'undefined' && window[key]) {
        items.push({ type: 'Grant copy', title: label, snippet: String(window[key]).slice(0, 140), view });
      }
    });
    if (typeof window !== 'undefined') {
      Object.keys(window)
        .filter((k) => k.startsWith('POMBOMB_') && typeof window[k] === 'string' && window[k].length > 30)
        .forEach((k) => {
          if (narrativeKeys.some(([key]) => key === k)) return;
          items.push({
            type: 'Grant copy',
            title: k.replace(/^POMBOMB_/, '').replace(/_/g, ' '),
            snippet: String(window[k]).slice(0, 140),
            view: 'narrative',
          });
        });
    }

    try {
      const key = NS + '_custom_narratives';
      const list =
        typeof loadPbStore === 'function'
          ? loadPbStore(key, [])
          : JSON.parse(localStorage.getItem(key) || '[]');
      list.forEach((n) => {
        items.push({
          type: 'Custom narrative',
          title: n.cardTitle || n.sectionHeading,
          snippet: (n.body || n.shortBody || '').slice(0, 140),
          view: 'narrative',
        });
      });
    } catch (_) {}

    return items;
  }

  function runSearch(query) {
    const box = document.getElementById('sbcc-search-results');
    if (!box) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      box.classList.remove('open');
      box.innerHTML = '';
      return;
    }

    const hits = collectSearchCorpus().filter((item) => {
      const hay = (item.title + ' ' + item.snippet + ' ' + item.type).toLowerCase();
      return hay.includes(q);
    });

    if (!hits.length) {
      box.innerHTML = '<div class="search-empty">No matches for “' + escHtml(query) + '”</div>';
      box.classList.add('open');
      return;
    }

    box.innerHTML = hits
      .slice(0, 40)
      .map(
        (h, i) =>
          `<div class="search-result-item${h.void ? ' search-result-void' : ''}" data-idx="${i}">
            <div class="search-result-type">${escHtml(h.type)}</div>
            <div class="search-result-title">${escHtml(h.title)}</div>
            <div class="search-result-snippet">${escHtml(h.snippet)}</div>
          </div>`
      )
      .join('');
    box.classList.add('open');

    box.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        const h = hits[i];
        if (typeof switchView === 'function') switchView(h.view || 'dashboard');
        box.classList.remove('open');
        if (h.void && h.id) setTimeout(() => openVoidModal(h.id, { taskText: h.title }), 300);
      });
    });
  }

  function injectSearchBar() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('sbcc-global-search')) return;

    const wrap = document.createElement('div');
    wrap.className = 'global-search-wrap';
    wrap.innerHTML = `
      <input type="search" id="sbcc-global-search" class="global-search-input" placeholder="Search tasks, void records, grants…" autocomplete="off">
      <div id="sbcc-search-results" class="global-search-results"></div>`;

    const h1 = topbar.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', wrap);
    else topbar.prepend(wrap);

    const input = document.getElementById('sbcc-global-search');
    let timer;
    input?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => runSearch(input.value), 180);
    });
    input?.addEventListener('focus', () => {
      if (input.value.trim()) runSearch(input.value);
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) document.getElementById('sbcc-search-results')?.classList.remove('open');
    });
  }

  function init() {
    wrapToggleDone();
    wrapRenderTaskItem();
    wrapRenderEdu();
    wrapUpdateStats();
    ensureVoidModal();
    injectSearchBar();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', refreshAllTaskViews);
    } else {
      refreshAllTaskViews();
    }
  }

  init();
  window.SBCC_VOID = { loadVoidMap, isVoided, getVoidRecord, runSearch, collectSearchCorpus };
})();
