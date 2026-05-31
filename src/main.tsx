import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Download,
  Eye,
  FileText,
  History,
  LayoutDashboard,
  Lock,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import "./styles.css";

type ComponentType = "earning" | "deduction";
type RowStatus = "Draft" | "Finalized" | "Paid";
type AttendanceStatus = "hadir" | "telat" | "cuti_berbayar" | "cuti_tidak_berbayar" | "izin" | "sakit" | "alfa" | "libur";
type ExtraWorkType = "overtime" | "extra_chore";
type ApprovalStatus = "pending" | "approved" | "rejected";
type KasbonStatus = "active" | "partially_paid" | "paid" | "cancelled";

type BusinessSettings = {
  id: string;
  business_name: string;
  legal_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_data_url: string;
  footer_note: string;
  payment_note: string;
  currency: string;
  admin_pin: string;
  attendance_qr_mode: "static" | "daily";
  office_qr_token: string;
  updated_at: string;
};

type PayrollComponent = {
  id: string;
  name: string;
  type: ComponentType;
  active: boolean;
  show_in_form: boolean;
  show_in_pdf: boolean;
  hide_if_zero: boolean;
  default_amount: number;
  company_paid: boolean;
  employee_deduction: boolean;
  notes: string;
  category?: "Default Staff" | "Monthly Variable" | "Deduction" | "Allowance";
  sort_order: number;
  archived?: boolean;
  created_at: string;
  updated_at: string;
};

type Employee = {
  id: string;
  employee_id: string;
  name: string;
  status: string;
  position: string;
  active: boolean;
  default_salary: number;
  base_salary_monthly: number;
  meal_allowance_per_day: number;
  transport_allowance_per_day: number;
  work_days_per_month: number;
  leave_quota_monthly: number;
  leave_quota_yearly: number;
  bpjs_kesehatan_default: number;
  bpjs_ketenagakerjaan_default: number;
  fixed_allowance: number;
  hp_admin_allowance_enabled: boolean;
  hp_admin_allowance_amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  staff_pin: string;
  attendance_token: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type PayrollRun = {
  id: string;
  month: number;
  year: number;
  status: RowStatus;
  created_at: string;
  updated_at: string;
};

type PayrollRowComponent = {
  id: string;
  payroll_row_id: string;
  component_name: string;
  component_type: ComponentType;
  amount: number;
  show_in_pdf: boolean;
  hide_if_zero: boolean;
  sort_order: number;
  source_component_id?: string;
};

type PayrollRow = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_name: string;
  employee_status: string;
  slip_id: string;
  payment_date: string;
  total_earning: number;
  total_deduction: number;
  take_home_pay: number;
  status: RowStatus;
  created_at: string;
  updated_at: string;
};

type SavedPayslip = {
  id: string;
  slip_id: string;
  payroll_row_id: string;
  month: number;
  year: number;
  employee_id: string;
  employee_name: string;
  status: RowStatus;
  business_snapshot_json: string;
  employee_snapshot_json: string;
  component_snapshot_json: string;
  totals_snapshot_json: string;
  payment_snapshot_json: string;
  finalized_at: string;
  paid_at: string;
  created_at: string;
};

type AttendanceLog = {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  clock_in_time: string;
  clock_out_time: string;
  break_start_time: string;
  break_end_time: string;
  total_work_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  status: AttendanceStatus;
  notes: string;
  source: "qr" | "manual";
  qr_type?: "office_static" | "daily";
  qr_date?: string;
  pin_verified?: boolean;
  created_at: string;
  updated_at: string;
};

type ExtraWorkRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  type: ExtraWorkType;
  hours: number;
  quantity: number;
  amount: number;
  notes: string;
  status: ApprovalStatus;
  source?: "staff_after_clock_out" | "admin_manual";
  approved_by: string;
  approved_at: string;
  created_at: string;
  updated_at: string;
};

type CashAdvance = {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  amount: number;
  description: string;
  status: KasbonStatus;
  remaining_balance: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type KasbonDeduction = {
  id: string;
  kasbon_id: string;
  payroll_row_id: string;
  employee_id: string;
  deduction_date: string;
  amount: number;
  notes: string;
  created_at: string;
};

type Store = {
  business_settings: BusinessSettings;
  payroll_components: PayrollComponent[];
  employees: Employee[];
  payroll_runs: PayrollRun[];
  payroll_rows: PayrollRow[];
  payroll_row_components: PayrollRowComponent[];
  saved_payslips: SavedPayslip[];
  attendance_logs: AttendanceLog[];
  extra_work_records: ExtraWorkRecord[];
  employee_cash_advances: CashAdvance[];
  kasbon_deductions: KasbonDeduction[];
};

const STORAGE_KEY = "payroll_app_v1";
const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const defaultStatusOptions = ["Tetap", "Training", "Freelance", "Part Time", "Kontrak", "Harian", "Magang"];
const defaultPositionOptions = ["Admin", "Finance", "HR", "Sales", "Kasir", "Barista", "Kitchen", "Cook", "Server", "Supervisor", "Manager", "Driver", "Cleaning", "Security"];

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const cleanNumber = (value: unknown) => Number(value || 0) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const currentTime = () => new Date().toTimeString().slice(0, 5);
const monthStart = (month: number, year: number) => `${year}-${String(month).padStart(2, "0")}-01`;
const monthEnd = (month: number, year: number) => new Date(year, month, 0).toISOString().slice(0, 10);
const makeAttendanceToken = (employeeId: string) => `ATT-${employeeId}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));
const makeOfficeQrToken = () => `OFFICE-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
const officeQrPayload = (settings: BusinessSettings, date = today()) =>
  JSON.stringify({
    type: settings.attendance_qr_mode === "daily" ? "daily" : "office_static",
    token: settings.office_qr_token,
    date: settings.attendance_qr_mode === "daily" ? date : "",
  });

type PayrollDraftRow = {
  employee_internal_id: string;
  employee_id: string;
  employee_name: string;
  position: string;
  hari_masuk: number;
  cuti_berbayar: number;
  cuti_tidak_berbayar: number;
  izin: number;
  sakit: number;
  alfa: number;
  sisa_cuti: number;
  komisi: number;
  bonus: number;
  lembur: number;
  extra_chore: number;
  potongan_manual: number;
  potong_kasbon: boolean;
  kasbon_deduction: number;
  notes: string;
  manual_override: boolean;
};

function nextEmployeeId(employees: Employee[]) {
  const latest = employees
    .map((employee) => /^EMP(\d+)$/i.exec(employee.employee_id)?.[1])
    .filter(Boolean)
    .map(Number)
    .reduce((max, number) => Math.max(max, number), 0);
  return `EMP${String(latest + 1).padStart(3, "0")}`;
}

function uniqueOptions(defaults: string[], savedValues: string[]) {
  const saved = savedValues.map((value) => value.trim()).filter(Boolean);
  return [...defaults, ...saved.filter((value) => !defaults.includes(value) && value !== "Custom"), "Custom"];
}

function formatIDR(amount: number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cleanNumber(amount));
}

function defaultBusiness(): BusinessSettings {
  return {
    id: "business_settings",
    business_name: "Nama Bisnis",
    legal_name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    logo_data_url: "",
    footer_note: "Slip ini dibuat secara otomatis dan sah tanpa tanda tangan basah.",
    payment_note: "Pembayaran dilakukan sesuai tanggal yang tercantum.",
    currency: "IDR",
    admin_pin: "0987",
    attendance_qr_mode: "daily",
    office_qr_token: makeOfficeQrToken(),
    updated_at: now(),
  };
}

function defaultComponents(): PayrollComponent[] {
  const earning = ["Gaji Pokok", "Lain-Lain", "Uang Makan", "Transport", "Komisi", "Bonus", "Lembur"];
  const deduction = ["Absensi", "BPJS Kesehatan", "BPJS Ketenagakerjaan", "Potongan Lain"];
  return [
    ...earning.map((name, index) => makeComponent(name, "earning", index + 1)),
    ...deduction.map((name, index) => makeComponent(name, "deduction", index + 20)),
  ];
}

function makeComponent(name = "", type: ComponentType = "earning", order = 1): PayrollComponent {
  return {
    id: uid("component"),
    name,
    type,
    active: true,
    show_in_form: true,
    show_in_pdf: true,
    hide_if_zero: true,
    default_amount: 0,
    company_paid: false,
    employee_deduction: type === "deduction",
    notes: "",
    category: type === "deduction" ? "Deduction" : "Monthly Variable",
    sort_order: order,
    created_at: now(),
    updated_at: now(),
  };
}

function seedStore(): Store {
  return {
    business_settings: defaultBusiness(),
    payroll_components: defaultComponents(),
    employees: [
      {
        id: uid("employee"),
        employee_id: "EMP001",
        name: "Contoh Karyawan",
        status: "Tetap",
        position: "Staff",
        active: true,
        default_salary: 5000000,
        base_salary_monthly: 5000000,
        meal_allowance_per_day: 10000,
        transport_allowance_per_day: 0,
        work_days_per_month: 26,
        leave_quota_monthly: 0,
        leave_quota_yearly: 0,
        bpjs_kesehatan_default: 0,
        bpjs_ketenagakerjaan_default: 0,
        fixed_allowance: 0,
        hp_admin_allowance_enabled: false,
        hp_admin_allowance_amount: 0,
        bank_name: "",
        account_number: "",
        account_holder: "",
        staff_pin: randomPin(),
        attendance_token: makeAttendanceToken("EMP001"),
        notes: "",
        created_at: now(),
        updated_at: now(),
      },
    ],
    payroll_runs: [],
    payroll_rows: [],
    payroll_row_components: [],
    saved_payslips: [],
    attendance_logs: [],
    extra_work_records: [],
    employee_cash_advances: [],
    kasbon_deductions: [],
  };
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedStore();
    const parsed = JSON.parse(raw);
    const seeded = seedStore();
    return {
      ...seeded,
      ...parsed,
      business_settings: {
        ...seeded.business_settings,
        ...parsed.business_settings,
        admin_pin: parsed.business_settings?.admin_pin || "0987",
        attendance_qr_mode: parsed.business_settings?.attendance_qr_mode || "daily",
        office_qr_token: parsed.business_settings?.office_qr_token || makeOfficeQrToken(),
      },
      employees: (parsed.employees || seeded.employees).map((employee: Employee) => ({
        ...employee,
        base_salary_monthly: employee.base_salary_monthly ?? employee.default_salary ?? 0,
        meal_allowance_per_day: employee.meal_allowance_per_day ?? 10000,
        transport_allowance_per_day: employee.transport_allowance_per_day ?? 0,
        work_days_per_month: employee.work_days_per_month ?? 26,
        leave_quota_monthly: employee.leave_quota_monthly ?? 0,
        leave_quota_yearly: employee.leave_quota_yearly ?? 0,
        bpjs_kesehatan_default: employee.bpjs_kesehatan_default ?? 0,
        bpjs_ketenagakerjaan_default: employee.bpjs_ketenagakerjaan_default ?? 0,
        fixed_allowance: employee.fixed_allowance ?? 0,
        hp_admin_allowance_enabled: employee.hp_admin_allowance_enabled ?? false,
        hp_admin_allowance_amount: employee.hp_admin_allowance_amount ?? 0,
        bank_name: employee.bank_name ?? "",
        account_number: employee.account_number ?? "",
        account_holder: employee.account_holder ?? "",
        staff_pin: employee.staff_pin || randomPin(),
        attendance_token: employee.attendance_token || makeAttendanceToken(employee.employee_id),
      })),
      attendance_logs: (parsed.attendance_logs || []).map((log: AttendanceLog) => ({
        ...log,
        qr_type: log.qr_type || (log.source === "qr" ? "daily" : undefined),
        qr_date: log.qr_date || log.date,
        pin_verified: log.pin_verified ?? log.source === "qr",
      })),
      extra_work_records: parsed.extra_work_records || [],
      employee_cash_advances: parsed.employee_cash_advances || [],
      kasbon_deductions: parsed.kasbon_deductions || [],
    };
  } catch {
    return seedStore();
  }
}

function timeDiffMinutes(date: string, start: string, end: string) {
  if (!start || !end) return 0;
  const startDate = new Date(`${date}T${start}`);
  const endDate = new Date(`${date}T${end}`);
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
}

function ensureComponent(store: Store, name: string, type: ComponentType) {
  const existing = store.payroll_components.find((component) => component.name.toLowerCase() === name.toLowerCase());
  if (existing) return { store, component: existing };
  const component = makeComponent(name, type, store.payroll_components.length + 50);
  return {
    store: { ...store, payroll_components: [...store.payroll_components, component] },
    component,
  };
}

function attendanceDefaultsFor(employee: Employee, logs: AttendanceLog[], month: number, year: number) {
  const from = monthStart(month, year);
  const to = monthEnd(month, year);
  const monthly = logs.filter((log) => log.employee_id === employee.employee_id && log.date >= from && log.date <= to);
  const count = (status: AttendanceStatus) => monthly.filter((log) => log.status === status).length;
  const hariMasuk = monthly.length ? monthly.filter((log) => ["hadir", "telat"].includes(log.status)).length : employee.work_days_per_month || 26;
  const paidLeave = count("cuti_berbayar");
  const unpaidLeave = count("cuti_tidak_berbayar");
  return {
    hari_masuk: hariMasuk,
    cuti_berbayar: paidLeave,
    cuti_tidak_berbayar: unpaidLeave,
    izin: count("izin"),
    sakit: count("sakit"),
    alfa: count("alfa"),
    sisa_cuti: Math.max(0, (employee.leave_quota_monthly || 0) - paidLeave),
  };
}

