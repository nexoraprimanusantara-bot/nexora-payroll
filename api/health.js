import { ensureSchema, getSql, handleError, json, methodNotAllowed } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`select 1`;
    return json(res, 200, { ok: true, database: "connected" });
  } catch (error) {
    return handleError(res, error);
  }
}
