-- Anonymous usage totals only. No images and no personal data are stored.
CREATE TABLE IF NOT EXISTS compressions (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  images           INTEGER NOT NULL,
  original_bytes   BIGINT  NOT NULL,
  compressed_bytes BIGINT  NOT NULL,
  format           TEXT    NOT NULL
);
