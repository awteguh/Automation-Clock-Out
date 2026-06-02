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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = React.useState<Account | null>(null);

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
    const verb = action === "in" ? "Absen masuk" : "Absen pulang";
    const path = action === "in" ? "clock-in" : "clock-out";
    setBusyId(account.id);
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
      setBusyId(null);
      await load();
      onAfterTap?.();
    }
  }

  async function loginOne(account: Account) {
    setBusyId(account.id);
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
      setBusyId(null);
      await load();
      onAfterTap?.();
    }
  }

  async function tapAll(action: TapAction) {
    const verb = action === "in" ? "Absen masuk" : "Absen pulang";
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

  return (
    <div className="space-y-10">
      <div className="space-y-8">
        <div className="max-w-3xl space-y-5">
          <p className="mono-label">Kontrol Absensi</p>
          <h1 className="font-display text-5xl font-normal leading-[1.02] tracking-[-0.03em] text-foreground sm:text-6xl">
            Otomasi Absensi
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Kelola akun dan catat kehadiran hanya dengan satu klik.
          </p>
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
            Absen Pulang Semua ({activeCount})
          </Button>
          <Button
            variant="secondary"
            onClick={() => tapAll("in")}
            disabled={busyAll !== null || activeCount === 0}
          >
            {busyAll === "in" ? <Loader2 className="animate-spin" /> : <LogIn />}
            Absen Masuk Semua ({activeCount})
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

      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-4 space-y-0">
          <CardTitle>Akun</CardTitle>
          <CardDescription className="mono-label pb-1">
            {accounts.length} total · {activeCount} aktif
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>ID Karyawan</TableHead>
                <TableHead>Jadwal</TableHead>
                <TableHead>Status terakhir</TableHead>
                <TableHead>Aktivitas terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Memuat…
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Belum ada akun. Klik “Tambah Akun” untuk memulai.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {account.label}
                        {!account.is_active && (
                          <Badge variant="secondary">nonaktif</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{account.employee_id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
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
                    </TableCell>
                    <TableCell>
                      <StatusBadge account={account} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.last_action && (
                        <span className="mr-1 font-medium uppercase">
                          {account.last_action}
                        </span>
                      )}
                      {formatTime(account.last_clock_out_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => tapOne(account, "in")}
                          disabled={busyId === account.id || busyAll !== null}
                        >
                          {busyId === account.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <LogIn />
                          )}
                          Masuk
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => tapOne(account, "out")}
                          disabled={busyId === account.id || busyAll !== null}
                        >
                          {busyId === account.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <LogOut />
                          )}
                          Pulang
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loginOne(account)}
                          disabled={busyId === account.id || busyAll !== null}
                          title="Perbarui Token"
                        >
                          {busyId === account.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                          <span className="sr-only">Login</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openEdit(account)}
                          title="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setAccountToDelete(account)}
                          title="Hapus"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AccountFormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        onSubmit={handleSubmit}
      />

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
