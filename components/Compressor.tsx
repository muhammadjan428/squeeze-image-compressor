"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compressImage, formatBytes, type Format, type Result, type Settings } from "@/lib/compress";

type Item = {
  id: string;
  file: File;
  preview: string;
  status: "working" | "done" | "error";
  result?: Result;
  error?: string;
};

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const PRESETS: { name: string; note: string; quality: number; maxWidth: number | null }[] = [
  { name: "Balanced", note: "Websites and email", quality: 75, maxWidth: 1920 },
  { name: "Smallest", note: "Tiny files, softer detail", quality: 50, maxWidth: 1280 },
  { name: "Sharpest", note: "Keeps the most detail", quality: 90, maxWidth: null },
];

const WIDTHS: { label: string; value: number | null }[] = [
  { label: "Original size", value: null },
  { label: "3840 px (4K)", value: 3840 },
  { label: "1920 px (Full HD)", value: 1920 },
  { label: "1280 px", value: 1280 },
  { label: "800 px", value: 800 },
  { label: "400 px (thumbnail)", value: 400 },
];

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "webp", label: "WebP", hint: "Smallest" },
  { value: "jpeg", label: "JPG", hint: "Works everywhere" },
  { value: "png", label: "PNG", hint: "Keeps transparency" },
];

const uid = () => `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function Compressor() {
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>({ quality: 75, maxWidth: 1920, format: "webp" });
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [stats, setStats] = useState<{ images: number; savedBytes: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const runId = useRef(0);
  itemsRef.current = items;

  // Global usage numbers (from Postgres)
  const loadStats = useCallback(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);
  useEffect(loadStats, [loadStats]);

  // Add files
  const addFiles = useCallback((files: File[]) => {
    const good = files.filter((f) => ACCEPTED.includes(f.type));
    const skipped = files.length - good.length;
    setNotice(skipped > 0 ? `Skipped ${skipped} ${skipped === 1 ? "file" : "files"}. Squeeze works with JPG, PNG, WebP and AVIF images.` : null);
    if (!good.length) return;
    const fresh: Item[] = good.map((file) => ({
      id: uid(),
      file,
      preview: URL.createObjectURL(file),
      status: "working",
    }));
    setItems((prev) => [...fresh, ...prev]);
    setAddedCount((n) => n + 1);
  }, []);

  // Paste support
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // (Re)compress when files are added or settings change
  useEffect(() => {
    if (!itemsRef.current.length) return;
    const id = ++runId.current;
    const timer = setTimeout(async () => {
      setItems((p) => p.map((i) => ({ ...i, status: "working" })));
      for (const item of [...itemsRef.current]) {
        if (runId.current !== id) return;
        try {
          const result = await compressImage(item.file, settings);
          if (runId.current !== id) return;
          setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "done", result, error: undefined } : i)));
        } catch (e) {
          if (runId.current !== id) return;
          const error = e instanceof Error ? e.message : "Something went wrong.";
          setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "error", error } : i)));
        }
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [settings, addedCount]);

  const remove = (id: string) => {
    setItems((p) => {
      const gone = p.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return p.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.preview));
    setItems([]);
    setNotice(null);
  };

  const done = useMemo(() => items.filter((i) => i.status === "done" && i.result), [items]);
  const totals = useMemo(() => {
    const original = done.reduce((s, i) => s + i.file.size, 0);
    const compressed = done.reduce((s, i) => s + i.result!.blob.size, 0);
    return { original, compressed, saved: Math.max(original - compressed, 0) };
  }, [done]);
  const savedPct = totals.original ? Math.round((totals.saved / totals.original) * 100) : 0;
  const busy = items.some((i) => i.status === "working");

  const recordUsage = (list: Item[]) => {
    const original = list.reduce((s, i) => s + i.file.size, 0);
    const compressed = list.reduce((s, i) => s + i.result!.blob.size, 0);
    fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: list.length, originalBytes: original, compressedBytes: compressed, format: settings.format }),
    }).then(loadStats).catch(() => {});
  };

  const fileName = (item: Item) => `${item.file.name.replace(/\.[^.]+$/, "")}-squeezed.${item.result!.ext}`;

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadOne = (item: Item) => {
    if (!item.result) return;
    save(item.result.blob, fileName(item));
    recordUsage([item]);
  };

  const downloadAll = async () => {
    if (done.length === 1) return downloadOne(done[0]);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const used = new Set<string>();
    done.forEach((item) => {
      let name = fileName(item);
      for (let n = 2; used.has(name); n++) name = fileName(item).replace(/(\.[^.]+)$/, `-${n}$1`);
      used.add(name);
      zip.file(name, item.result!.blob);
    });
    save(await zip.generateAsync({ type: "blob" }), "squeezed-images.zip");
    recordUsage(done);
  };

  const activePreset = PRESETS.find((p) => p.quality === settings.quality && p.maxWidth === settings.maxWidth);

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        className={`group flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition-colors ${items.length ? "py-8 sm:py-10" : "py-14 sm:py-20"} ${
          dragging ? "border-cobalt bg-cobalt/5" : "border-cobalt/40 bg-white hover:border-cobalt hover:bg-cobalt/[0.03]"
        }`}
      >
        <span className={`mb-5 grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg ${items.length && !dragging ? "bg-mint shadow-mint/25" : "bg-cobalt shadow-cobalt/25"}`}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {items.length && !dragging ? <path d="M5 13l4 4L19 7" /> : <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />}
          </svg>
        </span>
        <span className="font-display text-2xl font-bold sm:text-3xl">
          {dragging
            ? "Drop to squeeze"
            : items.length
              ? `${items.length} ${items.length === 1 ? "image" : "images"} added`
              : "Drop images here"}
        </span>
        <span className="mt-2 text-muted">
          {items.length
            ? busy
              ? "Squeezing now. Drop or click to add more."
              : "All done. Drop or click to add more."
            : "or click to choose files. You can also paste from your clipboard."}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />

      {notice && (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>
      )}

      {/* Results */}
      {items.length > 0 && (
        <section aria-labelledby="results-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-ink p-5 text-white sm:p-7">
            <div>
              <h2 id="results-title" className="text-sm font-medium text-white/70">
                {busy ? "Squeezing…" : `${done.length} ${done.length === 1 ? "image" : "images"} ready`}
              </h2>
              <p className="font-display mt-1 text-4xl font-extrabold sm:text-5xl">
                {busy && !done.length ? "…" : `${savedPct}% smaller`}
              </p>
              {done.length > 0 && (
                <p className="mt-1 text-white/70">
                  {formatBytes(totals.original)} to {formatBytes(totals.compressed)}. You save {formatBytes(totals.saved)}.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={clearAll}
                className="rounded-xl border border-white/25 px-4 py-3 font-semibold hover:bg-white/10"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={downloadAll}
                disabled={!done.length || busy}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-ink hover:bg-mist disabled:opacity-50"
              >
                {done.length > 1 ? "Download all (ZIP)" : "Download"}
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {items.map((item) => {
              const r = item.result;
              const pct = r ? Math.max(0, Math.round((1 - r.blob.size / item.file.size) * 100)) : 0;
              const ratio = r ? Math.min(100, Math.max(3, (r.blob.size / item.file.size) * 100)) : 100;
              return (
                <li key={item.id} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-3 sm:p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-mist object-cover sm:h-20 sm:w-20" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.file.name}</p>
                    {item.status === "error" ? (
                      <p className="mt-1 text-sm text-red-700">{item.error}</p>
                    ) : item.status === "working" && !r ? (
                      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                        <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
                          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Squeezing…
                      </p>
                    ) : r ? (
                      <>
                        <p className="mt-0.5 text-sm text-muted">
                          {formatBytes(item.file.size)} to {formatBytes(r.blob.size)}
                          <span className="hidden sm:inline">
                            {" "}· {r.originalWidth}×{r.originalHeight}
                            {r.width !== r.originalWidth && ` to ${r.width}×${r.height}`}
                          </span>
                        </p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist" aria-hidden>
                          <div className="h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${ratio}%` }} />
                        </div>
                        {r.keptOriginal && <p className="mt-1 text-xs text-muted">Already well optimized. We kept your original.</p>}
                      </>
                    ) : null}
                  </div>

                  {r && (
                    <span className="hidden rounded-full bg-mint-soft px-3 py-1 text-sm font-bold text-mint sm:block">
                      {pct > 0 ? `−${pct}%` : "0%"}
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => downloadOne(item)}
                      disabled={!r}
                      className="rounded-xl bg-cobalt px-4 py-2.5 text-sm font-semibold text-white hover:bg-cobalt-dark disabled:opacity-40"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-mist hover:text-ink"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Settings */}
      <section aria-labelledby="settings-title" className="rounded-3xl border border-line bg-white p-5 sm:p-7">
        <h2 id="settings-title" className="font-display text-xl font-bold">Settings</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PRESETS.map((p) => {
            const active = activePreset?.name === p.name;
            return (
              <button
                key={p.name}
                type="button"
                aria-pressed={active}
                onClick={() => setSettings((s) => ({ ...s, quality: p.quality, maxWidth: p.maxWidth }))}
                className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                  active ? "border-cobalt bg-cobalt/5" : "border-line hover:border-cobalt/50"
                }`}
              >
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-sm text-muted">{p.note}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-7 grid gap-7 sm:grid-cols-2">
          <div>
            <label htmlFor="quality" className="flex items-baseline justify-between font-semibold">
              Quality
              <span className="text-sm font-medium text-cobalt">{settings.quality}%</span>
            </label>
            <input
              id="quality"
              type="range"
              min={10}
              max={100}
              step={5}
              value={settings.quality}
              onChange={(e) => setSettings((s) => ({ ...s, quality: Number(e.target.value) }))}
              disabled={settings.format === "png"}
              className="mt-3 w-full disabled:opacity-40"
            />
            <p className="mt-1 text-sm text-muted">
              {settings.format === "png" ? "PNG is lossless. Use a smaller size to shrink it." : "Lower means a smaller file."}
            </p>
          </div>

          <div>
            <label htmlFor="width" className="block font-semibold">Maximum width</label>
            <select
              id="width"
              value={settings.maxWidth ?? "original"}
              onChange={(e) => setSettings((s) => ({ ...s, maxWidth: e.target.value === "original" ? null : Number(e.target.value) }))}
              className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2.5"
            >
              {WIDTHS.map((w) => (
                <option key={w.label} value={w.value ?? "original"}>{w.label}</option>
              ))}
            </select>
            <p className="mt-1 text-sm text-muted">Smaller images are never enlarged.</p>
          </div>
        </div>

        <fieldset className="mt-7">
          <legend className="font-semibold">Save as</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {FORMATS.map((f) => {
              const active = settings.format === f.value;
              return (
                <label
                  key={f.value}
                  className={`cursor-pointer rounded-2xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-cobalt ${
                    active ? "border-cobalt bg-cobalt/5" : "border-line hover:border-cobalt/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f.value}
                    checked={active}
                    onChange={() => setSettings((s) => ({ ...s, format: f.value }))}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{f.label}</span>
                  <span className="block text-sm text-muted">{f.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* Community stats from PostgreSQL */}
      {stats && stats.images > 0 && (
        <p className="pt-4 text-center text-sm text-muted">
          {stats.images.toLocaleString()} images squeezed so far, saving {formatBytes(stats.savedBytes)} of space.
        </p>
      )}
    </div>
  );
}