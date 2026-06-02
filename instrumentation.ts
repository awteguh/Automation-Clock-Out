// Runs once when the Next.js server process starts.
// We use it to boot the in-process clock-out scheduler (node-cron).
export async function register() {
  // Only in the Node.js runtime (not Edge) — node-cron needs Node timers.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
