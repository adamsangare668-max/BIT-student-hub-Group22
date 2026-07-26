/* ============================================================
   BIT STUDY HUB — Application principale
   Fonctionnalités: theme, navigation, recherche, toast, etc.
   ============================================================ */

const BIT = (() => {

  // ============== ÉTAT GLOBAL ==============
  const state = {
    theme: localStorage.getItem('bit-theme') || 'auto',
    mobileMenuOpen: false,
    searchData: null,
    courses: null,
    exams: null,
    contributors: null,
    flashcards: null,
  };

  // ============== THÈME (DARK / LIGHT / AUTO) ==============
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('bit-theme', theme);

    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }

    // Mettre à jour les boutons
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.setAttribute('aria-label', `Thème: ${theme}`);
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const isAuto = state.theme === 'auto';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveDark = isAuto ? prefersDark : current === 'dark';

    // Si on est en auto + dark → switch to explicit light
    // Si on est en auto + light → switch to explicit dark
    // Sinon basculer
    if (isAuto) {
      applyTheme(effectiveDark ? 'light' : 'dark');
    } else {
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }
  }

  // ============== MENU MOBILE ==============
  function toggleMobileMenu() {
    state.mobileMenuOpen = !state.mobileMenuOpen;
    const menu = document.querySelector('.mobile-menu');
    const toggle = document.querySelector('.mobile-menu-toggle');
    if (menu) menu.classList.toggle('active', state.mobileMenuOpen);
    if (toggle) toggle.setAttribute('aria-expanded', state.mobileMenuOpen);
    document.body.style.overflow = state.mobileMenuOpen ? 'hidden' : '';
  }

  // ============== TOASTS ==============
  function showToast(title, message = '', type = 'info', duration = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'check-circle', error: 'alert', info: 'info' };
    toast.innerHTML = `
      ${iconHTML(icons[type] || 'info', 24, 'toast-icon')}
      <div class="toast-content">
        <div class="toast-title">${escapeHTML(title)}</div>
        ${message ? `<div class="toast-message">${escapeHTML(message)}</div>` : ''}
      </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ============== UTILITAIRES ==============
  function escapeHTML(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[s]);
  }

  function slugify(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function resolveRelativePath(targetPath) {
    const [path, query = ''] = targetPath.split('?');
    const currentSegments = window.location.pathname.split('/').filter(Boolean);
    const targetSegments = path.split('/').filter(Boolean);
    const currentDir = currentSegments.slice(0, -1);
    let common = 0;
    while (common < currentDir.length && common < targetSegments.length && currentDir[common] === targetSegments[common]) {
      common++;
    }
    const prefix = '../'.repeat(currentDir.length - common);
    const relative = targetSegments.slice(common).join('/');
    return `${prefix}${relative}${query ? `?${query}` : ''}`;
  }

  async function loadJSON(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error(`Erreur chargement ${path}:`, err);
      return null;
    }
  }

  function debounce(fn, delay = 200) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============== RECHERCHE GLOBALE ==============
  async function ensureSearchData() {
    if (state.searchData) return state.searchData;
    const [courses, exams, contributors, flashcards] = await Promise.all([
      loadJSON('data/courses.json'),
      loadJSON('data/exams.json'),
      loadJSON('data/contributors.json'),
      loadJSON('data/flashcards.json'),
    ]);
    state.courses = courses;
    state.exams = exams;
    state.contributors = contributors;
    state.flashcards = flashcards;

    const items = [];
    if (courses) {
      courses.courses.forEach(c => {
        items.push({
          type: 'course', label: c.title, sub: `${c.code} • ${c.semester}`,
          href: resolveRelativePath(c.index_url), icon: iconForCategory(c.category),
          color: colorForCategory(c.category), keywords: [c.title, c.code, c.description].join(' ').toLowerCase()
        });
        if (c.chapters) {
          c.chapters.forEach(ch => {
            items.push({
              type: 'chapter', label: ch.title, sub: `Chapitre • ${c.title}`,
              href: resolveRelativePath(ch.url),
              icon: 'book', color: colorForCategory(c.category),
              keywords: `${ch.title} ${c.title}`.toLowerCase()
            });
          });
        }
      });
    }
    if (exams) {
      exams.exams.forEach(e => {
        items.push({
          type: 'exam', label: e.titre, sub: `${e.matiere} • ${e.semester}`,
          href: resolveRelativePath(e.index_url),
          icon: 'exam', color: colorForCategory(e.category),
          keywords: `${e.titre} ${e.matiere} ${e.type} ${e.semester}`.toLowerCase()
        });
      });
    }
    if (flashcards) {
      flashcards.cards.forEach(card => {
        items.push({
          type: 'flashcard', label: card.front.slice(0, 60) + (card.front.length > 60 ? '…' : ''),
          sub: `Flashcard • ${card.difficulty}`,
          href: resolveRelativePath(`flashcards.html?card=${card.id}`),
          icon: 'cards', color: '#7E57C2',
          keywords: `${card.front} ${card.back} ${card.tags.join(' ')}`.toLowerCase()
        });
      });
    }
    state.searchData = items;
    return items;
  }

  function search(query, items) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/);
    return items
      .map(item => {
        let score = 0;
        tokens.forEach(tok => {
          if (item.label.toLowerCase().includes(tok)) score += 10;
          if (item.sub && item.sub.toLowerCase().includes(tok)) score += 5;
          if (item.keywords && item.keywords.includes(tok)) score += 3;
        });
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function initGlobalSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');
    if (!searchInput || !searchResults) return;

    let items = null;
    ensureSearchData().then(data => { items = data; });

    const performSearch = debounce((query) => {
      if (!items || !query || query.length < 2) {
        searchResults.classList.remove('active');
        searchResults.innerHTML = '';
        return;
      }
      const results = search(query, items);
      if (results.length === 0) {
        searchResults.innerHTML = `
          <div class="search-result-item" style="cursor:default">
            <div class="search-result-icon" style="background: var(--bit-bg-alt); color: var(--bit-text-muted)">
              ${iconHTML('search', 20)}
            </div>
            <div class="search-result-content">
              <div class="search-result-title">Aucun résultat</div>
              <div class="search-result-meta">Essayez d'autres mots-clés</div>
            </div>
          </div>`;
        searchResults.classList.add('active');
        return;
      }
      const typeLabels = { course: 'Cours', chapter: 'Chapitre', exam: 'Examen', flashcard: 'Flashcard' };
      searchResults.innerHTML = results.map(r => `
        <a href="${r.href}" class="search-result-item">
          <div class="search-result-icon" style="background: ${r.color}20; color: ${r.color}">
            ${iconHTML(r.icon, 20)}
          </div>
          <div class="search-result-content">
            <div class="search-result-title">${escapeHTML(r.label)}</div>
            <div class="search-result-meta">${escapeHTML(r.sub)} • ${typeLabels[r.type]}</div>
          </div>
          ${iconHTML('chevron-right', 16)}
        </a>
      `).join('');
      searchResults.classList.add('active');
    }, 200);

    searchInput.addEventListener('input', e => performSearch(e.target.value));
    searchInput.addEventListener('focus', e => {
      if (e.target.value.length >= 2) performSearch(e.target.value);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-box')) {
        searchResults.classList.remove('active');
      }
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.blur();
        searchResults.classList.remove('active');
      }
    });
  }

  // ============== HEADER & FOOTER INJECTION ==============
  // Calcule automatiquement le préfixe '../' selon la profondeur de la page courante
  function computePrefix() {
    const path = window.location.pathname;
    // Compter les '/' après le premier (qui est le root)
    // Ex: /cours/python/index.html → 2 sous-dossiers → '../../'
    // Ex: /cours.html → 0 sous-dossier → ''
    // Ex: /index.html → 0 → ''
    const parts = path.split('/').filter(Boolean);
    // Le dernier élément est le fichier, donc depth = parts.length - 1
    const depth = Math.max(0, parts.length - 1);
    return '../'.repeat(depth);
  }

  function getNavHTML(activePage, prefix = '') {
    return `
      <a href="${prefix}index.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">
        ${iconHTML('home', 18)} <span>Accueil</span>
      </a>
      <a href="${prefix}cours.html" class="nav-link ${activePage === 'cours' ? 'active' : ''}">
        ${iconHTML('book', 18)} <span>Cours</span>
      </a>
      <a href="${prefix}semestres.html" class="nav-link ${activePage === 'semestres' ? 'active' : ''}">
        ${iconHTML('graduation', 18)} <span>Semestres</span>
      </a>
      <a href="${prefix}examens.html" class="nav-link ${activePage === 'examens' ? 'active' : ''}">
        ${iconHTML('exam', 18)} <span>Examens</span>
      </a>
      <a href="${prefix}flashcards.html" class="nav-link ${activePage === 'flashcards' ? 'active' : ''}">
        ${iconHTML('cards', 18)} <span>Flashcards</span>
      </a>
      <a href="${prefix}leaderboard.html" class="nav-link ${activePage === 'leaderboard' ? 'active' : ''}">
        ${iconHTML('trophy', 18)} <span>Classement</span>
      </a>
    `;
  }

  function getHeaderHTML(activePage, isSubpage = false) {
    // Toujours calculer le prefix automatiquement selon la profondeur réelle
    const prefix = computePrefix();
    const navHTML = getNavHTML(activePage, prefix);

    return `
    <a href="#main" class="skip-link">Aller au contenu</a>
    <header class="site-header">
      <div class="header-inner">
        <a href="${prefix}index.html" class="logo">
          <img src="${prefix}assets/img/bit-logo.jpeg" alt="Logo BIT" class="logo-img">
          <span class="logo-text">
            <span class="logo-title">BIT<span class="accent">·</span>Study<span class="accent">·</span>Hub</span>
            <span class="logo-subtitle">Computer Science · BIT</span>
          </span>
        </a>
        <nav class="main-nav" aria-label="Navigation principale">
          ${navHTML}
        </nav>
        <div class="header-actions">
          <button class="theme-toggle" onclick="BIT.toggleTheme()" aria-label="Basculer le thème">
            ${iconHTML('sun', 20)}
            ${iconHTML('moon', 20)}
          </button>
          <a href="${prefix}contribution.html" class="btn btn-primary btn-sm">
            ${iconHTML('upload', 16)} <span>Contribuer</span>
          </a>
          <button class="mobile-menu-toggle" onclick="BIT.toggleMobileMenu()" aria-label="Menu">
            ${iconHTML('menu', 20)}
          </button>
        </div>
      </div>
    </header>
    <div class="mobile-menu" id="mobile-menu">
      <a href="${prefix}index.html" class="mobile-nav-link ${activePage === 'home' ? 'active' : ''}">
        ${iconHTML('home', 24)} Accueil
      </a>
      <a href="${prefix}cours.html" class="mobile-nav-link ${activePage === 'cours' ? 'active' : ''}">
        ${iconHTML('book', 24)} Cours
      </a>
      <a href="${prefix}semestres.html" class="mobile-nav-link ${activePage === 'semestres' ? 'active' : ''}">
        ${iconHTML('graduation', 24)} Semestres
      </a>
      <a href="${prefix}examens.html" class="mobile-nav-link ${activePage === 'examens' ? 'active' : ''}">
        ${iconHTML('exam', 24)} Examens
      </a>
      <a href="${prefix}flashcards.html" class="mobile-nav-link ${activePage === 'flashcards' ? 'active' : ''}">
        ${iconHTML('cards', 24)} Flashcards
      </a>
      <a href="${prefix}leaderboard.html" class="mobile-nav-link ${activePage === 'leaderboard' ? 'active' : ''}">
        ${iconHTML('trophy', 24)} Classement
      </a>
      <a href="${prefix}contribution.html" class="mobile-nav-link ${activePage === 'contribution' ? 'active' : ''}">
        ${iconHTML('upload', 24)} Contribuer
      </a>
      <a href="${prefix}a-propos.html" class="mobile-nav-link ${activePage === 'a-propos' ? 'active' : ''}">
        ${iconHTML('info', 24)} À propos
      </a>
    </div>`;
  }

  function getFooterHTML(isSubpage = false) {
    const prefix = computePrefix();
    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <h3>BIT<span class="accent">·</span>Study<span class="accent">·</span>Hub</h3>
            <p>La plateforme collaborative des étudiants en Computer Science du Burkina Institute of Technology. Centralisez, partagez et réussissez ensemble.</p>
            <div class="footer-social">
              <a href="#" aria-label="Facebook">${iconHTML('facebook', 18)}</a>
              <a href="#" aria-label="Twitter">${iconHTML('twitter', 18)}</a>
              <a href="#" aria-label="Telegram">${iconHTML('telegram', 18)}</a>
              <a href="#" aria-label="WhatsApp">${iconHTML('whatsapp', 18)}</a>
              <a href="#" aria-label="GitHub">${iconHTML('github', 18)}</a>
            </div>
          </div>
          <div class="footer-col">
            <h4>Ressources</h4>
            <ul>
              <li><a href="${prefix}cours.html">Cours</a></li>
              <li><a href="${prefix}examens.html">Examens</a></li>
              <li><a href="${prefix}flashcards.html">Flashcards</a></li>
              <li><a href="${prefix}semestres.html">Semestres</a></li>
              <li><a href="${prefix}cours.html?semester=S1">Semestre 1</a></li>
              <li><a href="${prefix}cours.html?semester=S2">Semestre 2</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Communauté</h4>
            <ul>
              <li><a href="${prefix}contribution.html">Contribuer</a></li>
              <li><a href="${prefix}leaderboard.html">Classement</a></li>
              <li><a href="${prefix}a-propos.html">À propos</a></li>
              <li><a href="${prefix}a-propos.html#team">L'équipe</a></li>
              <li><a href="${prefix}a-propos.html#contact">Contact</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Institution</h4>
            <ul>
              <li><a href="#">Burkina Institute of Technology</a></li>
              <li><a href="#">Filière Computer Science</a></li>
              <li><a href="#">Bureau des étudiants</a></li>
              <li><a href="mailto:bitstudyhub@bit.bf">bitstudyhub@bit.bf</a></li>
              <li><a href="#">Koudougou, Burkina Faso</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <div>© 2026 BIT Study HUB · Projet étudiant · Tous droits réservés</div>
          <div>Conçu avec ${iconHTML('heart', 14)} par les étudiants CS du BIT</div>
        </div>
      </div>
    </footer>`;
  }

  // ============== PWA / SERVICE WORKER ==============
  function initPWA() {
    if ('serviceWorker' in navigator) {
      // Service worker minimal pour cache offline
      const swCode = `
        const CACHE = 'bit-study-hub-v1';
        const ASSETS = [
          './', './index.html',
          './css/styles.css',
          './js/icons.js', './js/app.js',
          './data/site.json',
          './assets/img/bit-logo.jpeg'
        ];
        self.addEventListener('install', e => {
          e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
          self.skipWaiting();
        });
        self.addEventListener('activate', e => {
          e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
          self.clients.claim();
        });
        self.addEventListener('fetch', e => {
          if (e.request.method !== 'GET') return;
          e.respondWith(
            caches.match(e.request).then(cached => {
              const fetchPromise = fetch(e.request).then(networkRes => {
                if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
                  const clone = networkRes.clone();
                  caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return networkRes;
              }).catch(() => cached);
              return cached || fetchPromise;
            })
          );
        });
      `;
      const blob = new Blob([swCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);
      // Note: en pratique, le SW doit être à la racine. On ne l'active qu'en production.
      // navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  // ============== SCROLL REVEAL (framer-motion style) ==============
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-scale');
    if (revealElements.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger sub-elements within the same container
          const siblings = Array.from(entry.target.parentElement?.children || []);
          const idx = siblings.indexOf(entry.target);
          const delay = Math.min(idx * 60, 360);
          setTimeout(() => entry.target.classList.add('is-visible'), delay);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealElements.forEach(el => observer.observe(el));
  }

  // ============== INITIALISATION ==============
  function init(activePage = 'home', isSubpage = false) {
    applyTheme(state.theme);

    // Écouteur pour les changements de préférence système
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.theme === 'auto') applyTheme('auto');
    });

    // Injecter header/footer si placeholders présents
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
      headerPlaceholder.innerHTML = getHeaderHTML(activePage, isSubpage);
    }
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
      footerPlaceholder.innerHTML = getFooterHTML(isSubpage);
    }

    // Recherche globale
    initGlobalSearch();

    // Scroll reveal — micro-animations fluides
    initScrollReveal();

    // Fermer menu mobile sur resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024 && state.mobileMenuOpen) {
        toggleMobileMenu();
      }
    });

    // Fermer menu mobile sur Échap
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.mobileMenuOpen) toggleMobileMenu();
    });

    // PWA (léger)
    initPWA();
  }

  // ============== API PUBLIQUE ==============
  return {
    init, toggleTheme, toggleMobileMenu, showToast,
    applyTheme, escapeHTML, slugify, loadJSON, debounce,
    iconHTML, iconForCategory, colorForCategory, iconForBadge,
    createIcon, ensureSearchData,
    get state() { return state; }
  };
})();

// Exposer globalement
window.BIT = BIT;
