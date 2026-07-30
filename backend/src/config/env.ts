import dotenv from "dotenv";
dotenv.config();

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientUrl: required("CLIENT_URL", "http://localhost:5173"),
  cookieSecret: required("COOKIE_SECRET", "dev_cookie_secret"),
  jwtSecret: required("JWT_SECRET", "dev_jwt_secret"),

  databaseUrl: required("DATABASE_URL"),

  redisHost: required("REDIS_HOST", "localhost"),
  redisPort: Number(process.env.REDIS_PORT ?? 6379),

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback",

  etherealSmtpHost: process.env.ETHEREAL_SMTP_HOST ?? "smtp.ethereal.email",
  etherealSmtpPort: Number(process.env.ETHEREAL_SMTP_PORT ?? 587),

  defaultMinDelayMs: Number(process.env.DEFAULT_MIN_DELAY_MS ?? 2000),
  defaultMaxEmailsPerHour: Number(process.env.DEFAULT_MAX_EMAILS_PER_HOUR ?? 200),

  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
};
