type ApiResult<T> = { ok: true; data: T } | { ok: false; offline: boolean; error: string; status?: number };

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data.ok === false) {
      return {
        ok: false,
        offline: response.status === 404 || response.status === 503,
        status: response.status,
        error: data.error || data.message || "Database belum tersambung.",
      };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, offline: true, error: error instanceof Error ? error.message : "Database belum tersambung." };
  }
}

export async function initDatabase() {
  return apiFetch<{ ok: true }>("/api/init-db", { method: "POST", body: "{}" });
}

export async function bootstrapData() {
  await initDatabase();
  return apiFetch<Record<string, unknown>>("/api/app?action=bootstrap");
}

export async function saveAttendanceSettings(settings: Record<string, unknown>, regenerate = false) {
  return apiFetch<Record<string, unknown>>("/api/app?action=attendance-settings", {
    method: "PUT",
    body: JSON.stringify({ ...settings, regenerate }),
  });
}

export async function fetchBusinessSettings() {
  return apiFetch<Record<string, unknown>>("/api/app?action=business-settings");
}

export async function saveBusinessSettings(settings: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/api/app?action=business-settings", {
    method: "PUT",
    body: JSON.stringify({ business_settings: settings }),
  });
}

export async function saveEmployeeRemote(employee: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/api/app?action=employee", {
    method: "POST",
    body: JSON.stringify({ employee }),
  });
}

export async function syncEmployeesRemote(employees: Array<Record<string, unknown>>) {
  return apiFetch<{ ok: true; synced: number }>("/api/app?action=sync-employees", {
    method: "POST",
    body: JSON.stringify({ employees }),
  });
}

export async function clockAttendanceRemote(payload: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/api/attendance?action=clock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchTodayAttendance(date: string) {
  return apiFetch<Record<string, unknown>>(`/api/attendance?action=today&date=${encodeURIComponent(date)}`);
}

export async function saveExtraWorkRemote(records: Array<Record<string, unknown>>) {
  return apiFetch<Record<string, unknown>>("/api/attendance?action=extra-work", {
    method: "POST",
    body: JSON.stringify({ records }),
  });
}

export async function updateExtraWorkRemote(record: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/api/attendance?action=extra-work", {
    method: "PUT",
    body: JSON.stringify({ record }),
  });
}

export async function migrateLocalDataToNeon(store: Record<string, unknown>) {
  return apiFetch<{ ok: true; summary: Record<string, number> }>("/api/app?action=migrate-local-data", {
    method: "POST",
    body: JSON.stringify({ store }),
  });
}

export async function syncStoreToRemote(store: Record<string, unknown>) {
  return migrateLocalDataToNeon(store);
}
