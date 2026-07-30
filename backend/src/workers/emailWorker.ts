import { Worker, Job } from "bullmq";
import { bullConnection } from "../queue/connection";
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from "../queue/emailQueue";
import { prisma } from "../config/prisma";
import { sendEmail } from "../services/mailer";
import { tryReserveSendSlot, nextHourWindowStart } from "../services/rateLimiter";
import { EmailStatus } from "@prisma/client";
import { env } from "../config/env";

/**
 * The worker is the single place where:
 *  1. Concurrency is bounded (`concurrency` option below - configurable via env).
 *  2. The minimum delay between sends is respected (BullMQ's `limiter` option
 *     throttles how fast this worker pulls NEW jobs off the queue, which
 *     naturally spaces out sends without relying on setTimeout/sleep hacks).
 *  3. The per-sender hourly cap is enforced (via Redis-backed counters) and,
 *     if exceeded, the job is *rescheduled* into the next hour window instead
 *     of being dropped or failed.
 */
async function processJob(job: Job<EmailJobData>) {
  const { scheduledEmailId, senderId, recipientEmail, subject, body } = job.data;

  const row = await prisma.scheduledEmail.findUnique({ where: { id: scheduledEmailId } });
  if (!row) return; // DB row deleted - nothing to do

  // Idempotency guard: if this row was already marked SENT (e.g. a duplicate
  // job somehow got queued), don't send twice.
  if (row.status === EmailStatus.SENT) return;

  const sender = await prisma.sender.findUniqueOrThrow({ where: { id: senderId } });

  const allowed = await tryReserveSendSlot(senderId, sender.maxPerHour);
  if (!allowed) {
    // Hourly budget exhausted for this sender - push into the next hour
    // window rather than failing. Order is preserved because we always
    // move to the *next* boundary relative to now.
    const nextWindow = nextHourWindowStart(new Date());
    const newDelay = nextWindow.getTime() - Date.now() + 1000; // +1s buffer past the boundary

    await prisma.scheduledEmail.update({
      where: { id: row.id },
      data: { status: EmailStatus.RESCHEDULED, scheduledFor: new Date(Date.now() + newDelay) },
    });

    await emailQueue.add(
      "send-email",
      { scheduledEmailId, senderId, recipientEmail, subject, body },
      { delay: newDelay, jobId: `${row.id}-retry-${Date.now()}` }
    );
    return;
  }

  await prisma.scheduledEmail.update({ where: { id: row.id }, data: { status: EmailStatus.PROCESSING } });

  try {
    await sendEmail({ senderId, to: recipientEmail, subject, html: body });
    await prisma.scheduledEmail.update({
      where: { id: row.id },
      data: { status: EmailStatus.SENT, sentAt: new Date() },
    });
  } catch (err: any) {
    await prisma.scheduledEmail.update({
      where: { id: row.id },
      data: { status: EmailStatus.FAILED, errorMessage: String(err?.message ?? err) },
    });
    throw err; // let BullMQ's retry/backoff handle re-attempts
  }
}

export const emailWorker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processJob, {
  connection: bullConnection,
  concurrency: env.workerConcurrency, // configurable worker concurrency
  limiter: {
    // Throttles job *pickup* rate -> enforces the minimum delay between sends
    // without ad-hoc sleeps inside job logic.
    max: 1,
    duration: env.defaultMinDelayMs,
  },
});

emailWorker.on("completed", (job) => console.log(`[worker] sent job ${job.id}`));
emailWorker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));

console.log(
  `Email worker started. concurrency=${env.workerConcurrency} minDelayMs=${env.defaultMinDelayMs}`
);
