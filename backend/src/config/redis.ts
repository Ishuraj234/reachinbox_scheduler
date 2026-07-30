import { createClient } from "redis";
import { env } from "./env";

// Plain redis client used for our custom hourly-rate-limit counters.
// (BullMQ manages its own ioredis-style connection separately, see queue/connection.ts)
export const redisClient = createClient({
  socket: { host: env.redisHost, port: env.redisPort },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

let connected = false;
export async function ensureRedisConnected() {
  if (!connected) {
    await redisClient.connect();
    connected = true;
  }
}
