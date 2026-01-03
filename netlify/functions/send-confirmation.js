import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function handler(event) {
  try {
    const data = JSON.parse(event.body || "{}");

    const naam = (data.naam || "").trim();
    const email = (data.email || "").trim();

    if (!naam || !email) {
      return { statusCode: 400, body: "Naam of e-mail ontbreekt" };
    }

    await resend.emails.send({
      from: "Twan Rieksen Webdesign <info@twanrieksenwebdesign.nl>",
      to: email,
      subject: "Uw bericht is goed ontvangen",
      html: `
        <p>Hallo ${naam},</p>
        <p>Dank u wel voor uw bericht. Ik heb uw aanvraag goed ontvangen en neem zo snel mogelijk contact met u op.</p>
        <p>Met vriendelijke groet,<br>
        Twan Rieksen<br>
        Twan Rieksen Webdesign</p>
      `,
    });

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    return { statusCode: 500, body: "Fout bij verzenden" };
  }
}
