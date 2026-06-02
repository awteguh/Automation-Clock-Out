"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account, AccountInput } from "@/lib/types";

const EMPTY: AccountInput = {
  label: "",
  employee_id: "",
  password: "",
  ssid: "LT. 2 Bharata-5G",
  // MAC di-hardcode saat tap (lib/clockout.ts), jadi cukup default di sini.
  mac_address: "C4:B2:5B:CE:DB:CF",
  device_id: "Currently unused",
  latitude: -7.704195315890301,
  longitude: 109.0258285203252,
  is_active: true,
  scheduled_time: "16:00",
  schedule_enabled: false,
  scheduled_clock_in_time: "07:30",
  clock_in_enabled: false,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog is in "edit" mode. */
  account?: Account | null;
  onSubmit: (values: AccountInput) => Promise<void>;
}

export function AccountFormSheet({
  open,
  onOpenChange,
  account,
  onSubmit,
}: Props) {
  const [values, setValues] = React.useState<AccountInput>(EMPTY);
  const [saving, setSaving] = React.useState(false);

  // Reset the form whenever the sheet opens (new vs edit).
  React.useEffect(() => {
    if (!open) return;
    if (account) {
      setValues({
        label: account.label,
        employee_id: account.employee_id,
        password: account.password,
        ssid: account.ssid,
        mac_address: account.mac_address,
        device_id: account.device_id,
        latitude: account.latitude,
        longitude: account.longitude,
        is_active: account.is_active,
        scheduled_time: account.scheduled_time ?? "17:00",
        schedule_enabled: account.schedule_enabled,
        scheduled_clock_in_time: account.scheduled_clock_in_time ?? "08:00",
        clock_in_enabled: account.clock_in_enabled,
      });
    } else {
      setValues(EMPTY);
    }
  }, [open, account]);

  function set<K extends keyof AccountInput>(key: K, value: AccountInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {account ? "Edit Akun" : "Tambah Akun"}
          </SheetTitle>
          <SheetDescription>
            Kredensial dan data tap untuk akun ini. Disimpan di Supabase.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={values.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="mis. Panpan"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="employee_id">ID Karyawan</Label>
              <Input
                id="employee_id"
                value={values.employee_id}
                onChange={(e) => set("employee_id", e.target.value)}
                placeholder="panpan"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>







          <div className="rounded-sm border p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={values.clock_in_enabled}
                onChange={(e) => set("clock_in_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Jalankan "Masuk" otomatis sesuai jadwal
            </label>
            <div className="grid gap-2">
              <Label htmlFor="scheduled_clock_in_time">
                Jam masuk
              </Label>
              <Input
                id="scheduled_clock_in_time"
                type="time"
                value={values.scheduled_clock_in_time ?? ""}
                onChange={(e) =>
                  set("scheduled_clock_in_time", e.target.value)
                }
                disabled={!values.clock_in_enabled}
              />
            </div>
          </div>

          <div className="rounded-sm border p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={values.schedule_enabled}
                onChange={(e) => set("schedule_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Jalankan "Pulang" otomatis sesuai jadwal
            </label>
            <div className="grid gap-2">
              <Label htmlFor="scheduled_time">
                Jam pulang
              </Label>
              <Input
                id="scheduled_time"
                type="time"
                value={values.scheduled_time ?? ""}
                onChange={(e) => set("scheduled_time", e.target.value)}
                disabled={!values.schedule_enabled}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Aktif
          </label>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : account ? "Simpan Perubahan" : "Tambah Akun"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
