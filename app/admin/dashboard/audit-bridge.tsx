"use client";

import { useEffect } from "react";

export default function AuditDashboardBridge() {
  useEffect(() => {
    const injectAudit = () => {
      const navigation = document.querySelector(".navigation");
      if (navigation && !navigation.querySelector('[data-admin-audit="true"]')) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "navItem";
        button.setAttribute("data-admin-audit", "true");
        button.innerHTML = '<span class="navIcon">◉</span><span>Audit Log</span>';
        navigation.appendChild(button);
      }
    };

    const handleNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const auditButton = target?.closest('[data-admin-audit="true"]');
      if (!auditButton) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign("/admin/audit");
    };

    document.addEventListener("click", handleNavigation, true);
    const observer = new MutationObserver(injectAudit);
    observer.observe(document.body, { childList: true, subtree: true });
    injectAudit();

    return () => {
      document.removeEventListener("click", handleNavigation, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
