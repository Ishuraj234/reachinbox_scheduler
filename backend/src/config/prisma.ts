import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance across the app (server + worker each get their own process,
// but within a process we reuse one client to avoid exhausting DB connections).
export const prisma = new PrismaClient();
