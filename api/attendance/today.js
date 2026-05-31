import { ensureSchema, getSql, handleError, json, methodNotAllowed } from "../_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    const date = req.query?.date || new Date().toISOString().slice(0, 10);
    const logs = await sql`select * from attendance_logs where date = ${date} order by employee_name`;
    return json(res, 200, { ok: true, attendance_logs: logs });
  } catch (error) {
    return handleError(res, error);
  }
}
