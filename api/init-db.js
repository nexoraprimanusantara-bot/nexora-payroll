import { ensureSchema, handleError, json, methodNotAllowed } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  try {
    await ensureSchema();
    return json(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
