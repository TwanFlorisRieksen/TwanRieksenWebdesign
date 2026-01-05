(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  const msg = document.getElementById('form-message');

  const isValidEmail = (v) => typeof v === 'string' && v.includes('@') && v.trim().length >= 5;

  const setMessage = (type, text) => {
    if (!msg) return;
    msg.textContent = text || '';
    msg.classList.remove('is-error','is-success');
    if (type === 'error') msg.classList.add('is-error');
    if (type === 'success') msg.classList.add('is-success');
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
    setMessage('', '');
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

    const formData = new FormData(form);
    const naam = String(formData.get("naam") || '').trim();
    const email = String(formData.get("email") || '').trim();
    const bericht = String(formData.get("bericht") || '').trim();

    if (!validate(naam, email, bericht)){
      setMessage('error', 'Controleer de velden hieronder.');
      return;
    }

    const prevText = submitBtn && ('value' in submitBtn ? submitBtn.value : submitBtn.textContent);
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      if ('value' in submitBtn) submitBtn.value = "Verzenden...";
      else submitBtn.textContent = "Verzenden...";
    }

    setMessage('success', 'Verzonden. Bedankt! U wordt doorgestuurd...');

    // 1) Netlify Forms opslaan
    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        if ('value' in submitBtn) submitBtn.value = prevText;
        else submitBtn.textContent = prevText;
      }
      setMessage('error', 'Verzenden mislukt. Probeer het opnieuw.');
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

    // 3) Redirect
    window.location.href = "/bedankt.html";
  });
})();
