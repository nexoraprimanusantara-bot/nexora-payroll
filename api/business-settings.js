import { ensureSchema, getSql, handleError, json, methodNotAllowed, readBody } from "./_db.js";

function toClient(row = {}) {
  return {
    business_name: row.business_name || row.data?.business_name || "Nama Bisnis",
    legal_name: row.data?.legal_name || "",
    address: row.business_address || row.data?.address || "",
    phone: row.business_phone || row.data?.phone || "",
    email: row.business_email || row.data?.email || "",
    website: row.data?.website || "",
    logo_data_url: row.business_logo_url || row.data?.logo_data_url || "",
    footer_note: row.payslip_footer_note || row.data?.footer_note || "",
    payment_note: row.data?.payment_note || "",
    currency: row.data?.currency || "IDR",
    admin_pin: row.data?.admin_pin || "0987",
  };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = getSql();
    if (req.method === "GET") {
      const [row] = await sql`select * from business_settings where id = 'default'`;
      return json(res, 200, { ok: true, business_settings: toClient(row) });
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const settings = body.business_settings || body;
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
      return json(res, 200, { ok: true, business_settings: toClient(row), message: "Business Info berhasil disimpan ke database." });
    }
    return methodNotAllowed(res);
  } catch (error) {
    return handleError(res, error);
  }
}
