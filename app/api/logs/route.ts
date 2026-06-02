import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/logs?limit=100 — recent raw request/response logs (newest first)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const { data, error } = await supabaseAdmin
    .from("request_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ logs: data });
}

// DELETE /api/logs — clear all request logs
export async function DELETE() {
  const { error } = await supabaseAdmin
    .from("request_logs")
    .delete()
    .not("id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
