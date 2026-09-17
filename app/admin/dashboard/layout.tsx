import type { ReactNode } from "react";
import FinanceDashboardBridge from "./finance-bridge";
import AuditDashboardBridge from "./audit-bridge";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FinanceDashboardBridge />
      <AuditDashboardBridge />
      {children}
    </>
  );
}
