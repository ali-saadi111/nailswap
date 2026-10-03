import type { NextRequest } from "next/server";
import { handle, json, requireInternal } from "@/lib/api";
import { dispatchDue } from "@/lib/notifications/dispatch";

export const maxDuration = 120;

/** POST /api/internal/notifications/dispatch — cron (every minute): send due notifications. */
export const POST = handle(async (req: NextRequest) => {
  requireInternal(req);
  return json(await dispatchDue(50));
});

export const GET = POST;
