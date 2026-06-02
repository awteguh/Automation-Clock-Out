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
import { AccountFormDialog } from "@/components/account-form-dialog";
import type {
  Account,
  AccountInput,
  ClockOutResult,
  TapAction,
} from "@/lib/types";

function StatusBadge({ account }: { account: Account }) {
  if (!account.last_status) return <Badge variant="outline">Never run</Badge>;
  if (account.last_status === "success")
    return <Badge variant="success">Success</Badge>;
  return <Badge variant="destructive">Error</Badge>;
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
      {!enabled && " (off)"}
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

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load accounts");
      setAccounts(json.accounts ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
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
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast.success(isEdit ? "Account updated" : "Account added");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete(account: Account) {
    if (!confirm(`Delete account "${account.label}"?`)) return;
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      toast.success("Account deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function tapOne(account: Account, action: TapAction) {
    const verb = action === "in" ? "Clock-in" : "Clock-out";
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
          `${account.label} — ${verb}: ${result?.message || json.error || "Failed"}`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusyId(null);
      await load();
      onAfterTap?.();
    }
  }

  async function tapAll(action: TapAction) {
    const verb = action === "in" ? "Clocked in" : "Clocked out";
    const path = action === "in" ? "clock-in-all" : "clock-out-all";
    setBusyAll(action);
    try {
      const res = await fetch(`/api/${path}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      const { summary } = json as {
        summary: { total: number; success: number; failed: number };
      };
      if (summary.failed === 0) {
        toast.success(`${verb} ${summary.success}/${summary.total} accounts`);
      } else {
        toast.warning(
          `Done: ${summary.success} ok, ${summary.failed} failed (of ${summary.total})`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusyAll(null);
      await load();
      onAfterTap?.();
    }
  }

  const activeCount = accounts.filter((a) => a.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Automation Clock Out
          </h1>
          <p className="text-muted-foreground">
            Manage accounts and clock out attendance in one click.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button variant="outline" onClick={openAdd}>
            <Plus />
            Add account
          </Button>
          <Button
            variant="secondary"
            onClick={() => tapAll("in")}
            disabled={busyAll !== null || activeCount === 0}
          >
            {busyAll === "in" ? <Loader2 className="animate-spin" /> : <LogIn />}
            Clock In All ({activeCount})
          </Button>
          <Button
            onClick={() => tapAll("out")}
            disabled={busyAll !== null || activeCount === 0}
          >
            {busyAll === "out" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <LogOut />
            )}
            Clock Out All ({activeCount})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Accounts</CardTitle>
          <CardDescription>
            {accounts.length} total · {activeCount} active
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last status</TableHead>
                <TableHead>Last tap</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No accounts yet. Click “Add account” to get started.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {account.label}
                        {!account.is_active && (
                          <Badge variant="secondary">inactive</Badge>
                        )}
                      </div>
                      {account.last_message && (
                        <div className="text-xs text-muted-foreground max-w-xs truncate">
                          {account.last_message}
                        </div>
                      )}
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
                          Clock In
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
                          Clock Out
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
                          onClick={() => handleDelete(account)}
                          title="Delete"
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

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
