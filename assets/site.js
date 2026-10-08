(() => {
  'use strict';

  const SELF = document.currentScript && document.currentScript.src;

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
  const intro = document.getElementById('stage-intro');
  const immersiveButton = document.getElementById('immersive-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BASE = (SELF || `${location.origin}/assets/site.js`).replace(/[^/]*$/, '');
  const VERSION = '?v=20261008';
  window.COSMOS_BASE = BASE;

  let loading = null;
  let booting = false;
  let introStart = 0;
  let introTimer = 0;

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

  function startIntro() {
    if (!intro || reduceMotion) return false;
    clearTimeout(introTimer);
    intro.classList.remove('is-leaving');
    intro.classList.add('is-active');
    introStart = performance.now();
    return true;
  }

  function endIntro(immediate) {
    if (!intro || !intro.classList.contains('is-active')) return;
    clearTimeout(introTimer);
    if (immediate) { intro.classList.remove('is-active', 'is-leaving'); return; }
    intro.classList.add('is-leaving');
    introTimer = setTimeout(() => intro.classList.remove('is-active', 'is-leaving'), 1500);
  }

  function addScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src + VERSION;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { script.remove(); reject(new Error(`Could not load ${src}`)); };
      document.head.appendChild(script);
    });
  }

  const nextFrames = (n = 2) => new Promise((resolve) => {
    const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

  function fail(message) {
    booting = false;
    loading = null;
    endIntro(true);
    showStatus(message, true);
  }

  async function startViewer() {
    if (loading) return loading;
    const hasIntro = startIntro();
    if (hasIntro) status.classList.add('hidden'); else showStatus('Loading the interactive 3D study…');
    booting = true;

    loading = (async () => {
      if (!window.THREE || !window.THREE.UnrealBloomPass) await addScript(`${BASE}vendor/three-r128.bundle.min.js`);
      if (!window.THREE) throw new Error('three.js did not initialise');
      await nextFrames(2); // let the title card paint before the heavy scene build blocks the thread
      await addScript(`${BASE}cosmos.js`);
    })().catch((error) => {
      console.error('[Biblical Cosmos 3D]', error);
      fail('The 3D study could not start. Check your connection or browser settings, then retry.');
    });
    return loading;
  }

  document.addEventListener('cosmos:ready', () => {
    booting = false;
    status.classList.add('hidden');
    const wait = reduceMotion ? 0 : Math.max(0, 2600 - (performance.now() - introStart));
    introTimer = setTimeout(() => endIntro(false), wait);
  });

  // Only a crash while the scene is being built is fatal. Later errors must never blank a working viewer.
  window.addEventListener('error', (event) => {
    if (booting && event.filename && event.filename.includes('/cosmos.js')) {
      fail('The 3D study encountered a problem while starting. Please retry.');
    }
  });

  if (retryButton) retryButton.addEventListener('click', () => {
    if (window.__cosmosStarted) { location.reload(); return; }
    loading = null;
    document.querySelectorAll('script[src*="cosmos.js"]').forEach((script) => script.remove());
    startViewer();
  });

  /* ---------- Immersive mode: full-screen stage, scroll-wheel zoom and full touch control ---------- */
  let immersive = false;
  async function setImmersive(on) {
    if (!stage || on === immersive) return;
    immersive = on;
    stage.classList.toggle('is-immersive', on);
    document.documentElement.classList.toggle('has-immersive', on);
    if (immersiveButton) {
      immersiveButton.setAttribute('aria-pressed', String(on));
      immersiveButton.setAttribute('aria-label', on ? 'Exit immersive mode' : 'Enter immersive mode');
      immersiveButton.title = on ? 'Exit immersive mode (Esc)' : 'Immersive mode: full-screen with scroll zoom';
    }
    if (on) {
      startViewer();
      if (stage.requestFullscreen) { try { await stage.requestFullscreen({ navigationUI: 'hide' }); } catch (_) { /* CSS fallback is already active */ } }
    } else if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (_) { /* ignore */ }
    }
    const canvas = document.getElementById('c');
    if (canvas) canvas.focus({ preventScroll: true });
  }
  if (immersiveButton) immersiveButton.addEventListener('click', () => setImmersive(!immersive));
  document.addEventListener('cosmos:exit-immersive', () => setImmersive(false));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && immersive) setImmersive(false); });

  if (stage) {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); startViewer(); }
      }, { rootMargin: '700px 0px', threshold: 0.01 });
      observer.observe(stage);
    } else {
      window.setTimeout(startViewer, 250);
    }
  }
})();
