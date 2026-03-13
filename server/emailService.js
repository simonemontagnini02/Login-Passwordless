const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS
  }
});

async function sendMagicLink(email, link) {
  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Magic Link Login",
    text: `Clicca per accedere: ${link}`
  });
}

module.exports = sendMagicLink;
