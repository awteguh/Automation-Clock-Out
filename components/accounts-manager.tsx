"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  LogOut,
  LogIn,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  KeyRound,
  MoreVertical,
  Bot,
  Eye,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccountFormSheet } from "@/components/account-form-sheet";
import type {
  Account,
  AccountInput,
  ClockOutResult,
  TapAction,
} from "@/lib/types";

function StatusBadge({ account }: { account: Account }) {
  if (!account.last_status)
    return <Badge variant="outline">Belum pernah</Badge>;
  if (account.last_status === "success")
    return <Badge variant="success">Berhasil</Badge>;
  return <Badge variant="destructive">Gagal</Badge>;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

/** One labelled row inside the detail sheet. */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 border-b border-border pb-4 last:border-0">
      <p className="mono-label">{label}</p>
      <div>{children}</div>
    </div>
  );
}

// Token lifetime — must match TOKEN_TTL_HOURS in lib/clockout.ts.
const TOKEN_TTL_MS = 72 * 3600 * 1000;

/** Shows token expiry: time remaining, valid-until, and the implied last login. */
function TokenStatus({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return (
      <span className="text-sm text-muted-foreground">
        Belum ada token — gunakan “Perbarui Token”.
      </span>
    );
  }
  const exp = new Date(expiresAt).getTime();
  const ms = exp - Date.now();
  const expired = ms <= 0;
  const soon = !expired && ms < 12 * 3600 * 1000;

  const totalMin = Math.abs(Math.round(ms / 60000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const rel = `${days > 0 ? `${days} hari ` : ""}${hours} jam`;

  const tone = expired
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : soon
      ? "border-coral-soft bg-coral/10 text-foreground"
      : "border-green/20 bg-wash-green text-green";
  const dot = expired ? "bg-destructive" : soon ? "bg-coral" : "bg-green";

  const loginAt = new Date(exp - TOKEN_TTL_MS);

  return (
    <div className="space-y-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${tone}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {expired ? `Kadaluarsa ${rel} lalu` : `${rel} lagi`}
      </span>
      <p className="text-sm text-muted-foreground">
        Berlaku sampai {new Date(expiresAt).toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">
        Login terakhir {loginAt.toLocaleString()}
      </p>
    </div>
  );
}

/**
 * Battery-style token gauge. Full & green when freshly issued, draining toward
 * empty + red as it nears the 72h expiry. Capacity = remaining / 72h.
 */
function TokenBattery({ expiresAt }: { expiresAt: string | null }) {
  // Shared battery shell so the empty/no-token state looks identical.
  const shell = (fill: React.ReactNode, nub = "bg-foreground/40") => (
    <span className="flex items-center">
      <span className="relative flex h-6 w-12 items-center rounded-[4px] border-2 border-foreground/40 p-[2px]">
        {fill}
      </span>
      <span className={`h-3 w-1 rounded-r-sm ${nub}`} />
    </span>
  );

  if (!expiresAt) {
    return (
      <span
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground"
        title="Belum ada token"
      >
        {shell(null)}
        Tanpa token
      </span>
    );
  }

  const exp = new Date(expiresAt).getTime();
  const ms = exp - Date.now();
  const expired = ms <= 0;
  const ratio = Math.max(0, Math.min(1, ms / TOKEN_TTL_MS));
  const pct = Math.round(ratio * 100);

  // green (sehat) → coral (<50%) → merah (<20% / habis)
  const critical = expired || ratio < 0.2;
  const fillColor = critical ? "bg-destructive" : ratio < 0.5 ? "bg-coral" : "bg-green";
  const textTone = critical ? "text-destructive" : "text-muted-foreground";

  const totalMin = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const label = expired ? "Habis" : days > 0 ? `${days} hari` : `${hours} jam`;

  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] ${textTone}`}
      title={`Token berlaku sampai ${new Date(expiresAt).toLocaleString()}`}
    >
      {shell(
        <span
          className={`h-full rounded-[2px] transition-all ${fillColor}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />,
        critical ? "bg-destructive" : "bg-foreground/30"
      )}
      {label}
    </span>
  );
}

