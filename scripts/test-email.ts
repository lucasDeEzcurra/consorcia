import "dotenv/config";
import nodemailer from "nodemailer";

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("Faltan GMAIL_USER o GMAIL_APP_PASSWORD en .env.local");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

async function main() {
  const info = await transporter.sendMail({
    from: GMAIL_USER,
    to: GMAIL_USER,
    subject: "Test Consorcia",
    html: "<h1>Funciona!</h1><p>El email de Consorcia está configurado.</p>",
  });
  console.log("Email enviado!", info.messageId);
}

main().catch((err) => {
  console.error("Error enviando email:", err);
  process.exit(1);
});
