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

// Run direct + after render changes (mounts)
window.addEventListener("DOMContentLoaded", () => {
  setActiveNavLink();

  // Extra veilig: als nav later “injected” wordt (bijv. na fetch), dan nogmaals
  setTimeout(setActiveNavLink, 0);

  // MutationObserver: zodra nav links verschijnen/veranderen -> opnieuw
  const nav = document.querySelector(".site-nav");
  if (nav){
    const obs = new MutationObserver(() => setActiveNavLink());
    obs.observe(nav, { childList: true, subtree: true });
  }
});
