import { Pool } from "pg";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS compressions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  images INTEGER NOT NULL,
  original_bytes BIGINT NOT NULL,
  compressed_bytes BIGINT NOT NULL,
  format TEXT NOT NULL
);`;

const g = globalThis as unknown as { pgPool?: Pool; pgReady?: Promise<void> };

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!g.pgPool) {
    g.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return g.pgPool;
}

async function ready(pool: Pool) {
  if (!g.pgReady) {
    g.pgReady = pool.query(SCHEMA).then(() => undefined);
    g.pgReady.catch(() => (g.pgReady = undefined));
  }
  return g.pgReady;
}

export async function getStats() {
  const pool = getPool();
  if (!pool) return { images: 0, savedBytes: 0 };
  await ready(pool);
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(images),0) AS images,
            COALESCE(SUM(GREATEST(original_bytes - compressed_bytes, 0)),0) AS saved
     FROM compressions`
  );
  return { images: Number(rows[0].images), savedBytes: Number(rows[0].saved) };
}

export async function recordUsage(images: number, originalBytes: number, compressedBytes: number, format: string) {
  const pool = getPool();
  if (!pool) return;
  await ready(pool);
  await pool.query(
    `INSERT INTO compressions (images, original_bytes, compressed_bytes, format) VALUES ($1,$2,$3,$4)`,
    [images, Math.round(originalBytes), Math.round(compressedBytes), format]
  );
}