/** Today's date as 'YYYY-MM-DD' in WIB — matches the scheduler's run-date guard. */
function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Shows when the cron last auto-ran each action for an account. The values are
 * the daily run-date guards (`last_clock_in_run_date` / `last_scheduled_run_date`),
 * so they are dates, not timestamps. "hari ini" means the guard is active and the
 * scheduler will skip that action until tomorrow.
 */
function AutoRunCell({ account }: { account: Account }) {
  const today = todayInJakarta();
  const row = (label: string, date: string | null) => (
    <div className="flex items-center gap-2">
      <span className="w-8 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {date ? (
        <span className="text-sm">
          {date}
          {date === today && (
            <span className="ml-1.5 rounded-xs bg-wash-green px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-green">
              hari ini
            </span>
          )}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-1">
      {row("IN", account.last_clock_in_run_date)}
      {row("OUT", account.last_scheduled_run_date)}
    </div>
  );
}

function ScheduleBadge({
  label,
  time,
  enabled,
}: {
  label: string;
  time: string | null;
  enabled: boolean;
}) {
  if (!time) {
    return (
      <span className="text-xs text-muted-foreground">{label} —</span>
    );
  }
  return (
    <Badge variant={enabled ? "default" : "outline"} className="w-fit">
      {label} {time}
      {!enabled && " (mati)"}
    </Badge>
  );
}

