/**
 * Demo dataset for local development, CI and E2E: 3 salons with owners, staff, services,
 * designs (Openverse photos from `pnpm designs:fetch`, else generated covers), polishes (generated swatches), clients, bookings, reviews,
 * analytics, invoices and a platform admin.
 *
 *   pnpm db:seed            (needs `supabase start` and .env.local)
 *
 * Idempotent: existing demo salons/users are removed first.
 * Sign in locally with any listed phone and the OTP 123456 (supabase/config.toml → test_otp).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { addDays, addMinutes, setHours, setMinutes, startOfDay, subDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { Database, Json } from "../src/lib/supabase/database.types";

loadEnv({ path: ".env.local" });
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (see .env.example)");
const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const TZ = "Asia/Beirut";
const OTP_NOTE = "OTP 123456";

// ── Fixtures ────────────────────────────────────────────────────────────────
export const DEMO = {
  admin: { phone: "96170000009", name: "Platform Admin" },
  client: { phone: "96170000021", name: "Demo Client" },
  salons: [
    {
      slug: "glow-beirut",
      name: "Glow Nails Beirut",
      description: "Achrafieh's go-to studio for chrome, BIAB and hand-painted art.",
      city: "Beirut",
      area: "Achrafieh",
      address: "Sassine Square, Achrafieh",
      lat: 33.8886,
      lng: 35.5178,
      brand: "#C86B85",
      plan: "pro" as const,
      bookingMode: "instant" as const,
      owner: { phone: "96170000001", name: "Maya Khoury" },
      staff: [
        { name: "Maya", phone: "96170000001", color: "#C86B85" },
        { name: "Rita", phone: "96170000011", color: "#8B5E3C" },
        { name: "Nour", phone: null, color: "#4B6B8A" },
      ],
    },
    {
      slug: "nailbar-jounieh",
      name: "The Nail Bar Jounieh",
      description: "Sea-view nail bar in Jounieh. Gel, acrylic and pedicures.",
      city: "Jounieh",
      area: "Kaslik",
      address: "Kaslik main road, Jounieh",
      lat: 33.9808,
      lng: 35.6178,
      brand: "#4B6B8A",
      plan: "basic" as const,
      bookingMode: "instant" as const,
      owner: { phone: "96170000002", name: "Lea Haddad" },
      staff: [
        { name: "Lea", phone: "96170000002", color: "#4B6B8A" },
        { name: "Sara", phone: "96170000012", color: "#C86B85" },
      ],
    },
    {
      slug: "studio-rose",
      name: "Studio Rosé",
      description: "Bridal and minimal nails in the heart of Tripoli. By appointment.",
      city: "Tripoli",
      area: "Al Mina",
      address: "Al Mina corniche, Tripoli",
      lat: 34.4367,
      lng: 35.8497,
      brand: "#B85C38",
      plan: "trial" as const,
      bookingMode: "approval" as const,
      owner: { phone: "96170000003", name: "Rania Saleh" },
      staff: [
        { name: "Rania", phone: "96170000003", color: "#B85C38" },
        { name: "Dina", phone: "96170000013", color: "#7B4B94" },
      ],
    },
  ],
};

type ServiceCategory = Database["public"]["Enums"]["service_category"];
const SERVICES: Array<{
  name: string;
  category: ServiceCategory;
  price: number;
  duration: number;
  buffer?: number;
  tryon?: boolean;
}> = [
  { name: "Classic Manicure", category: "manicure", price: 20, duration: 45 },
  { name: "Gel Manicure", category: "gel", price: 35, duration: 60, buffer: 10 },
  { name: "BIAB Overlay", category: "biab", price: 45, duration: 75, buffer: 10 },
  { name: "Acrylic Full Set", category: "acrylic", price: 60, duration: 120, buffer: 15 },
  { name: "Gel Removal", category: "removal", price: 10, duration: 20, tryon: false },
  { name: "Spa Pedicure", category: "pedicure", price: 30, duration: 60, tryon: false },
];

type DesignCategory = Database["public"]["Enums"]["design_category"];
type Shape = Database["public"]["Enums"]["nail_shape"];
type Length = Database["public"]["Enums"]["nail_length"];
const DESIGNS: Array<{
  slug: string;
  name: string;
  category: DesignCategory;
  shape: Shape;
  length: Length;
  prompt: string;
  addon: number;
  addonMin: number;
  colors: [string, string];
  tags: string[];
  featured?: boolean;
}> = [
  {
    slug: "classic-french",
    name: "Classic French",
    category: "french",
    shape: "squoval",
    length: "medium",
    prompt: "classic french manicure, sheer pink base, crisp white tips, glossy finish",
    addon: 5,
    addonMin: 10,
    colors: ["#F7D9DD", "#FFFFFF"],
    tags: ["french", "classic", "office"],
    featured: true,
  },
  {
    slug: "retro-robot",
    name: "Retro Robot",
    category: "art_3d",
    shape: "squoval",
    length: "short",
    prompt: "mint green base with hand-painted silver robots and circuit lines, red accents, glossy",
    addon: 10,
    addonMin: 15,
    colors: ["#8DB580", "#C0C4CA"],
    tags: ["robot", "fun", "silver"],
    featured: true,
  },
  {
    slug: "watermelon-pop",
    name: "Watermelon Pop",
    category: "seasonal",
    shape: "round",
    length: "short",
    prompt: "pink watermelon slice nail art with green rind tips and black seed dots, glossy",
    addon: 12,
    addonMin: 20,
    colors: ["#F27C9B", "#4CAF50"],
    tags: ["summer", "fruit", "fun"],
  },
  {
    slug: "pink-blossoms",
    name: "Pink Blossoms",
    category: "art_3d",
    shape: "squoval",
    length: "short",
    prompt: "lilac pink base with stamped pink floral pattern, glossy",
    addon: 20,
    addonMin: 30,
    colors: ["#E9A6C8", "#F7D6E8"],
    tags: ["flowers", "pink", "stamping"],
  },
  {
    slug: "candy-chevron",
    name: "Candy Chevron",
    category: "minimal",
    shape: "round",
    length: "short",
    prompt: "red and white chevron stripes on short nails, glossy",
    addon: 0,
    addonMin: 0,
    colors: ["#B5172F", "#FFFFFF"],
    tags: ["chevron", "red", "everyday"],
    featured: true,
  },
  {
    slug: "bridal-french",
    name: "Bridal French",
    category: "bridal",
    shape: "square",
    length: "long",
    prompt: "long square french tips on sheer pink base with a tiny white 3D flower accent, glossy",
    addon: 25,
    addonMin: 40,
    colors: ["#FFFFFF", "#F4D7D9"],
    tags: ["bridal", "french", "wedding"],
    featured: true,
  },
  {
    slug: "treasure-map",
    name: "Treasure Map",
    category: "seasonal",
    shape: "round",
    length: "short",
    prompt:
      "parchment cream base with hand-painted black and red treasure map details and compass rose, glossy",
    addon: 15,
    addonMin: 25,
    colors: ["#EADBC0", "#2B2B2B"],
    tags: ["art", "map", "hand-painted"],
  },
  {
    slug: "gilded-cherry",
    name: "Gilded Cherry",
    category: "minimal",
    shape: "round",
    length: "short",
    prompt: "coral red polish with thin gold striping-tape chevrons, glossy",
    addon: 0,
    addonMin: 0,
    colors: ["#D9473F", "#C9A227"],
    tags: ["red", "gold", "bold"],
  },
];

type Finish = Database["public"]["Enums"]["polish_finish"];
const POLISHES: Array<{
  brand: string;
  collection: string | null;
  shade: string;
  code: string | null;
  hex: string;
  finish: Finish;
}> = [
  {
    brand: "OPI",
    collection: "Classics",
    shade: "Bubble Bath",
    code: "NLS86",
    hex: "#F7D9DD",
    finish: "glossy",
  },
  {
    brand: "OPI",
    collection: "Classics",
    shade: "Big Apple Red",
    code: "NLN25",
    hex: "#C1272D",
    finish: "glossy",
  },
  {
    brand: "OPI",
    collection: "Classics",
    shade: "Lincoln Park After Dark",
    code: "NLW42",
    hex: "#3B1F2B",
    finish: "glossy",
  },
  { brand: "Essie", collection: null, shade: "Ballet Slippers", code: "6", hex: "#F3D5DC", finish: "glossy" },
  { brand: "Essie", collection: null, shade: "Mademoiselle", code: "384", hex: "#F0DAD8", finish: "shimmer" },
  { brand: "CND", collection: "Shellac", shade: "Cream Puff", code: null, hex: "#FBFAF8", finish: "glossy" },
  { brand: "CND", collection: "Shellac", shade: "Wildfire", code: null, hex: "#B8232F", finish: "glossy" },
  {
    brand: "Kiara Sky",
    collection: "Chrome",
    shade: "Silver Mirror",
    code: null,
    hex: "#C0C4CC",
    finish: "chrome",
  },
  {
    brand: "Kiara Sky",
    collection: "Cat Eye",
    shade: "Emerald Eye",
    code: null,
    hex: "#0F7B5F",
    finish: "cat_eye",
  },
  { brand: "Gelish", collection: null, shade: "Matte Taupe", code: null, hex: "#B7A08C", finish: "matte" },
];

const CLIENT_NAMES = [
  "Nadine Aoun",
  "Yara Nassar",
  "Joelle Fares",
  "Tala Rizk",
  "Cynthia Abou Jaoude",
  "Rim Khalil",
  "Maria Chidiac",
  "Lina Sfeir",
];
const REVIEW_BODIES = [
  "Beautiful work and super clean. My chrome lasted three weeks!",
  "Loved trying the design on my hand before booking — exactly what I got.",
  "Friendly team, on time, great music. Will be back for BIAB.",
  "Nour did the most delicate french I've ever had.",
  "A little pricey but worth it. The pearls are still on after 2 weeks.",
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const log = (msg: string) => console.log(`• ${msg}`);
const e164 = (digits: string) => `+${digits}`;

function must<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

/** Design cover: two-colour gradient with five nail silhouettes. */
async function coverImage(c1: string, c2: string, shape: Shape) {
  const nails = [0, 1, 2, 3, 4]
    .map((i) => {
      const x = 120 + i * 200;
      const h = i === 2 ? 320 : i === 0 || i === 4 ? 260 : 300;
      const ry = shape === "square" ? 10 : shape === "almond" || shape === "stiletto" ? 70 : 40;
      return `<rect x="${x}" y="${560 - h}" width="140" height="${h}" rx="${ry}" ry="${ry}" fill="url(#g)" stroke="rgba(255,255,255,0.55)" stroke-width="6"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#faf8f5"/><stop offset="1" stop-color="#eee6dc"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#bg)"/>${nails}
    <ellipse cx="600" cy="640" rx="520" ry="60" fill="rgba(0,0,0,0.06)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

/** Openly licensed design photos downloaded by scripts/fetch-design-images.ts (optional). */
type PhotoCredit = { file: string; attribution: string };
const PHOTO_DIR = path.join(process.cwd(), "scripts", "assets", "designs");
const PHOTO_CREDITS: Record<string, PhotoCredit[]> = existsSync(path.join(PHOTO_DIR, "credits.json"))
  ? JSON.parse(readFileSync(path.join(PHOTO_DIR, "credits.json"), "utf8"))
  : {};

function designPhotos(slug: string) {
  return (PHOTO_CREDITS[slug] ?? [])
    .filter((c) => existsSync(path.join(PHOTO_DIR, c.file)))
    .map((c) => ({ ...c, body: readFileSync(path.join(PHOTO_DIR, c.file)) }));
}

/** Polish swatch: solid colour with a soft highlight. */
async function swatchImage(hex: string, finish: Finish) {
  const highlight = finish === "matte" ? 0.08 : finish === "chrome" ? 0.6 : 0.3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="400" height="400" rx="80" fill="${hex}"/>
    <ellipse cx="150" cy="120" rx="110" ry="60" fill="rgba(255,255,255,${highlight})"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

/** Placeholder "hand photo" for demo try-on jobs. */
async function placeholderPhoto(tint: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1365"><rect width="1024" height="1365" fill="#e9d5c5"/><rect x="200" y="400" width="620" height="900" rx="300" fill="#d9b99b"/><rect x="330" y="150" width="90" height="420" rx="45" fill="#d9b99b"/><rect x="330" y="140" width="90" height="120" rx="45" fill="${tint}"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function upload(bucket: string, path: string, body: Buffer, contentType: string) {
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`);
  return path;
}

async function ensureUser(phone: string, fullName: string, extra: Record<string, unknown> = {}) {
  const { data: existing } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (existing) {
    await admin
      .from("profiles")
      .update({ full_name: fullName, ...extra })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    phone: e164(phone),
    phone_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser ${phone}: ${error?.message}`);
  await admin
    .from("profiles")
    .update({ full_name: fullName, ...extra })
    .eq("id", data.user.id);
  return data.user.id;
}

/** Local salon time → Date. */
function at(day: Date, hh: number, mm = 0) {
  return fromZonedTime(setMinutes(setHours(startOfDay(day), hh), mm), TZ);
}

function pick<T>(arr: readonly T[], i: number) {
  return arr[i % arr.length];
}

// ── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanup() {
  const slugs = DEMO.salons.map((s) => s.slug);
  const { data: old } = await admin.from("salons").select("id").in("slug", slugs);
  for (const s of old ?? []) {
    for (const bucket of ["public-media", "private-docs"]) {
      const { data: files } = await admin.storage.from(bucket).list(s.id, { limit: 1000 });
      for (const folder of files ?? []) {
        const { data: inner } = await admin.storage
          .from(bucket)
          .list(`${s.id}/${folder.name}`, { limit: 1000 });
        const paths = (inner ?? []).map((f) => `${s.id}/${folder.name}/${f.name}`);
        if (paths.length) await admin.storage.from(bucket).remove(paths);
      }
    }
  }
  if (old?.length)
    must(
      await admin
        .from("salons")
        .delete()
        .in(
          "id",
          old.map((s) => s.id),
        ),
      "delete salons",
    );

  const phones = [
    DEMO.admin.phone,
    DEMO.client.phone,
    ...DEMO.salons.flatMap((s) => [
      s.owner.phone,
      ...s.staff.map((st) => st.phone).filter((p): p is string => Boolean(p)),
    ]),
  ];
  const { data: users } = await admin.from("profiles").select("id").in("phone", phones);
  for (const u of users ?? []) {
    await admin.from("tryon_jobs").delete().eq("user_id", u.id);
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`deleteUser: ${error.message}`);
  }
  log(`cleaned ${old?.length ?? 0} salons, ${users?.length ?? 0} users`);
}

// ── Seed ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding ${url} …`);
  await cleanup();

  const adminId = await ensureUser(DEMO.admin.phone, DEMO.admin.name, { is_platform_admin: true });
  const clientUserId = await ensureUser(DEMO.client.phone, DEMO.client.name);
  log(`admin ${DEMO.admin.phone} (${OTP_NOTE}), demo client ${DEMO.client.phone}`);

  const now = new Date();
  let salonIndex = 0;

  for (const def of DEMO.salons) {
    salonIndex++;
    const ownerId = await ensureUser(def.owner.phone, def.owner.name);
    const salon = must(
      await admin
        .from("salons")
        .insert({
          slug: def.slug,
          name: def.name,
          description: def.description,
          description_i18n: { en: def.description },
          status: "active",
          owner_id: ownerId,
          brand_color: def.brand,
          city: def.city,
          area: def.area,
          address: def.address,
          lat: def.lat,
          lng: def.lng,
          phone: def.owner.phone,
          whatsapp_number: def.owner.phone,
          email: `${def.slug}@example.com`,
          instagram: def.slug.replace("-", "."),
          booking_mode: def.bookingMode,
          directory_approved: true,
          onboarding_step: 6,
          onboarding_completed_at: now.toISOString(),
          min_lead_time_min: 60,
          settings: { seeded: true },
        })
        .select("*")
        .single(),
      "insert salon",
    );
    log(`salon ${salon.name} (${salon.slug}) owner ${def.owner.phone}`);

    // Branding images
    const logo = await upload(
      "public-media",
      `${salon.id}/logo/logo.webp`,
      await swatchImage(def.brand, "glossy"),
      "image/webp",
    );
    const cover = await upload(
      "public-media",
      `${salon.id}/cover/cover.webp`,
      await coverImage(def.brand, "#F5F1EC", "almond"),
      "image/webp",
    );
    await admin.from("salons").update({ logo_path: logo, cover_path: cover }).eq("id", salon.id);

    // Hours (Mon–Sat 10–19, Sun closed)
    must(
      await admin.from("salon_hours").insert(
        [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          salon_id: salon.id,
          weekday,
          open_time: "10:00",
          close_time: "19:00",
          is_closed: weekday === 0,
        })),
      ),
      "hours",
    );
    await admin.from("salon_holidays").insert({
      salon_id: salon.id,
      date: addDays(now, 20).toISOString().slice(0, 10),
      name: "Staff day off",
    });

    // Subscription state
    if (def.plan !== "trial") {
      must(
        await admin
          .from("subscriptions")
          .update({
            plan_code: def.plan,
            status: "active",
            current_period_start: subDays(now, 10).toISOString(),
            current_period_end: addDays(now, 20).toISOString(),
            trial_ends_at: subDays(now, 40).toISOString(),
          })
          .eq("salon_id", salon.id),
        "subscription",
      );
      await admin
        .from("salons")
        .update({ remove_branding: def.plan === "pro" })
        .eq("id", salon.id);
    }

    // Services
    const services = must(
      await admin
        .from("services")
        .insert(
          SERVICES.map((s, i) => ({
            salon_id: salon.id,
            name: s.name,
            name_i18n: { en: s.name },
            category: s.category,
            price: s.price + (salonIndex - 2) * 2,
            duration_min: s.duration,
            buffer_min: s.buffer ?? 0,
            supports_tryon: s.tryon ?? true,
            sort_order: i,
          })),
        )
        .select("id, name, category, price, duration_min"),
      "services",
    );

    // Staff + schedules + memberships
    const staffRows: Array<{ id: string; user_id: string | null; name: string }> = [];
    for (const [i, st] of def.staff.entries()) {
      let userId: string | null = null;
      if (st.phone) {
        userId =
          st.phone === def.owner.phone ? ownerId : await ensureUser(st.phone, `${st.name} (${def.name})`);
        if (st.phone !== def.owner.phone) {
          await admin.from("salon_members").upsert({
            salon_id: salon.id,
            user_id: userId,
            role: i === 1 ? "manager" : "staff",
            invited_by: ownerId,
          });
        }
      }
      const avatar = await upload(
        "public-media",
        `${salon.id}/staff/${st.name.toLowerCase()}.webp`,
        await swatchImage(st.color, "shimmer"),
        "image/webp",
      );
      const row = must(
        await admin
          .from("staff")
          .insert({
            salon_id: salon.id,
            user_id: userId,
            display_name: st.name,
            avatar_path: avatar,
            color: st.color,
            bio: `${st.name} specialises in ${pick(["chrome and cat-eye", "BIAB and natural nails", "hand-painted art"], i)}.`,
            sort_order: i,
          })
          .select("id, user_id")
          .single(),
        "staff",
      );
      staffRows.push({ ...row, name: st.name });
      // Weekly rules: staff 0 Mon–Fri, staff 1 Tue–Sat, others Mon–Sat; lunch break 14:00–14:30
      const days = i === 0 ? [1, 2, 3, 4, 5] : i === 1 ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
      must(
        await admin.from("staff_schedule_rules").insert(
          days.flatMap((weekday) => [
            { staff_id: row.id, weekday, kind: "work" as const, start_time: "10:00", end_time: "19:00" },
            { staff_id: row.id, weekday, kind: "break" as const, start_time: "14:00", end_time: "14:30" },
          ]),
        ),
        "schedule",
      );
      // Everyone does everything except pedicure for the first technician
      must(
        await admin
          .from("staff_services")
          .insert(
            services
              .filter((s) => !(i === 0 && s.category === "pedicure"))
              .map((s) => ({ staff_id: row.id, service_id: s.id })),
          ),
        "staff_services",
      );
    }
    await admin.from("staff_time_off").insert({
      staff_id: staffRows[1].id,
      starts_at: addDays(now, 5).toISOString(),
      ends_at: addDays(now, 7).toISOString(),
      reason: "Holiday",
    });

    // Polishes
    const polishes = must(
      await admin
        .from("polishes")
        .insert(
          await Promise.all(
            POLISHES.map(async (p, i) => ({
              salon_id: salon.id,
              brand: p.brand,
              collection: p.collection,
              shade_name: p.shade,
              shade_code: p.code,
              finish: p.finish,
              hex_color: p.hex,
              hex_color_auto: p.hex,
              swatch_path: await upload(
                "public-media",
                `${salon.id}/polish/${i}.webp`,
                await swatchImage(p.hex, p.finish),
                "image/webp",
              ),
              in_stock: i !== 9,
              sort_order: i,
            })),
          ),
        )
        .select("id, hex_color"),
      "polishes",
    );

    // Designs (each salon shows a slightly different subset)
    const designDefs = DESIGNS.filter((_, i) => salonIndex !== 3 || i % 2 === 0 || i === 5);
    const designs = must(
      await admin
        .from("designs")
        .insert(
          await Promise.all(
            designDefs.map(async (d, i) => {
              const photo = designPhotos(d.slug)[0];
              return {
                salon_id: salon.id,
                slug: d.slug,
                name: d.name,
                name_i18n: { en: d.name },
                description: photo
                  ? `${d.name} — ${d.prompt}. Photo: ${photo.attribution}`
                  : `${d.name} — ${d.prompt}.`,
                category: d.category,
                tags: d.tags,
                shape: d.shape,
                length: d.length,
                prompt_text: d.prompt,
                price_addon: d.addon,
                duration_addon_min: d.addonMin,
                cover_path: await upload(
                  "public-media",
                  `${salon.id}/design/${d.slug}.webp`,
                  photo?.body ?? (await coverImage(d.colors[0], d.colors[1], d.shape)),
                  "image/webp",
                ),
                is_featured: Boolean(d.featured),
                sort_order: i,
                tryon_count: 40 + ((i * 37 + salonIndex * 11) % 120),
              };
            }),
          ),
        )
        .select("id, slug, price_addon"),
      "designs",
    );
    for (const [i, d] of designs.entries()) {
      const photos = designPhotos(d.slug);
      const gallery = [
        {
          design_id: d.id,
          path: `${salon.id}/design/${d.slug}.webp`,
          alt: photos[0]?.attribution ?? d.slug,
          sort_order: 0,
        },
      ];
      for (const [n, p] of photos.slice(1).entries()) {
        const extra = await upload(
          "public-media",
          `${salon.id}/design/${d.slug}-${n + 2}.webp`,
          p.body,
          "image/webp",
        );
        gallery.push({ design_id: d.id, path: extra, alt: p.attribution, sort_order: n + 1 });
      }
      await admin.from("design_images").insert(gallery);
      const tryonServices = services.filter((s) => ["gel", "biab", "acrylic"].includes(s.category));
      await admin
        .from("design_services")
        .insert(tryonServices.map((s) => ({ design_id: d.id, service_id: s.id })));
      await admin.from("design_polishes").insert([
        { design_id: d.id, polish_id: pick(polishes, i).id },
        { design_id: d.id, polish_id: pick(polishes, i + 3).id },
      ]);
    }

    // Clients
    const clientDefs = [
      { name: DEMO.client.name, phone: DEMO.client.phone, user_id: clientUserId },
      ...CLIENT_NAMES.slice(0, 6).map((name, i) => ({
        name,
        phone: `9617${String(1000000 + salonIndex * 10000 + i).slice(-7)}`,
        user_id: null,
      })),
    ];
    const clients = must(
      await admin
        .from("clients")
        .insert(
          clientDefs.map((c, i) => ({
            salon_id: salon.id,
            user_id: c.user_id,
            full_name: c.name,
            phone: c.phone,
            email: i === 0 ? "client@example.com" : null,
            preferred_locale: pick(["en", "ar", "fr"] as const, i),
          })),
        )
        .select("id, phone"),
      "clients",
    );

    // Bookings: past completed / no-shows, upcoming confirmed (and pending for approval salons)
    const gel = services.find((s) => s.category === "gel")!;
    const biab = services.find((s) => s.category === "biab")!;
    const bookingRows: Array<Database["public"]["Tables"]["bookings"]["Insert"]> = [];
    const mkBooking = (
      day: Date,
      hh: number,
      staffIdx: number,
      clientIdx: number,
      status: Database["public"]["Enums"]["booking_status"],
      svc = gel,
      design?: { id: string; price_addon: number },
    ) => {
      const startsAt = at(day, hh);
      const endsAt = addMinutes(startsAt, svc.duration_min + 10);
      bookingRows.push({
        salon_id: salon.id,
        client_id: pick(clients, clientIdx).id,
        staff_id: pick(staffRows, staffIdx).id,
        service_id: svc.id,
        design_id: design?.id ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status,
        source: pick(["tryon", "direct", "direct", "rebook", "dashboard"] as const, clientIdx + staffIdx),
        service_price: Number(svc.price),
        design_price: Number(design?.price_addon ?? 0),
        total_price: Number(svc.price) + Number(design?.price_addon ?? 0),
        currency: "USD",
        locale: "en",
      });
    };
    for (let d = 1; d <= 45; d += 3) {
      const day = subDays(now, d);
      if (day.getDay() === 0) continue;
      mkBooking(day, 10, 0, d % clients.length, d % 9 === 0 ? "no_show" : "completed", gel, pick(designs, d));
      mkBooking(day, 12, 1, (d + 2) % clients.length, "completed", biab);
      if (d % 2 === 0) mkBooking(day, 16, 0, (d + 4) % clients.length, "cancelled", gel);
    }
    for (let d = 1; d <= 6; d++) {
      const day = addDays(now, d);
      if (day.getDay() === 0) continue;
      mkBooking(
        day,
        11,
        0,
        d % clients.length,
        def.bookingMode === "approval" && d % 2 === 0 ? "new" : "confirmed",
        gel,
        pick(designs, d + 1),
      );
      if (d % 2 === 1) mkBooking(day, 15, 1, (d + 3) % clients.length, "confirmed", biab);
    }
    const bookings = must(
      await admin.from("bookings").insert(bookingRows).select("id, client_id, status, starts_at"),
      "bookings",
    );
    // Client counters (the trigger only counts status *changes*)
    for (const c of clients) {
      const mine = bookings.filter((b) => b.client_id === c.id);
      await admin
        .from("clients")
        .update({
          visit_count: mine.filter((b) => b.status === "completed").length,
          no_show_count: mine.filter((b) => b.status === "no_show").length,
          last_visit_at:
            mine
              .filter((b) => b.status === "completed")
              .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0]?.starts_at ?? null,
        })
        .eq("id", c.id);
    }

    // Reviews for a few completed bookings
    const completed = bookings.filter((b) => b.status === "completed").slice(0, 5);
    for (const [i, b] of completed.entries()) {
      must(
        await admin.from("reviews").insert({
          salon_id: salon.id,
          booking_id: b.id,
          client_id: b.client_id,
          user_id: b.client_id === clients[0].id ? clientUserId : null,
          rating: i === 3 ? 4 : 5,
          body: pick(REVIEW_BODIES, i + salonIndex),
          salon_reply: i === 0 ? "Thank you! See you next month 💅" : null,
          replied_at: i === 0 ? now.toISOString() : null,
        }),
        "review",
      );
    }

    // Leads
    await admin.from("leads").insert(
      [0, 1, 2].map((i) => ({
        salon_id: salon.id,
        phone: `96176${String(100000 + salonIndex * 100 + i)}`,
        full_name: pick(CLIENT_NAMES, i + 6),
        design_id: pick(designs, i).id,
        status: pick(["new", "contacted", "new"] as const, i),
      })),
    );

    // Demo AI try-on jobs (count toward quota) with placeholder images
    for (let i = 0; i < (def.plan === "pro" ? 6 : 3); i++) {
      const design = pick(designs, i);
      const jobId = crypto.randomUUID();
      const prefix = `users/${clientUserId}/${jobId}`;
      const photo = await placeholderPhoto(pick(POLISHES, i).hex);
      await upload("tryon", `${prefix}/input.jpg`, photo, "image/jpeg");
      await upload("tryon", `${prefix}/result-1.jpg`, photo, "image/jpeg");
      must(
        await admin.from("tryon_jobs").insert({
          id: jobId,
          salon_id: salon.id,
          user_id: clientUserId,
          status: "succeeded",
          progress: 100,
          input_path: `${prefix}/input.jpg`,
          input_hash: `seed-${salon.slug}-${i}`,
          mask_path: null,
          design_id: design.id,
          params: { mode: "catalog", variations: 1, _seed: true } as unknown as NonNullable<Json>,
          prompt: DESIGNS[i % DESIGNS.length].prompt,
          variations: 1,
          cache_key: `seed-${salon.slug}-${i}`,
          provider: "fal",
          provider_model: "fal-ai/flux-pro/v1/fill",
          result_paths: [`${prefix}/result-1.jpg`],
          cost_usd: 0.05,
          duration_ms: 9000 + i * 500,
          is_saved: i === 0,
          created_at: subDays(now, i + 1).toISOString(),
        }),
        "tryon_job",
      );
      await admin.from("ai_cost_log").insert({
        salon_id: salon.id,
        job_id: jobId,
        provider: "fal",
        model: "fal-ai/flux-pro/v1/fill",
        operation: "inpaint",
        cost_usd: 0.05,
        duration_ms: 9000,
        success: true,
        created_at: subDays(now, i + 1).toISOString(),
      });
      if (i === 0) {
        await admin.from("saved_looks").insert({
          user_id: clientUserId,
          job_id: jobId,
          salon_id: salon.id,
          design_id: design.id,
          image_path: `${prefix}/result-1.jpg`,
          title: "My next look",
        });
      }
    }

    // Analytics events (last 30 days)
    const events: Array<Database["public"]["Tables"]["analytics_events"]["Insert"]> = [];
    for (let d = 0; d < 30; d++) {
      const day = subDays(now, d);
      const base = 8 + ((d * 7 + salonIndex * 3) % 12);
      const push = (
        kind: Database["public"]["Enums"]["analytics_event_kind"],
        n: number,
        withDesign = true,
      ) => {
        for (let i = 0; i < n; i++) {
          events.push({
            salon_id: salon.id,
            kind,
            design_id: withDesign ? pick(designs, d + i).id : null,
            polish_id: kind.startsWith("tryon") && i % 3 === 0 ? pick(polishes, i).id : null,
            anon_id: `seed-${d}-${i}`,
            payload: { seeded: true },
            created_at: at(day, 9 + (i % 10)).toISOString(),
          });
        }
      };
      push("page_view", base * 3, false);
      push("tryon_ar_start", base);
      push("tryon_ar_capture", Math.round(base * 0.6));
      push("tryon_ai_request", Math.round(base * 0.4));
      push("tryon_ai_success", Math.round(base * 0.35));
      push("book_click", Math.round(base * 0.3));
      push("booking_created", Math.max(1, Math.round(base * 0.15)));
      push("share", Math.round(base * 0.1));
      push("qr_scan", d % 3 === 0 ? 2 : 0, false);
    }
    must(await admin.from("analytics_events").insert(events), "analytics");

    // Billing history
    if (def.plan !== "trial") {
      const price = def.plan === "pro" ? 79 : 29;
      const { data: sub } = await admin.from("subscriptions").select("id").eq("salon_id", salon.id).single();
      for (const monthsAgo of [2, 1]) {
        const inv = must(
          await admin
            .from("invoices")
            .insert({
              salon_id: salon.id,
              subscription_id: sub!.id,
              status: "paid",
              subtotal: price,
              total: price,
              line_items: [
                {
                  plan_code: def.plan,
                  description: `${def.plan === "pro" ? "Pro" : "Basic"} plan (monthly)`,
                  amount: price,
                },
              ],
              period_start: subDays(now, 30 * monthsAgo + 10).toISOString(),
              period_end: subDays(now, 30 * (monthsAgo - 1) + 10).toISOString(),
              paid_at: subDays(now, 30 * monthsAgo + 9).toISOString(),
              created_at: subDays(now, 30 * monthsAgo + 10).toISOString(),
            })
            .select("id")
            .single(),
          "invoice",
        );
        await admin.from("payments").insert({
          salon_id: salon.id,
          invoice_id: inv.id,
          purpose: "subscription",
          amount: price,
          method: monthsAgo === 2 ? "card" : "whish",
          provider: monthsAgo === 2 ? "mpgs" : "manual",
          provider_ref: monthsAgo === 2 ? `seed-${salon.slug}-${monthsAgo}` : null,
          reference_note: monthsAgo === 1 ? "WH-8841203" : null,
          status: "paid",
          marked_by: monthsAgo === 1 ? adminId : null,
          created_at: subDays(now, 30 * monthsAgo + 9).toISOString(),
        });
      }
      if (def.plan === "basic") {
        // An open invoice with a pending manual payment → shows in the admin queue
        const inv = must(
          await admin
            .from("invoices")
            .insert({
              salon_id: salon.id,
              subscription_id: sub!.id,
              status: "open",
              subtotal: 29,
              total: 29,
              line_items: [{ plan_code: "basic", description: "Basic plan (monthly)", amount: 29 }],
              period_start: addDays(now, 20).toISOString(),
              period_end: addDays(now, 50).toISOString(),
            })
            .select("id")
            .single(),
          "open invoice",
        );
        await admin.from("payments").insert({
          salon_id: salon.id,
          invoice_id: inv.id,
          purpose: "subscription",
          amount: 29,
          method: "omt",
          provider: "manual",
          reference_note: "OMT 55-118-224",
          status: "pending",
        });
      }
    }

    // Salon-specific notification template override (Arabic confirmation)
    await admin.from("salon_notification_templates").insert({
      salon_id: salon.id,
      kind: "booking_confirmation",
      locale: "ar",
      body: `مرحبًا {name}! موعدك لـ {service} في ${def.name} مؤكد يوم {date} الساعة {time}. للتعديل: {link}`,
    });

    log(
      `  ${services.length} services, ${staffRows.length} staff, ${designs.length} designs, ${polishes.length} polishes, ${clients.length} clients, ${bookings.length} bookings, ${events.length} events`,
    );
  }

  await admin.from("announcements").insert({
    title: "Welcome to NailSwap",
    body: "Share your QR code at the counter so clients can try designs while they wait.",
    level: "info",
    audience: "salons",
    created_by: adminId,
  });

  console.log("\nDone. Sign in with OTP 123456:");
  console.log(`  admin   +${DEMO.admin.phone}`);
  for (const s of DEMO.salons) console.log(`  owner   +${s.owner.phone}  → ${s.slug}`);
  console.log(`  client  +${DEMO.client.phone}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