function createPayrollDraftRows(store: Store, month: number, year: number) {
  return store.employees.filter((employee) => employee.active).map((employee) => {
    const att = attendanceDefaultsFor(employee, store.attendance_logs, month, year);
    const from = monthStart(month, year);
    const to = monthEnd(month, year);
    const overtime = store.extra_work_records.filter((record) => record.employee_id === employee.employee_id && record.status === "approved" && record.type === "overtime" && record.date >= from && record.date <= to).reduce((sum, record) => sum + record.amount, 0);
    const extra = store.extra_work_records.filter((record) => record.employee_id === employee.employee_id && record.status === "approved" && record.type === "extra_chore" && record.date >= from && record.date <= to).reduce((sum, record) => sum + record.amount, 0);
    return {
      employee_internal_id: employee.id,
      employee_id: employee.employee_id,
      employee_name: employee.name,
      position: employee.position,
      ...att,
      komisi: 0,
      bonus: 0,
      lembur: overtime,
      extra_chore: extra,
      potongan_manual: 0,
      potong_kasbon: false,
      kasbon_deduction: 0,
      notes: "",
      manual_override: false,
    };
  });
}

function calculatePayrollRow(employee: Employee, row: PayrollDraftRow) {
  const workDays = employee.work_days_per_month || 26;
  const base = employee.base_salary_monthly || employee.default_salary || 0;
  const dailySalary = workDays ? base / workDays : 0;
  const unpaidDays = cleanNumber(row.cuti_tidak_berbayar) + cleanNumber(row.alfa);
  const baseDeduction = dailySalary * unpaidDays;
  const finalBase = Math.max(0, Math.min(base, base - baseDeduction));
  const meal = cleanNumber(employee.meal_allowance_per_day) * cleanNumber(row.hari_masuk);
  const transport = cleanNumber(employee.transport_allowance_per_day) * cleanNumber(row.hari_masuk);
  const hpAdmin = employee.hp_admin_allowance_enabled ? cleanNumber(employee.hp_admin_allowance_amount) : 0;
  const totalEarning = finalBase + meal + transport + cleanNumber(employee.fixed_allowance) + hpAdmin + cleanNumber(row.komisi) + cleanNumber(row.bonus) + cleanNumber(row.lembur) + cleanNumber(row.extra_chore);
  const totalDeduction = cleanNumber(employee.bpjs_kesehatan_default) + cleanNumber(employee.bpjs_ketenagakerjaan_default) + cleanNumber(row.potongan_manual) + (row.potong_kasbon ? cleanNumber(row.kasbon_deduction) : 0);
  return {
    dailySalary,
    unpaidDays,
    baseDeduction,
    finalBase,
    meal,
    transport,
    hpAdmin,
    totalEarning,
    totalDeduction,
    takeHome: totalEarning - totalDeduction,
  };
}

function payrollComponentsFromDraft(employee: Employee, row: PayrollDraftRow): PayrollRowComponent[] {
  const calc = calculatePayrollRow(employee, row);
  return [
    ["Gaji Pokok Final", "earning", calc.finalBase, `Gaji pokok bulanan setelah penyesuaian cuti/alfa`],
    ["Uang Makan", "earning", calc.meal, `${row.hari_masuk} hari x ${employee.meal_allowance_per_day}`],
    ["Transport", "earning", calc.transport, `${row.hari_masuk} hari x ${employee.transport_allowance_per_day}`],
    ["Tunjangan Tetap", "earning", employee.fixed_allowance, ""],
    ["Tunjangan HP/Admin", "earning", calc.hpAdmin, ""],
    ["Komisi", "earning", row.komisi, ""],
    ["Bonus", "earning", row.bonus, ""],
    ["Lembur", "earning", row.lembur, ""],
    ["Extra Chore", "earning", row.extra_chore, ""],
    ["BPJS Kesehatan", "deduction", employee.bpjs_kesehatan_default, ""],
    ["BPJS Ketenagakerjaan", "deduction", employee.bpjs_ketenagakerjaan_default, ""],
    ["Kasbon", "deduction", row.potong_kasbon ? row.kasbon_deduction : 0, ""],
    ["Potongan Manual", "deduction", row.potongan_manual, ""],
  ].map(([name, type, amount, note], index) => ({
    id: uid("row_component"),
    payroll_row_id: "",
    component_name: String(name),
    component_type: type as ComponentType,
    amount: cleanNumber(amount),
    show_in_pdf: true,
    hide_if_zero: true,
    sort_order: index + 1,
    source_component_id: String(note || ""),
  }));
}

