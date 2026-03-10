// services/emailService.js

const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;

client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmail(to, subject, htmlContent) {
  const email = {
    sender: {
      name: "Converge Concierge",
      email: "noreply@concierge.convergeevents.com",
    },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent,
  };

  return apiInstance.sendTransacEmail(email);
}

module.exports = { sendEmail };
