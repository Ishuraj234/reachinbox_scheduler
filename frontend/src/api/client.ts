import axios from "axios";
import { ComposePayload, ScheduledEmailRow, SentEmailRow, User } from "../types";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const client = axios.create({ baseURL: API_BASE, withCredentials: true });

export function googleLoginUrl() {
  return `${API_BASE}/auth/google`;
}

export async function fetchMe(): Promise<User | null> {
  try {
    const { data } = await client.get<User>("/auth/me");
    return data;
  } catch {
    return null;
  }
}

export async function logout() {
  await client.post("/auth/logout");
}

export async function fetchScheduled(): Promise<ScheduledEmailRow[]> {
  const { data } = await client.get<ScheduledEmailRow[]>("/api/schedule/scheduled");
  return data;
}

export async function fetchSent(): Promise<SentEmailRow[]> {
  const { data } = await client.get<SentEmailRow[]>("/api/schedule/sent");
  return data;
}

export async function parseLeadsFile(file: File): Promise<{ count: number }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post("/api/schedule/parse-leads", form);
  return data;
}

export async function submitCompose(payload: ComposePayload): Promise<{ batchId: string; totalRecipients: number }> {
  const form = new FormData();
  form.append("subject", payload.subject);
  form.append("body", payload.body);
  form.append("startTime", payload.startTime);
  form.append("delayMs", String(payload.delayMs));
  form.append("hourlyLimit", String(payload.hourlyLimit));
  if (payload.file) form.append("file", payload.file);

  const { data } = await client.post("/api/schedule", form);
  return data;
}