export function AccountsManager({
  onAfterTap,
}: {
  onAfterTap?: () => void;
}) {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyAll, setBusyAll] = React.useState<TapAction | null>(null);
  // Track WHICH account and WHICH action is running, so only the clicked
  // button spins instead of every button in the row.
  const [busy, setBusy] = React.useState<{
    id: string;
    kind: TapAction | "login";
  } | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = React.useState<Account | null>(null);
  const [detailAccount, setDetailAccount] = React.useState<Account | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat akun");
      setAccounts(json.accounts ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setDialogOpen(true);
  }

  async function handleSubmit(values: AccountInput) {
    const isEdit = Boolean(editing);
    const url = isEdit ? `/api/accounts/${editing!.id}` : "/api/accounts";
    const method = isEdit ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      toast.success(isEdit ? "Akun diperbarui" : "Akun ditambahkan");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  async function handleDelete(account: Account) {
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus");
      toast.success("Akun dihapus");
      setAccountToDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  async function tapOne(account: Account, action: TapAction) {
    const verb = action === "in" ? "Masuk" : "Pulang";
    const path = action === "in" ? "clock-in" : "clock-out";
    setBusy({ id: account.id, kind: action });
    try {
      const res = await fetch(`/api/accounts/${account.id}/${path}`, {
        method: "POST",
      });
      const json = await res.json();
      const result = json.result as ClockOutResult | undefined;
      if (result?.status === "success") {
        toast.success(`${account.label} — ${verb}: ${result.message}`);
      } else {
        toast.error(
          `${account.label} — ${verb}: ${result?.message || json.error || "Gagal"}`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Permintaan gagal");
    } finally {
      setBusy(null);
      await load();
      onAfterTap?.();
    }
  }

  async function loginOne(account: Account) {
    setBusy({ id: account.id, kind: "login" });
    try {
      const res = await fetch(`/api/accounts/${account.id}/login`, {
        method: "POST",
      });
      const json = await res.json();
      const result = json.result as { ok: boolean; message: string } | undefined;
      if (result?.ok) {
        toast.success(`${account.label} — Login: ${result.message}`);
      } else {
        toast.error(
          `${account.label} — Login: ${result?.message || json.error || "Gagal"}`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Permintaan gagal");
    } finally {
      setBusy(null);
      await load();
      onAfterTap?.();
    }
  }

  async function tapAll(action: TapAction) {
    const verb = action === "in" ? "Masuk" : "Pulang";
    const path = action === "in" ? "clock-in-all" : "clock-out-all";
    setBusyAll(action);
    try {
      const res = await fetch(`/api/${path}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      const { summary } = json as {
        summary: { total: number; success: number; failed: number };
      };
      if (summary.failed === 0) {
        toast.success(`${verb} ${summary.success}/${summary.total} akun`);
      } else {
        toast.warning(
          `Selesai: ${summary.success} berhasil, ${summary.failed} gagal (dari ${summary.total})`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Permintaan gagal");
    } finally {
      setBusyAll(null);
      await load();
      onAfterTap?.();
    }
  }

  const activeCount = accounts.filter((a) => a.is_active).length;
  // The agent is "on duty" when at least one active account has a schedule it
  // can run autonomously.
  const agentActive = accounts.some(
    (a) => a.is_active && (a.schedule_enabled || a.clock_in_enabled)
  );

  return (
    <div className="space-y-10">
      <div className="space-y-8">
        <div className="flex items-start gap-5">
          {/* Robot agent — runs the schedule on its own. */}
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 animate-float items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bot className="h-8 w-8" strokeWidth={1.5} />
            </div>
            {/* Live "online" beacon. */}
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4">
              {agentActive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-50" />
              )}
              <span
                className={`relative inline-flex h-4 w-4 rounded-full border-2 border-background ${
                  agentActive ? "bg-green" : "bg-muted-foreground/40"
                }`}
              />
            </span>
          </div>

          <div className="max-w-3xl space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="mono-label">Kontrol Agen</p>
              {agentActive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green/20 bg-wash-green px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-green">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green" />
                  </span>
                  Agent aktif · memantau jadwal
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  Agent siaga
                </span>
              )}
            </div>
            <h1 className="font-display text-5xl font-normal leading-[1.02] tracking-[-0.03em] text-foreground sm:text-6xl">
              Otomasi Terjadwal
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Agen yang menjalankan tugas sesuai jadwal — berjalan sendiri,
              kamu cukup mengawasi.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => tapAll("out")}
            disabled={busyAll !== null || activeCount === 0}
          >
            {busyAll === "out" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <LogOut />
            )}
            Pulang Semua ({activeCount})
          </Button>
          <Button
            variant="secondary"
            onClick={() => tapAll("in")}
            disabled={busyAll !== null || activeCount === 0}
          >
            {busyAll === "in" ? <Loader2 className="animate-spin" /> : <LogIn />}
            Masuk Semua ({activeCount})
          </Button>
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <Button variant="outline" onClick={openAdd}>
            <Plus />
            Tambah Akun
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Muat Ulang
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-normal tracking-[-0.01em]">
            Akun
          </h2>
          <p className="mono-label">
            {accounts.length} total · {activeCount} aktif
          </p>
        </div>

        {loading && accounts.length === 0 ? (
          <div className="rounded-sm border border-border py-12 text-center text-sm text-muted-foreground">
            Memuat…
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            Belum ada akun. Klik “Tambah Akun” untuk memulai.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => {
              const agentOn =
                account.is_active &&
                (account.schedule_enabled || account.clock_in_enabled);
              return (
              <div
                key={account.id}
                className="flex flex-col overflow-hidden rounded-sm border border-border bg-card transition-colors hover:border-foreground/25"
              >
                {/* Ringkasan ala konsol agen — klik untuk membuka detail. */}
                <button
                  type="button"
                  onClick={() => setDetailAccount(account)}
                  className="group flex items-start gap-3 p-4 text-left transition-colors hover:bg-stone/40"
                >
                  {/* Avatar robot + beacon status. */}
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <Bot className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                      {agentOn && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-50" />
                      )}
                      <span
                        className={`relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-card ${
                          agentOn ? "bg-green" : "bg-muted-foreground/40"
                        }`}
                      />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-lg tracking-[-0.01em]">
                        {account.label}
                      </span>
                      {!account.is_active && (
                        <Badge variant="secondary">nonaktif</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          agentOn ? "bg-green" : "bg-muted-foreground/50"
                        }`}
                      />
                      {agentOn ? "Agent online" : "Agent siaga"}
                      <span className="text-muted-foreground/40">·</span>
                      ID {account.employee_id}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <ScheduleBadge
                        label="IN"
                        time={account.scheduled_clock_in_time}
                        enabled={account.clock_in_enabled}
                      />
                      <ScheduleBadge
                        label="OUT"
                        time={account.scheduled_time}
                        enabled={account.schedule_enabled}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge account={account} />
                    <TokenBattery expiresAt={account.bearer_expires_at} />
                    <span className="mono-label inline-flex items-center gap-0.5 text-muted-foreground/70 transition-colors group-hover:text-foreground">
                      Detail
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>

                {/* Aksi cepat. */}
                <div className="flex items-center gap-2 border-t border-border p-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => tapOne(account, "in")}
                    disabled={busy?.id === account.id || busyAll !== null}
                  >
                    {busy?.id === account.id && busy.kind === "in" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <LogIn />
                    )}
                    Masuk
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => tapOne(account, "out")}
                    disabled={busy?.id === account.id || busyAll !== null}
                  >
                    {busy?.id === account.id && busy.kind === "out" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <LogOut />
                    )}
                    Pulang
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={busy?.id === account.id || busyAll !== null}
                        title="Aksi lain"
                      >
                        {busy?.id === account.id && busy.kind === "login" ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <MoreVertical />
                        )}
                        <span className="sr-only">Aksi lain</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetailAccount(account)}>
                        <Eye />
                        Lihat detail
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => loginOne(account)}>
                        <KeyRound />
                        Perbarui Token
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(account)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setAccountToDelete(account)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <AccountFormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        onSubmit={handleSubmit}
      />

      <Sheet
        open={!!detailAccount}
        onOpenChange={(open) => !open && setDetailAccount(null)}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {detailAccount && (
            <>
              <SheetHeader>
                <div className="mb-2 flex items-center gap-3">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Bot className="h-6 w-6" strokeWidth={1.5} />
                    <span
                      className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background ${
                        detailAccount.is_active &&
                        (detailAccount.schedule_enabled ||
                          detailAccount.clock_in_enabled)
                          ? "bg-green"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                  </div>
                  <div>
                    <SheetTitle>{detailAccount.label}</SheetTitle>
                    <SheetDescription>Detail akun &amp; status agen</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4 py-6">
                <DetailRow label="ID Karyawan">
                  <span className="font-mono text-sm">
                    {detailAccount.employee_id}
                  </span>
                </DetailRow>
                <DetailRow label="Status">
                  <div className="flex items-center gap-2">
                    <StatusBadge account={detailAccount} />
                    {!detailAccount.is_active && (
                      <Badge variant="secondary">nonaktif</Badge>
                    )}
                  </div>
                </DetailRow>
                {detailAccount.last_message && (
                  <DetailRow label="Pesan terakhir">
                    <p className="text-sm text-muted-foreground">
                      {detailAccount.last_message}
                    </p>
                  </DetailRow>
                )}
                <DetailRow label="Jadwal">
                  <div className="flex flex-wrap gap-1.5">
                    <ScheduleBadge
                      label="IN"
                      time={detailAccount.scheduled_clock_in_time}
                      enabled={detailAccount.clock_in_enabled}
                    />
                    <ScheduleBadge
                      label="OUT"
                      time={detailAccount.scheduled_time}
                      enabled={detailAccount.schedule_enabled}
                    />
                  </div>
                </DetailRow>
                <DetailRow label="Aktivitas terakhir">
                  <span className="text-sm">
                    {detailAccount.last_action && (
                      <span className="mr-1 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        {detailAccount.last_action}
                      </span>
                    )}
                    {formatTime(detailAccount.last_clock_out_at)}
                  </span>
                </DetailRow>
                <DetailRow label="Token">
                  <TokenStatus expiresAt={detailAccount.bearer_expires_at} />
                </DetailRow>
                <DetailRow label="Terakhir auto-run">
                  <AutoRunCell account={detailAccount} />
                </DetailRow>
              </div>

              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setDetailAccount(null)}
                >
                  Tutup
                </Button>
                <Button
                  onClick={() => {
                    const a = detailAccount;
                    setDetailAccount(null);
                    openEdit(a);
                  }}
                >
                  <Pencil />
                  Edit
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Yakin ingin menghapus?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Akun
              "{accountToDelete?.label}" akan dihapus permanen dari database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (accountToDelete) {
                handleDelete(accountToDelete);
              }
            }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
