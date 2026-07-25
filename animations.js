// animations.js - entrance animations, animated counters and image optimizations
(function () {
  'use strict';
  function parseNumber(text) {
    const n = Number(String(text).replace(/[^\d.-]/g, '')) || 0;
    return n;
  }
  function animateCount(el, to, duration = 700) {
    cancelAnimationFrame(el.__countRaf);
    const from = parseNumber(el.textContent);
    const start = performance.now();
    const diff = to - from;
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(from + diff * eased);
      el.textContent = cur;
      if (t < 1) {
        el.__countRaf = requestAnimationFrame(step);
      } else {
        el.textContent = String(to);
        el.classList.add('pop');
        setTimeout(() => el.classList.remove('pop'), 220);
      }
    }
    el.__countRaf = requestAnimationFrame(step);
  }
  function setupStatObservers() {
    const ids = ['totalDevices', 'availableDevices', 'inUseDevices', 'maintenanceDevices'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('animated-number');
      const initial = parseNumber(el.textContent);
      el.textContent = initial;
      const mo = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          if (m.type === 'characterData' || m.type === 'childList') {
            const newVal = parseNumber(el.textContent);
            animateCount(el, newVal, 800);
          }
        });
      });
      mo.observe(el, { characterData: true, subtree: true, childList: true });
    });
  }
  function setupEntranceAnimations() {
    const selector = [
      '.stat-card',
      '.device-card',
      '.reservation-item',
      '.slot-item',
      '.card',
      '.login-card',
      '.profile-card',
      '.section-header'
    ].join(',');
    const els = Array.from(document.querySelectorAll(selector));
    els.forEach((el) => el.classList.add('anim-hidden'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => { el.classList.add('in-view'); el.classList.remove('anim-hidden'); });
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add('in-view');
          el.classList.remove('anim-hidden');
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => observer.observe(el));
  }
  function optimizeImages() {
    const imgs = Array.from(document.querySelectorAll('img'));
    imgs.forEach((img) => {
      try {
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
        if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
        if (!img.hasAttribute('fetchpriority')) {
          try { img.setAttribute('fetchpriority', 'low'); } catch (e) {}
        }
      } catch (e) {}
    });
    const inlineBgEls = Array.from(document.querySelectorAll('[style*="background-image"]'));
    const bgToObserve = inlineBgEls.filter((el) => {
      const s = getComputedStyle(el).backgroundImage || el.style.backgroundImage;
      return s && s !== 'none' && s.indexOf('url(') !== -1;
    });
    bgToObserve.forEach((el) => {
      const inline = el.style.backgroundImage;
      if (!inline) return;
      el.dataset._bg = inline;
      el.classList.add('lazy-bg');
      el.style.backgroundImage = 'none';
    });
    if (!('IntersectionObserver' in window)) {
      bgToObserve.forEach((el) => {
        const bg = el.dataset._bg;
        if (bg) el.style.backgroundImage = bg;
      });
      return;
    }
    const bgObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const bg = el.dataset._bg;
          if (bg) {
            el.style.backgroundImage = bg;
            el.classList.remove('lazy-bg');
            delete el.dataset._bg;
          }
          bgObserver.unobserve(el);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 10% 0px' });
    bgToObserve.forEach((el) => bgObserver.observe(el));
  }
  function observeDynamicContent() {
    if (!('MutationObserver' in window)) return;
    const body = document.body;
    const mo = new MutationObserver((mutations) => {
      let needOptimizeImgs = false;
      let needBgOptimization = false;
      mutations.forEach((m) => {
        if (m.addedNodes && m.addedNodes.length) {
          needOptimizeImgs = true;
          needBgOptimization = true;
        } else if (m.type === 'attributes' && m.attributeName === 'style') {
          needBgOptimization = true;
        }
      });
      if (needOptimizeImgs) optimizeImages();
      if (needBgOptimization) {
        const inlineBgEls = Array.from(document.querySelectorAll('[style*="background-image"]'));
        inlineBgEls.forEach((el) => {
          const s = el.style.backgroundImage;
          if (s && s.indexOf('url(') !== -1 && !el.dataset._bg) {
            el.dataset._bg = s;
            el.classList.add('lazy-bg');
            el.style.backgroundImage = 'none';
          }
        });
      }
    });
    mo.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }
  function init() {
    setupEntranceAnimations();
    setupStatObservers();
    optimizeImages();
    observeDynamicContent();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.vibeAnimations = { animateCount, optimizeImages };
})();