import { ConnectionOptions } from "bullmq";
import { env } from "../config/env";

// BullMQ (ioredis under the hood) connection options.
// Using host/port (not a shared node-redis client) is BullMQ's documented pattern.
export const bullConnection: ConnectionOptions = {
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null, // required by BullMQ for blocking commands
};
