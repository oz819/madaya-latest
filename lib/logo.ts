// Logo upload, protected on the way in: only PNG/JPEG/WebP (no SVG — it can carry script), at most
// 5 MB, redrawn in the browser to 256 px. What is stored is the redrawn image, never the raw file,
// and the database re-checks the format and size (centers.logo_url constraint).
const TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export async function logoDataUrl(file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error("الشعار: صورة PNG أو JPG أو WebP فقط");
  if (file.size > LOGO_MAX_BYTES) throw new Error("الشعار أكبر من 5 ميغابايت");
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error("تعذّر قراءة الصورة");
  });
  const side = 256;
  const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  let url = canvas.toDataURL("image/webp", 0.9);
  if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/png");
  if (url.length > 340_000) throw new Error("الشعار كبير بعد التصغير، جرّب صورة أبسط");
  return url;
}
