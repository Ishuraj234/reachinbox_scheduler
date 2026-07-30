import { redisClient, ensureRedisConnected } from "../config/redis";

/**
 * Enforces "N emails per hour per sender" using a Redis counter keyed by
 * `rate:{senderId}:{hourWindowStartEpoch}`.
 *
 * Why this is safe across multiple worker instances:
 * - INCR is atomic in Redis, so concurrent workers never double-count.
 * - The key auto-expires ~2 hours after the window starts, so we don't
 *   accumulate stale counters forever.
 * - Because every worker asks the SAME Redis instance for the SAME key
 *   (derived purely from senderId + current hour), horizontal scaling of
 *   workers doesn't break the limit - it's not an in-memory count.
 */

function hourWindowStart(date: Date): number {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

export function nextHourWindowStart(date: Date): Date {
  const start = hourWindowStart(date);
  return new Date(start + 60 * 60 * 1000);
}

function keyFor(senderId: string, windowStart: number): string {
  return `rate:${senderId}:${windowStart}`;
}

/**
 * Attempts to reserve one "send slot" for this sender in the current hour.
 * Returns true if allowed (and increments the counter), false if the
 * sender's hourly limit has already been reached.
 */
export async function tryReserveSendSlot(
  senderId: string,
  maxPerHour: number,
  at: Date = new Date()
): Promise<boolean> {
  await ensureRedisConnected();
  const windowStart = hourWindowStart(at);
  const key = keyFor(senderId, windowStart);

  const count = await redisClient.incr(key);
  if (count === 1) {
    // first increment in this window - set expiry so the key self-cleans
    await redisClient.expire(key, 60 * 60 * 2);
  }

  if (count > maxPerHour) {
    // Over budget - release our reservation and reject.
    await redisClient.decr(key);
    return false;
  }
  return true;
}

export async function currentWindowCount(senderId: string, at: Date = new Date()): Promise<number> {
  await ensureRedisConnected();
  const windowStart = hourWindowStart(at);
  const val = await redisClient.get(keyFor(senderId, windowStart));
  return val ? Number(val) : 0;
}
