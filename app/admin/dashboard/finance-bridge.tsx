"use client";

import { useEffect } from "react";

export default function FinanceDashboardBridge() {
  useEffect(() => {
    const injectFinanceAndRefunds = () => {
      const navigation = document.querySelector(".navigation");
      if (navigation) {
        if (!navigation.querySelector('[data-admin-finance="true"]')) {
          const financeButton = document.createElement("button");
          financeButton.type = "button";
          financeButton.className = "navItem";
          financeButton.setAttribute("data-admin-finance", "true");
          financeButton.innerHTML = '<span class="navIcon">₹</span><span>Finance</span>';
          navigation.appendChild(financeButton);
        }

        if (!navigation.querySelector('[data-admin-refunds="true"]')) {
          const refundsButton = document.createElement("button");
          refundsButton.type = "button";
          refundsButton.className = "navItem";
          refundsButton.setAttribute("data-admin-refunds", "true");
          refundsButton.innerHTML = '<span class="navIcon">↩</span><span>Refunds</span>';
          navigation.appendChild(refundsButton);
        }
      }

      const quickGrid = document.querySelector(".quickGrid");
      if (quickGrid && !quickGrid.querySelector('[data-admin-finance-quick="true"]')) {
        const financeQuick = document.createElement("button");
        financeQuick.type = "button";
        financeQuick.className = "quickAction";
        financeQuick.setAttribute("data-admin-finance-quick", "true");
        financeQuick.innerHTML = '<div class="quickIcon">₹</div><strong>Finance</strong><span>Gross, refunds & net collections</span>';
        quickGrid.appendChild(financeQuick);
      }
    };

    const handleNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const financeButton = target.closest('[data-admin-finance="true"]');
      if (financeButton) {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign("/admin/finance");
        return;
      }

      const refundsButton = target.closest('[data-admin-refunds="true"]');
      if (refundsButton) {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign("/admin/refunds");
        return;
      }

      const navigationButton = target.closest(".navigation button") as HTMLElement | null;
      if (!navigationButton) return;

      const label = navigationButton.textContent?.trim().toLowerCase();
      if (label === "payments") {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign("/admin/payments");
      }
    };

    document.addEventListener("click", handleNavigation, true);

    const observer = new MutationObserver(injectFinanceAndRefunds);
    observer.observe(document.body, { childList: true, subtree: true });
    injectFinanceAndRefunds();

    return () => {
      document.removeEventListener("click", handleNavigation, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
