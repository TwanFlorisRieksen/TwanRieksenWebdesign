document.addEventListener('DOMContentLoaded', () => {
  const backToTop = document.getElementById('back-to-top');
  if (!backToTop) return;

  const threshold = 120; // "iets" scrollen -> meteen zichtbaar

  const onScroll = () => {
    if (window.scrollY > threshold) {
      backToTop.classList.add('is-visible');
    } else {
      backToTop.classList.remove('is-visible');
    }
  };

  // init + listeners
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
