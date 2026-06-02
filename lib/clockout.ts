import { supabaseAdmin } from "@/lib/supabase";
import type { Account, ClockOutResult, TapAction } from "@/lib/types";

const API_BASE =
  process.env.ATTENDANCE_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.bharatainternasional.com";

const LOGIN_PATH = "/auth/login";
const TAP_PATH = "/api/attendance/tap?method=Mobile";

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
  action: TapAction;
  step: "login" | "tap";
  success: boolean;
  httpStatus: number | null;
  body: string;
}) {
  try {
    await supabaseAdmin.from("request_logs").insert({
      account_id: params.account.id,
      account_label: params.account.label,
      action: params.action,
      step: params.step,
      success: params.success,
      http_status: params.httpStatus,
      response_body: (params.body ?? "").slice(0, MAX_BODY),
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

/** Call the attendance tap endpoint. Returns the raw outcome (no throw on HTTP errors). */
async function tap(account: Account, token: string): Promise<StepResult> {
  const res = await fetch(`${API_BASE}${TAP_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ssid: account.ssid,
      mac_address: account.mac_address,
      device_id: account.device_id,
      location: {
        latitude: account.latitude,
        longitude: account.longitude,
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

/**
 * Full flow for one account: login fresh -> tap -> persist result + logs.
 *
 * The attendance tap endpoint is a toggle — the SAME request both clocks in and
 * clocks out (the server decides based on current state). `action` is therefore
 * only our intent/label, recorded for history and UI. Never throws; always
 * returns a ClockOutResult so batch callers can keep going. Every login/tap
 * HTTP response is recorded raw in request_logs.
 */
export async function tapAttendance(
  account: Account,
  action: TapAction
): Promise<ClockOutResult> {
  let status: "success" | "error" = "success";
  let message = "";
  let bearer: string | null = null;

  // ── Step 1: login ──
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
    } else {
      bearer = l.token ?? null;
    }
  } catch (err) {
    status = "error";
    message = err instanceof Error ? err.message : String(err);
    await logRequest({
      account,
      action,
      step: "login",
      success: false,
      httpStatus: null,
      body: message,
    });
  }

  // ── Step 2: tap (only if we got a token) ──
  if (status === "success" && bearer) {
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

  // Persist the outcome on the account row.
  await supabaseAdmin
    .from("accounts")
    .update({
      last_bearer: bearer,
      last_status: status,
      last_message: message,
      last_action: action,
      last_clock_out_at: new Date().toISOString(),
    })
    .eq("id", account.id);

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

/** Clock out one account (login fresh -> tap). */
export const clockOutAccount = (account: Account) =>
  tapAttendance(account, "out");

/** Clock in one account (login fresh -> tap). */
export const clockInAccount = (account: Account) =>
  tapAttendance(account, "in");
