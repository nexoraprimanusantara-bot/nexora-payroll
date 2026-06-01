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

export function officeToken() {
  return `OFFICE-${randomUUID().slice(0, 12).toUpperCase()}`;
}

export function nowIso() {
  return new Date().toISOString();
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
  await sql`
    insert into attendance_settings (id, office_token)
    values ('default', ${officeToken()})
    on conflict (id) do nothing
  `;
  await sql`
    insert into business_settings (id, business_name, business_subtitle)
    values ('default', 'Nama Bisnis', 'Aplikasi Penggajian')
    on conflict (id) do nothing
  `;
}
