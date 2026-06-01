import {
  attendanceSettingsFromDb,
  businessSettingsFromDb,
  employeeFromDb,
  ensureSchema,
  getSql,
  handleError,
  json,
  methodNotAllowed,
  num,
  officeToken,
  readBody,
  upsertBusinessSettings,
  upsertEmployee,
  upsertExtraWork,
} from "../lib/db.js";

async function bootstrap(sql) {
  const [attendanceSettings] = await sql`select * from attendance_settings where id = 'default'`;
  const [businessSettings] = await sql`select * from business_settings where id = 'default'`;
  const employees = await sql`select * from employees order by employee_id`;
  const attendanceLogs = await sql`select * from attendance_logs order by date desc, employee_name asc limit 1000`;
  const extraWork = await sql`select * from extra_work_records order by date desc, created_at desc limit 1000`;
  const payrollComponents = await sql`select data from payroll_components order by created_at`;
  const cashAdvances = await sql`select data from employee_cash_advances order by created_at desc`;
  const kasbonDeductions = await sql`select data from kasbon_deductions order by created_at desc`;
  const payrollRuns = await sql`select data from payroll_runs order by created_at desc`;
  const payrollRows = await sql`select data from payroll_rows order by created_at desc`;
  const payrollRowComponents = await sql`select data from payroll_row_components order by created_at`;
  const savedPayslips = await sql`select data from saved_payslips order by created_at desc`;
  return {
    business_settings: {
      ...businessSettingsFromDb(businessSettings),
      ...attendanceSettingsFromDb(attendanceSettings),
    },
    employees: employees.map(employeeFromDb),
    attendance_logs: attendanceLogs,
    extra_work_records: extraWork,
    payroll_components: payrollComponents.map((r) => r.data),
    employee_cash_advances: cashAdvances.map((r) => r.data),
    kasbon_deductions: kasbonDeductions.map((r) => r.data),
    payroll_runs: payrollRuns.map((r) => r.data),
    payroll_rows: payrollRows.map((r) => r.data),
    payroll_row_components: payrollRowComponents.map((r) => r.data),
    saved_payslips: savedPayslips.map((r) => r.data),
  };
}

async function upsertJson(sql, table, row) {
  const data = JSON.stringify(row);
  if (table === "payroll_components") await sql`insert into payroll_components (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  else if (table === "employee_cash_advances") await sql`insert into employee_cash_advances (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  else if (table === "kasbon_deductions") await sql`insert into kasbon_deductions (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data`;
  else if (table === "payroll_runs") await sql`insert into payroll_runs (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  else if (table === "payroll_rows") await sql`insert into payroll_rows (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  else if (table === "payroll_row_components") await sql`insert into payroll_row_components (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data`;
  else if (table === "saved_payslips") await sql`insert into saved_payslips (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data`;
}

async function migrateLocalData(sql, data) {
  let employees = 0;
  let attendance = 0;
  let extraWork = 0;
  let businessInfo = 0;

  if (data.business_settings) {
    await upsertBusinessSettings(sql, data.business_settings);
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
        forgot_clock_out, auto_closed_at, status_note, admin_review_required,
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
        ${Boolean(log.forgot_clock_out)}, ${log.auto_closed_at || null}, ${log.status_note || ""},
        ${Boolean(log.admin_review_required)}, ${log.notes || ""},
        ${log.created_at || new Date().toISOString()}, now()
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
    for (const row of rows) if (row?.id) await upsertJson(sql, table, row);
  }
  return { employees, attendance, extraWork, businessInfo };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    const action = req.query?.action || "bootstrap";

    if (req.method === "GET" && action === "bootstrap") return json(res, 200, { ok: true, ...(await bootstrap(sql)) });
    if (req.method === "GET" && action === "business-settings") {
      const [row] = await sql`select * from business_settings where id = 'default'`;
      return json(res, 200, { ok: true, business_settings: businessSettingsFromDb(row) });
    }
    if (req.method === "PUT" && action === "business-settings") {
      const body = await readBody(req);
      const row = await upsertBusinessSettings(sql, body.business_settings || body);
      return json(res, 200, { ok: true, business_settings: businessSettingsFromDb(row), message: "Business Info berhasil disimpan ke database." });
    }
    if (req.method === "GET" && action === "employees") {
      const rows = await sql`select * from employees order by employee_id`;
      return json(res, 200, { ok: true, employees: rows.map(employeeFromDb) });
    }
    if (req.method === "POST" && action === "employee") {
      const body = await readBody(req);
      const row = await upsertEmployee(sql, body.employee || body);
      return json(res, 200, { ok: true, employee: employeeFromDb(row) });
    }
    if ((req.method === "PUT" || req.method === "POST") && action === "sync-employees") {
      const body = await readBody(req);
      let synced = 0;
      for (const employee of body.employees || []) {
        if (employee?.employee_id && employee?.name) {
          await upsertEmployee(sql, employee);
          synced += 1;
        }
      }
      return json(res, 200, { ok: true, synced });
    }
    if ((req.method === "GET" || req.method === "PUT") && action === "attendance-settings") {
      if (req.method === "GET") {
        const [row] = await sql`select * from attendance_settings where id = 'default'`;
        return json(res, 200, { ok: true, attendance_settings: attendanceSettingsFromDb(row) });
      }
      const body = await readBody(req);
      const token = body.regenerate ? officeToken() : body.office_qr_token;
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
      return json(res, 200, { ok: true, attendance_settings: attendanceSettingsFromDb(row) });
    }
    if (req.method === "POST" && action === "migrate-local-data") {
      const body = await readBody(req);
      return json(res, 200, { ok: true, summary: await migrateLocalData(sql, body.store || body) });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}
