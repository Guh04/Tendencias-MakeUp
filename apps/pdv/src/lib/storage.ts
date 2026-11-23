import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Envia a imagem do produto para o armazenamento e devolve a URL publica. */
export async function uploadProductImage(file: File): Promise<{ url: string } | { error: string }> {
  if (!TYPES.includes(file.type)) return { error: "Use uma imagem JPG, PNG ou WebP." };
  if (file.size > MAX_BYTES) return { error: "A imagem deve ter no máximo 2 MB." };
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const db = createClient();
  const { error } = await db.storage.from("product-images").upload(path, file, { contentType: file.type });
  if (error) return { error: "Não foi possível enviar a imagem." };
  return { url: db.storage.from("product-images").getPublicUrl(path).data.publicUrl };
}
