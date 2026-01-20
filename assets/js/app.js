(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function onReady(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function setYear(){
    const now = new Date();
    $$('[data-bind="site.footer.copyright"]').forEach(el=>{
      el.textContent = el.textContent.replace('{year}', String(now.getFullYear()));
    });
  }

  function setupReveal(){
    const els = $$('.reveal');
    // Selective reveal: keep style, but skip long text blocks
    const isLongText = (el) => {
      const tag = (el.tagName||'').toUpperCase();
      if(tag !== 'P' && tag !== 'LI') return false;
      const t = (el.textContent||'').trim();
      return t.length > 220;
    };
    if(!('IntersectionObserver' in window)){
      els.forEach(e=>e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(ent=>{
        if(ent.isIntersecting){
          ent.target.classList.add('in');
          io.unobserve(ent.target);
        }
      });
    }, {threshold: 0.12});
    els.forEach(el=>{
      if(isLongText(el)){
        el.classList.add('in');
        return;
      }
      io.observe(el);
    });
  }

  function setupMobileNav(navLinks){
    // Create a simple mobile nav panel that uses the same links
    let panel = $('.mobile-nav');
    if(!panel){
      panel = document.createElement('div');
      panel.className = 'mobile-nav';
      document.body.appendChild(panel);
    }
    panel.innerHTML = '';
    navLinks.forEach(link=>{
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      if(link.current) a.setAttribute('aria-current', 'page');
      panel.appendChild(a);
    });

    const btn = $('[data-action="toggle-menu"]');
    if(!btn) return;

    const close = () => {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', ()=>{
      const open = !panel.classList.contains('open');
      panel.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });

    // Close on navigation
    panel.addEventListener('click', (e)=>{
      if(e.target && e.target.tagName === 'A') close();
    });

    // Close on scroll / resize
    window.addEventListener('resize', close, {passive:true});
    window.addEventListener('scroll', close, {passive:true});
  }

  function setupSearchUI(openFn, closeFn){
    // Keyboard shortcuts
    document.addEventListener('keydown', (e)=>{
      const isTyping = /INPUT|TEXTAREA/.test((document.activeElement||{}).tagName||'');
      if(e.key === '/' && !isTyping){
        e.preventDefault();
        openFn();
      }
      if(e.key === 'Escape'){
        closeFn();
      }
    });

    // Buttons
    const openBtn = $('[data-action="open-search"]');
    const closeBtn = $('[data-action="close-search"]');
    if(openBtn) openBtn.addEventListener('click', openFn);
    if(closeBtn) closeBtn.addEventListener('click', closeFn);

    // Click outside
    const overlay = $('[data-ui="search"]');
    if(overlay){
      overlay.addEventListener('click', (e)=>{
        if(e.target === overlay) closeFn();
      });
    }
  }


  function trackEvent(name, params){
    try{
      if(typeof window.gtag === 'function'){
        window.gtag('event', name, params || {});
        return;
      }
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({event: name}, params || {}));
    }catch(_){}
  }

  function setupTracking(){
    document.addEventListener('click', (e)=>{
      const a = e.target && (e.target.closest ? e.target.closest('a') : null);
      if(!a) return;
      const href = (a.getAttribute('href')||'').toString();
      const page = (document.body.getAttribute('data-page')||'').toString();

      // contact navigation
      if(/(^|\/)contact\.html($|\?|#)/.test(href) || href === 'contact.html'){
        trackEvent('contact_navigate', {page});
      }

      // primary CTA click (page-specific, minimal assumptions)
      const isHeaderCta = a.classList.contains('header-cta') && a.classList.contains('primary');
      const isDienstenPrimary = page === 'diensten' && a.getAttribute('data-bind') === 'diensten.cta_mid.button_label';
      const isWerkwijzePrimary = page === 'werkwijze' && a.classList.contains('primary');
      const isHomePrimary = page === 'home' && isHeaderCta;

      if(isHomePrimary || isDienstenPrimary || (page === 'werkwijze' && isWerkwijzePrimary)){
        trackEvent('cta_primary_click', {page, label: (a.textContent||'').trim(), href});
      }
    }, {capture:true});
  }

  // Public API hook for content.js
  window.RW_APP = {
    onReady,
    setYear,
    setupReveal,
    setupMobileNav,
    setupSearchUI,
    setupTracking
  };
})();
