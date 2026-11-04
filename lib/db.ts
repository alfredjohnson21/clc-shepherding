import 'server-only';
import postgres from 'postgres';

type Row = Record<string, any>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  shepherd_id INTEGER NOT NULL,
  meeting_date TEXT NOT NULL,
  week_start TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_week_idx ON reports (week_start);
CREATE INDEX IF NOT EXISTS reports_shepherd_idx ON reports (shepherd_id);
`;

const g = globalThis as unknown as { __db?: Promise<Runner> };

async function init(): Promise<Runner> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const sql = postgres(url, { ssl: url.includes('localhost') ? false : 'require', max: 5, idle_timeout: 20 });
    await sql.unsafe(SCHEMA);
    return async (text, params = []) => (await sql.unsafe(text, params as any[])) as unknown as Row[];
  }
  if (process.env.VERCEL) throw new Error('DATABASE_URL is not set. Connect a Postgres database (e.g. Neon) to this Vercel project.');
  // Local development fallback: an embedded Postgres stored in ./.data
  const modName = '@electric-sql/pglite';
  const { PGlite } = await import(/* webpackIgnore: true */ modName);
  (await import('fs')).mkdirSync('./.data', { recursive: true });
  const db = new PGlite('./.data/pglite');
  await db.exec(SCHEMA);
  return async (text, params = []) => (await db.query(text, params)).rows as Row[];
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!g.__db) g.__db = init().catch((e) => { g.__db = undefined; throw e; });
  const run = await g.__db;
  return (await run(text, params)) as T[];
}
