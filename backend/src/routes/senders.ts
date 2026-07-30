import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { env } from "../config/env";

export const sendersRouter = Router();
sendersRouter.use(requireAuth);

sendersRouter.get("/", async (req: AuthedRequest, res) => {
  const senders = await prisma.sender.findMany({
    where: { userId: req.userId },
    select: { id: true, label: true, smtpUser: true, maxPerHour: true, createdAt: true },
  });
  res.json(senders);
});

// Register an Ethereal test account (create one at https://ethereal.email/create)
// as a usable sender. In a real product this would instead be a verified
// company mailbox / API key - Ethereal is used here per the assignment spec.
sendersRouter.post("/", async (req: AuthedRequest, res) => {
  const { label, smtpUser, smtpPass, maxPerHour } = req.body as {
    label: string;
    smtpUser: string;
    smtpPass: string;
    maxPerHour?: number;
  };

  if (!label || !smtpUser || !smtpPass) {
    return res.status(400).json({ error: "label, smtpUser and smtpPass are required" });
  }

  const sender = await prisma.sender.create({
    data: {
      userId: req.userId!,
      label,
      smtpHost: env.etherealSmtpHost,
      smtpPort: env.etherealSmtpPort,
      smtpUser,
      smtpPass,
      maxPerHour: maxPerHour ?? env.defaultMaxEmailsPerHour,
    },
  });

  res.status(201).json({ id: sender.id, label: sender.label, smtpUser: sender.smtpUser });
});
