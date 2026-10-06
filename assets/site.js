(() => {
  'use strict';

  const menuButton = document.getElementById('menu-toggle');
  const navigation = document.getElementById('primary-nav');

  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!expanded));
      menuButton.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
      navigation.classList.toggle('is-open', !expanded);
    });

    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a') && window.matchMedia('(max-width: 760px)').matches) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Open navigation');
        navigation.classList.remove('is-open');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Open navigation');
        navigation.classList.remove('is-open');
        menuButton.focus();
      }
    });
  }

  const year = document.getElementById('copyright-year');
  if (year) year.textContent = String(new Date().getFullYear());

  const stage = document.getElementById('viewer-stage');
  const status = document.getElementById('viewer-status');
  const retryButton = document.getElementById('retry-viewer');
  let loading = null;

  function showStatus(message, isError = false) {
    if (!status) return;
    status.classList.remove('hidden');
    status.classList.toggle('status-error', isError);
    const spinner = status.querySelector('.status-spinner');
    if (spinner) spinner.classList.toggle('hidden', isError);
    const copy = status.querySelector('.status-copy');
    if (copy) copy.textContent = message;
    if (retryButton) retryButton.classList.toggle('hidden', !isError);
  }

  function addScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  async function loadThree() {
    if (window.THREE) return;
    const sources = [
      'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'
    ];

    for (const source of sources) {
      try {
        await addScript(source);
        if (window.THREE) return;
      } catch (_) {
        // Try the fallback CDN before reporting a loading error.
      }
    }
    throw new Error('The 3D engine could not be loaded from either CDN.');
  }

  async function startViewer() {
    if (loading) return loading;
    showStatus('Loading the interactive 3D study…');
    loading = (async () => {
      await loadThree();
      await addScript('/assets/cosmos.js');
      if (!status.classList.contains('status-error')) status.classList.add('hidden');
    })().catch((error) => {
      console.error('[Biblical Cosmos 3D]', error);
      showStatus('The 3D study could not start. Check your connection or browser settings, then retry.', true);
      loading = null;
    });
    return loading;
  }

  window.addEventListener('error', (event) => {
    if (event.filename && event.filename.includes('/assets/cosmos.js')) {
      showStatus('The 3D study encountered a problem. Reload the model to try again.', true);
      loading = null;
    }
  });

  if (retryButton) retryButton.addEventListener('click', () => {
    loading = null;
    document.querySelectorAll('script[src="/assets/cosmos.js"]').forEach((script) => script.remove());
    startViewer();
  });

  if (stage) {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startViewer();
        }
      }, { rootMargin: '360px 0px', threshold: 0.01 });
      observer.observe(stage);
    } else {
      window.setTimeout(startViewer, 250);
    }
  }
})();
