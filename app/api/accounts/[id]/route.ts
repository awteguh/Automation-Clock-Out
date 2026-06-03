import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { AccountInput } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/accounts/:id — update an account
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  let body: Partial<AccountInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only allow known, editable fields through.
  const allowed: (keyof AccountInput)[] = [
    "label",
    "employee_id",
    "password",
    "ssid",
    "mac_address",
    "device_id",
    "latitude",
    "longitude",
    "is_active",
    "scheduled_time",
    "schedule_enabled",
    "scheduled_clock_in_time",
    "clock_in_enabled",
    "mood",
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body && body[key] !== undefined) {
      update[key] = body[key];
    }
  }

  // Normalize empty schedule times to null.
  if (update.scheduled_time === "") update.scheduled_time = null;
  if (update.scheduled_clock_in_time === "")
    update.scheduled_clock_in_time = null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("accounts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data });
}

// DELETE /api/accounts/:id — remove an account
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin
    .from("accounts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
