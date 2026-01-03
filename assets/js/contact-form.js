(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    // 1) Netlify Forms laten opslaan (zoals nu)
    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });
    } catch (err) {
      alert("Verzenden mislukt. Probeer het opnieuw.");
      return;
    }

    // 2) Bevestigingsmail via Resend (via Netlify Function)
    const payload = {
      naam: formData.get("naam"),
      email: formData.get("email"),
      bericht: formData.get("bericht"),
    };

    try {
      await fetch("/.netlify/functions/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Form is al opgeslagen; mail faalt dan alleen
      // Je kunt dit stil houden of tonen. Ik houd het stil.
    }

    // 3) Redirect naar bedanktpagina
    window.location.href = "/bedankt.html";
  });
})();
