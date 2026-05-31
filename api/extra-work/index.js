import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "../_db.js";

const num = (value) => Number(value || 0) || 0;

async function upsertExtraWork(sql, record) {
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

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
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
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}

export { upsertExtraWork };
