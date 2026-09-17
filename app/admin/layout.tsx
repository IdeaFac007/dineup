import type { ReactNode } from "react";
import AdminActionGuard from "./action-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminActionGuard />
      {children}
    </>
  );
}
