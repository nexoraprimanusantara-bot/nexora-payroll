import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "../_db.js";
import { randomUUID } from "node:crypto";

function minutesBetween(date, start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(`${date}T${end}`).getTime() - new Date(`${date}T${start}`).getTime()) / 60000));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    const body = await readBody(req);
    const [settings] = await sql`select * from attendance_settings where id = 'default'`;
    const [employee] = await sql`select * from employees where employee_id = ${body.employeeId} and active = true`;
    if (!employee) return json(res, 404, { ok: false, code: "EMPLOYEE_NOT_FOUND", message: "Karyawan tidak ditemukan atau tidak aktif." });

    const date = body.date || new Date().toISOString().slice(0, 10);
    const time = body.time || new Date().toTimeString().slice(0, 5);
    await sql`
      update attendance_logs set
        forgot_clock_out = true,
        auto_closed_at = now(),
        status_note = 'Lupa sign out / clock out',
        admin_review_required = true,
        updated_at = now()
      where employee_id = ${employee.employee_id}
        and date < ${date}
        and nullif(clock_in_time, '') is not null
        and (clock_out_time is null or clock_out_time = '')
        and coalesce(forgot_clock_out, false) = false
    `;
    const [existing] = await sql`select * from attendance_logs where employee_id = ${employee.employee_id} and date = ${date}`;

    if (body.action === "clock_in") {
      if (existing?.clock_in_time) return json(res, 409, { ok: false, code: "DUPLICATE_CLOCK_IN", message: "Karyawan ini sudah clock in hari ini.", attendance: existing });
      const id = body.id || `attendance_${randomUUID()}`;
      const [log] = await sql`
        insert into attendance_logs (
          id, employee_id, employee_name, date, clock_in_time, status, qr_type, qr_date,
          office_token_valid, pin_verified, source, location_lat, location_lng,
          location_accuracy, office_distance_meters, location_valid, location_validation_status,
          notes, created_at, updated_at
        ) values (
          ${id}, ${employee.employee_id}, ${employee.name}, ${date}, ${time}, 'hadir',
          ${settings.qr_mode === "daily" ? "daily" : "office_static"}, ${body.qrDate || date},
          true, false, 'qr', ${body.location?.lat ?? null}, ${body.location?.lng ?? null},
          ${body.location?.accuracy ?? null}, ${body.location?.distance ?? null},
          ${body.location?.valid ?? null}, ${body.location?.status || null},
          ${body.notes || ""}, now(), now()
        )
        on conflict (employee_id, date) do update set
          clock_in_time = coalesce(attendance_logs.clock_in_time, excluded.clock_in_time),
          office_token_valid = true,
          updated_at = now()
        returning *
      `;
      return json(res, 200, { ok: true, attendance: log, message: `Clock In berhasil pukul ${time}` });
    }

    if (body.action === "clock_out") {
      if (!existing?.clock_in_time) return json(res, 409, { ok: false, code: "CLOCK_IN_REQUIRED", message: "Clock in terlebih dahulu." });
      if (existing.clock_out_time) return json(res, 409, { ok: false, code: "DUPLICATE_CLOCK_OUT", message: "Karyawan ini sudah clock out hari ini.", attendance: existing });
      const total = minutesBetween(date, existing.clock_in_time, time);
      const overtime = Math.max(0, total - 8 * 60);
      const [log] = await sql`
        update attendance_logs set
          clock_out_time = ${time},
          total_work_minutes = ${total},
          overtime_minutes = ${overtime},
          location_lat = coalesce(${body.location?.lat ?? null}, location_lat),
          location_lng = coalesce(${body.location?.lng ?? null}, location_lng),
          location_accuracy = coalesce(${body.location?.accuracy ?? null}, location_accuracy),
          office_distance_meters = coalesce(${body.location?.distance ?? null}, office_distance_meters),
          location_valid = coalesce(${body.location?.valid ?? null}, location_valid),
          location_validation_status = coalesce(${body.location?.status || null}, location_validation_status),
          updated_at = now()
        where id = ${existing.id}
        returning *
      `;
      return json(res, 200, { ok: true, attendance: log, message: `Clock Out berhasil pukul ${time}` });
    }

    return json(res, 400, { ok: false, message: "Action tidak valid." });
  } catch (error) {
    return handleError(res, error);
  }
}
