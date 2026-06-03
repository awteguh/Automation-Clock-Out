export type TapAction = "in" | "out";

export interface Account {
  id: string;
  label: string;
  employee_id: string;
  password: string;
  ssid: string;
  mac_address: string;
  device_id: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  scheduled_time: string | null; // clock-out 'HH:MM'
  schedule_enabled: boolean;
  last_scheduled_run_date: string | null; // 'YYYY-MM-DD'
  scheduled_clock_in_time: string | null; // clock-in 'HH:MM'
  clock_in_enabled: boolean;
  last_clock_in_run_date: string | null; // 'YYYY-MM-DD'
  mood: string | null; // mood key sent with each tap, e.g. 'moodHappy'
  last_bearer: string | null;
  bearer_expires_at: string | null; // ISO timestamp: last login + 72h
  last_status: "success" | "error" | null;
  last_message: string | null;
  last_action: TapAction | null;
  last_clock_out_at: string | null; // timestamp of last tap (in or out)
  created_at: string;
  updated_at: string;
}

// Fields the user can create/edit from the dashboard form.
export interface AccountInput {
  label: string;
  employee_id: string;
  password: string;
  ssid: string;
  mac_address: string;
  device_id: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  scheduled_time: string | null; // clock-out 'HH:MM' or null
  schedule_enabled: boolean;
  scheduled_clock_in_time: string | null; // clock-in 'HH:MM' or null
  clock_in_enabled: boolean;
  mood: string; // mood key sent with each tap
}

export interface ClockOutLog {
  id: string;
  account_id: string;
  status: "success" | "error";
  action: TapAction;
  message: string | null;
  created_at: string;
}

// One raw HTTP login/tap response captured by the logger.
export interface RequestLog {
  id: string;
  account_id: string | null;
  account_label: string | null;
  action: TapAction | null;
  step: "login" | "tap" | "mood";
  success: boolean;
  http_status: number | null;
  response_body: string | null;
  created_at: string;
}

// Result returned to the dashboard after a clock-out attempt.
export interface ClockOutResult {
  account_id: string;
  label: string;
  action: TapAction;
  status: "success" | "error";
  message: string;
}
