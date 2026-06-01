import { ensureSchema, handleError, json, methodNotAllowed } from "../lib/db.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res);
  try {
    await ensureSchema();
    return json(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
