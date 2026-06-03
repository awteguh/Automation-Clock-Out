import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { AccountInput } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/accounts — list all accounts (newest first)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ accounts: data });
}

function validate(body: Partial<AccountInput>): string | null {
  if (!body.label?.trim()) return "label is required";
  if (!body.employee_id?.trim()) return "employee_id is required";
  if (!body.password?.trim()) return "password is required";
  if (!body.mac_address?.trim()) return "mac_address is required";
  if (typeof body.latitude !== "number" || Number.isNaN(body.latitude))
    return "latitude must be a number";
  if (typeof body.longitude !== "number" || Number.isNaN(body.longitude))
    return "longitude must be a number";
  return null;
}

// POST /api/accounts — create an account
export async function POST(req: Request) {
  let body: Partial<AccountInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const err = validate(body);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const insert = {
    label: body.label!.trim(),
    employee_id: body.employee_id!.trim(),
    password: body.password!,
    ssid: body.ssid?.trim() || "LT. 2 Bharata-5G",
    mac_address: body.mac_address!.trim(),
    device_id: body.device_id?.trim() || "Currently unused",
    latitude: body.latitude!,
    longitude: body.longitude!,
    is_active: body.is_active ?? true,
    scheduled_time: body.scheduled_time?.trim() || null,
    schedule_enabled: body.schedule_enabled ?? false,
    scheduled_clock_in_time: body.scheduled_clock_in_time?.trim() || null,
    clock_in_enabled: body.clock_in_enabled ?? false,
    mood: body.mood?.trim() || "moodNeutral",
  };

  const { data, error } = await supabaseAdmin
    .from("accounts")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data }, { status: 201 });
}
