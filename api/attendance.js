import { ensureSchema, getSql, handleError, json, methodNotAllowed, num, readBody, upsertExtraWork } from "../lib/db.js";
import { randomUUID } from "node:crypto";

function minutesBetween(date, start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(`${date}T${end}`).getTime() - new Date(`${date}T${start}`).getTime()) / 60000));
}

async function clock(sql, body) {
  const [settings] = await sql`select * from attendance_settings where id = 'default'`;
  const [employee] = await sql`select * from employees where employee_id = ${body.employeeId} and active = true`;
  if (!employee) return { status: 404, payload: { ok: false, code: "EMPLOYEE_NOT_FOUND", message: "Karyawan tidak ditemukan atau tidak aktif." } };

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
    if (existing?.clock_in_time) return { status: 409, payload: { ok: false, code: "DUPLICATE_CLOCK_IN", message: "Karyawan ini sudah clock in hari ini.", attendance: existing } };
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
    return { status: 200, payload: { ok: true, attendance: log, message: `Clock In berhasil pukul ${time}` } };
  }

  if (body.action === "clock_out") {
    if (!existing?.clock_in_time) return { status: 409, payload: { ok: false, code: "CLOCK_IN_REQUIRED", message: "Clock in terlebih dahulu." } };
    if (existing.clock_out_time) return { status: 409, payload: { ok: false, code: "DUPLICATE_CLOCK_OUT", message: "Karyawan ini sudah clock out hari ini.", attendance: existing } };
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
    return { status: 200, payload: { ok: true, attendance: log, message: `Clock Out berhasil pukul ${time}` } };
  }
  return { status: 400, payload: { ok: false, message: "Action tidak valid." } };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    const action = req.query?.action || "list";
    if (req.method === "GET" && (action === "today" || action === "list")) {
      const date = req.query?.date;
      const logs = date
        ? await sql`select * from attendance_logs where date = ${date} order by employee_name`
        : await sql`select * from attendance_logs order by date desc, employee_name asc limit 1000`;
      return json(res, 200, { ok: true, attendance_logs: logs });
    }
    if (req.method === "POST" && action === "clock") {
      const result = await clock(sql, await readBody(req));
      return json(res, result.status, result.payload);
    }
    if (action === "extra-work") {
      if (req.method === "GET") {
        const rows = await sql`select * from extra_work_records order by date desc, created_at desc limit 1000`;
        return json(res, 200, { ok: true, extra_work_records: rows });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const records = Array.isArray(body.records) ? body.records : [body.record || body];
        const saved = [];
        for (const record of records) saved.push(await upsertExtraWork(sql, record));
        return json(res, 200, { ok: true, extra_work_records: saved });
      }
      if (req.method === "PUT") {
        const body = await readBody(req);
        const row = await upsertExtraWork(sql, body.record || body);
        return json(res, 200, { ok: true, extra_work_record: row });
      }
    }
    if (req.method === "POST" && action === "manual-correction") {
      const body = await readBody(req);
      await sql`
        update attendance_logs set
          clock_in_time = coalesce(${body.clock_in_time || null}, clock_in_time),
          clock_out_time = coalesce(${body.clock_out_time || null}, clock_out_time),
          status = coalesce(${body.status || null}, status),
          notes = coalesce(${body.notes || null}, notes),
          updated_at = now()
        where id = ${body.id}
      `;
      return json(res, 200, { ok: true });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}
