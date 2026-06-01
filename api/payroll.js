import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "../lib/db.js";

async function upsertJson(sql, table, row) {
  const data = JSON.stringify(row);
  if (table === "payroll_components") await sql`insert into payroll_components (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  else if (table === "employee_cash_advances") await sql`insert into employee_cash_advances (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data, updated_at = now()`;
  else if (table === "saved_payslips") await sql`insert into saved_payslips (id, data) values (${row.id}, ${data}::jsonb) on conflict (id) do update set data = excluded.data`;
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    const action = req.query?.action || "components";
    if (req.method === "GET" && action === "components") {
      const rows = await sql`select data from payroll_components order by created_at`;
      return json(res, 200, { ok: true, payroll_components: rows.map((r) => r.data) });
    }
    if (req.method === "PUT" && action === "components") {
      const body = await readBody(req);
      const rows = Array.isArray(body.components) ? body.components : [body.component || body];
      for (const row of rows) if (row?.id) await upsertJson(sql, "payroll_components", row);
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && ["payslips", "history"].includes(action)) {
      const rows = await sql`select data from saved_payslips order by created_at desc`;
      return json(res, 200, { ok: true, saved_payslips: rows.map((r) => r.data) });
    }
    if (req.method === "POST" && ["save-payslip", "finalize"].includes(action)) {
      const body = await readBody(req);
      if (body.payslip?.id) await upsertJson(sql, "saved_payslips", body.payslip);
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && action === "kasbon") {
      const rows = await sql`select data from employee_cash_advances order by created_at desc`;
      return json(res, 200, { ok: true, employee_cash_advances: rows.map((r) => r.data) });
    }
    if ((req.method === "POST" || req.method === "PUT") && action === "kasbon") {
      const body = await readBody(req);
      if (body.kasbon?.id) await upsertJson(sql, "employee_cash_advances", body.kasbon);
      return json(res, 200, { ok: true });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}
