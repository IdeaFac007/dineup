"use client";

import { useEffect } from "react";

export default function FinanceDashboardBridge() {
  useEffect(() => {
    const injectFinance = () => {
      const navigation = document.querySelector(".navigation");
      if (navigation && !navigation.querySelector('[data-admin-finance="true"]')) {
        const financeButton = document.createElement("button");
        financeButton.type = "button";
        financeButton.className = "navItem";
        financeButton.setAttribute("data-admin-finance", "true");
        financeButton.innerHTML = '<span class="navIcon">₹</span><span>Finance</span>';
        financeButton.addEventListener("click", () => {
          window.location.href = "/admin/finance";
        });
        navigation.appendChild(financeButton);
      }

      const quickGrid = document.querySelector(".quickGrid");
      if (quickGrid && !quickGrid.querySelector('[data-admin-finance-quick="true"]')) {
        const financeQuick = document.createElement("button");
        financeQuick.type = "button";
        financeQuick.className = "quickAction";
        financeQuick.setAttribute("data-admin-finance-quick", "true");
        financeQuick.innerHTML = '<div class="quickIcon">₹</div><strong>Finance</strong><span>Gross, refunds & net collections</span>';
        financeQuick.addEventListener("click", () => {
          window.location.href = "/admin/finance";
        });
        quickGrid.appendChild(financeQuick);
      }
    };

    const observer = new MutationObserver(injectFinance);
    observer.observe(document.body, { childList: true, subtree: true });
    injectFinance();

    return () => observer.disconnect();
  }, []);

  return null;
}
