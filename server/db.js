import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMPTY_SCENE = { elements: [], appState: {} };

export async function ensureSchema() {
  await pool.query(`
    create table if not exists boards (
      id text primary key,
      scene_data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);
}

export async function getScene(boardId) {
  const result = await pool.query("select scene_data from boards where id = $1", [boardId]);
  if (result.rows.length === 0) {
    return EMPTY_SCENE;
  }
  return result.rows[0].scene_data;
}

export async function saveScene(boardId, scene) {
  await pool.query(
    `insert into boards (id, scene_data, updated_at)
     values ($1, $2, now())
     on conflict (id) do update set scene_data = $2, updated_at = now()`,
    [boardId, scene]
  );
}
