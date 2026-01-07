(async () => {
  const res = await fetch('/content/site.json', { cache: 'no-store' });
  if (!res.ok) return;
  const site = await res.json();

  const logoUrl = (site?.brand?.logo || '').trim();
  const mark = document.querySelector('.brand-mark');
  const img  = document.querySelector('.brand-logo');

  if (mark && img && logoUrl) {
    img.src = logoUrl;
    img.hidden = false;
    mark.classList.add('has-logo');
  }
})();
/* =========================
   (Optie 10) Active nav link
   ========================= */

function setActiveNavLink(){
  const path = location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".site-nav a, .mobile-nav a").forEach(a => {
    const href = (a.getAttribute("href") || "").split("/").pop();
    if (!href) return;

    if (href === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function mountBackToTop(){
  if (document.querySelector('[data-ui="back-to-top"]')) return;
  if (!document.body) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'back-to-top';
  btn.dataset.ui = 'back-to-top';
  btn.textContent = 'terug naar boven';
  btn.setAttribute('aria-label', 'terug naar boven');
  btn.setAttribute('aria-hidden', 'true');
  btn.tabIndex = -1;

  document.body.appendChild(btn);

  const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  btn.addEventListener('click', () => {
    const reduceMotion = !!reduceMotionQuery?.matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const show = y > 500;

    btn.classList.toggle('is-visible', show);
    btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    btn.tabIndex = show ? 0 : -1;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

// Run direct + after render changes (mounts)
window.addEventListener("DOMContentLoaded", () => {
  setActiveNavLink();
  mountBackToTop();

  // Extra veilig: als nav later “injected” wordt (bijv. na fetch), dan nogmaals
  setTimeout(setActiveNavLink, 0);

  // MutationObserver: zodra nav links verschijnen/veranderen -> opnieuw
  const nav = document.querySelector(".site-nav");
  if (nav){
    const obs = new MutationObserver(() => setActiveNavLink());
    obs.observe(nav, { childList: true, subtree: true });
  }
});
