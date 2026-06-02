"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account, AccountInput } from "@/lib/types";

const EMPTY: AccountInput = {
  label: "",
  employee_id: "",
  password: "",
  ssid: "LT. 2 Bharata-5G",
  mac_address: "",
  device_id: "Currently unused",
  latitude: -7.704195315890301,
  longitude: 109.0258285203252,
  is_active: true,
  scheduled_time: "17:00",
  schedule_enabled: false,
  scheduled_clock_in_time: "08:00",
  clock_in_enabled: false,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog is in "edit" mode. */
  account?: Account | null;
  onSubmit: (values: AccountInput) => Promise<void>;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
}: Props) {
  const [values, setValues] = React.useState<AccountInput>(EMPTY);
  const [saving, setSaving] = React.useState(false);

  // Reset the form whenever the dialog opens (new vs edit).
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit account" : "Add account"}
          </DialogTitle>
          <DialogDescription>
            Credentials and tap payload for this account. Stored in Supabase.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={values.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="e.g. Panpan"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="employee_id">Employee ID</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ssid">SSID</Label>
              <Input
                id="ssid"
                value={values.ssid}
                onChange={(e) => set("ssid", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mac_address">MAC address</Label>
              <Input
                id="mac_address"
                value={values.mac_address}
                onChange={(e) => set("mac_address", e.target.value)}
                placeholder="C4:B2:5B:CE:DB:CF"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device_id">Device ID</Label>
            <Input
              id="device_id"
              value={values.device_id}
              onChange={(e) => set("device_id", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={values.latitude}
                onChange={(e) => set("latitude", parseFloat(e.target.value))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={values.longitude}
                onChange={(e) => set("longitude", parseFloat(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={values.clock_in_enabled}
                onChange={(e) => set("clock_in_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Auto clock-IN on schedule
            </label>
            <div className="grid gap-2">
              <Label htmlFor="scheduled_clock_in_time">
                Clock-in time (24h, server timezone)
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

          <div className="rounded-md border p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={values.schedule_enabled}
                onChange={(e) => set("schedule_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Auto clock-OUT on schedule
            </label>
            <div className="grid gap-2">
              <Label htmlFor="scheduled_time">
                Clock-out time (24h, server timezone)
              </Label>
              <Input
                id="scheduled_time"
                type="time"
                value={values.scheduled_time ?? ""}
                onChange={(e) => set("scheduled_time", e.target.value)}
                disabled={!values.schedule_enabled}
              />
              <p className="text-xs text-muted-foreground">
                The cron runs every minute and taps in/out at the set times
                (timezone CRON_TIMEZONE, default Asia/Jakarta).
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Active (included in “Clock Out All” and scheduled runs)
          </label>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : account ? "Save changes" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
