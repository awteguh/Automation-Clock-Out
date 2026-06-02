import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clockOutAccount } from "@/lib/clockout";
import type { Account, ClockOutResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/clock-out-all — clock out every active account, sequentially.
 *
 * This is also the route a scheduler (e.g. Supabase pg_cron) can call later
 * to automate the daily run. Keeps going even if individual accounts fail.
 */
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
    results.push(await clockOutAccount(account));
  }

  const summary = {
    total: results.length,
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ summary, results });
}
