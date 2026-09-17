import type { ReactNode } from "react";
import FinanceDashboardBridge from "./finance-bridge";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FinanceDashboardBridge />
      {children}
    </>
  );
}
