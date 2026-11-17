import Compressor from "@/components/Compressor";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-cobalt text-white">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 3l5 5M17 3l-5 5M3 17l5-5M17 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <rect x="8" y="8" width="4" height="4" rx="1" fill="currentColor" />
            </svg>
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Squeeze</span>
        </div>
        <p className="text-sm text-muted">Free. No sign-up.</p>
      </header>

      <section className="pb-10 pt-14 sm:pt-20">
        <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
          Smaller images.
          <br />
          Same picture.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Drop your photos and they shrink right here in your browser. Your files never leave your device.
        </p>
      </section>

      <Compressor />

      <footer className="mt-20 grid gap-6 border-t border-line pt-8 text-sm text-muted sm:grid-cols-3">
        <div>
          <h2 className="font-semibold text-ink">Private</h2>
          <p className="mt-1 leading-relaxed">Images are processed on your device. We never see or store them.</p>
        </div>
        <div>
          <h2 className="font-semibold text-ink">Fast</h2>
          <p className="mt-1 leading-relaxed">No uploading and no waiting. Drop 50 photos and download in seconds.</p>
        </div>
        <div>
          <h2 className="font-semibold text-ink">Works with</h2>
          <p className="mt-1 leading-relaxed">JPG, PNG, WebP and AVIF. Output as WebP, JPG or PNG.</p>
        </div>
      </footer>
    </main>
  );
}
