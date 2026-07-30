import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { sendersRouter } from "./routes/senders";
import { scheduleRouter } from "./routes/schedule";
import { reconcilePendingJobs } from "./services/scheduler";

const app = express();

app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/api/senders", sendersRouter);
app.use("/api/schedule", scheduleRouter);

app.listen(env.port, async () => {
  console.log(`ReachInbox scheduler API listening on :${env.port}`);

  // On boot, re-enqueue any SCHEDULED rows that don't have a live BullMQ job
  // behind them (covers the edge case of Redis data loss, not just app
  // restarts - a plain app restart never loses jobs because they live in
  // Redis, independent of the Node process).
  const reQueued = await reconcilePendingJobs();
  if (reQueued > 0) console.log(`Reconciled ${reQueued} pending job(s) on startup.`);
});
