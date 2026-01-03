exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return { statusCode: 500, body: "Missing RESEND_API_KEY env var" };
    }

    // Verwacht JSON vanuit je front-end:
    // { naam: "...", email: "...", bericht: "..." }
    const data = JSON.parse(event.body || "{}");
    const naam = (data.naam || "").toString().trim();
    const email = (data.email || "").toString().trim();

    if (!email) {
      return { statusCode: 400, body: "Missing email" };
    }

    // Tot je domein verified is: gebruik onboarding@resend.dev als from
    // en zet jouw eigen domein in reply_to.
    const from = "Twan Rieksen Webdesign <onboarding@resend.dev>";
    const reply_to = "info@twanrieksenwebdesign.nl";

    const subject = "Bevestiging: uw bericht is goed ontvangen";

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <p>Hoi ${naam ? naam : "daar"},</p>
        <p>Bedankt voor uw bericht. Ik heb het goed ontvangen en ik kom zo snel mogelijk bij u terug.</p>
        <p style="margin-top:16px">
          Met vriendelijke groet,<br>
          Twan Rieksen<br>
          Twan Rieksen Webdesign
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        reply_to,
        subject,
        html,
      }),
    });

    const out = await res.text();

    if (!res.ok) {
      // Belangrijk voor debuggen
      return {
        statusCode: 502,
        body: `Resend API error (${res.status}): ${out}`,
      };
    }

    return {
      statusCode: 200,
      body: out,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: `Server error: ${e && e.message ? e.message : "unknown"}`,
    };
  }
};
