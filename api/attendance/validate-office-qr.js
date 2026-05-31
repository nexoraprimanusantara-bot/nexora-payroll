import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "../_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    const body = await readBody(req);
    const [settings] = await sql`select office_token, qr_mode from attendance_settings where id = 'default'`;
    const valid = Boolean(body.officeToken && settings?.office_token === body.officeToken);
    return json(res, 200, {
      ok: true,
      valid,
      qr_type: settings?.qr_mode === "daily" ? "daily" : "office_static",
    });
  } catch (error) {
    return handleError(res, error);
  }
}
