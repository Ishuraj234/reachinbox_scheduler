import { Router } from "express";
import multer from "multer";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { parseLeadsFromText } from "../services/leadParser";
import { scheduleBatch } from "../services/scheduler";
import { prisma } from "../config/prisma";
import { EmailStatus } from "@prisma/client";
import { env } from "../config/env";

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Lets the compose modal show "N email addresses detected" before scheduling.
scheduleRouter.post("/parse-leads", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const emails = parseLeadsFromText(req.file.buffer.toString("utf-8"));
  res.json({ count: emails.length, emails });
});

scheduleRouter.post("/", upload.single("file"), async (req: AuthedRequest, res) => {
  try {
    const { subject, body, startTime, delayMs, hourlyLimit, recipients } = req.body as {
      subject: string;
      body: string;
      startTime: string;
      delayMs?: string;
      hourlyLimit?: string;
      recipients?: string; // JSON-stringified string[] if not sending a file
    };

    let emails: string[] = [];
    if (req.file) {
      emails = parseLeadsFromText(req.file.buffer.toString("utf-8"));
    } else if (recipients) {
      emails = JSON.parse(recipients);
    }

    if (!subject || !body) return res.status(400).json({ error: "subject and body are required" });
    if (emails.length === 0) return res.status(400).json({ error: "No valid recipient emails found" });

    const batch = await scheduleBatch({
      userId: req.userId!,
      subject,
      body,
      recipients: emails,
      startTime: startTime ? new Date(startTime) : new Date(),
      delayMs: delayMs ? Number(delayMs) : env.defaultMinDelayMs,
      hourlyLimit: hourlyLimit ? Number(hourlyLimit) : env.defaultMaxEmailsPerHour,
    });

    res.status(201).json({ batchId: batch.id, totalRecipients: emails.length });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

scheduleRouter.get("/scheduled", async (req: AuthedRequest, res) => {
  const rows = await prisma.scheduledEmail.findMany({
    where: {
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING, EmailStatus.RESCHEDULED] },
      batch: { userId: req.userId },
    },
    orderBy: { scheduledFor: "asc" },
    select: {
      id: true,
      recipientEmail: true,
      subject: true,
      scheduledFor: true,
      status: true,
    },
  });
  res.json(rows);
});

scheduleRouter.get("/sent", async (req: AuthedRequest, res) => {
  const rows = await prisma.scheduledEmail.findMany({
    where: {
      status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
      batch: { userId: req.userId },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      recipientEmail: true,
      subject: true,
      sentAt: true,
      status: true,
      errorMessage: true,
    },
  });
  res.json(rows);
});
