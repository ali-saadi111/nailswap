import type { NextRequest } from "next/server";
import { handle, json, requireInternal } from "@/lib/api";
import { processQueued, requeueStuck } from "@/lib/tryon/worker";

export const maxDuration = 300;

/** POST /api/internal/tryon/requeue — cron (every 5 min): recover stuck jobs, then drain the queue. */
export const POST = handle(async (req: NextRequest) => {
  requireInternal(req);
  const requeued = await requeueStuck();
  const drained = await processQueued(5);
  return json({ requeued, ...drained });
});

export const GET = POST;
