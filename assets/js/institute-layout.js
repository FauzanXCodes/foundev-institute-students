
"use strict";

/**
 * Foundev Institution Workspace
 * Shared navigation and account-menu interactions.
 */

document.addEventListener("DOMContentLoaded", initInstituteLayout);

function initInstituteLayout() {
    const body = document.body;
    const sidebar = document.getElementById("institute-sidebar");
    const toggleButton = document.getElementById("sidebar-toggle");
    const overlay = document.getElementById("sidebar-overlay");
    const accountButton = document.getElementById("account-menu-button");
    const accountMenu = document.getElementById("account-menu");

    if (!sidebar) {
        return;
    }

    const mobileQuery = window.matchMedia("(max-width: 900px)");

    function isMobile() {
        return mobileQuery.matches;
    }

    function openSidebar() {
        if (!isMobile()) return;

        body.classList.add("sidebar-open");

        if (toggleButton) {
            toggleButton.setAttribute("aria-expanded", "true");
            toggleButton.setAttribute("aria-label", "Close navigation");
        }

        if (overlay) {
            overlay.hidden = false;
            overlay.setAttribute("tabindex", "0");
        }

        body.style.overflow = "hidden";
    }

    function closeSidebar(returnFocus = false) {
        body.classList.remove("sidebar-open");

        if (toggleButton) {
            toggleButton.setAttribute("aria-expanded", "false");
            toggleButton.setAttribute("aria-label", "Open navigation");
        }

        if (overlay) {
            overlay.hidden = true;
            overlay.setAttribute("tabindex", "-1");
        }

        body.style.overflow = "";

        if (returnFocus && toggleButton && isMobile()) {
            toggleButton.focus();
        }
    }

    if (toggleButton) {
        toggleButton.addEventListener("click", () => {
            const isOpen = body.classList.contains("sidebar-open");

            if (isOpen) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (overlay) {
        overlay.addEventListener("click", () => closeSidebar(true));
    }

    // Close mobile navigation after selecting a destination.
    sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            if (isMobile()) {
                closeSidebar();
            }
        });
    });

    // Close the mobile sidebar with Escape.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (body.classList.contains("sidebar-open")) {
                closeSidebar(true);
            }

            closeAccountMenu();
        }
    });

    // Reset mobile-only state when returning to desktop.
    function handleBreakpointChange() {
        if (!isMobile()) {
            closeSidebar();
        }
    }

    if (typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", handleBreakpointChange);
    } else {
        mobileQuery.addListener(handleBreakpointChange);
    }

    // Account dropdown.
    function openAccountMenu() {
        if (!accountMenu || !accountButton) return;

        accountMenu.hidden = false;
        accountButton.setAttribute("aria-expanded", "true");
    }

    function closeAccountMenu(returnFocus = false) {
        if (!accountMenu || !accountButton) return;

        accountMenu.hidden = true;
        accountButton.setAttribute("aria-expanded", "false");

        if (returnFocus) {
            accountButton.focus();
        }
    }

    if (accountButton && accountMenu) {
        accountButton.addEventListener("click", (event) => {
            event.stopPropagation();

            if (accountMenu.hidden) {
                openAccountMenu();
            } else {
                closeAccountMenu();
            }
        });

        accountMenu.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        document.addEventListener("click", (event) => {
            if (
                !accountMenu.hidden &&
                !accountMenu.contains(event.target) &&
                !accountButton.contains(event.target)
            ) {
                closeAccountMenu();
            }
        });
    }

    // Keep the displayed year current.
    const yearElement = document.getElementById("current-year");

    if (yearElement) {
        yearElement.textContent = String(new Date().getFullYear());
    }

    // Display the current local date.
    const dateElement = document.getElementById("dashboard-date");
    const welcomeDateElement = document.getElementById("welcome-date");

    const now = new Date();

    if (dateElement) {
        dateElement.textContent = new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(now);
    }

    if (welcomeDateElement) {
        welcomeDateElement.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric"
        }).format(now);
    }

    // Update the greeting to match the user's local time.
    const welcomeTitle = document.getElementById("welcome-title");

    if (welcomeTitle) {
        const hour = now.getHours();

        let greeting = "Good to have you here";

        if (hour >= 5 && hour < 12) {
            greeting = "Good morning";
        } else if (hour >= 12 && hour < 17) {
            greeting = "Good afternoon";
        } else if (hour >= 17 && hour < 22) {
            greeting = "Good evening";
        }

        welcomeTitle.replaceChildren();

        const text = document.createTextNode(greeting);
        const period = document.createElement("span");

        period.className = "welcome-period";
        period.textContent = ".";

        welcomeTitle.append(text, period);
    }

    // Initial accessibility state.
    closeSidebar();
}
