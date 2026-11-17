export type Format = "webp" | "jpeg" | "png";

export interface Settings {
  quality: number; // 10-100
  maxWidth: number | null; // null = keep original size
  format: Format;
}

export interface Result {
  blob: Blob;
  ext: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  keptOriginal: boolean;
}

const MIME: Record<Format, string> = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png" };
const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File, s: Settings): Promise<Result> {
  const bitmap = await createImageBitmap(file);
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;

  let width = originalWidth;
  let height = originalHeight;
  const resized = !!s.maxWidth && width > s.maxWidth;
  if (resized && s.maxWidth) {
    height = Math.round((height * s.maxWidth) / width);
    width = s.maxWidth;
  }

  const draw = (fillWhite: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    if (fillWhite) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  };

  let blob = await toBlob(draw(s.format === "jpeg"), MIME[s.format], s.quality / 100);
  // Some browsers can't export WebP and silently return PNG. Fall back to JPEG.
  if (blob && s.format === "webp" && blob.type !== "image/webp") {
    blob = await toBlob(draw(true), "image/jpeg", s.quality / 100);
  }
  bitmap.close();
  if (!blob) throw new Error("This image couldn't be processed. Try a different format.");

  // Never hand back a bigger file: keep the original if we didn't help.
  if (!resized && blob.size >= file.size) {
    return {
      blob: file,
      ext: EXT[file.type] ?? "jpg",
      width: originalWidth,
      height: originalHeight,
      originalWidth,
      originalHeight,
      keptOriginal: true,
    };
  }

  return {
    blob,
    ext: EXT[blob.type] ?? "jpg",
    width,
    height,
    originalWidth,
    originalHeight,
    keptOriginal: false,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
