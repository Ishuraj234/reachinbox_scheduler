import { Queue } from "bullmq";
import { bullConnection } from "./connection";

export const EMAIL_QUEUE_NAME = "email-send-queue";

export interface EmailJobData {
  scheduledEmailId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

// One durable queue backed by Redis. Jobs are added with a `delay` so BullMQ
// itself acts as the scheduler (no cron). Redis persists the queue (via its own
// RDB/AOF persistence), so jobs survive an app restart as long as the Redis
// server/container stays up - the Node process restarting does NOT lose jobs.
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 * 24 * 7 }, // keep 7 days for dashboard/debug
    removeOnFail: false,
  },
});
