import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

let sqlClient;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is not configured");
    error.statusCode = 503;
    throw error;
  }
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res) {
  return json(res, 405, { ok: false, error: "Method not allowed" });
}

export function handleError(res, error) {
  const status = error.statusCode || 500;
  return json(res, status, {
    ok: false,
    error: status === 503 ? "DATABASE_URL belum dikonfigurasi" : "Terjadi kesalahan server",
    detail: process.env.NODE_ENV === "production" ? undefined : error.message,
  });
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export const num = (value) => Number(value || 0) || 0;
export const officeToken = () => `OFFICE-${randomUUID().slice(0, 12).toUpperCase()}`;

export function employeeFromDb(row) {
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

export function attendanceSettingsFromDb(row) {
  return {
    attendance_qr_mode: row?.qr_mode || "static",
    office_qr_token: row?.office_token || "",
    location_validation_enabled: row?.location_enabled ?? false,
    office_latitude: num(row?.office_lat),
    office_longitude: num(row?.office_lng),
    location_radius_meters: num(row?.allowed_radius_meters) || 100,
    location_validation_mode: row?.location_validation_mode || "warning",
  };
}

export function businessSettingsFromDb(row) {
  return {
    ...(row?.data || {}),
    business_name: row?.business_name || row?.data?.business_name || "Nama Bisnis",
    legal_name: row?.data?.legal_name || "",
    address: row?.business_address || row?.data?.address || "",
    phone: row?.business_phone || row?.data?.phone || "",
    email: row?.business_email || row?.data?.email || "",
    website: row?.data?.website || "",
    logo_data_url: row?.business_logo_url || row?.data?.logo_data_url || "",
    footer_note: row?.payslip_footer_note || row?.data?.footer_note || "",
    payment_note: row?.data?.payment_note || "",
    currency: row?.data?.currency || "IDR",
    admin_pin: row?.data?.admin_pin || "0987",
  };
}

export async function ensureSchema() {
  const sql = getSql();
  await sql`
    create table if not exists business_settings (
      id text primary key default 'default',
      data jsonb not null default '{}'::jsonb,
      business_name text default 'Nama Bisnis',
      business_subtitle text default 'Aplikasi Penggajian',
      business_address text,
      business_phone text,
      business_email text,
      business_logo_url text,
      business_npwp text,
      payslip_footer_note text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`alter table business_settings add column if not exists business_name text default 'Nama Bisnis'`;
  await sql`alter table business_settings add column if not exists business_subtitle text default 'Aplikasi Penggajian'`;
  await sql`alter table business_settings add column if not exists business_address text`;
  await sql`alter table business_settings add column if not exists business_phone text`;
  await sql`alter table business_settings add column if not exists business_email text`;
  await sql`alter table business_settings add column if not exists business_logo_url text`;
  await sql`alter table business_settings add column if not exists business_npwp text`;
  await sql`alter table business_settings add column if not exists payslip_footer_note text`;
  await sql`
    create table if not exists attendance_settings (
      id text primary key default 'default',
      office_token text not null,
      qr_mode text default 'static',
      location_enabled boolean default false,
      office_lat double precision,
      office_lng double precision,
      allowed_radius_meters integer default 100,
      location_validation_mode text default 'warning',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`
    create table if not exists employees (
      id text primary key,
      employee_id text unique not null,
      name text not null,
      status text,
      position text,
      active boolean default true,
      base_salary_monthly numeric default 0,
      meal_allowance_per_day numeric default 10000,
      transport_allowance_per_day numeric default 0,
      work_days_per_month integer default 26,
      leave_per_month numeric default 0,
      leave_per_year numeric default 0,
      bpjs_kesehatan numeric default 0,
      bpjs_ketenagakerjaan numeric default 0,
      fixed_allowance numeric default 0,
      phone_allowance_active boolean default false,
      phone_allowance_amount numeric default 0,
      bank_name text,
      account_number text,
      account_holder text,
      staff_pin text,
      attendance_token text,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`
    create table if not exists attendance_logs (
      id text primary key,
      employee_id text not null,
      employee_name text,
      date text not null,
      clock_in_time text,
      clock_out_time text,
      total_work_minutes integer default 0,
      late_minutes integer default 0,
      overtime_minutes integer default 0,
      status text default 'hadir',
      qr_type text default 'static_office',
      qr_date text,
      office_token_valid boolean default false,
      pin_verified boolean default false,
      source text default 'qr',
      location_lat double precision,
      location_lng double precision,
      location_accuracy double precision,
      office_distance_meters double precision,
      location_valid boolean,
      location_validation_status text,
      forgot_clock_out boolean default false,
      auto_closed_at timestamptz,
      status_note text,
      admin_review_required boolean default false,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique (employee_id, date)
    )
  `;
  await sql`alter table attendance_logs add column if not exists forgot_clock_out boolean default false`;
  await sql`alter table attendance_logs add column if not exists auto_closed_at timestamptz`;
  await sql`alter table attendance_logs add column if not exists status_note text`;
  await sql`alter table attendance_logs add column if not exists admin_review_required boolean default false`;
  await sql`
    create table if not exists extra_work_records (
      id text primary key,
      employee_id text not null,
      employee_name text,
      date text not null,
      type text,
      hours numeric default 0,
      quantity numeric default 0,
      amount numeric default 0,
      notes text,
      status text default 'pending',
      source text,
      approved_by text,
      approved_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create table if not exists employee_cash_advances (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now())`;
  await sql`create table if not exists kasbon_deductions (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now())`;
  await sql`create table if not exists payroll_components (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now())`;
  await sql`create table if not exists payroll_runs (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now())`;
  await sql`create table if not exists payroll_rows (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now())`;
  await sql`create table if not exists payroll_row_components (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now())`;
  await sql`create table if not exists saved_payslips (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now())`;
  await sql`insert into attendance_settings (id, office_token) values ('default', ${officeToken()}) on conflict (id) do nothing`;
  await sql`insert into business_settings (id, business_name, business_subtitle) values ('default', 'Nama Bisnis', 'Aplikasi Penggajian') on conflict (id) do nothing`;
}

export async function upsertEmployee(sql, employee) {
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

export async function upsertExtraWork(sql, record) {
  const [row] = await sql`
    insert into extra_work_records (
      id, employee_id, employee_name, date, type, hours, quantity, amount,
      notes, status, source, approved_by, approved_at, created_at, updated_at
    ) values (
      ${record.id}, ${record.employee_id}, ${record.employee_name || ""}, ${record.date},
      ${record.type || "overtime"}, ${num(record.hours)}, ${num(record.quantity)},
      ${num(record.amount)}, ${record.notes || ""}, ${record.status || "pending"},
      ${record.source || ""}, ${record.approved_by || ""}, ${record.approved_at || null},
      ${record.created_at || new Date().toISOString()}, now()
    )
    on conflict (id) do update set
      employee_name = excluded.employee_name,
      date = excluded.date,
      type = excluded.type,
      hours = excluded.hours,
      quantity = excluded.quantity,
      amount = excluded.amount,
      notes = excluded.notes,
      status = excluded.status,
      source = excluded.source,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at,
      updated_at = now()
    returning *
  `;
  return row;
}

export async function upsertBusinessSettings(sql, settings) {
  const [row] = await sql`
    insert into business_settings (
      id, data, business_name, business_subtitle, business_address,
      business_phone, business_email, business_logo_url, business_npwp,
      payslip_footer_note, updated_at
    ) values (
      'default', ${JSON.stringify(settings)}::jsonb, ${settings.business_name || "Nama Bisnis"},
      'Aplikasi Penggajian', ${settings.address || ""}, ${settings.phone || ""},
      ${settings.email || ""}, ${settings.logo_data_url || ""}, ${settings.npwp || ""},
      ${settings.footer_note || ""}, now()
    )
    on conflict (id) do update set
      data = excluded.data,
      business_name = excluded.business_name,
      business_subtitle = excluded.business_subtitle,
      business_address = excluded.business_address,
      business_phone = excluded.business_phone,
      business_email = excluded.business_email,
      business_logo_url = excluded.business_logo_url,
      business_npwp = excluded.business_npwp,
      payslip_footer_note = excluded.payslip_footer_note,
      updated_at = now()
    returning *
  `;
  return row;
}
