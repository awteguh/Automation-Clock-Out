import { NextResponse } from "next/server";
import { runDueClockOuts } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron entry point. The in-process scheduler calls runDueClockOuts() directly,
 * but this HTTP route lets an EXTERNAL scheduler trigger the same logic:
 *   - Windows Task Scheduler / curl
 *   - Supabase pg_cron (pg_net) once the app is deployed and reachable
 *   - Vercel Cron
 *
 * Protect it by setting CRON_SECRET in the environment, then send it as either
 *   Authorization: Bearer <secret>   or   x-cron-secret: <secret>
 */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → open (local use)
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runDueClockOuts();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Support both POST (recommended) and GET (some cron services only do GET).
export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
