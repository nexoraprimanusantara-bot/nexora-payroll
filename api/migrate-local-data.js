import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "./_db.js";
import { upsertEmployee } from "./employees.js";
import { upsertExtraWork } from "./extra-work/index.js";

const num = (value) => Number(value || 0) || 0;

async function upsertJson(sql, table, row) {
  const data = JSON.stringify(row);
  if (table === "payroll_components") {
    await sql`insert into payroll_components (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  } else if (table === "employee_cash_advances") {
    await sql`insert into employee_cash_advances (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  } else if (table === "kasbon_deductions") {
    await sql`insert into kasbon_deductions (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data`;
  } else if (table === "payroll_runs") {
    await sql`insert into payroll_runs (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  } else if (table === "payroll_rows") {
    await sql`insert into payroll_rows (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  } else if (table === "payroll_row_components") {
    await sql`insert into payroll_row_components (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data`;
  } else if (table === "saved_payslips") {
    await sql`insert into saved_payslips (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data`;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    const body = await readBody(req);
    const data = body.store || body;
    let employees = 0;
    let attendance = 0;
    let extraWork = 0;
    let businessInfo = 0;

    if (data.business_settings) {
      await sql`
        insert into business_settings (
          id, data, business_name, business_subtitle, business_address,
          business_phone, business_email, business_logo_url, payslip_footer_note, updated_at
        )
        values (
          'default', ${JSON.stringify(data.business_settings)}::jsonb,
          ${data.business_settings.business_name || "Nama Bisnis"}, 'Aplikasi Penggajian',
          ${data.business_settings.address || ""}, ${data.business_settings.phone || ""},
          ${data.business_settings.email || ""}, ${data.business_settings.logo_data_url || ""},
          ${data.business_settings.footer_note || ""}, now()
        )
        on conflict (id) do update set
          data = excluded.data,
          business_name = excluded.business_name,
          business_subtitle = excluded.business_subtitle,
          business_address = excluded.business_address,
          business_phone = excluded.business_phone,
          business_email = excluded.business_email,
          business_logo_url = excluded.business_logo_url,
          payslip_footer_note = excluded.payslip_footer_note,
          updated_at = now()
      `;
      await sql`
        update attendance_settings set
          office_token = coalesce(${data.business_settings.office_qr_token || null}, office_token),
          qr_mode = ${data.business_settings.attendance_qr_mode || "static"},
          location_enabled = ${Boolean(data.business_settings.location_validation_enabled)},
          office_lat = ${num(data.business_settings.office_latitude)},
          office_lng = ${num(data.business_settings.office_longitude)},
          allowed_radius_meters = ${num(data.business_settings.location_radius_meters) || 100},
          location_validation_mode = ${data.business_settings.location_validation_mode || "warning"},
          updated_at = now()
        where id = 'default'
      `;
      businessInfo = 1;
    }

    for (const employee of data.employees || []) {
      await upsertEmployee(sql, employee);
      employees += 1;
    }

    for (const log of data.attendance_logs || []) {
      await sql`
        insert into attendance_logs (
          id, employee_id, employee_name, date, clock_in_time, clock_out_time,
          total_work_minutes, late_minutes, overtime_minutes, status, qr_type, qr_date,
          office_token_valid, pin_verified, source, location_lat, location_lng,
          location_accuracy, office_distance_meters, location_valid, location_validation_status,
          notes, created_at, updated_at
        ) values (
          ${log.id}, ${log.employee_id}, ${log.employee_name || ""}, ${log.date},
          ${log.clock_in_time || ""}, ${log.clock_out_time || ""}, ${num(log.total_work_minutes)},
          ${num(log.late_minutes)}, ${num(log.overtime_minutes)}, ${log.status || "hadir"},
          ${log.qr_type || "office_static"}, ${log.qr_date || log.date},
          ${Boolean(log.office_token_valid ?? log.source === "qr")}, ${Boolean(log.pin_verified)},
          ${log.source || "qr"}, ${log.location_lat ?? null}, ${log.location_lng ?? null},
          ${log.location_accuracy ?? null}, ${log.office_distance_meters ?? null},
          ${log.location_valid ?? null}, ${log.location_validation_status || null},
          ${log.notes || ""}, ${log.created_at || new Date().toISOString()}, now()
        )
        on conflict (employee_id, date) do update set
          clock_in_time = excluded.clock_in_time,
          clock_out_time = excluded.clock_out_time,
          total_work_minutes = excluded.total_work_minutes,
          status = excluded.status,
          notes = excluded.notes,
          updated_at = now()
      `;
      attendance += 1;
    }

    for (const record of data.extra_work_records || []) {
      await upsertExtraWork(sql, record);
      extraWork += 1;
    }

    const jsonTables = [
      ["payroll_components", data.payroll_components || []],
      ["employee_cash_advances", data.employee_cash_advances || []],
      ["kasbon_deductions", data.kasbon_deductions || []],
      ["payroll_runs", data.payroll_runs || []],
      ["payroll_rows", data.payroll_rows || []],
      ["payroll_row_components", data.payroll_row_components || []],
      ["saved_payslips", data.saved_payslips || []],
    ];
    for (const [table, rows] of jsonTables) {
      for (const row of rows) {
        if (row?.id) await upsertJson(sql, table, row);
      }
    }

    return json(res, 200, { ok: true, summary: { employees, attendance, extraWork, businessInfo } });
  } catch (error) {
    return handleError(res, error);
  }
}
