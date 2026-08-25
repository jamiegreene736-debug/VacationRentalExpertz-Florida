import nodemailer, { type Transporter } from "nodemailer";
import {
  RESERVATIONS_EMAIL,
} from "./contact";
import {
  CONTACT_TOPICS,
  contactInquiryText,
  type ValidContactInquiry,
} from "./contact-form";

let transporter: Transporter | null = null;

function smtpTransport(): Transporter {
  if (transporter) return transporter;

  const password = process.env.SMTP_PASSWORD?.trim();
  if (!password) {
    throw new Error("Contact email delivery is not configured.");
  }

  const port = Number(process.env.SMTP_PORT || "465");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT must be a valid port number.");
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.ionos.com",
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    auth: {
      user: process.env.SMTP_USER?.trim() || RESERVATIONS_EMAIL,
      pass: password,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

export async function deliverContactInquiry(
  inquiry: ValidContactInquiry,
): Promise<void> {
  const recipient = process.env.CONTACT_EMAIL_TO?.trim() || RESERVATIONS_EMAIL;
  const senderAddress = process.env.SMTP_FROM?.trim() || RESERVATIONS_EMAIL;
  const result = await smtpTransport().sendMail({
    from: {
      name: "Vacation Rental Expertz Florida Website",
      address: senderAddress,
    },
    to: recipient,
    replyTo: {
      name: inquiry.name,
      address: inquiry.email,
    },
    subject: `Website inquiry: ${CONTACT_TOPICS[inquiry.topic]}`,
    text: contactInquiryText(inquiry),
  });

  if (!result.accepted.map(String).includes(recipient)) {
    throw new Error("The reservations mailbox did not accept the inquiry.");
  }
}
