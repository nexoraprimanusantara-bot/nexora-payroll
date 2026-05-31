import { ensureSchema, getSql, handleError, json, methodNotAllowed } from "../_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    const date = req.query?.date;
    const logs = date
      ? await sql`select * from attendance_logs where date = ${date} order by employee_name`
      : await sql`select * from attendance_logs order by date desc, employee_name asc limit 1000`;
    return json(res, 200, { ok: true, attendance_logs: logs });
  } catch (error) {
    return handleError(res, error);
  }
}
