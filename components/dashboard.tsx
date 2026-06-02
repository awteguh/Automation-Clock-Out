"use client";

import * as React from "react";
import { AccountsManager } from "@/components/accounts-manager";
import { RequestLogs, type RequestLogsHandle } from "@/components/request-logs";

export function Dashboard() {
  const logsRef = React.useRef<RequestLogsHandle>(null);

  return (
    <div className="space-y-16">
      <AccountsManager onAfterTap={() => logsRef.current?.refresh()} />
      <RequestLogs ref={logsRef} />
    </div>
  );
}
