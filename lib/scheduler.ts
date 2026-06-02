import cron, { type ScheduledTask } from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { tapAttendance } from "@/lib/clockout";
import type { Account, ClockOutResult } from "@/lib/types";

// Timezone used to interpret each account's scheduled_time. The sample
// location (Central Java) is WIB → Asia/Jakarta.
const TZ = process.env.CRON_TIMEZONE || "Asia/Jakarta";

// If the server was briefly down at the exact scheduled minute, still run when
// it comes back, as long as we're within this many minutes of the target.
const GRACE_MIN = Number(process.env.CRON_GRACE_MINUTES ?? "5");

/** Current date ("YYYY-MM-DD") and minutes-since-midnight in TZ. */
function nowInTz(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // some runtimes emit 24 for midnight
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(hour) * 60 + Number(get("minute"));
  return { date, minutes };
}

/** Parse "HH:MM" (or "HH:MM:SS") into minutes-since-midnight. */
function parseHHMM(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Prevent overlapping runs (a slow clock-out batch must not collide with the
// next minute's tick).
let running = false;

export interface RunSummary {
  skipped: boolean;
  date?: string;
  due?: number;
  results: ClockOutResult[];
}

/** Is `time` (HH:MM) due now given current minutes, within the grace window? */
function isDue(time: string | null, minutes: number): boolean {
  if (!time) return false;
  const sched = parseHHMM(time);
  if (sched === null) return false;
  return minutes >= sched && minutes - sched <= GRACE_MIN;
}

/**
 * Find every active account whose clock-in or clock-out time is due now (and
 * that hasn't already auto-run that action today) and tap it. Safe to call from
 * both the in-process cron and the HTTP cron endpoint.
 */
export async function runDueClockOuts(): Promise<RunSummary> {
  if (running) return { skipped: true, results: [] };
  running = true;
  try {
    const { date, minutes } = nowInTz();

    const { data, error } = await supabaseAdmin
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .or("schedule_enabled.eq.true,clock_in_enabled.eq.true")
      .returns<Account[]>();

    if (error) throw new Error(error.message);

    const results: ClockOutResult[] = [];

    for (const account of data ?? []) {
      // Clock IN due?
      if (
        account.clock_in_enabled &&
        account.last_clock_in_run_date !== date &&
        isDue(account.scheduled_clock_in_time, minutes)
      ) {
        // Automation: cukup tap dengan token tersimpan, tidak pernah login.
        results.push(await tapAttendance(account, "in", { allowLogin: false }));
        await supabaseAdmin
          .from("accounts")
          .update({ last_clock_in_run_date: date })
          .eq("id", account.id);
      }

      // Clock OUT due?
      if (
        account.schedule_enabled &&
        account.last_scheduled_run_date !== date &&
        isDue(account.scheduled_time, minutes)
      ) {
        // Automation: cukup tap dengan token tersimpan, tidak pernah login.
        results.push(await tapAttendance(account, "out", { allowLogin: false }));
        await supabaseAdmin
          .from("accounts")
          .update({ last_scheduled_run_date: date })
          .eq("id", account.id);
      }
    }

    if (results.length > 0) {
      console.log(
        `[scheduler] ${date} ran ${results.length} tap(s):`,
        results.map((r) => `${r.label}:${r.action}=${r.status}`).join(", ")
      );
    }

    return { skipped: false, date, due: results.length, results };
  } finally {
    running = false;
  }
}

// Single cron task per server process.
let task: ScheduledTask | null = null;

/** Start the in-process scheduler (ticks every minute). Idempotent. */
export function startScheduler() {
  if (task) return;
  if (process.env.SCHEDULER_ENABLED === "false") {
    console.log("[scheduler] disabled via SCHEDULER_ENABLED=false");
    return;
  }
  task = cron.schedule("* * * * *", () => {
    runDueClockOuts().catch((err) =>
      console.error("[scheduler] run failed:", err)
    );
  });
  console.log(`[scheduler] started — tz=${TZ}, grace=${GRACE_MIN}m`);
}
