"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";

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
import type { RequestLog } from "@/lib/types";

function timeOf(iso: string) {
  return new Date(iso).toLocaleString();
}

export interface RequestLogsHandle {
  refresh: () => void;
}

/**
 * Separate section showing the raw login/tap HTTP responses captured by the
 * server. Exposes a `refresh()` via ref so the accounts panel can refresh it
 * right after a clock-in/out.
 */
export const RequestLogs = React.forwardRef<RequestLogsHandle>(
  function RequestLogs(_props, ref) {
    const [logs, setLogs] = React.useState<RequestLog[]>([]);
    const [loading, setLoading] = React.useState(true);

    const load = React.useCallback(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/logs?limit=100", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat log");
        setLogs(json.logs ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat log");
      } finally {
        setLoading(false);
      }
    }, []);

    React.useEffect(() => {
      load();
    }, [load]);

    React.useImperativeHandle(ref, () => ({ refresh: load }), [load]);

    async function clearLogs() {
      if (!confirm("Bersihkan semua log permintaan?")) return;
      try {
        const res = await fetch("/api/logs", { method: "DELETE" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal membersihkan");
        toast.success("Log dibersihkan");
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal membersihkan");
      }
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="mono-label">Diagnostik</p>
            <CardTitle>Log Permintaan</CardTitle>
            <CardDescription>
              Respons mentah login &amp; tap ({logs.length} ditampilkan, 100 terbaru)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Muat Ulang
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              <Trash2 />
              Bersihkan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Waktu</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Langkah</TableHead>
                <TableHead>Hasil</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Respons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    {loading ? "Memuat…" : "Belum ada log."}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {timeOf(log.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.account_label ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs uppercase tracking-[0.08em]">
                      {log.action ?? "—"}
                    </TableCell>
                    <TableCell>{log.step}</TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="destructive">Gagal</Badge>
                      )}
                    </TableCell>
                    <TableCell>{log.http_status ?? "—"}</TableCell>
                    <TableCell className="max-w-md">
                      <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground max-h-24 overflow-auto">
                        {log.response_body || "—"}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }
);
