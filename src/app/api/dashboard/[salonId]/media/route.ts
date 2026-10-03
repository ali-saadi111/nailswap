import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { errors, handle, json, noContent, parseForm, parseJson, requireSalonRole } from "@/lib/api";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, extractSwatchColor, prepareCatalogImage } from "@/lib/images";
import { BUCKETS, publicMediaUrl, removeObjects, uploadObject } from "@/lib/storage";

export const maxDuration = 60;

const KINDS = ["logo", "cover", "gallery", "design", "polish", "staff"] as const;

/**
 * POST /api/dashboard/:salonId/media — multipart { file, kind }
 * Optimises the image (metadata stripped, ≤2048px WebP) into the public bucket under the
 * salon's folder. For `polish` swatches the dominant colour is also extracted.
 * Response: { path, url, hex? }. Store `path` on the row (logo_path, cover_path, swatch_path…).
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "manager");
  const form = await parseForm(req);
  const kind = z.enum(KINDS).parse(form.get("kind"));
  const file = form.get("file");
  if (!(file instanceof File)) throw errors.badRequest("file_required");
  if (file.size > MAX_UPLOAD_BYTES) throw errors.tooLarge();
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type))
    throw errors.unprocessable("unsupported", "Use JPG, PNG, WebP or HEIC");

  const original = Buffer.from(await file.arrayBuffer());
  const maxEdge = kind === "logo" || kind === "staff" ? 512 : kind === "polish" ? 800 : 2048;
  const optimised = await prepareCatalogImage(original, maxEdge);
  const path = `${salonId}/${kind}/${nanoid(12)}.webp`;
  await uploadObject(BUCKETS.publicMedia, path, optimised, "image/webp");
  const hex = kind === "polish" ? await extractSwatchColor(original) : undefined;
  return json({ path, url: publicMediaUrl(path), hex }, { status: 201 });
});

const deleteSchema = z.object({ path: z.string().min(1).max(300) });

/** DELETE /api/dashboard/:salonId/media { path } — removes an object from the salon's folder. */
export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "manager");
  const body = await parseJson(req, deleteSchema);
  if (!body.path.startsWith(`${salonId}/`)) throw errors.forbidden("Path outside the salon folder");
  await removeObjects(BUCKETS.publicMedia, [body.path]);
  return noContent();
});
