import nodemailer, { Transporter } from "nodemailer";
import { prisma } from "../config/prisma";

// One transporter cached per sender (per SMTP credentials) so we don't
// re-authenticate with Ethereal on every single send.
const transporterCache = new Map<string, Transporter>();

async function getTransporter(senderId: string) {
  if (transporterCache.has(senderId)) return transporterCache.get(senderId)!;

  const sender = await prisma.sender.findUniqueOrThrow({ where: { id: senderId } });

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: false,
    auth: { user: sender.smtpUser, pass: sender.smtpPass },
  });

  transporterCache.set(senderId, transporter);
  return transporter;
}

export async function sendEmail(params: {
  senderId: string;
  to: string;
  subject: string;
  html: string;
}) {
  const sender = await prisma.sender.findUniqueOrThrow({ where: { id: params.senderId } });
  const transporter = await getTransporter(params.senderId);

  const info = await transporter.sendMail({
    from: `"${sender.label}" <${sender.smtpUser}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  // Ethereal gives back a preview URL - handy for the demo video.
  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  return { messageId: info.messageId, previewUrl };
}
