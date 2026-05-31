import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "./_db.js";

const num = (value) => Number(value || 0) || 0;

async function upsertEmployee(sql, employee) {
  const [row] = await sql`
    insert into employees (
      id, employee_id, name, status, position, active, base_salary_monthly,
      meal_allowance_per_day, transport_allowance_per_day, work_days_per_month,
      leave_per_month, leave_per_year, bpjs_kesehatan, bpjs_ketenagakerjaan,
      fixed_allowance, phone_allowance_active, phone_allowance_amount, bank_name,
      account_number, account_holder, staff_pin, attendance_token, notes,
      created_at, updated_at
    ) values (
      ${employee.id}, ${employee.employee_id}, ${employee.name}, ${employee.status || ""},
      ${employee.position || ""}, ${employee.active ?? true}, ${num(employee.base_salary_monthly ?? employee.default_salary)},
      ${num(employee.meal_allowance_per_day)}, ${num(employee.transport_allowance_per_day)},
      ${num(employee.work_days_per_month) || 26}, ${num(employee.leave_quota_monthly ?? employee.leave_per_month)},
      ${num(employee.leave_quota_yearly ?? employee.leave_per_year)}, ${num(employee.bpjs_kesehatan_default ?? employee.bpjs_kesehatan)},
      ${num(employee.bpjs_ketenagakerjaan_default ?? employee.bpjs_ketenagakerjaan)}, ${num(employee.fixed_allowance)},
      ${Boolean(employee.hp_admin_allowance_enabled ?? employee.phone_allowance_active)}, ${num(employee.hp_admin_allowance_amount ?? employee.phone_allowance_amount)},
      ${employee.bank_name || ""}, ${employee.account_number || ""}, ${employee.account_holder || ""},
      ${employee.staff_pin || ""}, ${employee.attendance_token || ""}, ${employee.notes || ""},
      ${employee.created_at || new Date().toISOString()}, now()
    )
    on conflict (employee_id) do update set
      name = excluded.name,
      status = excluded.status,
      position = excluded.position,
      active = excluded.active,
      base_salary_monthly = excluded.base_salary_monthly,
      meal_allowance_per_day = excluded.meal_allowance_per_day,
      transport_allowance_per_day = excluded.transport_allowance_per_day,
      work_days_per_month = excluded.work_days_per_month,
      leave_per_month = excluded.leave_per_month,
      leave_per_year = excluded.leave_per_year,
      bpjs_kesehatan = excluded.bpjs_kesehatan,
      bpjs_ketenagakerjaan = excluded.bpjs_ketenagakerjaan,
      fixed_allowance = excluded.fixed_allowance,
      phone_allowance_active = excluded.phone_allowance_active,
      phone_allowance_amount = excluded.phone_allowance_amount,
      bank_name = excluded.bank_name,
      account_number = excluded.account_number,
      account_holder = excluded.account_holder,
      staff_pin = excluded.staff_pin,
      attendance_token = excluded.attendance_token,
      notes = excluded.notes,
      updated_at = now()
    returning *
  `;
  return row;
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    if (req.method === "GET") {
      const rows = await sql`select * from employees order by employee_id`;
      return json(res, 200, { ok: true, employees: rows });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const employee = body.employee || body;
      const row = await upsertEmployee(sql, employee);
      return json(res, 200, { ok: true, employee: row });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}

export { upsertEmployee };
