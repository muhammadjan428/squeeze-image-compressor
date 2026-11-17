import { NextResponse } from "next/server";
import { getStats, recordUsage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStats());
  } catch {
    return NextResponse.json({ images: 0, savedBytes: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const images = Number(b.images);
    const original = Number(b.originalBytes);
    const compressed = Number(b.compressedBytes);
    const format = String(b.format ?? "").slice(0, 10);
    const valid =
      [images, original, compressed].every(Number.isFinite) &&
      images >= 1 && images <= 500 &&
      original >= 0 && compressed >= 0 &&
      original <= 5e10 && compressed <= 5e10 &&
      ["webp", "jpeg", "png"].includes(format);
    if (!valid) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    await recordUsage(images, original, compressed, format);
    return NextResponse.json({ ok: true });
  } catch {
    // Stats are optional: never break the tool if the database is down.
    return NextResponse.json({ ok: false });
  }
}
