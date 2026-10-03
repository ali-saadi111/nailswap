import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseJson, requireInternal } from "@/lib/api";
import { processJob, processQueued } from "@/lib/tryon/worker";

export const maxDuration = 300;

const schema = z.object({
  jobId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

/** POST /api/tryon/worker — internal: process one job (`jobId`) or drain the queue. */
export const POST = handle(async (req: NextRequest) => {
  requireInternal(req);
  const body = await parseJson(req, schema).catch(() => ({}) as z.infer<typeof schema>);
  if (body.jobId) return json({ jobId: body.jobId, outcome: await processJob(body.jobId) });
  return json(await processQueued(body.limit ?? 5));
});
