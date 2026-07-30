export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export type ScheduledStatus = "SCHEDULED" | "PROCESSING" | "RESCHEDULED";
export type SentStatus = "SENT" | "FAILED";

export interface ScheduledEmailRow {
  id: string;
  recipientEmail: string;
  subject: string;
  scheduledFor: string;
  status: ScheduledStatus;
}

export interface SentEmailRow {
  id: string;
  recipientEmail: string;
  subject: string;
  sentAt: string | null;
  status: SentStatus;
  errorMessage?: string | null;
}

export interface ComposePayload {
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  file?: File;
}
