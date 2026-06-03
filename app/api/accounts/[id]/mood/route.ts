import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMoodManual } from "@/lib/clockout";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// POST /api/accounts/:id/mood — manually send the account's mood (no tap)
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const { data: account, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single<Account>();

  if (error || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const result = await sendMoodManual(account);
  const httpStatus = result.ok ? 200 : 502;
  return NextResponse.json({ result }, { status: httpStatus });
}
