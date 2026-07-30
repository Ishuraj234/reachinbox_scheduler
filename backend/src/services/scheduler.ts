import { prisma } from "../config/prisma";
import { emailQueue } from "../queue/emailQueue";
import { EmailStatus } from "@prisma/client";

export interface ScheduleBatchInput {
  userId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayMs: number; // minimum gap between individual sends
  hourlyLimit: number; // applied per-sender via rateLimiter at send time
}

/**
 * Creates one EmailBatch + N ScheduledEmail rows, then enqueues one BullMQ
 * delayed job per email. Recipients are spread across all of the user's
 * senders round-robin, and each successive email in a sender's lane is
 * offset by `delayMs` starting at `startTime`. The hourly cap itself is
 * enforced at send-time by the worker (see rateLimiter), because that's the
 * only place we can safely react to jobs that were rescheduled/delayed.
 */
export async function scheduleBatch(input: ScheduleBatchInput) {
  const senders = await prisma.sender.findMany({ where: { userId: input.userId } });
  if (senders.length === 0) {
    throw new Error("No senders configured for this user. Add at least one Ethereal sender first.");
  }

  const batch = await prisma.emailBatch.create({
    data: {
      userId: input.userId,
      subject: input.subject,
      body: input.body,
      startTime: input.startTime,
      delayMs: input.delayMs,
      hourlyLimit: input.hourlyLimit,
      totalRecipients: input.recipients.length,
    },
  });

  // Track next available slot time per sender lane so emails from the same
  // sender are spaced `delayMs` apart, preserving submission order.
  const nextSlot = new Map<string, number>(senders.map((s) => [s.id, input.startTime.getTime()]));

  const created = [];
  for (let i = 0; i < input.recipients.length; i++) {
    const sender = senders[i % senders.length];
    const slotTime = nextSlot.get(sender.id)!;
    nextSlot.set(sender.id, slotTime + input.delayMs);

    const scheduledFor = new Date(slotTime);

    const row = await prisma.scheduledEmail.create({
      data: {
        batchId: batch.id,
        senderId: sender.id,
        recipientEmail: input.recipients[i],
        subject: input.subject,
        body: input.body,
        scheduledFor,
        status: EmailStatus.SCHEDULED,
      },
    });
    created.push(row);
  }

  // Enqueue jobs in a second pass so a DB failure never leaves an orphaned
  // BullMQ job with no DB record behind it.
  for (const row of created) {
    const delay = Math.max(0, row.scheduledFor.getTime() - Date.now());
    const job = await emailQueue.add(
      "send-email",
      {
        scheduledEmailId: row.id,
        senderId: row.senderId!,
        recipientEmail: row.recipientEmail,
        subject: row.subject,
        body: row.body,
      },
      {
        delay,
        // Idempotency: jobId is deterministic (== DB row id), so re-running
        // scheduleBatch or a reconciliation pass can never create a duplicate
        // job for the same ScheduledEmail row - BullMQ silently no-ops.
        jobId: row.id,
      }
    );
    await prisma.scheduledEmail.update({
      where: { id: row.id },
      data: { bullJobId: job.id },
    });
  }

  return batch;
}

/**
 * Startup reconciliation: on server boot, find any ScheduledEmail rows that
 * are still SCHEDULED but (for whatever reason - e.g. the Redis queue was
 * wiped) have no corresponding job in BullMQ, and re-enqueue them. This is
 * what makes the system resilient even to Redis data loss, not just app
 * restarts (Redis itself already survives an app restart with no help).
 */
export async function reconcilePendingJobs() {
  const pending = await prisma.scheduledEmail.findMany({
    where: { status: EmailStatus.SCHEDULED },
  });

  let reQueued = 0;
  for (const row of pending) {
    const existingJob = row.bullJobId ? await emailQueue.getJob(row.bullJobId) : undefined;
    if (existingJob) continue; // already safely in the queue

    const delay = Math.max(0, row.scheduledFor.getTime() - Date.now());
    const job = await emailQueue.add(
      "send-email",
      {
        scheduledEmailId: row.id,
        senderId: row.senderId!,
        recipientEmail: row.recipientEmail,
        subject: row.subject,
        body: row.body,
      },
      { delay, jobId: row.id }
    );
    await prisma.scheduledEmail.update({ where: { id: row.id }, data: { bullJobId: job.id } });
    reQueued++;
  }
  return reQueued;
}
