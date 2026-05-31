import { ensureSchema, getSql, handleError, json, methodNotAllowed, officeToken, readBody } from "./_db.js";

const num = (value) => Number(value || 0) || 0;

function toClient(row) {
  return {
    attendance_qr_mode: row.qr_mode || "static",
    office_qr_token: row.office_token,
    location_validation_enabled: row.location_enabled ?? false,
    office_latitude: num(row.office_lat),
    office_longitude: num(row.office_lng),
    location_radius_meters: num(row.allowed_radius_meters) || 100,
    location_validation_mode: row.location_validation_mode || "warning",
  };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    if (req.method === "GET") {
      const [row] = await sql`select * from attendance_settings where id = 'default'`;
      return json(res, 200, { ok: true, attendance_settings: toClient(row) });
    }
    if (req.method === "POST" || req.method === "PUT") {
      const body = await readBody(req);
      const regenerate = body.regenerate === true;
      const token = regenerate ? officeToken() : body.office_qr_token;
      const [row] = await sql`
        update attendance_settings set
          office_token = coalesce(${token || null}, office_token),
          qr_mode = ${body.attendance_qr_mode || body.qr_mode || "static"},
          location_enabled = ${Boolean(body.location_validation_enabled ?? body.location_enabled ?? false)},
          office_lat = ${num(body.office_latitude ?? body.office_lat)},
          office_lng = ${num(body.office_longitude ?? body.office_lng)},
          allowed_radius_meters = ${num(body.location_radius_meters ?? body.allowed_radius_meters) || 100},
          location_validation_mode = ${body.location_validation_mode || "warning"},
          updated_at = now()
        where id = 'default'
        returning *
      `;
      return json(res, 200, { ok: true, attendance_settings: toClient(row) });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}
