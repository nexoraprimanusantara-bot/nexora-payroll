import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "../_db.js";
import { upsertExtraWork } from "./index.js";

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    const id = req.query?.id;
    if (req.method === "PUT") {
      const body = await readBody(req);
      const record = { ...(body.record || body), id };
      const row = await upsertExtraWork(sql, record);
      return json(res, 200, { ok: true, extra_work_record: row });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}
