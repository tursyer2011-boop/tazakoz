import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { assertActiveAdmin } = await import("@/lib/admin-guard.server");
  await assertActiveAdmin(supabase, userId);
}

const CreateInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  priceKzt: z.number().int().min(0).max(100_000_000).default(0),
  photoDataUrl: z.string().max(8_000_000).default(""),
});

const IdInput = z.object({ productId: z.string().uuid() });

/** Список опубликованных товаров с подписанными ссылками на фото. */
export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, title, description, photo_url, price_kzt, published, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return await Promise.all(
      (data ?? []).map(async (p) => {
        let photo: string | null = null;
        if (p.photo_url) {
          const { data: signed } = await supabaseAdmin.storage.from("market").createSignedUrl(p.photo_url, 3600);
          photo = signed?.signedUrl ?? null;
        }
        return { ...p, photo };
      }),
    );
  });

/** Публикация товара — только администратор. */
export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let path = "";
    if (data.photoDataUrl.startsWith("data:")) {
      const base64 = data.photoDataUrl.split(",")[1] ?? "";
      const bytes = Buffer.from(base64, "base64");
      path = `products/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("market")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
    }

    const { error } = await supabaseAdmin.from("products").insert({
      title: data.title,
      description: data.description,
      price_kzt: data.priceKzt,
      photo_url: path,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Удаление товара — только администратор. */
export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("photo_url")
      .eq("id", data.productId)
      .maybeSingle();
    if (product?.photo_url) await supabaseAdmin.storage.from("market").remove([product.photo_url]);
    await supabaseAdmin.from("products").delete().eq("id", data.productId);
    return { ok: true };
  });
