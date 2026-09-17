import type { ReactNode } from "react";
import FinanceDashboardBridge from "./finance-bridge";
import AuditDashboardBridge from "./audit-bridge";
import AdminActionGuard from "../action-guard";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FinanceDashboardBridge />
      <AuditDashboardBridge />
      <AdminActionGuard />
      {children}
    </>
  );
}
