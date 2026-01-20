(() => {
  /**
   * Contact form handler
   * Doel: na geldig submit direct knoptekst wijzigen naar "doorgestuurd"-melding
   * en zo houden tot redirect naar /bedankt.html, zonder dat content.js dit terugzet.
   *
   * BELANGRIJK:
   * - We draaien op window.load zodat content.js (async) eerst zijn data-bind heeft toegepast.
   * - We koppelen alleen de submit-label binding los (data-bind) zodat runtime teksten blijven staan.
   * - We registreren submit listener op CAPTURE + stopImmediatePropagation om andere handlers te blokkeren.
   */
  window.addEventListener('load', () => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) return;

    // Optioneel: als je de span-oplossing gebruikt
    // <span id="contact-submit-label" data-bind="contact.form.fields.submit_label">Versturen</span>
    const submitLabel = document.getElementById('contact-submit-label');

    // Hidden element (bijv. direct onder de knop):
    // <span id="contact-submit-sending-text" data-bind="contact.form.fields.submit_sending_label" hidden></span>
    const sendingTextEl = document.getElementById('contact-submit-sending-text');

    // Neem CMS-teksten over (content.js heeft deze inmiddels gezet)
    const cmsIdleText = (() => {
      if ('value' in submitBtn) return String(submitBtn.value || '').trim();
      if (submitLabel) return String(submitLabel.textContent || '').trim();
      return String(submitBtn.textContent || '').trim();
    })();

    const cmsSendingText = sendingTextEl ? String(sendingTextEl.textContent || '').trim() : '';

    // Ontkoppel data-bind alleen voor het submit label, zodat runtime tekst niet wordt teruggezet.
    // (Sommige pagina's zetten data-bind op de knop zelf, anderen op een span.)
    if (submitLabel && submitLabel.getAttribute('data-bind')) {
      submitLabel.removeAttribute('data-bind');
    }
    if (submitBtn && submitBtn.getAttribute('data-bind')) {
      submitBtn.removeAttribute('data-bind');
    }

    const isValidEmail = (v) =>
      typeof v === 'string' && v.includes('@') && v.trim().length >= 5;

    const getBtnText = () => {
      if ('value' in submitBtn) return submitBtn.value;
      if (submitLabel) return submitLabel.textContent;
      return submitBtn.textContent;
    };

    const setBtnText = (text) => {
      if ('value' in submitBtn) {
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
      if (!naam) {
        setFieldError('naam', 'Vul uw naam in.');
        ok = false;
      }
      if (!email || !isValidEmail(email)) {
        setFieldError('email', 'Vul een geldig e-mailadres in.');
        ok = false;
      }
      if (!bericht) {
        setFieldError('bericht', 'Vul uw bericht in.');
        ok = false;
      }
      return ok;
    };

    form.addEventListener(
      'input',
      (e) => {
        const t = e.target;
        if (!t || !t.name) return;
        if (t.name === 'naam') setFieldError('naam', t.value.trim() ? '' : 'Vul uw naam in.');
        if (t.name === 'email')
          setFieldError(
            'email',
            t.value.trim() && isValidEmail(t.value.trim()) ? '' : 'Vul een geldig e-mailadres in.'
          );
        if (t.name === 'bericht') setFieldError('bericht', t.value.trim() ? '' : 'Vul uw bericht in.');
      },
      { passive: true }
    );

    const setBusy = (isBusy) => {
      if (isBusy) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
      } else {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      }
    };

    // Submit: CAPTURE + stopImmediatePropagation voorkomt dat andere scripts de submit overschrijven.
    form.addEventListener(
      'submit',
      async (e) => {
        // Blokkeer alle andere submit-handlers
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        clearErrors();

        const idleText = cmsIdleText || String(getBtnText() || '').trim() || 'Versturen';

        const formData = new FormData(form);
        const naam = String(formData.get('naam') || '').trim();
        const email = String(formData.get('email') || '').trim();
        const bericht = String(formData.get('bericht') || '').trim();

        // Valideer eerst, zonder knop permanent te locken
        if (!validate(naam, email, bericht)) {
          setBusy(false);
          setBtnText('Controleer de velden hieronder.');
          window.setTimeout(() => setBtnText(idleText), 2500);
          return;
        }

        // Vanaf hier: geldig -> toon melding en lock knop tot redirect
        setBusy(true);
        setBtnText(cmsSendingText || 'Even geduld... U wordt doorgestuurd...');

        // Forceer repaint voordat we network calls starten (zorgt dat tekst echt zichtbaar wordt)
        await new Promise(requestAnimationFrame);

        // 1) Netlify Forms opslaan
        try {
          await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString(),
          });
        } catch (_err) {
          setBusy(false);
          setBtnText('Verzenden mislukt. Probeer het opnieuw.');
          window.setTimeout(() => setBtnText(idleText), 3000);
          track('form_submit_error', { page: 'contact' });
          return;
        }

        // 2) Resend confirmation mail (mail failure mag niet blokkeren)
        try {
          await fetch('/.netlify/functions/send-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ naam, email, bericht }),
          });
        } catch (_err) {}

        track('form_submit_success', { page: 'contact' });

        // 3) Redirect — geef de knoptekst even zichtbaar tijd
        const MIN_DISPLAY_MS = 900;
        await new Promise((r) => setTimeout(r, MIN_DISPLAY_MS));

        window.location.href = '/bedankt.html';
      },
      true
    );
  });
})();
