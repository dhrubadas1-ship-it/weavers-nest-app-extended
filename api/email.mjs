import nodemailer from "nodemailer";

// Set env vars on Vercel:
// SMTP_HOST, SMTP_PORT (e.g., 587), SMTP_USER, SMTP_PASS, RECIPIENT_EMAIL
const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, RECIPIENT_EMAIL
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT || "587", 10),
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
  try {
    const { subject = "Weavers Nest Package", text = "", fromUser = "guest" } = req.body || {};
    if (!RECIPIENT_EMAIL) return res.status(400).json({ ok:false, error:"RECIPIENT_EMAIL not set" });

    const info = await transporter.sendMail({
      from: `Weavers Nest App <${SMTP_USER}>`,
      to: RECIPIENT_EMAIL,
      subject,
      text: `From: ${fromUser}\n\n${text}`
    });

    res.status(200).json({ ok:true, messageId: info.messageId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"Email failed" });
  }
}
