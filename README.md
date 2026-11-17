# Squeeze: Image Compressor & Resizer

Next.js (App Router) + Tailwind CSS v4 + PostgreSQL.

- Images are compressed **in the browser** (Canvas API). Nothing is uploaded.
- PostgreSQL stores only anonymous totals (image count and bytes saved) for the counter at the bottom of the page.
- If `DATABASE_URL` is missing or the database is down, the tool still works. Only the counter is hidden.

## Run locally

```bash
npm install
cp .env.example .env.local     # then edit DATABASE_URL
createdb squeeze               # or create the DB in Neon / Supabase
npm run db:init                # optional: the table is also created automatically
npm run dev                    # http://localhost:3000
```

## Deploy

1. Create a free Postgres database (Neon, Supabase or Railway).
2. Push this folder to GitHub and import it in Vercel.
3. Add `DATABASE_URL` and `DATABASE_SSL=true` in Vercel's environment variables.
