(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  const statusEl = document.querySelector('[data-ui="form-status"]');

  const getContent = () => (window.RW_CONTENT && window.RW_CONTENT.contact) ? window.RW_CONTENT.contact : null;
  const getMsgs = () => (getContent() && getContent().form && getContent().form.messages) ? getContent().form.messages : {};
  const getSubmitLabel = () => (getContent() && getContent().form && getContent().form.fields && getContent().form.fields.submit_label)
    ? getContent().form.fields.submit_label
    : (submitBtn ? (submitBtn.getAttribute('data-default-label') || submitBtn.textContent || '') : '');

  const setStatus = (msg) => {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
  };

  const isValidEmail = (v) => typeof v === 'string' && v.includes('@') && v.trim().length >= 5;

  // cache default submit label after content is bound
  const defaultLabel = getSubmitLabel();
  if (submitBtn && defaultLabel) submitBtn.setAttribute('data-default-label', defaultLabel);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus('');

    const msgs = getMsgs();

    const formData = new FormData(form);
    const naam = String(formData.get("naam") || '').trim();
    const email = String(formData.get("email") || '').trim();
    const bericht = String(formData.get("bericht") || '').trim();

    if (!naam || !email || !bericht) {
      setStatus(msgs.required || '');
      return;
    }
    if (!isValidEmail(email)) {
      setStatus(msgs.invalid_email || '');
      return;
    }

    // UX: sending state
    if (submitBtn) {
      submitBtn.disabled = true;
      const sending = msgs.sending || '';
      if ('value' in submitBtn) submitBtn.value = sending;
      else submitBtn.textContent = sending;
    }

    // 1) Netlify Forms submission (x-www-form-urlencoded)
    try {
      const body = new URLSearchParams();
      body.append('form-name', 'offerte');
      body.append('naam', naam);
      body.append('email', email);
      body.append('bericht', bericht);

      await fetch(form.getAttribute('action') || '/', {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
    } catch (err) {
      // If Netlify Forms fails, show message and allow retry
      setStatus(msgs.send_failed || '');
      if (submitBtn) {
        submitBtn.disabled = false;
        const back = getSubmitLabel();
        if ('value' in submitBtn) submitBtn.value = back;
        else submitBtn.textContent = back;
      }
      return;
    }

    // 2) Send confirmation via existing function (do not change flow)
    try {
      const payload = { naam, email, bericht };
      await fetch("/.netlify/functions/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Form is opgeslagen; redirect blijft doorgaan
    }

    // 3) Redirect to thank-you page
    window.location.href = "/bedankt.html";
  });
})();