(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');

  const isValidEmail = (v) => typeof v === 'string' && v.includes('@') && v.trim().length >= 5;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const naam = String(formData.get("naam") || '').trim();
    const email = String(formData.get("email") || '').trim();
    const bericht = String(formData.get("bericht") || '').trim();

    // Basisvalidatie (minimaal, zonder gedrag te wijzigen)
    if (!naam || !email || !bericht || !isValidEmail(email)) {
      alert("Vul uw naam, e-mailadres en bericht in.");
      return;
    }

    // Disabled state tijdens verzenden
    const prevText = submitBtn && ('value' in submitBtn ? submitBtn.value : submitBtn.textContent);
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      if ('value' in submitBtn) submitBtn.value = "Verzenden...";
      else submitBtn.textContent = "Verzenden...";
    }

    // 1) Netlify Forms laten opslaan (zoals nu)
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
      alert("Verzenden mislukt. Probeer het opnieuw.");
      return;
    }

    // 2) Bevestigingsmail via Resend (via Netlify Function)
    const payload = { naam, email, bericht };

    try {
      await fetch("/.netlify/functions/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Form is al opgeslagen; mail faalt dan alleen
      // Redirect mag alsnog doorgaan (zoals gevraagd)
    }

    // 3) Redirect naar bedanktpagina
    window.location.href = "/bedankt.html";
  });
})();
