import { supabaseAdmin } from "@/lib/supabase";
import type { Account, ClockOutResult, TapAction } from "@/lib/types";

const API_BASE =
  process.env.ATTENDANCE_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.bharatainternasional.com";

const LOGIN_PATH = "/auth/login";
const TAP_PATH = "/api/attendance/tap?method=Mobile";
const MOOD_PATH = "/api/attendance/mood";

/**
 * Try to pull a bearer token out of an unknown login response shape.
 * Handles { token }, { access_token }, { data: { token } }, { data: { access_token } }, etc.
 */
function extractToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, any>;
  const candidates = [
    obj.token,
    obj.access_token,
    obj.accessToken,
    obj.bearer,
    obj.data?.token,
    obj.data?.access_token,
    obj.data?.accessToken,
    obj.data?.bearer,
    obj.result?.token,
    obj.result?.access_token,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

// The attendance API issues tokens valid for 72 hours.
const TOKEN_TTL_HOURS = 72;

/** Expiry (ISO) for a token obtained now: login time + 72h. Null when no token. */
function computeBearerExpiry(token: string | null): string | null {
  if (!token) return null;
  return new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000).toISOString();
}

async function readBody(res: Response): Promise<{ json: any; text: string }> {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { json, text };
}

// Raw response bodies can be large; cap what we store.
const MAX_BODY = 4000;

interface StepResult {
  ok: boolean;
  status: number;
  bodyText: string;
  message: string;
  token?: string | null;
}

/** Insert one raw request/response row into request_logs (best-effort). */
async function logRequest(params: {
  account: Account;
  action: TapAction | null;
  step: "login" | "tap" | "mood";
  success: boolean;
  httpStatus: number | null;
  body: string;
}) {
  try {
    const bodyToSave = params.httpStatus === 200 
      ? "[Success response hidden]" 
      : (params.body ?? "").slice(0, MAX_BODY);

    await supabaseAdmin.from("request_logs").insert({
      account_id: params.account.id,
      account_label: params.account.label,
      action: params.action,
      step: params.step,
      success: params.success,
      http_status: params.httpStatus,
      response_body: bodyToSave,
    });
  } catch {
    // Never let logging failures break a clock-in/out.
  }
}

/** Log in with employee_id + password. Returns the raw outcome (no throw on HTTP errors). */
async function login(account: Account): Promise<StepResult> {
  const res = await fetch(`${API_BASE}${LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      employee_id: account.employee_id,
      password: account.password,
    }),
    cache: "no-store",
  });

  const { json, text } = await readBody(res);

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `HTTP ${res.status}`;
    return {
      ok: false,
      status: res.status,
      bodyText: text,
      message: `Login failed (${res.status}): ${msg}`,
      token: null,
    };
  }

  const token = extractToken(json);
  if (!token) {
    return {
      ok: false,
      status: res.status,
      bodyText: text,
      message: "Login succeeded but no token found in response",
      token: null,
    };
  }
  return { ok: true, status: res.status, bodyText: text, message: "Login OK", token };
}

/**
 * Adds a random offset up to `maxMeters` to the given coordinates.
 */
function applyJitter(lat: number, lng: number, maxMeters = 50) {
  const radius = Math.random() * maxMeters;
  const angle = Math.random() * 2 * Math.PI;
  
  const dx = radius * Math.cos(angle); // East-West offset in meters
  const dy = radius * Math.sin(angle); // North-South offset in meters
  
  // Convert meters to degrees
  // 1 degree latitude = 111,111 meters
  const deltaLat = dy / 111111;
  // 1 degree longitude = 111,111 * cos(lat) meters
  const deltaLng = dx / (111111 * Math.cos(lat * (Math.PI / 180)));
  
  return {
    latitude: lat + deltaLat,
    longitude: lng + deltaLng,
  };
}

/** Call the attendance tap endpoint. Returns the raw outcome (no throw on HTTP errors). */
async function tap(account: Account, token: string): Promise<StepResult> {
  const baseLat = -7.438400322394673;
  const baseLng = 108.7680295990381;
  const { latitude, longitude } = applyJitter(baseLat, baseLng, 50);

  const res = await fetch(`${API_BASE}${TAP_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ssid: "LT. 2 Bharata-5G",
      mac_address: "C4:B2:5B:CE:DB:CF",
      device_id: "Currently unused",
      location: {
        latitude,
        longitude,
      },
    }),
    cache: "no-store",
  });

  const { json, text } = await readBody(res);

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `HTTP ${res.status}`;
    return {
      ok: false,
      status: res.status,
      bodyText: text,
      message: `Tap failed (${res.status}): ${msg}`,
    };
  }

  return {
    ok: true,
    status: res.status,
    bodyText: text,
    message: (json?.message as string) || text || "Tap OK",
  };
}

