/**
 * SBCC API URLs — auto same-origin when dashboard + api folder uploaded together.
 */
(function () {
  const AUTO = 'auto';

  function pageDir() {
    const p = window.location.pathname || '/';
    if (p.endsWith('.html')) return p.replace(/\/[^/]+$/, '');
    return p.replace(/\/$/, '') || '';
  }

  function resolveApiBase(settings) {
    const custom = (settings?.backendUrl || '').trim();
    if (custom && custom !== AUTO) return custom.replace(/\/$/, '');

    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      return window.location.origin + pageDir() + '/api';
    }

    return 'http://127.0.0.1:3921/api';
  }

  function endpoints(base) {
    const b = base.replace(/\/$/, '');
    return {
      health: b + '/health.php',
      chat: b + '/chat.php',
      proxy: (url) => b + '/research/proxy.php?url=' + encodeURIComponent(url),
    };
  }

  window.SBCC_API = {
    AUTO,
    resolveApiBase,
    endpoints,
    pageDir,
  };
})();
