import type { NextRequest } from "next/server";
import { handle, noContent, requireUser, userClient } from "@/lib/api";

/** DELETE /api/account/looks/:id — removes a saved look (RLS: own rows only). */
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const supabase = await userClient();
  const { error } = await supabase.from("saved_looks").delete().eq("id", id);
  if (error) throw error;
  return noContent();
});
