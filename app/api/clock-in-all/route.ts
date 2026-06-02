import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clockInAccount } from "@/lib/clockout";
import type { Account, ClockOutResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/clock-in-all — clock in every active account, sequentially.
export async function POST() {
  const { data: accounts, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .returns<Account[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: ClockOutResult[] = [];
  for (const account of accounts ?? []) {
    results.push(await clockInAccount(account));
  }

  const summary = {
    total: results.length,
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ summary, results });
}
