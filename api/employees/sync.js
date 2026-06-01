import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "../_db.js";
import { upsertEmployee } from "../employees.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    const body = await readBody(req);
    const employees = Array.isArray(body.employees) ? body.employees : [];
    let synced = 0;
    for (const employee of employees) {
      if (employee?.employee_id && employee?.name) {
        await upsertEmployee(sql, employee);
        synced += 1;
      }
    }
    return json(res, 200, { ok: true, synced });
  } catch (error) {
    return handleError(res, error);
  }
}
