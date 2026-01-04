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
    els.forEach(el=>io.observe(el));
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

  // Public API hook for content.js
  window.RW_APP = {
    onReady,
    setYear,
    setupReveal,
    setupMobileNav,
    setupSearchUI
  };
})();
