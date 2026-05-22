/**
 * SBCC AI Assistant — draggable chat + settings + agent actions
 * Requires: command-center globals (loadProfile, PROFILE_FIELDS, TASKS, etc.)
 */
(function () {
  const STORAGE_KEY = 'sbcc_ai_settings';
  const DEFAULT_BACKEND = 'http://localhost:3921';

  function detectStorageNs() {
    if (typeof localStorage === 'undefined') return 'sbcc';
    try {
      if (localStorage.getItem('pb_profile') != null || document.title.includes('Pombomb')) return 'pb';
    } catch (_) {}
    return 'sbcc';
  }

  const STORE_NS = detectStorageNs();
  function storeKey(suffix) { return `${STORE_NS}_${suffix}`; }

  const DEFAULT_SETTINGS = {
    backendUrl: DEFAULT_BACKEND,
    activeProvider: 'openai',
    fullAccess: false,
    chatPos: { x: null, y: null },
    chatOpen: false,
    chatCollapsed: false,
    providers: {
      perplexity: { apiKey: '', model: 'sonar-pro' },
      openai: { apiKey: '', model: 'gpt-4o-mini' },
      anthropic: { apiKey: '', model: 'claude-sonnet-4-20250514' },
      google: { apiKey: '', model: 'gemini-2.0-flash' },
    },
    history: [],
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers } };
      const s = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...s,
        providers: { ...DEFAULT_SETTINGS.providers, ...(s.providers || {}) },
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn('SBCC AI settings save failed', e);
    }
  }

  function getSensitiveKeys() {
    if (typeof PROFILE_FIELDS !== 'undefined') {
      return PROFILE_FIELDS.filter((f) => f.sensitive).map((f) => f.key);
    }
    return ['phone', 'ein', 'address', 'city', 'state', 'zip', 'owner_name', 'birth_date', 'birth_place', 'owner_ethnicity'];
  }

  function exportContext(fullAccess) {
    const profile = typeof loadProfile === 'function' ? loadProfile() : {};
    const sensitive = new Set(getSensitiveKeys());
    const safeProfile = {};
    for (const [k, v] of Object.entries(profile)) {
      safeProfile[k] = sensitive.has(k) && !fullAccess ? '[REDACTED]' : v;
    }

    const narratives = {};
    if (typeof POMBOMB_WHAT_WE_DO !== 'undefined') {
      const keys = [
        'POMBOMB_WHAT_WE_DO', 'POMBOMB_WHY_WE_STARTED', 'POMBOMB_COMMUNITY_ISSUES',
        'POMBOMB_MISSION', 'POMBOMB_GRANT_IMPACT', 'POMBOMB_GRANT_10K', 'POMBOMB_CUSTOMERS',
        'POMBOMB_2026_GOALS', 'POMBOMB_THOUGHTS_COMMENTS',
      ];
      keys.forEach((k) => {
        if (typeof window[k] !== 'undefined' && window[k]) narratives[k] = String(window[k]).slice(0, 2000);
      });
    }

    let customNarratives = [];
    try {
      customNarratives = JSON.parse(localStorage.getItem(storeKey('custom_narratives')) || '[]');
    } catch (_) {}

    const activeView = document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';

    return {
      profile: safeProfile,
      profileFields: typeof PROFILE_FIELDS !== 'undefined'
        ? PROFILE_FIELDS.map((f) => ({ key: f.key, label: f.label, sensitive: !!f.sensitive }))
        : [],
      tasks: typeof TASKS !== 'undefined' ? TASKS.slice(0, 80) : [],
      grants: typeof GRANTS !== 'undefined' ? GRANTS : {},
      milestones: typeof MILESTONES !== 'undefined' ? MILESTONES : [],
      edu: typeof EDU_DATA !== 'undefined' ? EDU_DATA.slice(0, 40) : [],
      narratives,
      customNarratives: customNarratives.slice(0, 20),
      currentView: activeView,
      stats: {
        taskCount: typeof TASKS !== 'undefined' ? TASKS.length : 0,
        doneCount: typeof doneMem !== 'undefined' ? doneMem.length : 0,
      },
    };
  }

  function applyActions(actions) {
    if (!Array.isArray(actions) || !actions.length) return [];
    const applied = [];

    for (const a of actions) {
      try {
        if (a.tool === 'fill_profile' && a.key && a.value != null) {
          const el = document.getElementById('pf-' + a.key);
          if (el) {
            el.value = a.value;
            if (typeof saveProfile === 'function') saveProfile();
            applied.push(`Profile: ${a.key}`);
          }
        } else if (a.tool === 'add_task' && typeof loadPbStore === 'function') {
          const t = {
            id: 'ai_' + Date.now(),
            text: a.text,
            url: a.url || '',
            label: a.label || 'AI',
            color: a.color || 'primary',
            category: 'business',
            deadline: a.deadline || 'TBD',
            group: a.group || 'month',
          };
          const list = loadPbStore(storeKey('custom_tasks'), []);
          list.push(t);
          savePbStore(storeKey('custom_tasks'), list);
          if (typeof TASKS !== 'undefined') TASKS.push(t);
          if (typeof updateStats === 'function') updateStats();
          if (typeof renderDashboardUrgent === 'function') renderDashboardUrgent();
          if (typeof renderChecklist === 'function') renderChecklist();
          applied.push(`Task: ${a.text.slice(0, 40)}…`);
        } else if (a.tool === 'add_grant' && typeof loadPbStore === 'function') {
          const sec = a.section || 'monitor';
          const g = {
            name: a.name,
            desc: a.desc,
            amt: a.amt,
            amtColor: a.amtColor || 'green',
            url: a.url,
            why: a.why,
          };
          const store = loadPbStore(storeKey('custom_grants'), {});
          if (!store[sec]) store[sec] = [];
          store[sec].push(g);
          savePbStore(storeKey('custom_grants'), store);
          if (typeof GRANTS !== 'undefined') {
            if (!GRANTS[sec]) GRANTS[sec] = [];
            GRANTS[sec].push(g);
          }
          if (typeof renderGrants === 'function') renderGrants();
          applied.push(`Grant: ${a.name}`);
        } else if (a.tool === 'add_narrative' && typeof loadPbStore === 'function') {
          const item = {
            id: 'ai_cn_' + Date.now(),
            kind: 'single',
            sectionHeading: a.sectionHeading,
            cardTitle: a.cardTitle,
            body: a.body,
          };
          const list = loadPbStore(storeKey('custom_narratives'), []);
          list.push(item);
          savePbStore(storeKey('custom_narratives'), list);
          if (typeof renderCustomNarratives === 'function') renderCustomNarratives();
          applied.push(`Narrative: ${a.cardTitle}`);
        }
      } catch (err) {
        console.warn('Action failed', a, err);
      }
    }
    return applied;
  }

  // ─── Settings UI ───
  function renderSettingsForm() {
    const el = document.getElementById('ai-settings-form');
    if (!el) return;
    const s = loadSettings();
    el.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Backend connection</div>
        <label style="font-size:.68rem;color:var(--muted);display:block;margin-bottom:4px">AI server URL</label>
        <input type="url" id="ai-backend-url" value="${esc(s.backendUrl)}" placeholder="http://localhost:3921" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);background:var(--offset);font:inherit">
        <p style="font-size:.72rem;color:var(--muted);margin-top:8px;line-height:1.45">Run <code style="font-size:.68rem">npm start</code> in the <code style="font-size:.68rem">server/</code> folder. Static GitHub Pages host still works for the dashboard — AI needs this backend.</p>
        <button type="button" class="btn-secondary" id="ai-test-backend" style="margin-top:10px;font-size:.75rem">Test connection</button>
        <span id="ai-backend-status" style="font-size:.72rem;margin-left:8px;color:var(--muted)"></span>
      </div>

      <div class="ai-full-access">
        <label>
          <input type="checkbox" id="ai-full-access" ${s.fullAccess ? 'checked' : ''}>
          <span><strong>FULL ACCESS</strong> — Allow AI to read and fill sensitive fields (EIN, phone, address, DOB, owner info). Off by default. You are responsible for what you send to third-party APIs.</span>
        </label>
        <p class="warn">⚠ With Full Access off, sensitive fields are replaced with [REDACTED] before any API call. The server also blocks fill actions on sensitive keys.</p>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Active synthesis provider</div>
        <select id="ai-active-provider" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);background:var(--offset);font:inherit">
          <option value="openai" ${s.activeProvider === 'openai' ? 'selected' : ''}>OpenAI (agent + tools)</option>
          <option value="anthropic" ${s.activeProvider === 'anthropic' ? 'selected' : ''}>Anthropic (agent + tools)</option>
          <option value="perplexity" ${s.activeProvider === 'perplexity' ? 'selected' : ''}>Perplexity only (search-first)</option>
        </select>
      </div>

      <div class="ai-settings-grid">
        ${providerCard('perplexity', 'Perplexity', 'Required for web search & research. Non-negotiable for external facts.', s, true)}
        ${providerCard('openai', 'OpenAI', 'Agent orchestration + form fill tools.', s)}
        ${providerCard('anthropic', 'Anthropic', 'Agent orchestration + form fill tools.', s)}
        ${providerCard('google', 'Google AI', 'Reserved for future provider plug-in.', s)}
      </div>

      <div class="profile-actions">
        <button type="button" class="btn-primary" id="ai-save-settings">Save AI Settings</button>
        <button type="button" class="btn-secondary" id="ai-clear-history">Clear chat history</button>
      </div>
    `;

    document.getElementById('ai-save-settings')?.addEventListener('click', saveSettingsFromForm);
    document.getElementById('ai-clear-history')?.addEventListener('click', () => {
      const st = loadSettings();
      st.history = [];
      saveSettings(st);
      chatState.history = [];
      renderChatMessages();
      alert('Chat history cleared.');
    });
    document.getElementById('ai-test-backend')?.addEventListener('click', testBackend);
  }

  function providerCard(id, title, desc, s, required) {
    const p = s.providers[id] || {};
    return `<div class="ai-provider-card ${id}">
      <h3>${title}${required ? ' <span style="color:var(--red);font-size:.65rem">REQUIRED FOR SEARCH</span>' : ''}</h3>
      <p style="font-size:.72rem;color:var(--muted);margin-bottom:8px;line-height:1.4">${desc}</p>
      <label>API key</label>
      <input type="password" id="ai-key-${id}" value="${esc(p.apiKey || '')}" placeholder="sk-… or pplx-…" autocomplete="off">
      <label>Model</label>
      <input type="text" id="ai-model-${id}" value="${esc(p.model || '')}" placeholder="Model id">
    </div>`;
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function saveSettingsFromForm() {
    const s = loadSettings();
    s.backendUrl = document.getElementById('ai-backend-url')?.value?.trim() || DEFAULT_BACKEND;
    s.fullAccess = !!document.getElementById('ai-full-access')?.checked;
    s.activeProvider = document.getElementById('ai-active-provider')?.value || 'openai';
    ['perplexity', 'openai', 'anthropic', 'google'].forEach((id) => {
      s.providers[id] = s.providers[id] || {};
      s.providers[id].apiKey = document.getElementById('ai-key-' + id)?.value?.trim() || '';
      s.providers[id].model = document.getElementById('ai-model-' + id)?.value?.trim() || s.providers[id].model;
    });
    saveSettings(s);
    const msg = document.getElementById('ai-settings-saved');
    if (msg) {
      msg.textContent = 'Saved ✓';
      setTimeout(() => { msg.textContent = ''; }, 2500);
    }
  }

  async function testBackend() {
    const status = document.getElementById('ai-backend-status');
    const url = (document.getElementById('ai-backend-url')?.value || DEFAULT_BACKEND).replace(/\/$/, '');
    status.textContent = 'Testing…';
    status.style.color = 'var(--muted)';
    try {
      const res = await fetch(url + '/api/health', { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      status.textContent = data.ok ? 'Connected ✓' : 'Unexpected response';
      status.style.color = data.ok ? 'var(--green)' : 'var(--red)';
    } catch (e) {
      status.textContent = 'Offline — start server/';
      status.style.color = 'var(--red)';
    }
  }

  // ─── Chat UI ───
  const chatState = { history: [], sending: false };

  function createChatDOM() {
    if (document.getElementById('sbcc-ai-root')) return;

    const root = document.createElement('div');
    root.id = 'sbcc-ai-root';
    root.innerHTML = `
      <button type="button" class="sbcc-ai-fab" id="sbcc-ai-fab" aria-label="Open AI assistant" title="AI Assistant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
      <div class="sbcc-ai-panel hidden" id="sbcc-ai-panel">
        <div class="sbcc-ai-header" id="sbcc-ai-drag">
          <div class="sbcc-ai-header-title"><span class="dot" id="sbcc-ai-dot"></span> SBCC Assistant</div>
          <div class="sbcc-ai-header-btns">
            <button type="button" class="sbcc-ai-icon-btn" id="sbcc-ai-settings-btn" title="AI Settings">⚙</button>
            <button type="button" class="sbcc-ai-icon-btn" id="sbcc-ai-collapse" title="Collapse">−</button>
            <button type="button" class="sbcc-ai-icon-btn" id="sbcc-ai-close" title="Close">×</button>
          </div>
        </div>
        <div class="sbcc-ai-messages" id="sbcc-ai-messages"></div>
        <div class="sbcc-ai-status" id="sbcc-ai-status">Ask about your grants, profile, or tasks. Search uses Perplexity.</div>
        <div class="sbcc-ai-input-row">
          <textarea class="sbcc-ai-input" id="sbcc-ai-input" rows="2" placeholder="Ask or ask me to fill a field…"></textarea>
          <button type="button" class="sbcc-ai-send" id="sbcc-ai-send">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const s = loadSettings();
    chatState.history = s.history || [];
    positionPanel(s);
    setupDrag();
    bindChatEvents();
    renderChatMessages();
    updateBackendDot();
  }

  function positionPanel(s) {
    const panel = document.getElementById('sbcc-ai-panel');
    if (!panel) return;
    const x = s.chatPos?.x ?? (window.innerWidth - 420);
    const y = s.chatPos?.y ?? (window.innerHeight - 560);
    panel.style.left = Math.max(8, x) + 'px';
    panel.style.top = Math.max(8, y) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function setupDrag() {
    const header = document.getElementById('sbcc-ai-drag');
    const panel = document.getElementById('sbcc-ai-panel');
    if (!header || !panel) return;

    let dragging = false;
    let startX, startY, origX, origY;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const nx = origX + (e.clientX - startX);
      const ny = origY + (e.clientY - startY);
      panel.style.left = Math.max(0, Math.min(nx, window.innerWidth - 80)) + 'px';
      panel.style.top = Math.max(0, Math.min(ny, window.innerHeight - 60)) + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const s = loadSettings();
      const rect = panel.getBoundingClientRect();
      s.chatPos = { x: rect.left, y: rect.top };
      saveSettings(s);
    });
  }

  function bindChatEvents() {
    document.getElementById('sbcc-ai-fab')?.addEventListener('click', toggleChat);
    document.getElementById('sbcc-ai-close')?.addEventListener('click', () => setChatOpen(false));
    document.getElementById('sbcc-ai-collapse')?.addEventListener('click', toggleCollapse);
    document.getElementById('sbcc-ai-settings-btn')?.addEventListener('click', () => {
      if (typeof switchView === 'function') switchView('ai-settings');
      setChatOpen(false);
    });
    document.getElementById('sbcc-ai-send')?.addEventListener('click', sendMessage);
    document.getElementById('sbcc-ai-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function toggleChat() {
    const panel = document.getElementById('sbcc-ai-panel');
    const fab = document.getElementById('sbcc-ai-fab');
    if (!panel) return;
    const open = panel.classList.contains('hidden');
    setChatOpen(open);
    if (fab) fab.style.display = open ? 'none' : 'flex';
  }

  function setChatOpen(open) {
    const panel = document.getElementById('sbcc-ai-panel');
    const fab = document.getElementById('sbcc-ai-fab');
    if (!panel) return;
    panel.classList.toggle('hidden', !open);
    if (fab) fab.style.display = open ? 'none' : 'flex';
    const s = loadSettings();
    s.chatOpen = open;
    saveSettings(s);
    if (open) document.getElementById('sbcc-ai-input')?.focus();
  }

  function toggleCollapse() {
    const panel = document.getElementById('sbcc-ai-panel');
    panel?.classList.toggle('collapsed');
    const s = loadSettings();
    s.chatCollapsed = panel?.classList.contains('collapsed');
    saveSettings(s);
  }

  function renderChatMessages() {
    const box = document.getElementById('sbcc-ai-messages');
    if (!box) return;
    box.innerHTML = '';
    if (!chatState.history.length) {
      box.innerHTML = '<div class="sbcc-ai-msg system">Hi — I can summarize your command center, research grants via Perplexity, or fill forms. Sensitive data stays blocked unless Full Access is on in AI Settings.</div>';
      return;
    }
    chatState.history.forEach((m) => {
      const div = document.createElement('div');
      div.className = 'sbcc-ai-msg ' + (m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'assistant');
      div.textContent = m.content;
      if (m.mode && m.role === 'assistant') {
        const tag = document.createElement('span');
        tag.className = 'mode-tag';
        tag.textContent = m.mode + (m.intent ? ' · ' + m.intent : '');
        div.appendChild(tag);
      }
      if (m.citations?.length) {
        const cit = document.createElement('div');
        cit.className = 'sbcc-ai-citations';
        cit.innerHTML = m.citations.slice(0, 5).map((c, i) => {
          const u = typeof c === 'string' ? c : c.url || c;
          return `<a href="${u}" target="_blank" rel="noopener">[${i + 1}]</a>`;
        }).join(' ');
        div.appendChild(cit);
      }
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  }

  async function updateBackendDot() {
    const dot = document.getElementById('sbcc-ai-dot');
    if (!dot) return;
    const s = loadSettings();
    const url = (s.backendUrl || DEFAULT_BACKEND).replace(/\/$/, '');
    try {
      const res = await fetch(url + '/api/health', { signal: AbortSignal.timeout(4000) });
      dot.style.background = res.ok ? 'var(--green)' : 'var(--orange)';
    } catch {
      dot.style.background = 'var(--red)';
    }
  }

  async function sendMessage() {
    if (chatState.sending) return;
    const input = document.getElementById('sbcc-ai-input');
    const status = document.getElementById('sbcc-ai-status');
    const text = input?.value?.trim();
    if (!text) return;

    const s = loadSettings();
    chatState.history.push({ role: 'user', content: text });
    input.value = '';
    renderChatMessages();

    chatState.sending = true;
    document.getElementById('sbcc-ai-send').disabled = true;
    status.textContent = 'Thinking…';

    try {
      const url = (s.backendUrl || DEFAULT_BACKEND).replace(/\/$/, '') + '/api/chat';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatState.history.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-12).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: exportContext(s.fullAccess),
          settings: {
            fullAccess: s.fullAccess,
            activeProvider: s.activeProvider,
            providers: s.providers,
            sensitiveKeys: getSensitiveKeys(),
          },
        }),
        signal: AbortSignal.timeout(120000),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      let reply = data.reply || '';
      if (data.actions?.length) {
        const applied = applyActions(data.actions);
        if (applied.length) reply += '\n\n✓ Applied: ' + applied.join(', ');
      }

      chatState.history.push({
        role: 'assistant',
        content: reply,
        mode: data.mode,
        intent: data.intent,
        citations: data.citations,
      });

      s.history = chatState.history.slice(-50);
      saveSettings(s);
      status.textContent = data.mode === 'perplexity' ? 'Answered via Perplexity search' : 'Ready';
    } catch (err) {
      chatState.history.push({
        role: 'assistant',
        content: err.name === 'TimeoutError'
          ? 'Request timed out. Try a shorter question.'
          : `Could not reach AI backend. Start the server: cd server && npm start\n\n(${err.message})`,
      });
      status.textContent = 'Backend offline?';
      updateBackendDot();
    }

    chatState.sending = false;
    document.getElementById('sbcc-ai-send').disabled = false;
    renderChatMessages();
  }

  function init() {
    createChatDOM();
    renderSettingsForm();
    const s = loadSettings();
    if (s.chatOpen) {
      setChatOpen(true);
      document.getElementById('sbcc-ai-fab').style.display = 'none';
    }
    if (s.chatCollapsed) document.getElementById('sbcc-ai-panel')?.classList.add('collapsed');

    // Re-render settings when view opens
    const origSwitch = window.switchView;
    if (typeof origSwitch === 'function') {
      window.switchView = function (name) {
        origSwitch(name);
        if (name === 'ai-settings') renderSettingsForm();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SBCC_AI = { exportContext, applyActions, loadSettings, saveSettings };
})();
