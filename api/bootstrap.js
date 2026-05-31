import { ensureSchema, getSql, handleError, json, methodNotAllowed } from "./_db.js";

const num = (value) => Number(value || 0) || 0;

function employeeFromDb(row) {
  return {
    id: row.id,
    employee_id: row.employee_id,
    name: row.name,
    status: row.status || "",
    position: row.position || "",
    active: row.active ?? true,
    default_salary: num(row.base_salary_monthly),
    base_salary_monthly: num(row.base_salary_monthly),
    meal_allowance_per_day: num(row.meal_allowance_per_day),
    transport_allowance_per_day: num(row.transport_allowance_per_day),
    work_days_per_month: num(row.work_days_per_month) || 26,
    leave_quota_monthly: num(row.leave_per_month),
    leave_quota_yearly: num(row.leave_per_year),
    bpjs_kesehatan_default: num(row.bpjs_kesehatan),
    bpjs_ketenagakerjaan_default: num(row.bpjs_ketenagakerjaan),
    fixed_allowance: num(row.fixed_allowance),
    hp_admin_allowance_enabled: row.phone_allowance_active ?? false,
    hp_admin_allowance_amount: num(row.phone_allowance_amount),
    bank_name: row.bank_name || "",
    account_number: row.account_number || "",
    account_holder: row.account_holder || "",
    staff_pin: row.staff_pin || "",
    attendance_token: row.attendance_token || "",
    notes: row.notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function attendanceSettingsFromDb(row) {
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
  if (req.method !== "GET") return methodNotAllowed(res);
  try {
    await ensureSchema();
    const sql = getSql();
    const [attendanceSettings] = await sql`select * from attendance_settings where id = 'default'`;
    const [businessSettings] = await sql`select data from business_settings where id = 'default'`;
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
    return json(res, 200, {
      ok: true,
      business_settings: {
        ...(businessSettings?.data || {}),
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
    });
  } catch (error) {
    return handleError(res, error);
  }
}