function generateSlipId(store: Store, employeeId: string, month: number, year: number) {
  const yyyymm = `${year}${String(month).padStart(2, "0")}`;
  const prefix = `PAY-${yyyymm}-${employeeId}-`;
  const used = [...store.payroll_rows.map((row) => row.slip_id), ...store.saved_payslips.map((slip) => slip.slip_id)];
  const max = used
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter(Boolean)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getVisibleComponents(components: PayrollRowComponent[]) {
  return components
    .filter((component) => component.show_in_pdf && (!component.hide_if_zero || component.amount !== 0))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function createPayslipPdf(payload: {
  business: BusinessSettings;
  employee: Partial<Employee> & { employee_id: string; name: string; status: string };
  components: PayrollRowComponent[];
  totals: { total_earning: number; total_deduction: number; take_home_pay: number };
  payment: { slip_id: string; month: number; year: number; payment_date: string; finalized_at?: string; payroll_detail?: PayrollDraftRow; calculation?: ReturnType<typeof calculatePayrollRow> };
  save?: boolean;
  print?: boolean;
}) {
  const { business, employee, components, totals, payment, save, print } = payload;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const currency = business.currency || "IDR";
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 12, 186, 273, 2, 2, "F");

  if (business.logo_data_url) {
    try {
      doc.addImage(business.logo_data_url, "PNG", 18, 18, 24, 24);
    } catch {
      doc.setDrawColor(203, 213, 225);
      doc.rect(18, 18, 24, 24);
    }
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.rect(18, 18, 24, 24);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("LOGO", 26, 32);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(business.business_name || "Nama Bisnis", 48, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contact = [business.legal_name, business.address, business.phone, business.email, business.website].filter(Boolean);
  doc.text(contact.slice(0, 3), 48, 29);
  if (contact.length > 3) doc.text(contact.slice(3).join(" | "), 48, 41);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SLIP GAJI / PAYSLIP", 192, 25, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(payment.slip_id || "Draft", 192, 32, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(18, 50, 192, 50);

  const infoRows = [
    ["Nama", employee.name],
    ["Employee ID", employee.employee_id],
    ["Status Karyawan", employee.status || "-"],
    ["Periode", `${months[payment.month - 1]} ${payment.year}`],
    ["Tanggal Pembayaran", payment.payment_date || "-"],
  ];
  autoTable(doc, {
    startY: 58,
    theme: "plain",
    body: infoRows,
    styles: { fontSize: 9, cellPadding: 1.4, textColor: [15, 23, 42] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 42 }, 1: { cellWidth: 65 } },
    margin: { left: 18, right: 18 },
  });

  if (payment.payroll_detail) {
    const detail = payment.payroll_detail;
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5,
      theme: "grid",
      head: [["Attendance Summary", "Hari"]],
      body: [
        ["Hari Masuk", String(detail.hari_masuk)],
        ["Cuti Berbayar", String(detail.cuti_berbayar)],
        ["Cuti Tidak Berbayar", String(detail.cuti_tidak_berbayar)],
        ["Alfa", String(detail.alfa)],
        ["Sisa Cuti", String(detail.sisa_cuti)],
      ],
      styles: { fontSize: 8, cellPadding: 1.8 },
      margin: { left: 18, right: 18 },
    });
  }

  const earnings = getVisibleComponents(components).filter((item) => item.component_type === "earning");
  const deductions = getVisibleComponents(components).filter((item) => item.component_type === "deduction");
  const tableOptions = {
    theme: "striped" as const,
    headStyles: { fillColor: [15, 23, 42] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    styles: { fontSize: 9, cellPadding: 2.3, overflow: "linebreak" as const },
    columnStyles: { 1: { halign: "right" as const, cellWidth: 45 } },
    margin: { left: 18, right: 18 },
    pageBreak: "avoid" as const,
  };

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Pendapatan", 18, y);
  autoTable(doc, {
    ...tableOptions,
    startY: y + 4,
    head: [["Komponen", "Jumlah"]],
    body: earnings.length ? earnings.map((item) => [item.component_name, formatIDR(item.amount, currency)]) : [["Tidak ada pendapatan", formatIDR(0, currency)]],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.text("Potongan", 18, y);
  autoTable(doc, {
    ...tableOptions,
    startY: y + 4,
    head: [["Komponen", "Jumlah"]],
    body: deductions.length ? deductions.map((item) => [item.component_name, formatIDR(item.amount, currency)]) : [["Tidak ada potongan", formatIDR(0, currency)]],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  autoTable(doc, {
    startY: y,
    theme: "plain",
    body: [
      ["Total Pendapatan", formatIDR(totals.total_earning, currency)],
      ["Total Potongan", formatIDR(totals.total_deduction, currency)],
      ["Take Home Pay", formatIDR(totals.take_home_pay, currency)],
    ],
    styles: { fontSize: 10, cellPadding: 2.4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 115 }, 1: { halign: "right", fontStyle: "bold", cellWidth: 59 } },
    margin: { left: 18, right: 18 },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [236, 253, 245];
        data.cell.styles.textColor = [6, 95, 70];
        data.cell.styles.fontSize = 12;
      }
    },
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Catatan pembayaran: ${business.payment_note || "-"}`, 18, 262, { maxWidth: 174 });
  doc.text(business.footer_note || "", 18, 270, { maxWidth: 174 });
  doc.text(`Generated by system${payment.finalized_at ? ` | Final: ${new Date(payment.finalized_at).toLocaleString("id-ID")}` : ""}`, 18, 279);

  if (print) {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
    return;
  }
  if (save) doc.save(`${payment.slip_id || "draft-payslip"}.pdf`);
  else window.open(doc.output("bloburl"), "_blank");
}

function App() {
  const [store, setStore] = useState<Store>(() => loadStore());
  const [page, setPage] = useState("Absensi Staff");
  const [settingsTab, setSettingsTab] = useState("Info Bisnis");
  const [draftEmployee, setDraftEmployee] = useState<Employee>(() => emptyEmployee(nextEmployeeId(store.employees)));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(store.employees[0]?.id || "");
  const [attendanceEmployeeId, setAttendanceEmployeeId] = useState("");
  const [attendanceSource, setAttendanceSource] = useState<"qr" | "manual">("manual");
  const [attendanceQrInput, setAttendanceQrInput] = useState("");
  const [attendanceQrValid, setAttendanceQrValid] = useState(false);
  const [attendanceQrType, setAttendanceQrType] = useState<"office_static" | "daily">("daily");
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [showManualQr, setShowManualQr] = useState(false);
  const [adminCorrectionOpen, setAdminCorrectionOpen] = useState(false);
  const [staffPinInput, setStaffPinInput] = useState("");
  const [manualAdminPin, setManualAdminPin] = useState("");
  const [officeQrDataUrl, setOfficeQrDataUrl] = useState("");
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [showExtraPrompt, setShowExtraPrompt] = useState<Employee | null>(null);
  const [extraChoice, setExtraChoice] = useState<"none" | "overtime" | "extra_chore" | "both">("none");
  const [extraDraft, setExtraDraft] = useState({ overtime_hours: 0, overtime_amount: 0, overtime_notes: "", chore_name: "", chore_quantity: 0, chore_amount: 0, chore_notes: "" });
  const [recapFrom, setRecapFrom] = useState(monthStart(new Date().getMonth() + 1, new Date().getFullYear()));
  const [recapTo, setRecapTo] = useState(today());
  const [recapEmployee, setRecapEmployee] = useState("");
  const [recapStatus, setRecapStatus] = useState("");
  const [kasbonDraft, setKasbonDraft] = useState({ employeeInternalId: store.employees[0]?.id || "", amount: 0, description: "", notes: "" });
  const [deductKasbon, setDeductKasbon] = useState(false);
  const [kasbonDeductionAmount, setKasbonDeductionAmount] = useState(0);
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [paymentDate, setPaymentDate] = useState(today());
  const [componentAmounts, setComponentAmounts] = useState<Record<string, number>>({});
  const [customComponents, setCustomComponents] = useState<PayrollRowComponent[]>([]);
  const [selectedSlipId, setSelectedSlipId] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyMonth, setHistoryMonth] = useState("");
  const [historyYear, setHistoryYear] = useState("");
  const [historyEmployee, setHistoryEmployee] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingPage, setPendingPage] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [shownPins, setShownPins] = useState<Record<string, boolean>>({});
  const [advancedQrEmployee, setAdvancedQrEmployee] = useState<Employee | null>(null);
  const [payrollRowsDraft, setPayrollRowsDraft] = useState<PayrollDraftRow[]>([]);
  const [detailRowId, setDetailRowId] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<unknown>; clear: () => void } | null>(null);

  const saveStore = (next: Store) => {
    setStore(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const requestPage = (target: string) => {
    if (target === "Absensi Staff" || adminUnlocked) {
      setPage(target);
      return;
    }
    setPendingPage(target);
    setPinInput("");
    setPinError("");
    setPinModalOpen(true);
  };

  const unlockAdmin = () => {
    if (pinInput === (store.business_settings.admin_pin || "0987")) {
      sessionStorage.setItem("payroll_admin_unlocked", "true");
      setAdminUnlocked(true);
      setPinModalOpen(false);
      setPage(pendingPage || "Dashboard");
      return;
    }
    setPinError("PIN salah. Silakan coba lagi.");
  };

  const lockAdmin = () => {
    sessionStorage.removeItem("payroll_admin_unlocked");
    setAdminUnlocked(false);
    setPage("Absensi Staff");
  };

  const validateOfficeQr = (raw = attendanceQrInput) => {
    try {
      const payload = JSON.parse(raw) as { type?: string; token?: string; date?: string };
      if (payload.token !== store.business_settings.office_qr_token) {
        setAttendanceQrValid(false);
        setAttendanceMessage("QR absensi tidak valid.");
        return false;
      }
      if (payload.type === "daily" && payload.date !== today()) {
        setAttendanceQrValid(false);
        setAttendanceMessage("QR absensi sudah tidak berlaku. Silakan scan QR hari ini.");
        return false;
      }
      setAttendanceQrValid(true);
      setAttendanceQrType(payload.type === "office_static" ? "office_static" : "daily");
      setAttendanceSource("qr");
      setAttendanceMessage(payload.type === "daily" ? "QR hari ini valid." : "QR Absensi Kantor valid.");
      return true;
    } catch {
      setAttendanceQrValid(false);
      setAttendanceMessage("QR absensi tidak valid.");
      return false;
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch {
      // Camera may already be stopped by the browser.
    }
    scannerRef.current = null;
    setScannerActive(false);
  };

  const startScanner = async () => {
    setScannerError("");
    setShowManualQr(false);
    setAdminCorrectionOpen(false);
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await stopScanner();
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText: string) => {
          setAttendanceQrInput(decodedText);
          validateOfficeQr(decodedText);
          await stopScanner();
        },
        () => undefined,
      );
    } catch {
      setScannerActive(false);
      setShowManualQr(true);
      setScannerError("Kamera tidak bisa dibuka. Gunakan Input Manual QR.");
    }
  };

  const generateOfficeQr = async (regenerate = false) => {
    const nextSettings = regenerate
      ? { ...store.business_settings, office_qr_token: makeOfficeQrToken(), updated_at: now() }
      : store.business_settings;
    if (regenerate) saveStore({ ...store, business_settings: nextSettings });
    const dataUrl = await QRCode.toDataURL(officeQrPayload(nextSettings), { margin: 1, width: 320 });
    setOfficeQrDataUrl(dataUrl);
  };

  const downloadOfficeQr = async (print = false) => {
    const dataUrl = officeQrDataUrl || await QRCode.toDataURL(officeQrPayload(store.business_settings), { margin: 1, width: 360 });
    if (print) {
      const popup = window.open("", "_blank");
      popup?.document.write(`<html><body style="font-family:Arial;text-align:center;padding:32px"><h2>QR Absensi Kantor</h2><p>${store.business_settings.attendance_qr_mode === "daily" ? `QR Harian ${today()}` : "Static Office QR"}</p><img src="${dataUrl}" /></body></html>`);
      popup?.document.close();
      popup?.print();
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-absensi-kantor-${store.business_settings.attendance_qr_mode === "daily" ? today() : "static"}.png`;
    link.click();
  };

  const ensureEmployeeToken = (employee: Employee) => {
    if (employee.attendance_token) return employee;
    const updated = { ...employee, attendance_token: makeAttendanceToken(employee.employee_id), updated_at: now() };
    saveStore({ ...store, employees: store.employees.map((item) => item.id === employee.id ? updated : item) });
    return updated;
  };

  const regenerateEmployeeToken = (employee: Employee) => {
    const updated = { ...employee, attendance_token: makeAttendanceToken(employee.employee_id), updated_at: now() };
    saveStore({ ...store, employees: store.employees.map((item) => item.id === employee.id ? updated : item) });
    setQrMap((current) => {
      const next = { ...current };
      delete next[employee.id];
      return next;
    });
    return updated;
  };

  const generateQr = async (employee: Employee, regenerate = false) => {
    const secured = regenerate ? regenerateEmployeeToken(employee) : ensureEmployeeToken(employee);
    const token = secured.attendance_token || secured.employee_id;
    const dataUrl = await QRCode.toDataURL(token, { margin: 1, width: 260 });
    setQrMap((current) => ({ ...current, [employee.id]: dataUrl }));
  };

  const downloadQr = async (employee: Employee, print = false) => {
    const secured = ensureEmployeeToken(employee);
    const token = secured.attendance_token || secured.employee_id;
    const dataUrl = qrMap[secured.id] || await QRCode.toDataURL(token, { margin: 1, width: 360 });
    if (print) {
      const popup = window.open("", "_blank");
      popup?.document.write(`<html><body style="font-family:Arial;text-align:center;padding:32px"><h2>${employee.name}</h2><p>${employee.employee_id}</p><img src="${dataUrl}" /></body></html>`);
      popup?.document.close();
      popup?.print();
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-${employee.employee_id}.png`;
    link.click();
  };

  const clockIn = () => {
    if (!attendanceEmployee) return alert("Pilih atau masukkan Employee ID yang valid.");
    if (!attendanceEmployee.active) return alert("Karyawan tidak aktif.");
    if (!adminCorrectionOpen && !attendanceQrValid) return alert("Scan QR Absensi Kantor yang valid terlebih dahulu.");
    if (adminCorrectionOpen && manualAdminPin !== (store.business_settings.admin_pin || "0987")) return alert("Manual fallback memerlukan PIN admin.");
    if (attendanceEmployee.staff_pin !== staffPinInput) return alert("PIN Staff salah. Silakan coba lagi.");
    if (todayAttendance?.clock_in_time) return alert("Karyawan ini sudah clock in hari ini.");
    const log: AttendanceLog = {
      id: uid("attendance"),
      employee_id: attendanceEmployee.employee_id,
      employee_name: attendanceEmployee.name,
      date: today(),
      clock_in_time: currentTime(),
      clock_out_time: "",
      break_start_time: "",
      break_end_time: "",
      total_work_minutes: 0,
      late_minutes: 0,
      overtime_minutes: 0,
      status: currentTime() > "09:00" ? "telat" : "hadir",
      notes: "",
      source: adminCorrectionOpen ? "manual" : "qr",
      qr_type: adminCorrectionOpen ? undefined : attendanceQrType,
      qr_date: adminCorrectionOpen ? "" : today(),
      pin_verified: attendanceEmployee.staff_pin === staffPinInput,
      created_at: now(),
      updated_at: now(),
    };
    saveStore({ ...store, attendance_logs: [log, ...store.attendance_logs] });
    setAttendanceMessage(`Clock In berhasil pukul ${log.clock_in_time}`);
  };

  const clockOut = () => {
    if (!attendanceEmployee || !todayAttendance) return alert("Clock in terlebih dahulu.");
    if (!adminCorrectionOpen && !attendanceQrValid) return alert("Scan QR Absensi Kantor yang valid terlebih dahulu.");
    if (adminCorrectionOpen && manualAdminPin !== (store.business_settings.admin_pin || "0987")) return alert("Manual fallback memerlukan PIN admin.");
    if (attendanceEmployee.staff_pin !== staffPinInput) return alert("PIN Staff salah. Silakan coba lagi.");
    if (todayAttendance.clock_out_time) return alert("Karyawan ini sudah clock out hari ini.");
    const out = currentTime();
    const total = timeDiffMinutes(todayAttendance.date, todayAttendance.clock_in_time, out);
    const overtime = Math.max(0, total - 8 * 60);
    saveStore({
      ...store,
      attendance_logs: store.attendance_logs.map((log) =>
        log.id === todayAttendance.id ? { ...log, clock_out_time: out, total_work_minutes: total, overtime_minutes: overtime, pin_verified: true, updated_at: now() } : log,
      ),
    });
    setAttendanceMessage(`Clock Out berhasil pukul ${out}`);
    setShowExtraPrompt(attendanceEmployee);
  };

  const updateTodayBreak = (field: "break_start_time" | "break_end_time") => {
    if (!todayAttendance) return;
    saveStore({
      ...store,
      attendance_logs: store.attendance_logs.map((log) => log.id === todayAttendance.id ? { ...log, [field]: currentTime(), updated_at: now() } : log),
    });
  };

  const submitExtraWork = (none = false) => {
    if (none || !showExtraPrompt) {
      setShowExtraPrompt(null);
      return;
    }
    const records: ExtraWorkRecord[] = [];
    if (extraChoice === "overtime" || extraChoice === "both") {
      records.push({
        id: uid("extra_work"),
        employee_id: showExtraPrompt.employee_id,
        employee_name: showExtraPrompt.name,
        date: today(),
        type: "overtime",
        hours: cleanNumber(extraDraft.overtime_hours),
        quantity: 0,
        amount: cleanNumber(extraDraft.overtime_amount),
        notes: extraDraft.overtime_notes,
        status: "pending",
        source: "staff_after_clock_out",
        approved_by: "",
        approved_at: "",
        created_at: now(),
        updated_at: now(),
      });
    }
    if (extraChoice === "extra_chore" || extraChoice === "both") {
      records.push({
        id: uid("extra_work"),
        employee_id: showExtraPrompt.employee_id,
        employee_name: showExtraPrompt.name,
        date: today(),
        type: "extra_chore",
        hours: 0,
        quantity: cleanNumber(extraDraft.chore_quantity),
        amount: cleanNumber(extraDraft.chore_amount),
        notes: [extraDraft.chore_name, extraDraft.chore_notes].filter(Boolean).join(" - "),
        status: "pending",
        source: "staff_after_clock_out",
        approved_by: "",
        approved_at: "",
        created_at: now(),
        updated_at: now(),
      });
    }
    if (!records.length) return;
    saveStore({ ...store, extra_work_records: [...records, ...store.extra_work_records] });
    setShowExtraPrompt(null);
    setExtraChoice("none");
    setExtraDraft({ overtime_hours: 0, overtime_amount: 0, overtime_notes: "", chore_name: "", chore_quantity: 0, chore_amount: 0, chore_notes: "" });
    setAttendanceMessage("Pengajuan lembur / extra chore berhasil dikirim dan menunggu approval admin.");
  };

  const setExtraStatus = (record: ExtraWorkRecord, status: ApprovalStatus) => {
    saveStore({
      ...store,
      extra_work_records: store.extra_work_records.map((item) =>
        item.id === record.id ? { ...item, status, approved_by: status === "approved" ? "Admin" : "", approved_at: status === "approved" ? now() : "", updated_at: now() } : item,
      ),
    });
  };

  const createKasbon = () => {
    const employee = store.employees.find((item) => item.id === kasbonDraft.employeeInternalId);
    if (!employee || !kasbonDraft.amount) return alert("Pilih karyawan dan isi nominal kasbon.");
    const kasbon: CashAdvance = {
      id: uid("kasbon"),
      employee_id: employee.employee_id,
      employee_name: employee.name,
      date: today(),
      amount: cleanNumber(kasbonDraft.amount),
      description: kasbonDraft.description,
      status: "active",
      remaining_balance: cleanNumber(kasbonDraft.amount),
      notes: kasbonDraft.notes,
      created_at: now(),
      updated_at: now(),
    };
    saveStore({ ...store, employee_cash_advances: [kasbon, ...store.employee_cash_advances] });
    setKasbonDraft({ employeeInternalId: store.employees[0]?.id || "", amount: 0, description: "", notes: "" });
  };

  const applyAmountToComponent = (name: string, amount: number, type: ComponentType) => {
    const ensured = ensureComponent(store, name, type);
    saveStore(ensured.store);
    setComponentAmounts((current) => ({ ...current, [ensured.component.id]: amount }));
  };

  const pullAttendance = () => {
    const alfa = monthlyAttendance.filter((log) => log.status === "alfa").length;
    const suggested = alfa * 50000;
    if (confirm(`Tarik data absensi? Alfa: ${alfa}. Nominal potongan dapat diedit setelah ditarik.`)) {
      applyAmountToComponent("Absensi", suggested, "deduction");
    }
  };

  const pullOvertime = () => {
    const amount = approvedOvertime.reduce((sum, record) => sum + record.amount, 0);
    applyAmountToComponent("Lembur", amount, "earning");
  };

  const pullExtraChore = () => {
    const amount = approvedExtraChore.reduce((sum, record) => sum + record.amount, 0);
    applyAmountToComponent("Extra Chore", amount, "earning");
  };

  const applyKasbonDeduction = () => {
    const balance = activeKasbon.reduce((sum, item) => sum + item.remaining_balance, 0);
    if (!balance) return alert("Tidak ada kasbon aktif.");
    setDeductKasbon(true);
    setKasbonDeductionAmount((current) => current || balance);
    applyAmountToComponent("Kasbon", kasbonDeductionAmount || balance, "deduction");
  };

  const selectedEmployee = store.employees.find((employee) => employee.id === selectedEmployeeId) || store.employees[0];
  const formComponents = store.payroll_components
    .filter((component) => component.active && component.show_in_form && !component.archived)
    .sort((a, b) => a.sort_order - b.sort_order);

  const generatedComponents = useMemo(() => {
    return formComponents.map((component) => ({
      id: `draft_${component.id}`,
      payroll_row_id: "",
      component_name: component.name,
      component_type: component.type,
      amount:
        componentAmounts[component.id] ??
        (component.name === "Gaji Pokok" && selectedEmployee ? selectedEmployee.default_salary : component.default_amount),
      show_in_pdf: component.show_in_pdf,
      hide_if_zero: component.hide_if_zero,
      sort_order: component.sort_order,
      source_component_id: component.id,
    }));
  }, [componentAmounts, formComponents, selectedEmployee]);

  const allDraftComponents = [...generatedComponents, ...customComponents];
  const totals = calculateTotals(allDraftComponents);
  const selectedSavedSlip = store.saved_payslips.find((slip) => slip.slip_id === selectedSlipId) || store.saved_payslips[0];
  const statusOptions = uniqueOptions(defaultStatusOptions, store.employees.map((employee) => employee.status));
  const positionOptions = uniqueOptions(defaultPositionOptions, store.employees.map((employee) => employee.position));
  const attendanceEmployee = store.employees.find((employee) => employee.employee_id === attendanceEmployeeId || employee.attendance_token === attendanceEmployeeId);
  const todayAttendance = attendanceEmployee
    ? store.attendance_logs.find((log) => log.employee_id === attendanceEmployee.employee_id && log.date === today())
    : undefined;
  const staffPinValid = Boolean(attendanceEmployee && staffPinInput && attendanceEmployee.staff_pin === staffPinInput);
  const attendanceCanContinue = attendanceQrValid || adminCorrectionOpen;
  const attendanceReady = Boolean(attendanceCanContinue && attendanceEmployee?.active && staffPinValid);
  const activeKasbon = selectedEmployee
    ? store.employee_cash_advances.filter((kasbon) => kasbon.employee_id === selectedEmployee.employee_id && ["active", "partially_paid"].includes(kasbon.status) && kasbon.remaining_balance > 0)
    : [];
  const monthlyAttendance = selectedEmployee
    ? store.attendance_logs.filter((log) => log.employee_id === selectedEmployee.employee_id && log.date >= monthStart(runMonth, runYear) && log.date <= monthEnd(runMonth, runYear))
    : [];
  const approvedOvertime = selectedEmployee
    ? store.extra_work_records.filter((record) => record.employee_id === selectedEmployee.employee_id && record.status === "approved" && record.type === "overtime" && record.date >= monthStart(runMonth, runYear) && record.date <= monthEnd(runMonth, runYear))
    : [];
  const approvedExtraChore = selectedEmployee
    ? store.extra_work_records.filter((record) => record.employee_id === selectedEmployee.employee_id && record.status === "approved" && record.type === "extra_chore" && record.date >= monthStart(runMonth, runYear) && record.date <= monthEnd(runMonth, runYear))
    : [];

  const updateBusiness = (patch: Partial<BusinessSettings>) => {
    saveStore({ ...store, business_settings: { ...store.business_settings, ...patch, updated_at: now() } });
  };

  const saveEmployee = () => {
    if (!draftEmployee.name.trim()) return alert("Nama karyawan wajib diisi.");
    const exists = store.employees.some((employee) => employee.id === draftEmployee.id);
    const employeeId = exists ? draftEmployee.employee_id : nextEmployeeId(store.employees);
    const tokenExists = (token: string) => store.employees.some((employee) => employee.id !== draftEmployee.id && employee.attendance_token === token);
    let token = draftEmployee.attendance_token || makeAttendanceToken(employeeId);
    while (tokenExists(token)) token = makeAttendanceToken(employeeId);
    const nextEmployee = {
      ...draftEmployee,
      employee_id: employeeId,
      default_salary: draftEmployee.base_salary_monthly,
      staff_pin: draftEmployee.staff_pin || randomPin(),
      attendance_token: token,
      updated_at: now(),
    };
    saveStore({
      ...store,
      employees: exists
        ? store.employees.map((employee) => (employee.id === nextEmployee.id ? nextEmployee : employee))
        : [...store.employees, { ...nextEmployee, created_at: now() }],
    });
    setDraftEmployee(emptyEmployee(nextEmployeeId(exists ? store.employees : [...store.employees, nextEmployee])));
    if (!selectedEmployeeId) setSelectedEmployeeId(nextEmployee.id);
  };

  const saveComponent = (component: PayrollComponent) => {
    if (!component.name.trim()) return alert("Nama komponen wajib diisi.");
    saveStore({
      ...store,
      payroll_components: store.payroll_components.map((item) =>
        item.id === component.id ? { ...component, updated_at: now() } : item,
      ),
    });
  };

  const addComponent = () => {
    saveStore({ ...store, payroll_components: [...store.payroll_components, makeComponent("Komponen Baru", "earning", store.payroll_components.length + 1)] });
  };

  const deleteComponent = (component: PayrollComponent) => {
    if (!confirm("Hapus komponen payroll ini? Jika sudah dipakai pada slip final, komponen akan diarsipkan.")) return;
    const used = store.saved_payslips.some((slip) =>
      (JSON.parse(slip.component_snapshot_json) as PayrollRowComponent[]).some((item) => item.source_component_id === component.id),
    );
    saveStore({
      ...store,
      payroll_components: used
        ? store.payroll_components.map((item) => (item.id === component.id ? { ...item, active: false, archived: true } : item))
        : store.payroll_components.filter((item) => item.id !== component.id),
    });
  };

  const addCustomComponent = () => {
    setCustomComponents([
      ...customComponents,
      {
        id: uid("custom_component"),
        payroll_row_id: "",
        component_name: "Komponen Custom",
        component_type: "earning",
        amount: 0,
        show_in_pdf: true,
        hide_if_zero: true,
        sort_order: 999 + customComponents.length,
      },
    ]);
  };

  const finalizeSlip = () => {
    if (!selectedEmployee) return alert("Pilih karyawan terlebih dahulu.");
    if (!confirm("Setelah slip disimpan final, isi slip akan dikunci sebagai arsip.")) return;
    const run = store.payroll_runs.find((item) => item.month === runMonth && item.year === runYear) || {
      id: uid("run"),
      month: runMonth,
      year: runYear,
      status: "Draft" as RowStatus,
      created_at: now(),
      updated_at: now(),
    };
    const rowId = uid("row");
    const slipId = generateSlipId(store, selectedEmployee.employee_id, runMonth, runYear);
    const rowComponents = allDraftComponents.map((component) => ({ ...component, id: uid("row_component"), payroll_row_id: rowId }));
    const row: PayrollRow = {
      id: rowId,
      payroll_run_id: run.id,
      employee_id: selectedEmployee.employee_id,
      employee_name: selectedEmployee.name,
      employee_status: selectedEmployee.status,
      slip_id: slipId,
      payment_date: paymentDate,
      total_earning: totals.total_earning,
      total_deduction: totals.total_deduction,
      take_home_pay: totals.take_home_pay,
      status: "Finalized",
      created_at: now(),
      updated_at: now(),
    };
    const saved: SavedPayslip = {
      id: uid("saved_slip"),
      slip_id: slipId,
      payroll_row_id: rowId,
      month: runMonth,
      year: runYear,
      employee_id: selectedEmployee.employee_id,
      employee_name: selectedEmployee.name,
      status: "Finalized",
      business_snapshot_json: JSON.stringify(store.business_settings),
      employee_snapshot_json: JSON.stringify(selectedEmployee),
      component_snapshot_json: JSON.stringify(rowComponents),
      totals_snapshot_json: JSON.stringify(totals),
      payment_snapshot_json: JSON.stringify({
        slip_id: slipId,
        month: runMonth,
        year: runYear,
        payment_date: paymentDate,
        attendance_summary: {
          hadir: monthlyAttendance.filter((log) => log.status === "hadir").length,
          telat: monthlyAttendance.filter((log) => log.status === "telat").length,
          izin: monthlyAttendance.filter((log) => log.status === "izin").length,
          sakit: monthlyAttendance.filter((log) => log.status === "sakit").length,
          alfa: monthlyAttendance.filter((log) => log.status === "alfa").length,
          libur: monthlyAttendance.filter((log) => log.status === "libur").length,
        },
        approved_overtime: approvedOvertime,
        approved_extra_chore: approvedExtraChore,
        kasbon_deducted: deductKasbon ? cleanNumber(kasbonDeductionAmount) : 0,
      }),
      finalized_at: now(),
      paid_at: "",
      created_at: now(),
    };
    let remainingDeduction = deductKasbon ? cleanNumber(kasbonDeductionAmount) : 0;
    const kasbonDeductions: KasbonDeduction[] = [];
    const updatedKasbon = store.employee_cash_advances.map((kasbon) => {
      if (!remainingDeduction || kasbon.employee_id !== selectedEmployee.employee_id || !["active", "partially_paid"].includes(kasbon.status)) return kasbon;
      const paid = Math.min(kasbon.remaining_balance, remainingDeduction);
      remainingDeduction -= paid;
      kasbonDeductions.push({
        id: uid("kasbon_deduction"),
        kasbon_id: kasbon.id,
        payroll_row_id: rowId,
        employee_id: kasbon.employee_id,
        deduction_date: paymentDate,
        amount: paid,
        notes: `Potongan payroll ${slipId}`,
        created_at: now(),
      });
      const balance = kasbon.remaining_balance - paid;
      return { ...kasbon, remaining_balance: balance, status: balance <= 0 ? "paid" as KasbonStatus : "partially_paid" as KasbonStatus, updated_at: now() };
    });
    saveStore({
      ...store,
      payroll_runs: store.payroll_runs.some((item) => item.id === run.id) ? store.payroll_runs : [...store.payroll_runs, run],
      payroll_rows: [...store.payroll_rows, row],
      payroll_row_components: [...store.payroll_row_components, ...rowComponents],
      saved_payslips: [saved, ...store.saved_payslips],
      employee_cash_advances: updatedKasbon,
      kasbon_deductions: [...kasbonDeductions, ...store.kasbon_deductions],
    });
    setSelectedSlipId(slipId);
    setPage("Payslip History");
  };

  const finalizeMonthlyRow = (draft: PayrollDraftRow) => {
    const employee = store.employees.find((item) => item.id === draft.employee_internal_id);
    if (!employee) return;
    if (!confirm("Setelah slip disimpan final, isi slip akan dikunci sebagai arsip.")) return;
    const run = store.payroll_runs.find((item) => item.month === runMonth && item.year === runYear) || {
      id: uid("run"),
      month: runMonth,
      year: runYear,
      status: "Draft" as RowStatus,
      created_at: now(),
      updated_at: now(),
    };
    const rowId = uid("row");
    const slipId = generateSlipId(store, employee.employee_id, runMonth, runYear);
    const calc = calculatePayrollRow(employee, draft);
    const rowComponents = payrollComponentsFromDraft(employee, draft).map((component) => ({ ...component, payroll_row_id: rowId }));
    const row: PayrollRow = {
      id: rowId,
      payroll_run_id: run.id,
      employee_id: employee.employee_id,
      employee_name: employee.name,
      employee_status: employee.status,
      slip_id: slipId,
      payment_date: paymentDate,
      total_earning: calc.totalEarning,
      total_deduction: calc.totalDeduction,
      take_home_pay: calc.takeHome,
      status: "Finalized",
      created_at: now(),
      updated_at: now(),
    };
    const saved: SavedPayslip = {
      id: uid("saved_slip"),
      slip_id: slipId,
      payroll_row_id: rowId,
      month: runMonth,
      year: runYear,
      employee_id: employee.employee_id,
      employee_name: employee.name,
      status: "Finalized",
      business_snapshot_json: JSON.stringify(store.business_settings),
      employee_snapshot_json: JSON.stringify(employee),
      component_snapshot_json: JSON.stringify(rowComponents),
      totals_snapshot_json: JSON.stringify({ total_earning: calc.totalEarning, total_deduction: calc.totalDeduction, take_home_pay: calc.takeHome }),
      payment_snapshot_json: JSON.stringify({ slip_id: slipId, month: runMonth, year: runYear, payment_date: paymentDate, payroll_detail: draft, calculation: calc }),
      finalized_at: now(),
      paid_at: "",
      created_at: now(),
    };
    saveStore({
      ...store,
      payroll_runs: store.payroll_runs.some((item) => item.id === run.id) ? store.payroll_runs : [...store.payroll_runs, run],
      payroll_rows: [...store.payroll_rows, row],
      payroll_row_components: [...store.payroll_row_components, ...rowComponents],
      saved_payslips: [saved, ...store.saved_payslips],
    });
    setSelectedSlipId(slipId);
  };

  const previewDraft = (save = false, print = false) => {
    if (!selectedEmployee) return;
    createPayslipPdf({
      business: store.business_settings,
      employee: selectedEmployee,
      components: allDraftComponents,
      totals,
      payment: { slip_id: "Draft", month: runMonth, year: runYear, payment_date: paymentDate },
      save,
      print,
    });
  };

  const openSavedPdf = (slip: SavedPayslip, save = false, print = false) => {
    createPayslipPdf({
      business: JSON.parse(slip.business_snapshot_json),
      employee: JSON.parse(slip.employee_snapshot_json),
      components: JSON.parse(slip.component_snapshot_json),
      totals: JSON.parse(slip.totals_snapshot_json),
      payment: { ...JSON.parse(slip.payment_snapshot_json), finalized_at: slip.finalized_at },
      save,
      print,
    });
  };

  const markPaid = (slip: SavedPayslip, paid: boolean) => {
    saveStore({
      ...store,
      saved_payslips: store.saved_payslips.map((item) =>
        item.id === slip.id ? { ...item, status: paid ? "Paid" : "Finalized", paid_at: paid ? now() : "" } : item,
      ),
      payroll_rows: store.payroll_rows.map((row) =>
        row.slip_id === slip.slip_id ? { ...row, status: paid ? "Paid" : "Finalized" } : row,
      ),
    });
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `backup-payroll-${today()}.json`;
    link.click();
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    if (!confirm("Import backup akan mengganti data lokal saat ini. Lanjutkan?")) return;
    saveStore(JSON.parse(await file.text()));
  };

  const filteredSlips = store.saved_payslips.filter((slip) => {
    const matchSearch = slip.employee_name.toLowerCase().includes(historySearch.toLowerCase());
    const matchMonth = !historyMonth || slip.month === Number(historyMonth);
    const matchYear = !historyYear || slip.year === Number(historyYear);
    const matchEmployee = !historyEmployee || slip.employee_id === historyEmployee;
    return matchSearch && matchMonth && matchYear && matchEmployee;
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          {store.business_settings.logo_data_url ? <img src={store.business_settings.logo_data_url} alt="" /> : <Building2 size={28} />}
          <div>
            <strong>{store.business_settings.business_name || "Payroll"}</strong>
          <span>Aplikasi Penggajian</span>
          </div>
        </div>
        {[
          ["Absensi Staff", Clock],
          ["Dashboard", LayoutDashboard],
          ["Staff / Employee Settings", Users],
          ["Rekap Absensi", CalendarDays],
          ["Generate Payroll", Banknote],
          ["Review Payslips", FileText],
          ["Payslip History", History],
          ["Kasbon", Banknote],
          ["Lembur & Extra Chore", SlidersHorizontal],
          ["Settings", Settings],
        ].map(([label, Icon]) => (
          <button key={label as string} className={page === label ? "nav active" : "nav"} onClick={() => requestPage(label as string)}>
            <Icon size={18} /> <span>{label as string}</span>
          </button>
        ))}
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p>Manajemen Penggajian</p>
            <h1>{page}</h1>
          </div>
          <div className="top-actions">
            {adminUnlocked && <button className="ghost" onClick={lockAdmin}><Lock size={16} /> Lock Admin</button>}
            <button className="ghost" onClick={exportBackup}><Download size={16} /> Backup</button>
            <label className="ghost file-button"><Upload size={16} /> Impor <input type="file" accept="application/json" onChange={(e) => importBackup(e.target.files?.[0])} /></label>
          </div>
        </header>

        {pinModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <h2>Masuk Admin</h2>
              <p className="muted">Menu ini hanya untuk admin. Masukkan PIN admin untuk melanjutkan.</p>
              <input autoFocus type="password" inputMode="numeric" placeholder="Masukkan PIN Admin" value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlockAdmin()} />
              {pinError && <p className="error-text">{pinError}</p>}
              <div className="actions">
                <button className="primary" onClick={unlockAdmin}><Check size={16} /> Buka Admin</button>
                <button className="ghost" onClick={() => setPinModalOpen(false)}>Batal</button>
              </div>
            </div>
          </div>
        )}

        {showExtraPrompt && (
          <div className="modal-backdrop">
            <div className="modal-card wide-modal">
              <h2>Ada lembur / extra chore hari ini?</h2>
              <p className="muted">{showExtraPrompt.name} baru saja Clock Out. Pengajuan akan masuk status pending sampai admin approve.</p>
              <div className="actions">
                <button className="ghost" onClick={() => submitExtraWork(true)}>Tidak ada</button>
                <button className={extraChoice === "overtime" ? "primary" : "ghost"} onClick={() => setExtraChoice("overtime")}>Ada Lembur</button>
                <button className={extraChoice === "extra_chore" ? "primary" : "ghost"} onClick={() => setExtraChoice("extra_chore")}>Ada Extra Chore</button>
                <button className={extraChoice === "both" ? "primary" : "ghost"} onClick={() => setExtraChoice("both")}>Ada Lembur + Extra Chore</button>
              </div>
              {(extraChoice === "overtime" || extraChoice === "both") && <div className="form-grid">
                <Input label="Jam Lembur" type="number" value={extraDraft.overtime_hours} onChange={(v) => setExtraDraft({ ...extraDraft, overtime_hours: cleanNumber(v) })} />
                <Input label="Nominal Lembur" type="number" value={extraDraft.overtime_amount} onChange={(v) => setExtraDraft({ ...extraDraft, overtime_amount: cleanNumber(v) })} />
                <Input label="Catatan Lembur" value={extraDraft.overtime_notes} onChange={(v) => setExtraDraft({ ...extraDraft, overtime_notes: v })} />
              </div>}
              {(extraChoice === "extra_chore" || extraChoice === "both") && <div className="form-grid">
                <Input label="Nama Chore / Tugas Tambahan" value={extraDraft.chore_name} onChange={(v) => setExtraDraft({ ...extraDraft, chore_name: v })} />
                <Input label="Qty" type="number" value={extraDraft.chore_quantity} onChange={(v) => setExtraDraft({ ...extraDraft, chore_quantity: cleanNumber(v) })} />
                <Input label="Nominal" type="number" value={extraDraft.chore_amount} onChange={(v) => setExtraDraft({ ...extraDraft, chore_amount: cleanNumber(v) })} />
                <Input label="Catatan" value={extraDraft.chore_notes} onChange={(v) => setExtraDraft({ ...extraDraft, chore_notes: v })} />
              </div>}
              <div className="actions">
                <button className="primary" disabled={extraChoice === "none"} onClick={() => submitExtraWork(false)}><Save size={16} /> Kirim untuk Approval Admin</button>
                <button className="ghost" onClick={() => setShowExtraPrompt(null)}>Tutup</button>
              </div>
            </div>
          </div>
        )}

        {advancedQrEmployee && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <h2>Advanced QR</h2>
              <p className="muted">Fitur ini hanya cadangan admin. Rekomendasi utama tetap QR Harian Kantor + PIN Staff untuk mengurangi risiko titip absen.</p>
              <div className="actions">
                <button className="ghost" onClick={() => generateQr(advancedQrEmployee, Boolean(advancedQrEmployee.attendance_token))}><QrCode size={16} /> Generate / Regenerate QR</button>
                <button className="ghost" onClick={() => downloadQr(advancedQrEmployee)}><Download size={16} /> Download QR</button>
                <button className="ghost" onClick={() => downloadQr(advancedQrEmployee, true)}><Printer size={16} /> Print QR</button>
              </div>
              {qrMap[advancedQrEmployee.id] && <img className="qr-preview large" src={qrMap[advancedQrEmployee.id]} alt="" />}
              <button className="primary" onClick={() => setAdvancedQrEmployee(null)}>Tutup</button>
            </div>
          </div>
        )}

        {detailRowId && (() => {
          const row = payrollRowsDraft.find((item) => item.employee_internal_id === detailRowId);
          const employee = store.employees.find((item) => item.id === detailRowId);
          if (!row || !employee) return null;
          const calc = calculatePayrollRow(employee, row);
          return (
            <div className="modal-backdrop">
              <div className="modal-card wide-modal">
                <h2>Detail Payroll - {employee.name}</h2>
                <div className="detail-grid">
                  <Breakdown title="Default Staff" rows={[
                    ["Gaji Pokok Bulanan", formatIDR(employee.base_salary_monthly || employee.default_salary, store.business_settings.currency)],
                    ["Uang Makan per Hari", formatIDR(employee.meal_allowance_per_day, store.business_settings.currency)],
                    ["Transport per Hari", formatIDR(employee.transport_allowance_per_day, store.business_settings.currency)],
                    ["Hari Kerja per Bulan", String(employee.work_days_per_month)],
                    ["BPJS", `${formatIDR(employee.bpjs_kesehatan_default, store.business_settings.currency)} / ${formatIDR(employee.bpjs_ketenagakerjaan_default, store.business_settings.currency)}`],
                    ["Tunjangan Tetap", formatIDR(employee.fixed_allowance, store.business_settings.currency)],
                  ]} />
                  <Breakdown title="Kehadiran Bulan Ini" rows={[
                    ["Hari Masuk", `${row.hari_masuk} hari`],
                    ["Cuti Berbayar", `${row.cuti_berbayar} hari`],
                    ["Cuti Tidak Berbayar", `${row.cuti_tidak_berbayar} hari`],
                    ["Izin", `${row.izin} hari`],
                    ["Sakit", `${row.sakit} hari`],
                    ["Alfa", `${row.alfa} hari`],
                    ["Sisa Cuti", `${row.sisa_cuti} hari`],
                  ]} />
                  <Breakdown title="Pendapatan" rows={[
                    ["Gaji Pokok Final", `${formatIDR(employee.base_salary_monthly || employee.default_salary, store.business_settings.currency)} - (${calc.unpaidDays} hari tidak dibayar x ${formatIDR(calc.dailySalary, store.business_settings.currency)}) = ${formatIDR(calc.finalBase, store.business_settings.currency)}`],
                    ["Uang Makan", `${row.hari_masuk} hari x ${formatIDR(employee.meal_allowance_per_day, store.business_settings.currency)} = ${formatIDR(calc.meal, store.business_settings.currency)}`],
                    ["Transport", `${row.hari_masuk} hari x ${formatIDR(employee.transport_allowance_per_day, store.business_settings.currency)} = ${formatIDR(calc.transport, store.business_settings.currency)}`],
                    ["Komisi", formatIDR(row.komisi, store.business_settings.currency)],
                    ["Bonus", formatIDR(row.bonus, store.business_settings.currency)],
                    ["Lembur", formatIDR(row.lembur, store.business_settings.currency)],
                    ["Extra Chore", formatIDR(row.extra_chore, store.business_settings.currency)],
                  ]} />
                  <Breakdown title="Potongan & Summary" rows={[
                    ["BPJS Kesehatan", formatIDR(employee.bpjs_kesehatan_default, store.business_settings.currency)],
                    ["BPJS Ketenagakerjaan", formatIDR(employee.bpjs_ketenagakerjaan_default, store.business_settings.currency)],
                    ["Kasbon", formatIDR(row.potong_kasbon ? row.kasbon_deduction : 0, store.business_settings.currency)],
                    ["Potongan Manual", formatIDR(row.potongan_manual, store.business_settings.currency)],
                    ["Total Pendapatan", formatIDR(calc.totalEarning, store.business_settings.currency)],
                    ["Total Potongan", formatIDR(calc.totalDeduction, store.business_settings.currency)],
                    ["Take Home Pay", formatIDR(calc.takeHome, store.business_settings.currency)],
                  ]} />
                </div>
                <div className="actions"><span className="badge draft">Draft</span>{row.manual_override && <span className="badge pending">Manual Override</span>}{row.potong_kasbon && <span className="badge approved">Kasbon Deducted</span>}<span className="badge active">Ready to Finalize</span></div>
                <button className="primary" onClick={() => setDetailRowId("")}>Tutup</button>
              </div>
            </div>
          );
        })()}

        {page !== "Absensi Staff" && !adminUnlocked && <AdminLocked onOpen={() => requestPage(page)} />}

        {page === "Absensi Staff" && (
          <section className="attendance-public">
            <div className="panel attendance-hero">
              <h2>Absensi Staff</h2>
              <strong>{new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}</strong>
              <div className="attendance-step">
                <div className="step-title"><span>1</span><h3>Scan QR Absensi Kantor</h3></div>
                <div className="attendance-methods">
                  <button className="primary" onClick={startScanner}><QrCode size={18} /> Scan QR Absensi Kantor</button>
                  <button className="ghost" onClick={() => setShowManualQr(!showManualQr)}>Input Manual QR</button>
                  <button className="ghost" onClick={() => setAdminCorrectionOpen(!adminCorrectionOpen)}>Manual Admin Correction</button>
                  <span className={`badge ${attendanceQrValid ? "active" : "inactive"}`}>{attendanceQrValid ? "QR valid" : "QR belum valid"}</span>
                </div>
                {scannerError && <p className="error-text">{scannerError}</p>}
                {scannerActive && <div id="qr-reader" className="scanner-box" />}
                {showManualQr && <div className="manual-qr-box">
                  <label className="full">Input Manual QR<textarea placeholder="Gunakan ini hanya jika kamera tidak bisa digunakan." value={attendanceQrInput} onChange={(e) => setAttendanceQrInput(e.target.value)} /></label>
                  <button className="primary" onClick={() => validateOfficeQr()}><QrCode size={16} /> Validasi QR</button>
                </div>}
                {adminCorrectionOpen && <div className="warning-card">
                  <strong>Manual Admin Correction</strong>
                  <p className="muted">Khusus admin untuk koreksi darurat. Staff normal tidak perlu PIN admin.</p>
                  <input type="password" inputMode="numeric" placeholder="PIN Admin" value={manualAdminPin} onChange={(e) => setManualAdminPin(e.target.value)} />
                </div>}
              </div>
              {attendanceCanContinue && <div className="attendance-step">
                <div className="step-title"><span>2</span><h3>Pilih Staff</h3></div>
                <div className="form-grid">
                  <label>Pilih Nama Staff<select value={attendanceEmployee?.id || ""} onChange={(e) => {
                    const employee = store.employees.find((item) => item.id === e.target.value);
                    setAttendanceEmployeeId(employee?.employee_id || "");
                  }}><option value="">Pilih staff terlebih dahulu</option>{store.employees.filter((e) => e.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_id} - {employee.name}</option>)}</select></label>
                  <Input label="Atau masukkan Employee ID" value={attendanceEmployeeId} onChange={setAttendanceEmployeeId} />
                </div>
                {attendanceEmployee && <div className="confirm-card"><strong>{attendanceEmployee.name}</strong><span>{attendanceEmployee.employee_id} | {attendanceEmployee.status} | {attendanceEmployee.position}</span></div>}
              </div>}
              {attendanceCanContinue && attendanceEmployee && <div className="attendance-step">
                <div className="step-title"><span>3</span><h3>Masukkan PIN Staff</h3></div>
                <div className="form-grid">
                  <label>PIN Staff<input type="password" inputMode="numeric" placeholder="Masukkan PIN Staff" value={staffPinInput} onChange={(e) => setStaffPinInput(e.target.value)} /></label>
                  <span className={`badge ${staffPinValid ? "active" : "inactive"}`}>{staffPinValid ? "PIN Staff valid" : "PIN Staff belum valid"}</span>
                </div>
              </div>}
              {attendanceCanContinue && attendanceEmployee && <div className="attendance-step">
                <div className="step-title"><span>4</span><h3>Absen</h3></div>
                <div className="status-row">
                  {todayAttendance?.clock_in_time && <span className="badge pending">Sudah Clock In</span>}
                  {todayAttendance?.clock_out_time && <span className="badge approved">Sudah Clock Out</span>}
                </div>
                <div className="big-actions">
                  <button className="primary" disabled={!attendanceReady || Boolean(todayAttendance?.clock_in_time)} onClick={clockIn}><Clock size={22} /> Clock In</button>
                  <button className="primary dark" disabled={!attendanceReady || !todayAttendance?.clock_in_time || Boolean(todayAttendance?.clock_out_time)} onClick={clockOut}><Check size={22} /> Clock Out</button>
                </div>
              </div>}
              {attendanceMessage && <p className="success-text">{attendanceMessage}</p>}
              {todayAttendance && <div className="today-status">
                <span>Clock in <strong>{todayAttendance.clock_in_time || "-"}</strong></span>
                <span>Clock out <strong>{todayAttendance.clock_out_time || "-"}</strong></span>
                <span>Total kerja <strong>{Math.round(todayAttendance.total_work_minutes / 60 * 10) / 10} jam</strong></span>
                <span>Status <strong>{statusLabel(todayAttendance.status)}</strong></span>
              </div>}
            </div>
            <div className="panel">
              <h2>Ringkasan Absensi Hari Ini</h2>
              <AttendanceTable logs={store.attendance_logs.filter((log) => log.date === today())} editable={false} onUpdate={() => undefined} extraWork={store.extra_work_records} />
            </div>
          </section>
        )}

        {adminUnlocked && page === "Dashboard" && (
          <section className="grid dashboard-grid">
            <Metric title="Karyawan Aktif" value={store.employees.filter((e) => e.active).length} icon={<Users />} />
            <Metric title="Slip Final" value={store.saved_payslips.length} icon={<Archive />} />
            <Metric title="Sudah Dibayar" value={store.saved_payslips.filter((s) => s.status === "Paid").length} icon={<BadgeCheck />} />
            <Metric title="Komponen Aktif" value={store.payroll_components.filter((c) => c.active).length} icon={<SlidersHorizontal />} />
            <div className="panel wide">
              <h2>Slip Terbaru</h2>
              <SlipTable slips={store.saved_payslips.slice(0, 5)} currency={store.business_settings.currency} onPreview={openSavedPdf} onPaid={markPaid} />
            </div>
          </section>
        )}

        {adminUnlocked && page === "Staff / Employee Settings" && (
          <section className="grid two">
            <div className="panel">
              <h2>Data Karyawan</h2>
              <div className="form-grid">
                <label>ID Karyawan<input readOnly value={draftEmployee.employee_id} /><span className="helper-text">ID otomatis, tidak perlu diisi manual.</span><span className="helper-text">Employee ID dibuat otomatis oleh sistem.</span></label>
                <Input label="Nama" value={draftEmployee.name} onChange={(v) => setDraftEmployee({ ...draftEmployee, name: v })} />
                <label>Status Karyawan<select value={statusOptions.includes(draftEmployee.status) ? draftEmployee.status : "Custom"} onChange={(e) => setDraftEmployee({ ...draftEmployee, status: e.target.value === "Custom" ? "" : e.target.value })}>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                {!statusOptions.includes(draftEmployee.status) && <Input label="Status custom" value={draftEmployee.status} onChange={(v) => setDraftEmployee({ ...draftEmployee, status: v })} />}
                <label>Posisi<select value={positionOptions.includes(draftEmployee.position) ? draftEmployee.position : "Custom"} onChange={(e) => setDraftEmployee({ ...draftEmployee, position: e.target.value === "Custom" ? "" : e.target.value })}>{positionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                {!positionOptions.includes(draftEmployee.position) && <Input label="Posisi custom" value={draftEmployee.position} onChange={(v) => setDraftEmployee({ ...draftEmployee, position: v })} />}
                <Input label="Gaji Pokok Bulanan" type="number" value={draftEmployee.base_salary_monthly} onChange={(v) => setDraftEmployee({ ...draftEmployee, base_salary_monthly: cleanNumber(v), default_salary: cleanNumber(v) })} />
                <Input label="Hari Kerja per Bulan" type="number" value={draftEmployee.work_days_per_month} onChange={(v) => setDraftEmployee({ ...draftEmployee, work_days_per_month: cleanNumber(v) })} />
                <Input label="Uang Makan per Hari" type="number" value={draftEmployee.meal_allowance_per_day} onChange={(v) => setDraftEmployee({ ...draftEmployee, meal_allowance_per_day: cleanNumber(v) })} />
                <Input label="Transport per Hari" type="number" value={draftEmployee.transport_allowance_per_day} onChange={(v) => setDraftEmployee({ ...draftEmployee, transport_allowance_per_day: cleanNumber(v) })} />
                <Input label="Jatah Cuti per Bulan" type="number" value={draftEmployee.leave_quota_monthly} onChange={(v) => setDraftEmployee({ ...draftEmployee, leave_quota_monthly: cleanNumber(v) })} />
                <Input label="Jatah Cuti per Tahun" type="number" value={draftEmployee.leave_quota_yearly} onChange={(v) => setDraftEmployee({ ...draftEmployee, leave_quota_yearly: cleanNumber(v) })} />
                <Input label="BPJS Kesehatan" type="number" value={draftEmployee.bpjs_kesehatan_default} onChange={(v) => setDraftEmployee({ ...draftEmployee, bpjs_kesehatan_default: cleanNumber(v) })} />
                <Input label="BPJS Ketenagakerjaan" type="number" value={draftEmployee.bpjs_ketenagakerjaan_default} onChange={(v) => setDraftEmployee({ ...draftEmployee, bpjs_ketenagakerjaan_default: cleanNumber(v) })} />
                <Input label="Tunjangan Tetap" type="number" value={draftEmployee.fixed_allowance} onChange={(v) => setDraftEmployee({ ...draftEmployee, fixed_allowance: cleanNumber(v) })} />
                <Toggle label="Tunjangan HP/Admin" checked={draftEmployee.hp_admin_allowance_enabled} onChange={(v) => setDraftEmployee({ ...draftEmployee, hp_admin_allowance_enabled: v })} />
                {draftEmployee.hp_admin_allowance_enabled && <Input label="Nominal Tunjangan HP/Admin" type="number" value={draftEmployee.hp_admin_allowance_amount} onChange={(v) => setDraftEmployee({ ...draftEmployee, hp_admin_allowance_amount: cleanNumber(v) })} />}
                <Input label="Bank Name" value={draftEmployee.bank_name} onChange={(v) => setDraftEmployee({ ...draftEmployee, bank_name: v })} />
                <Input label="Account Number" value={draftEmployee.account_number} onChange={(v) => setDraftEmployee({ ...draftEmployee, account_number: v })} />
                <Input label="Account Holder" value={draftEmployee.account_holder} onChange={(v) => setDraftEmployee({ ...draftEmployee, account_holder: v })} />
                <label>PIN Staff<input type="password" inputMode="numeric" value={draftEmployee.staff_pin} onChange={(e) => setDraftEmployee({ ...draftEmployee, staff_pin: e.target.value })} /><span className="helper-text">Absensi utama menggunakan QR Kantor / QR Harian + PIN Staff.</span></label>
                <button className="ghost" onClick={() => setDraftEmployee({ ...draftEmployee, staff_pin: randomPin() })}>Generate PIN</button>
                <Toggle label="Aktif" checked={draftEmployee.active} onChange={(v) => setDraftEmployee({ ...draftEmployee, active: v })} />
                <label className="full">Catatan<textarea value={draftEmployee.notes} onChange={(e) => setDraftEmployee({ ...draftEmployee, notes: e.target.value })} /></label>
              </div>
              <button className="primary" onClick={saveEmployee}><Save size={16} /> Simpan Karyawan</button>
            </div>
            <div className="panel">
              <h2>Daftar Karyawan</h2>
              <div className="list">
                {store.employees.map((employee) => (
                  <div className="list-row" key={employee.id}>
                    <div className="employee-card-main">
                      <div>
                        <strong>{employee.employee_id} | {employee.name}</strong>
                        <span>{employee.status} • {employee.position || "-"}</span>
                        <span className={`badge ${employee.active ? "active" : "inactive"}`}>{employee.active ? "Aktif" : "Nonaktif"}</span>
                      </div>
                      <div className="salary-mini-grid">
                        <span>Gaji Pokok: <strong>{formatIDR(employee.base_salary_monthly || employee.default_salary, store.business_settings.currency)}</strong></span>
                        <span>Uang Makan/Hari: <strong>{formatIDR(employee.meal_allowance_per_day, store.business_settings.currency)}</strong></span>
                        <span>Transport/Hari: <strong>{formatIDR(employee.transport_allowance_per_day, store.business_settings.currency)}</strong></span>
                        <span>Hari Kerja/Bulan: <strong>{employee.work_days_per_month}</strong></span>
                        <span>Jatah Cuti: <strong>{employee.leave_quota_monthly || 0} hari/bulan • {employee.leave_quota_yearly || 0} hari/tahun</strong></span>
                        <span>BPJS: <strong>{employee.bpjs_kesehatan_default || employee.bpjs_ketenagakerjaan_default ? "Aktif" : "Tidak aktif"}</strong></span>
                      </div>
                      <div className="pin-line">
                        <span>PIN Staff: <strong>{shownPins[employee.id] ? employee.staff_pin : "****"}</strong></span>
                      </div>
                    </div>
                    <div className="row-actions">
                      <button className="ghost" title="Edit" onClick={() => setDraftEmployee(employee)}><Pencil size={16} /> Edit</button>
                      <button className="ghost" onClick={() => setShownPins({ ...shownPins, [employee.id]: !shownPins[employee.id] })}>Show PIN</button>
                      <button className="ghost" onClick={() => saveStore({ ...store, employees: store.employees.map((item) => item.id === employee.id ? { ...item, staff_pin: randomPin(), updated_at: now() } : item) })}>Reset PIN</button>
                      <button className="ghost" onClick={() => setAdvancedQrEmployee(employee)}><QrCode size={16} /> Advanced QR</button>
                      <button className={employee.active ? "danger" : "ghost"} title="Deactivate" onClick={() => saveStore({ ...store, employees: store.employees.map((item) => item.id === employee.id ? { ...item, active: !item.active, updated_at: now() } : item) })}>{employee.active ? "Nonaktifkan" : "Aktifkan"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {adminUnlocked && page === "Generate Payroll" && (
          <section className="panel">
            <div className="section-head">
              <h2>Generate Payroll</h2>
              <div className="actions">
                <button className="primary" onClick={() => setPayrollRowsDraft(createPayrollDraftRows(store, runMonth, runYear))}><Check size={16} /> Generate / Load Payroll</button>
                <button className="ghost" onClick={() => setPayrollRowsDraft(createPayrollDraftRows(store, runMonth, runYear))}>Tarik dari Absensi</button>
                <button className="ghost" onClick={() => setPayrollRowsDraft(createPayrollDraftRows(store, runMonth, runYear))}><RotateCcw size={16} /> Reset ke Default Staff</button>
              </div>
            </div>
            <div className="form-grid four">
              <label>Bulan<select value={runMonth} onChange={(e) => setRunMonth(Number(e.target.value))}>{months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
              <Input label="Tahun" type="number" value={runYear} onChange={(v) => setRunYear(cleanNumber(v))} />
              <Input label="Tanggal Pembayaran" type="date" value={paymentDate} onChange={setPaymentDate} />
            </div>
            <div className="info-strip">
              <span>Cuti berbayar tidak memotong gaji pokok.</span>
              <span>Cuti tidak berbayar dan alfa memotong gaji pokok.</span>
              <span>Uang makan dan transport dihitung berdasarkan hari masuk.</span>
            </div>
            <div className="payroll-table-wrap">
              <table className="payroll-table">
                <thead><tr><th className="sticky-col">Staff</th><th>Posisi</th><th>Gaji Pokok</th><th>Hari Masuk</th><th>Cuti Berbayar</th><th>Cuti Tidak Berbayar</th><th>Alfa</th><th>Komisi</th><th>Bonus</th><th>Lembur</th><th>Potongan</th><th>Kasbon</th><th>Take Home Pay</th><th>Detail</th></tr></thead>
                <tbody>{payrollRowsDraft.map((row) => {
                  const employee = store.employees.find((item) => item.id === row.employee_internal_id)!;
                  const calc = calculatePayrollRow(employee, row);
                  const activeBalance = store.employee_cash_advances.filter((item) => item.employee_id === row.employee_id && ["active", "partially_paid"].includes(item.status)).reduce((sum, item) => sum + item.remaining_balance, 0);
                  const updateRow = (patch: Partial<PayrollDraftRow>) => setPayrollRowsDraft(payrollRowsDraft.map((item) => item.employee_internal_id === row.employee_internal_id ? { ...item, ...patch, manual_override: true } : item));
                  return <tr key={row.employee_internal_id}>
                    <td className="sticky-col"><strong>{row.employee_id}</strong><span className="muted">{row.employee_name}</span>{activeBalance > 0 && <span className="warning-text">Karyawan ini memiliki kasbon aktif.</span>}</td>
                    <td>{row.position}</td>
                    <td className="money">{formatIDR(employee.base_salary_monthly || employee.default_salary, store.business_settings.currency)}</td>
                    <td><input type="number" value={row.hari_masuk} onChange={(e) => updateRow({ hari_masuk: cleanNumber(e.target.value) })} /></td>
                    <td><input type="number" value={row.cuti_berbayar} onChange={(e) => updateRow({ cuti_berbayar: cleanNumber(e.target.value) })} /></td>
                    <td><input type="number" value={row.cuti_tidak_berbayar} onChange={(e) => updateRow({ cuti_tidak_berbayar: cleanNumber(e.target.value) })} /></td>
                    <td><input type="number" value={row.alfa} onChange={(e) => updateRow({ alfa: cleanNumber(e.target.value) })} /></td>
                    <td><input type="number" value={row.komisi} onChange={(e) => updateRow({ komisi: cleanNumber(e.target.value) })} /></td>
                    <td><input type="number" value={row.bonus} onChange={(e) => updateRow({ bonus: cleanNumber(e.target.value) })} /></td>
                    <td><input type="number" value={row.lembur} onChange={(e) => updateRow({ lembur: cleanNumber(e.target.value) })} /></td>
                    <td><input type="number" value={row.potongan_manual} onChange={(e) => updateRow({ potongan_manual: cleanNumber(e.target.value) })} /></td>
                    <td><label className="toggle compact-toggle"><input type="checkbox" checked={row.potong_kasbon} onChange={(e) => updateRow({ potong_kasbon: e.target.checked, kasbon_deduction: e.target.checked ? Math.min(activeBalance, row.kasbon_deduction || activeBalance) : 0 })} /> Potong</label><input type="number" value={row.kasbon_deduction} onChange={(e) => updateRow({ kasbon_deduction: cleanNumber(e.target.value), potong_kasbon: cleanNumber(e.target.value) > 0 })} /></td>
                    <td className="money">{formatIDR(calc.takeHome, store.business_settings.currency)}</td>
                    <td className="row-actions"><button className="icon" onClick={() => setDetailRowId(row.employee_internal_id)}><Eye size={15} /></button><button className="icon" onClick={() => finalizeMonthlyRow(row)}><Save size={15} /></button></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            {!payrollRowsDraft.length && <Empty title="Klik Generate / Load Payroll untuk membuat payroll bulanan dari default staff." />}
          </section>
        )}

        {adminUnlocked && page === "Review Payslips" && (
          <section className="panel">
            <h2>Review Payslips</h2>
            {selectedSavedSlip ? (
              <>
                <div className="review-card">
                  <StatusBadge status={selectedSavedSlip.status} />
                  <h3>{selectedSavedSlip.slip_id}</h3>
                  <p>{selectedSavedSlip.employee_name} | {months[selectedSavedSlip.month - 1]} {selectedSavedSlip.year}</p>
                  {(() => {
                    const payment = JSON.parse(selectedSavedSlip.payment_snapshot_json);
                    const employee = JSON.parse(selectedSavedSlip.employee_snapshot_json) as Employee;
                    const detail = payment.payroll_detail as PayrollDraftRow | undefined;
                    const calc = payment.calculation as ReturnType<typeof calculatePayrollRow> | undefined;
                    if (!detail || !calc) return null;
                    return <div className="review-breakdown">
                      <h3>{selectedSavedSlip.employee_name}</h3>
                      <p><strong>Gaji Pokok:</strong> {formatIDR(employee.base_salary_monthly || employee.default_salary, store.business_settings.currency)} - ({calc.unpaidDays} hari tidak dibayar x {formatIDR(calc.dailySalary, store.business_settings.currency)}) = {formatIDR(calc.finalBase, store.business_settings.currency)}</p>
                      <p><strong>Uang Makan:</strong> {detail.hari_masuk} hari masuk x {formatIDR(employee.meal_allowance_per_day, store.business_settings.currency)} = {formatIDR(calc.meal, store.business_settings.currency)}</p>
                      <p><strong>Transport:</strong> {detail.hari_masuk} hari masuk x {formatIDR(employee.transport_allowance_per_day, store.business_settings.currency)} = {formatIDR(calc.transport, store.business_settings.currency)}</p>
                      <p><strong>Komisi:</strong> {formatIDR(detail.komisi, store.business_settings.currency)} | <strong>Bonus:</strong> {formatIDR(detail.bonus, store.business_settings.currency)} | <strong>Lembur:</strong> {formatIDR(detail.lembur, store.business_settings.currency)}</p>
                      <p><strong>Potongan:</strong> Kasbon {formatIDR(detail.potong_kasbon ? detail.kasbon_deduction : 0, store.business_settings.currency)} • Potongan Manual {formatIDR(detail.potongan_manual, store.business_settings.currency)}</p>
                      <h3>Take Home Pay: {formatIDR(calc.takeHome, store.business_settings.currency)}</h3>
                      <div className="actions"><span className="badge finalized">Draft</span>{detail.manual_override && <span className="badge pending">Manual Override</span>}{detail.potong_kasbon && <span className="badge approved">Kasbon Deducted</span>}<span className="badge active">Ready to Finalize</span></div>
                    </div>;
                  })()}
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => openSavedPdf(selectedSavedSlip)}><Eye size={16} /> Pratinjau PDF</button>
                  <button className="ghost" onClick={() => openSavedPdf(selectedSavedSlip, true)}><Download size={16} /> Download PDF</button>
                  <button className="ghost" onClick={() => openSavedPdf(selectedSavedSlip, false, true)}><Printer size={16} /> Cetak</button>
                </div>
              </>
            ) : <Empty title="Belum ada slip final" />}
          </section>
        )}

        {adminUnlocked && page === "Payslip History" && (
          <section className="panel">
            <div className="section-head">
              <h2>Payslip History</h2>
              <div className="filter-row">
                <div className="search-box"><Search size={16} /><input placeholder="Cari nama karyawan" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} /></div>
                <select value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)}><option value="">Semua Bulan</option>{months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
                <input placeholder="Tahun" value={historyYear} onChange={(e) => setHistoryYear(e.target.value)} />
                <select value={historyEmployee} onChange={(e) => setHistoryEmployee(e.target.value)}><option value="">Semua Karyawan</option>{store.employees.map((e) => <option key={e.id} value={e.employee_id}>{e.name}</option>)}</select>
              </div>
            </div>
            <SlipTable slips={filteredSlips} currency={store.business_settings.currency} onPreview={openSavedPdf} onPaid={markPaid} />
          </section>
        )}

        {adminUnlocked && page === "Rekap Absensi" && (
          <section className="panel">
            <div className="section-head">
              <h2>Rekap Absensi</h2>
              <div className="filter-row">
                <Input label="Dari" type="date" value={recapFrom} onChange={setRecapFrom} />
                <Input label="Sampai" type="date" value={recapTo} onChange={setRecapTo} />
                <label>Karyawan<select value={recapEmployee} onChange={(e) => setRecapEmployee(e.target.value)}><option value="">Semua</option>{store.employees.map((e) => <option key={e.id} value={e.employee_id}>{e.name}</option>)}</select></label>
                <label>Status<select value={recapStatus} onChange={(e) => setRecapStatus(e.target.value)}><option value="">Semua</option>{attendanceStatusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
              </div>
            </div>
            <AttendanceStats logs={filteredAttendance(store.attendance_logs, recapFrom, recapTo, recapEmployee, recapStatus)} />
            <AttendanceTable logs={filteredAttendance(store.attendance_logs, recapFrom, recapTo, recapEmployee, recapStatus)} editable onUpdate={(log, patch) => saveStore({ ...store, attendance_logs: store.attendance_logs.map((item) => item.id === log.id ? { ...item, ...patch, updated_at: now() } : item) })} />
          </section>
        )}

        {adminUnlocked && page === "Lembur & Extra Chore" && (
          <section className="panel">
            <div className="section-head">
              <h2>Lembur & Extra Chore</h2>
              <button className="primary" onClick={() => {
                const employee = selectedEmployee || store.employees[0];
                if (!employee) return;
                const record: ExtraWorkRecord = { id: uid("extra_work"), employee_id: employee.employee_id, employee_name: employee.name, date: today(), type: "overtime", hours: 0, quantity: 0, amount: 0, notes: "Input manual admin", status: "pending", source: "admin_manual", approved_by: "", approved_at: "", created_at: now(), updated_at: now() };
                saveStore({ ...store, extra_work_records: [record, ...store.extra_work_records] });
              }}><Plus size={16} /> Buat Manual</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Karyawan</th><th>Tanggal</th><th>Tipe</th><th>Jam/Qty</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>{store.extra_work_records.map((record) => <tr key={record.id}>
                  <td>{record.employee_name}</td>
                  <td>{record.date}</td>
                  <td>{record.type === "overtime" ? "Lembur" : "Extra Chore"}</td>
                  <td>{record.hours || record.quantity}</td>
                  <td className="money">{formatIDR(record.amount, store.business_settings.currency)}</td>
                  <td><span className={`badge ${record.status}`}>{record.status}</span></td>
                  <td className="row-actions">
                    <button className="icon" title="Approve" onClick={() => setExtraStatus(record, "approved")}><Check size={15} /></button>
                    <button className="icon" title="Reject" onClick={() => setExtraStatus(record, "rejected")}><Trash2 size={15} /></button>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        {adminUnlocked && page === "Kasbon" && (
          <section className="grid two">
            <div className="panel">
              <h2>Tambah Kasbon</h2>
              <div className="form-grid">
                <label>Karyawan<select value={kasbonDraft.employeeInternalId} onChange={(e) => setKasbonDraft({ ...kasbonDraft, employeeInternalId: e.target.value })}>{store.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_id} - {employee.name}</option>)}</select></label>
                <Input label="Nominal" type="number" value={kasbonDraft.amount} onChange={(v) => setKasbonDraft({ ...kasbonDraft, amount: cleanNumber(v) })} />
                <Input label="Deskripsi" value={kasbonDraft.description} onChange={(v) => setKasbonDraft({ ...kasbonDraft, description: v })} />
                <Input label="Catatan" value={kasbonDraft.notes} onChange={(v) => setKasbonDraft({ ...kasbonDraft, notes: v })} />
              </div>
              <button className="primary" onClick={createKasbon}><Save size={16} /> Simpan Kasbon</button>
            </div>
            <div className="panel">
              <h2>Daftar Kasbon</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Karyawan</th><th>Tanggal</th><th>Nominal</th><th>Sisa</th><th>Status</th></tr></thead>
                  <tbody>{store.employee_cash_advances.map((kasbon) => <tr key={kasbon.id}>
                    <td>{kasbon.employee_name}</td><td>{kasbon.date}</td><td className="money">{formatIDR(kasbon.amount, store.business_settings.currency)}</td><td className="money">{formatIDR(kasbon.remaining_balance, store.business_settings.currency)}</td><td>{kasbon.status}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {adminUnlocked && page === "Settings" && (
          <section className="settings-layout">
            <div className="tabs">
              {["Info Bisnis", "Absensi Settings", "Komponen Payroll", "Pengaturan PDF"].map((tab) => <button key={tab} className={settingsTab === tab ? "active" : ""} onClick={() => setSettingsTab(tab)}>{tab}</button>)}
            </div>
            {settingsTab === "Info Bisnis" && (
              <div className="panel">
                <h2>Info Bisnis</h2>
                <div className="form-grid two-columns">
                  <Input label="Nama Bisnis" value={store.business_settings.business_name} onChange={(v) => updateBusiness({ business_name: v })} />
                  <Input label="Nama Legal Perusahaan" value={store.business_settings.legal_name} onChange={(v) => updateBusiness({ legal_name: v })} />
                  <Input label="Phone / WhatsApp" value={store.business_settings.phone} onChange={(v) => updateBusiness({ phone: v })} />
                  <Input label="Email" value={store.business_settings.email} onChange={(v) => updateBusiness({ email: v })} />
                  <Input label="Website / Instagram" value={store.business_settings.website} onChange={(v) => updateBusiness({ website: v })} />
                  <Input label="Currency" value={store.business_settings.currency} onChange={(v) => updateBusiness({ currency: v || "IDR" })} />
                  <label className="full">Alamat<textarea value={store.business_settings.address} onChange={(e) => updateBusiness({ address: e.target.value })} /></label>
                  <label>Upload Logo<input type="file" accept="image/*" onChange={(e) => readLogo(e.target.files?.[0], (logo_data_url) => updateBusiness({ logo_data_url }))} /></label>
                  <div className="logo-preview">{store.business_settings.logo_data_url ? <img src={store.business_settings.logo_data_url} alt="" /> : <span>Pratinjau logo</span>}</div>
                </div>
              </div>
            )}
            {settingsTab === "Absensi Settings" && (
              <div className="panel">
                <div className="section-head">
                  <div>
                    <h2>QR Absensi Kantor</h2>
                    <p className="muted">Untuk mencegah titip absen, gunakan QR Harian + PIN Staff. QR harian berubah setiap hari dan PIN staff wajib diisi saat absen.</p>
                  </div>
                  <span className="badge active">{store.business_settings.attendance_qr_mode === "daily" ? "QR Harian" : "Static Office QR"}</span>
                </div>
                <div className="form-grid">
                  <label>QR Mode<select value={store.business_settings.attendance_qr_mode} onChange={(e) => updateBusiness({ attendance_qr_mode: e.target.value as "static" | "daily" })}><option value="daily">QR Harian</option><option value="static">Static Office QR</option></select></label>
                  <label>QR validity<input readOnly value={store.business_settings.attendance_qr_mode === "daily" ? "Valid today only" : "Static"} /></label>
                </div>
                <div className="actions">
                  <button className="primary" onClick={() => generateOfficeQr(false)}><QrCode size={16} /> Generate QR</button>
                  <button className="ghost" onClick={() => generateOfficeQr(true)}><RotateCcw size={16} /> Regenerate QR</button>
                  <button className="ghost" onClick={() => downloadOfficeQr(false)}><Download size={16} /> Download QR</button>
                  <button className="ghost" onClick={() => downloadOfficeQr(true)}><Printer size={16} /> Print QR</button>
                </div>
                <div className="office-qr-preview">
                  {officeQrDataUrl ? <img src={officeQrDataUrl} alt="" /> : <span>Office QR Code akan tampil setelah Generate QR.</span>}
                </div>
                <p className="helper-text">Rekomendasi: gunakan QR Harian Kantor + PIN Staff untuk mengurangi risiko titip absen.</p>
              </div>
            )}
            {settingsTab === "Komponen Payroll" && (
              <div className="panel">
                <div className="section-head">
                  <h2>Komponen Payroll</h2>
                  <button className="primary" onClick={addComponent}><Plus size={16} /> Tambah Komponen</button>
                </div>
                <div className="component-admin">
                  {store.payroll_components.sort((a, b) => a.sort_order - b.sort_order).map((component) => (
                    <ComponentEditor key={component.id} component={component} onSave={saveComponent} onDelete={deleteComponent} />
                  ))}
                </div>
              </div>
            )}
            {settingsTab === "Pengaturan PDF" && (
              <div className="panel">
                <h2>Pengaturan PDF</h2>
                <div className="form-grid">
                  <label className="full">Catatan Footer Default<textarea value={store.business_settings.footer_note} onChange={(e) => updateBusiness({ footer_note: e.target.value })} /></label>
                  <label className="full">Catatan Pembayaran Default<textarea value={store.business_settings.payment_note} onChange={(e) => updateBusiness({ payment_note: e.target.value })} /></label>
                  <p className="helper-text full">PIN Admin disimpan internal dan tidak ditampilkan di UI. Perubahan PIN admin akan dibuat melalui panel keamanan terpisah.</p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function emptyEmployee(employeeId = "EMP001"): Employee {
  return {
    id: uid("employee"),
    employee_id: employeeId,
    name: "",
    status: "Tetap",
    position: "Admin",
    active: true,
    default_salary: 0,
    base_salary_monthly: 0,
    meal_allowance_per_day: 10000,
    transport_allowance_per_day: 0,
    work_days_per_month: 26,
    leave_quota_monthly: 0,
    leave_quota_yearly: 0,
    bpjs_kesehatan_default: 0,
    bpjs_ketenagakerjaan_default: 0,
    fixed_allowance: 0,
    hp_admin_allowance_enabled: false,
    hp_admin_allowance_amount: 0,
    bank_name: "",
    account_number: "",
    account_holder: "",
    staff_pin: randomPin(),
    attendance_token: "",
    notes: "",
    created_at: now(),
    updated_at: now(),
  };
}

function calculateTotals(components: PayrollRowComponent[]) {
  const total_earning = components.filter((c) => c.component_type === "earning").reduce((sum, c) => sum + cleanNumber(c.amount), 0);
  const total_deduction = components.filter((c) => c.component_type === "deduction").reduce((sum, c) => sum + cleanNumber(c.amount), 0);
  return { total_earning, total_deduction, take_home_pay: total_earning - total_deduction };
}

function Input(props: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label>{props.label}<input type={props.type || "text"} value={props.value} onChange={(e) => props.onChange(e.target.value)} /></label>;
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle"><input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} /><span>{props.label}</span></label>;
}

function Metric(props: { title: string; value: number; icon: React.ReactNode }) {
  return <div className="metric"><div>{props.icon}</div><span>{props.title}</span><strong>{props.value}</strong></div>;
}

function Breakdown({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="breakdown">
      <h3>{title}</h3>
      {rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
  );
}

function Empty({ title }: { title: string }) {
  return <div className="empty"><Archive size={32} /><p>{title}</p></div>;
}

function AdminLocked({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="panel locked-panel">
      <Lock size={36} />
      <h2>Menu admin terkunci</h2>
      <p>Data payroll, kasbon, histori slip, dan pengaturan hanya tampil setelah PIN admin dimasukkan.</p>
      <button className="primary" onClick={onOpen}>Masukkan PIN Admin</button>
    </section>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  return <span className={`badge ${status.toLowerCase()}`}>{status}</span>;
}

function statusLabel(status: AttendanceStatus) {
  return ({ hadir: "Hadir", telat: "Telat", cuti_berbayar: "Cuti Berbayar", cuti_tidak_berbayar: "Cuti Tidak Berbayar", izin: "Izin", sakit: "Sakit", alfa: "Alfa", libur: "Libur" })[status];
}

const attendanceStatusOptions: AttendanceStatus[] = ["hadir", "telat", "cuti_berbayar", "cuti_tidak_berbayar", "izin", "sakit", "alfa", "libur"];

function filteredAttendance(logs: AttendanceLog[], from: string, to: string, employee: string, status: string) {
  return logs.filter((log) =>
    (!from || log.date >= from) &&
    (!to || log.date <= to) &&
    (!employee || log.employee_id === employee) &&
    (!status || log.status === status)
  );
}

function AttendanceStats({ logs }: { logs: AttendanceLog[] }) {
  return (
    <div className="summary-bar attendance-stats">
      {attendanceStatusOptions.map((status) => (
        <span key={status}>{statusLabel(status)} <strong>{logs.filter((log) => log.status === status).length}</strong></span>
      ))}
      <span>Total lembur <strong>{logs.reduce((sum, log) => sum + log.overtime_minutes, 0)} menit</strong></span>
      <span>Hari kerja <strong>{logs.filter((log) => ["hadir", "telat"].includes(log.status)).length}</strong></span>
    </div>
  );
}

function AttendanceTable(props: { logs: AttendanceLog[]; editable: boolean; onUpdate: (log: AttendanceLog, patch: Partial<AttendanceLog>) => void; extraWork?: ExtraWorkRecord[] }) {
  if (!props.logs.length) return <Empty title="Belum ada data absensi." />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Karyawan</th><th>Tanggal</th><th>Clock In</th><th>Clock Out</th><th>Total</th><th>Status</th><th>Pending</th><th>Catatan</th></tr></thead>
        <tbody>{props.logs.map((log) => {
          const pending = (props.extraWork || []).filter((record) => record.employee_id === log.employee_id && record.date === log.date && record.status === "pending").length;
          return <tr key={log.id}>
            <td>{log.employee_name}<span className="muted">{log.employee_id} | {log.source}</span></td>
            <td>{log.date}</td>
            <td>{log.clock_in_time || "-"}</td>
            <td>{log.clock_out_time || "-"}</td>
            <td>{Math.round(log.total_work_minutes / 60 * 10) / 10} jam</td>
            <td>{props.editable ? <select value={log.status} onChange={(e) => props.onUpdate(log, { status: e.target.value as AttendanceStatus })}>{attendanceStatusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select> : statusLabel(log.status)}</td>
            <td>{pending ? <span className="badge pending">{pending} pending</span> : "-"}</td>
            <td>{props.editable ? <input value={log.notes} onChange={(e) => props.onUpdate(log, { notes: e.target.value })} /> : log.notes || "-"}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function ComponentAmountTable(props: {
  title: string;
  type: ComponentType;
  components: PayrollRowComponent[];
  custom: PayrollRowComponent[];
  setCustom: (components: PayrollRowComponent[]) => void;
  amounts: Record<string, number>;
  setAmounts: (amounts: Record<string, number>) => void;
  currency: string;
}) {
  const rows = props.components.filter((component) => component.component_type === props.type);
  const customs = props.custom.filter((component) => component.component_type === props.type);
  return (
    <div className="mini-panel">
      <h3>{props.title}</h3>
      {[...rows, ...customs].map((component) => {
        const custom = !component.source_component_id;
        return (
          <div className="amount-row" key={component.id}>
            {custom ? (
              <input value={component.component_name} onChange={(e) => props.setCustom(props.custom.map((item) => item.id === component.id ? { ...item, component_name: e.target.value } : item))} />
            ) : <span>{component.component_name}</span>}
            {custom && <select value={component.component_type} onChange={(e) => props.setCustom(props.custom.map((item) => item.id === component.id ? { ...item, component_type: e.target.value as ComponentType } : item))}><option value="earning">Pendapatan</option><option value="deduction">Potongan</option></select>}
            <input type="number" value={component.amount} onChange={(e) => {
              if (component.source_component_id) props.setAmounts({ ...props.amounts, [component.source_component_id]: cleanNumber(e.target.value) });
              else props.setCustom(props.custom.map((item) => item.id === component.id ? { ...item, amount: cleanNumber(e.target.value) } : item));
            }} />
          </div>
        );
      })}
      <p className="muted">Subtotal {formatIDR([...rows, ...customs].reduce((sum, item) => sum + item.amount, 0), props.currency)}</p>
    </div>
  );
}

function ComponentEditor(props: { component: PayrollComponent; onSave: (component: PayrollComponent) => void; onDelete: (component: PayrollComponent) => void }) {
  const [draft, setDraft] = useState(props.component);
  return (
    <div className={draft.archived ? "component-editor archived" : "component-editor"}>
      <div className="form-grid compact">
        <Input label="Nama komponen" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
        <label>Tipe<select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ComponentType })}><option value="earning">Pendapatan</option><option value="deduction">Potongan</option></select></label>
        <Input label="Nominal default" type="number" value={draft.default_amount} onChange={(v) => setDraft({ ...draft, default_amount: cleanNumber(v) })} />
        <Input label="Urutan" type="number" value={draft.sort_order} onChange={(v) => setDraft({ ...draft, sort_order: cleanNumber(v) })} />
        <label>Kategori<select value={draft.category || "Monthly Variable"} onChange={(e) => setDraft({ ...draft, category: e.target.value as PayrollComponent["category"] })}><option>Default Staff</option><option>Monthly Variable</option><option>Deduction</option><option>Allowance</option></select></label>
        <Toggle label="Aktif" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
        <Toggle label="Tampil di form payroll" checked={draft.show_in_form} onChange={(v) => setDraft({ ...draft, show_in_form: v })} />
        <Toggle label="Tampil di PDF" checked={draft.show_in_pdf} onChange={(v) => setDraft({ ...draft, show_in_pdf: v })} />
        <Toggle label="Sembunyikan jika nol" checked={draft.hide_if_zero} onChange={(v) => setDraft({ ...draft, hide_if_zero: v })} />
        <Toggle label="Ditanggung perusahaan" checked={draft.company_paid} onChange={(v) => setDraft({ ...draft, company_paid: v })} />
        <Toggle label="Potongan karyawan" checked={draft.employee_deduction} onChange={(v) => setDraft({ ...draft, employee_deduction: v })} />
        <label className="full">Catatan<textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
      </div>
      <div className="actions">
        <button className="ghost" onClick={() => props.onSave(draft)}><Save size={16} /> Simpan</button>
        <button className="danger" onClick={() => props.onDelete(draft)}><Trash2 size={16} /> Hapus</button>
      </div>
    </div>
  );
}

function SlipTable(props: {
  slips: SavedPayslip[];
  currency: string;
  onPreview: (slip: SavedPayslip, save?: boolean, print?: boolean) => void;
  onPaid: (slip: SavedPayslip, paid: boolean) => void;
}) {
  if (!props.slips.length) return <Empty title="Belum ada data slip." />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Slip ID</th><th>Karyawan</th><th>Periode</th><th>Status</th><th>Take Home Pay</th><th>Aksi</th></tr></thead>
        <tbody>
          {props.slips.map((slip) => {
            const totals = JSON.parse(slip.totals_snapshot_json) as { take_home_pay: number };
            return (
              <tr key={slip.id}>
                <td>{slip.slip_id}</td>
                <td>{slip.employee_name}</td>
                <td>{months[slip.month - 1]} {slip.year}</td>
                <td><StatusBadge status={slip.status} /></td>
                <td className="money">{formatIDR(totals.take_home_pay, props.currency)}</td>
                <td className="row-actions">
                  <button className="icon" title="Preview PDF" onClick={() => props.onPreview(slip)}><Eye size={15} /></button>
                  <button className="icon" title="Download PDF" onClick={() => props.onPreview(slip, true)}><Download size={15} /></button>
                  <button className="icon" title="Print" onClick={() => props.onPreview(slip, false, true)}><Printer size={15} /></button>
                  <button className="icon" title={slip.status === "Paid" ? "Tandai belum dibayar" : "Tandai paid"} onClick={() => props.onPaid(slip, slip.status !== "Paid")}>{slip.status === "Paid" ? <RotateCcw size={15} /> : <CalendarDays size={15} />}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function readLogo(file: File | undefined, callback: (dataUrl: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result || ""));
  reader.readAsDataURL(file);
}

const rootElement = document.getElementById("root")!;
const root = (window as typeof window & { payrollRoot?: ReturnType<typeof createRoot> }).payrollRoot ?? createRoot(rootElement);
(window as typeof window & { payrollRoot?: ReturnType<typeof createRoot> }).payrollRoot = root;
root.render(<App />);
