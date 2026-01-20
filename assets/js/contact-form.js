(() => {
  'use strict';

  const init = () => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) return;

    // Label staat in een span in jouw HTML
    const submitLabel = document.getElementById('contact-submit-label');
    const sendingTextEl = document.getElementById('contact-submit-sending-text');

    const isValidEmail = (v) => typeof v === 'string' && v.includes('@') && v.trim().length >= 5;

    const getBtnText = () => {
      if (submitBtn.tagName === 'INPUT') return submitBtn.value;
      if (submitLabel) return submitLabel.textContent;
      return submitBtn.textContent;
    };

    const setBtnText = (text) => {
      if (submitBtn.tagName === 'INPUT') {
        submitBtn.value = text;
        return;
      }
      if (submitLabel) {
        submitLabel.textContent = text;
        return;
      }
      submitBtn.textContent = text;
    };

    const setFieldError = (name, text) => {
      const slot = form.querySelector(`[data-error-for="${name}"]`);
      const field = form.querySelector(`[name="${name}"]`);
      if (slot) slot.textContent = text || '';
      if (field) {
        field.classList.toggle('input-error', !!text);
        field.setAttribute('aria-invalid', text ? 'true' : 'false');
      }
    };

    const clearErrors = () => {
      ['naam', 'email', 'bericht'].forEach((n) => setFieldError(n, ''));
    };

    const track = (name, params) => {
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', name, params || {});
        } else if (Array.isArray(window.dataLayer)) {
          window.dataLayer.push({ event: name, ...(params || {}) });
        }
      } catch (_e) {}
    };

    const validate = (naam, email, bericht) => {
      let ok = true;
      if (!naam) { setFieldError('naam', 'Vul uw naam in.'); ok = false; }
      if (!email || !isValidEmail(email)) { setFieldError('email', 'Vul een geldig e-mailadres in.'); ok = false; }
      if (!bericht) { setFieldError('bericht', 'Vul uw bericht in.'); ok = false; }
      return ok;
    };

    form.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || !t.name) return;
      if (t.name === 'naam') setFieldError('naam', t.value.trim() ? '' : 'Vul uw naam in.');
      if (t.name === 'email') setFieldError('email', (t.value.trim() && isValidEmail(t.value.trim())) ? '' : 'Vul een geldig e-mailadres in.');
      if (t.name === 'bericht') setFieldError('bericht', t.value.trim() ? '' : 'Vul uw bericht in.');
    }, { passive: true });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      // Lees de huidige (CMS) teksten precies op submit-moment
      const idleText = String(getBtnText() || '').trim() || 'Versturen';
      const cmsSendingText = sendingTextEl ? String(sendingTextEl.textContent || '').trim() : '';
      const sendingText = cmsSendingText || 'Even geduld... U wordt doorgestuurd...';

      const formData = new FormData(form);
      const naam = String(formData.get('naam') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const bericht = String(formData.get('bericht') || '').trim();

      if (!validate(naam, email, bericht)) {
        // Geen “doorgestuurd”-tekst tonen bij invalid; dit is consistent met ja.zip UX
        setBtnText('Controleer de velden hieronder.');
        window.setTimeout(() => setBtnText(idleText), 2500);
        return;
      }

      // Ontkoppel data-bind pas nu (zodat content.js later niets kan overschrijven)
      if (submitLabel && submitLabel.getAttribute('data-bind')) submitLabel.removeAttribute('data-bind');
      if (submitBtn && submitBtn.getAttribute('data-bind')) submitBtn.removeAttribute('data-bind');

      // Zet knopstatus zichtbaar vóór de fetch
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      setBtnText(sendingText);

      // Forceer paint vóór netwerk (anders kan tekst pas na fetch zichtbaar worden)
      await new Promise(requestAnimationFrame);

      // 1) Netlify Forms opslaan
      try {
        await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData).toString(),
        });
      } catch (_err) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        setBtnText('Verzenden mislukt. Probeer het opnieuw.');
        window.setTimeout(() => setBtnText(idleText), 3000);
        track('form_submit_error', { page: 'contact' });
        return;
      }

      // 2) Resend confirmation mail (mag niet blokkeren)
      try {
        await fetch('/.netlify/functions/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ naam, email, bericht }),
        });
      } catch (_err) {}

      track('form_submit_success', { page: 'contact' });

      // 3) Redirect — geef de tekst een minimum zichtbare tijd
      const MIN_DISPLAY_MS = 900;
      await new Promise((r) => setTimeout(r, MIN_DISPLAY_MS));

      window.location.href = '/bedankt.html';
    });
  };

  // Start zo vroeg mogelijk (zoals ja.zip), niet wachten op window.load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
