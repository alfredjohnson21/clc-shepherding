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
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'member',
  reports_to_id INTEGER,
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS member_profiles (
  person_id INTEGER PRIMARY KEY,
  details JSONB NOT NULL DEFAULT '{}',
  care_status TEXT NOT NULL DEFAULT '',
  status_note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS care_notes (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL,
  note_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_notes_person_idx ON care_notes (person_id);
CREATE TABLE IF NOT EXISTS profile_requests (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  phone TEXT NOT NULL,
  person_id INTEGER,
  status TEXT NOT NULL,
  proposed JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS profile_requests_status_idx ON profile_requests (status);
`;

const g = globalThis as unknown as { __db?: Promise<Runner> };

async function init(): Promise<Runner> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const sql = postgres(url, { ssl: url.includes('localhost') ? false : 'require', max: 5, idle_timeout: 20, prepare: false });
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