/** Send the account's chosen mood. Body: { emoji: <mood key> }. */
async function sendMood(token: string, mood: string): Promise<StepResult> {
  const res = await fetch(`${API_BASE}${MOOD_PATH}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ emoji: mood }),
    cache: "no-store",
  });

  const { json, text } = await readBody(res);

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `HTTP ${res.status}`;
    return {
      ok: false,
      status: res.status,
      bodyText: text,
      message: `Mood failed (${res.status}): ${msg}`,
    };
  }

  return {
    ok: true,
    status: res.status,
    bodyText: text,
    message: (json?.message as string) || text || "Mood OK",
  };
}

/**
 * Full flow for one account: try tap with existing token -> if fail, login fresh -> tap.
 * Persists result + logs.
 */
export async function tapAttendance(
  account: Account,
  action: TapAction,
  options: { allowLogin?: boolean } = {}
): Promise<ClockOutResult> {
  // allowLogin=true  → boleh login sekali kalau belum punya token (tombol manual).
  // allowLogin=false → murni tap saja, tidak pernah login (dipakai cron/automation).
  const { allowLogin = true } = options;

  let status: "success" | "error" = "success";
  let message = "";
  let bearer: string | null = account.last_bearer;
  // Track whether we logged in this run, so we only refresh the expiry stamp
  // when a NEW token was actually obtained (not when reusing the old one).
  let attemptedLogin = false;

  // ── Step 1: pastikan ada token. Hanya login kalau diizinkan DAN belum ada
  // token sama sekali — tidak pernah login ulang ketika token sudah tersedia. ──
  if (!bearer && allowLogin) {
    attemptedLogin = true;
    try {
      const l = await login(account);
      await logRequest({
        account,
        action,
        step: "login",
        success: l.ok,
        httpStatus: l.status,
        body: l.bodyText,
      });
      if (!l.ok) {
        status = "error";
        message = l.message;
        bearer = null;
      } else {
        bearer = l.token ?? null;
      }
    } catch (err) {
      status = "error";
      message = err instanceof Error ? err.message : String(err);
      bearer = null;
      await logRequest({
        account,
        action,
        step: "login",
        success: false,
        httpStatus: null,
        body: message,
      });
    }
  }

  // ── Step 2: tap SEKALI saja. Tidak ada login + tap ulang kalau gagal;
  // token kadaluarsa ditangani lewat tombol "Perbarui Token" manual. ──
  if (status === "success") {
    if (!bearer) {
      status = "error";
      message = "Tidak ada token. Gunakan \"Perbarui Token\" terlebih dahulu.";
    } else {
      try {
        const t = await tap(account, bearer);
        await logRequest({
          account,
          action,
          step: "tap",
          success: t.ok,
          httpStatus: t.status,
          body: t.bodyText,
        });
        status = t.ok ? "success" : "error";
        message = t.message;

        // Setelah tap MASUK sukses, kirim mood pilihan akun (best-effort —
        // kegagalan mood tidak menggagalkan clock-in; tidak dikirim saat pulang).
        if (action === "in" && t.ok && account.mood) {
          try {
            const m = await sendMood(bearer, account.mood);
            await logRequest({
              account,
              action,
              step: "mood",
              success: m.ok,
              httpStatus: m.status,
              body: m.bodyText,
            });
          } catch (err) {
            await logRequest({
              account,
              action,
              step: "mood",
              success: false,
              httpStatus: null,
              body: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } catch (err) {
        status = "error";
        message = err instanceof Error ? err.message : String(err);
        await logRequest({
          account,
          action,
          step: "tap",
          success: false,
          httpStatus: null,
          body: message,
        });
      }
    }
  }

  // Persist the outcome on the account row.
  const update: Record<string, unknown> = {
    last_bearer: bearer,
    last_status: status,
    last_message: message,
    last_action: action,
    last_clock_out_at: new Date().toISOString(),
  };
  // Only touch the expiry when we actually attempted a login this run:
  // fresh token → now + 72h, failed login (no token) → cleared.
  if (attemptedLogin) {
    update.bearer_expires_at = computeBearerExpiry(bearer);
  }
  await supabaseAdmin.from("accounts").update(update).eq("id", account.id);

  // Write a summary history row.
  await supabaseAdmin.from("clock_out_logs").insert({
    account_id: account.id,
    status,
    action,
    message,
  });

  return {
    account_id: account.id,
    label: account.label,
    status,
    action,
    message,
  };
}

/**
 * Manually refresh the login token for an account and save it.
 */
export async function refreshLogin(account: Account): Promise<{ ok: boolean; message: string }> {
  let status: "success" | "error" = "success";
  let message = "";
  let bearer: string | null = null;
  
  try {
    const l = await login(account);
    await logRequest({
      account,
      action: null, // login murni — bukan tap masuk/pulang
      step: "login",
      success: l.ok,
      httpStatus: l.status,
      body: l.bodyText,
    });
    if (!l.ok) {
      status = "error";
      message = l.message;
    } else {
      bearer = l.token ?? null;
      message = "Login OK";
    }
  } catch (err) {
    status = "error";
    message = err instanceof Error ? err.message : String(err);
    await logRequest({
      account,
      action: account.last_action || "out",
      step: "login",
      success: false,
      httpStatus: null,
      body: message,
    });
  }

  if (bearer) {
    await supabaseAdmin
      .from("accounts")
      .update({
        last_bearer: bearer,
        bearer_expires_at: computeBearerExpiry(bearer),
      })
      .eq("id", account.id);
  }

  return { ok: status === "success", message };
}

/**
 * Manually send the account's mood (no tap). Logs in once if there's no token,
 * same as a manual clock-in/out.
 */
export async function sendMoodManual(
  account: Account
): Promise<{ ok: boolean; message: string }> {
  let bearer: string | null = account.last_bearer;
  let loggedIn = false;

  // Ensure a token — manual action may log in once.
  if (!bearer) {
    try {
      const l = await login(account);
      await logRequest({
        account,
        action: null,
        step: "login",
        success: l.ok,
        httpStatus: l.status,
        body: l.bodyText,
      });
      if (l.ok) {
        bearer = l.token ?? null;
        loggedIn = true;
      } else {
        return { ok: false, message: l.message };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logRequest({
        account,
        action: null,
        step: "login",
        success: false,
        httpStatus: null,
        body: message,
      });
      return { ok: false, message };
    }
  }

  if (!bearer) {
    return {
      ok: false,
      message: 'Tidak ada token. Gunakan "Perbarui Token" terlebih dahulu.',
    };
  }

  let result: { ok: boolean; message: string };
  try {
    const m = await sendMood(bearer, account.mood ?? "moodNeutral");
    await logRequest({
      account,
      action: null,
      step: "mood",
      success: m.ok,
      httpStatus: m.status,
      body: m.bodyText,
    });
    result = { ok: m.ok, message: m.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRequest({
      account,
      action: null,
      step: "mood",
      success: false,
      httpStatus: null,
      body: message,
    });
    result = { ok: false, message };
  }

  // Persist a freshly obtained token + expiry.
  if (loggedIn && bearer) {
    await supabaseAdmin
      .from("accounts")
      .update({
        last_bearer: bearer,
        bearer_expires_at: computeBearerExpiry(bearer),
      })
      .eq("id", account.id);
  }

  return result;
}

/** Clock out one account (tap fast). */
export const clockOutAccount = (account: Account) =>
  tapAttendance(account, "out");

/** Clock in one account (tap fast). */
export const clockInAccount = (account: Account) =>
  tapAttendance(account, "in");
