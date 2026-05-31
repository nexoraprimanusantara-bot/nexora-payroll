import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "../_db.js";
import { upsertEmployee } from "../employees.js";

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    const id = req.query?.id;
    if (req.method === "PUT") {
      const body = await readBody(req);
      const employee = { ...(body.employee || body), id };
      const row = await upsertEmployee(sql, employee);
      return json(res, 200, { ok: true, employee: row });
    }
    if (req.method === "DELETE") {
      await sql`update employees set active = false, updated_at = now() where id = ${id}`;
      return json(res, 200, { ok: true });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}
