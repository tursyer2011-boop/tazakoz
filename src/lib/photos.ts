import { supabase } from "@/integrations/supabase/client";

export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("reports").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function resizeImage(file: File, max = 1280): Promise<{ blob: Blob; dataUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось обработать фото");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Ошибка сжатия"))), "image/jpeg", 0.82),
  );
  return { blob, dataUrl };
}