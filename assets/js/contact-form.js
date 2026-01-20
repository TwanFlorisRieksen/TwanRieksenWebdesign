(() => {
  // Wacht tot window.load zodat content.js zijn async bind (data-bind) al heeft gedaan.
  // Daarna ontkoppelen we alleen de submit-knop van data-bind zodat runtime-teksten niet worden teruggezet.
  window.addEventListener('load', () => {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) return;

    // Neem CMS-label over (content.js heeft dit inmiddels gezet), en ontkoppel alleen deze knop van data-bind.
    const originalBind = submitBtn.getAttribute('data-bind');
    const cmsIdleText = ('value' in submitBtn) ? submitBtn.value : submitBtn.textContent;

    const sendingTextEl = document.getElementById('contact-submit-sending-text');
const cmsSendingText = sendingTextEl ? String(sendingTextEl.textContent || '').trim() : '';

    if (originalBind) submitBtn.removeAttribute('data-bind');

    const isValidEmail = (v) => typeof v === 'string' && v.includes('@') && v.trim().length >= 5;

    const getBtnText = () => ('value' in submitBtn) ? submitBtn.value : submitBtn.textContent;
    const setBtnText = (text) => {
      if ('value' in submitBtn) submitBtn.value = text;
      else submitBtn.textContent = text;
    };

    const setFieldError = (name, text) => {
      const slot = form.querySelector(`[data-error-for="${name}"]`);
      const field = form.querySelector(`[name="${name}"]`);
      if (slot) slot.textContent = text || '';
      if (field){
        field.classList.toggle('input-error', !!text);
        field.setAttribute('aria-invalid', text ? 'true' : 'false');
      }
    };

    const clearErrors = () => {
      ['naam','email','bericht'].forEach(n => setFieldError(n, ''));
    };

    const track = (name, params) => {
      try{
        if (typeof window.gtag === 'function') {
          window.gtag('event', name, params || {});
        } else if (Array.isArray(window.dataLayer)) {
          window.dataLayer.push({event: name, ...(params||{})});
        }
      } catch(_e){}
    };

    const validate = (naam, email, bericht) => {
      let ok = true;
      if (!naam){ setFieldError('naam', 'Vul uw naam in.'); ok = false; }
      if (!email || !isValidEmail(email)){ setFieldError('email', 'Vul een geldig e-mailadres in.'); ok = false; }
      if (!bericht){ setFieldError('bericht', 'Vul uw bericht in.'); ok = false; }
      return ok;
    };

    form.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || !t.name) return;
      if (t.name === 'naam') setFieldError('naam', t.value.trim() ? '' : 'Vul uw naam in.');
      if (t.name === 'email') setFieldError('email', (t.value.trim() && isValidEmail(t.value.trim())) ? '' : 'Vul een geldig e-mailadres in.');
      if (t.name === 'bericht') setFieldError('bericht', t.value.trim() ? '' : 'Vul uw bericht in.');
    }, {passive:true});

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors();

        // Immediately show "sending/redirecting" state so it is visible before redirect
  setBtnText(cmsSendingText || 'Even geduld... U wordt doorgestuurd...');
  submitBtn.disabled = true;

        // Ontkoppel de knop van CMS data-bind zodat content.js onze runtime-tekst niet kan terugzetten
  if (submitBtn) submitBtn.removeAttribute('data-bind');

      // Gebruik de CMS idle text als "terugval" (meestal "Versturen")
      const idleText = cmsIdleText || getBtnText();

      const formData = new FormData(form);
      const naam = String(formData.get("naam") || '').trim();
      const email = String(formData.get("email") || '').trim();
      const bericht = String(formData.get("bericht") || '').trim();

      if (!validate(naam, email, bericht)){
        setBtnText('Controleer de velden hieronder.');
        window.setTimeout(() => setBtnText(idleText), 2500);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');

      // Meldingtekst op de knop
      setBtnText(cmsSendingText || 'Even geduld... U wordt doorgestuurd...');

      // 1) Netlify Forms opslaan
      try {
        await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(formData).toString(),
        });
      } catch (_err) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        setBtnText('Verzenden mislukt. Probeer het opnieuw.');
        window.setTimeout(() => setBtnText(idleText), 3000);
        track('form_submit_error', {page: 'contact'});
        return;
      }

      // 2) Resend confirmation mail (ongewijzigd endpoint)
      try {
        await fetch("/.netlify/functions/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ naam, email, bericht }),
        });
      } catch (_err) {
        // Form is opgeslagen; mail failure mag niet blokkeren
      }

      track('form_submit_success', {page: 'contact'});

      // 3) Redirect — geef de knoptekst zichtbaar tijd
      const MIN_DISPLAY_MS = 900;
      await new Promise(r => setTimeout(r, MIN_DISPLAY_MS));

      window.location.href = "/bedankt.html";
    });
  });
})();
