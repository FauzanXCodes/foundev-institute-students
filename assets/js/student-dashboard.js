
// =========================================================
// FOUNDEV — STUDENT WORKSPACE
// File: assets/js/student-dashboard.js
// =========================================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initializeSidebar();
    initializeActiveNavigation();
    initializeSearch();
    initializeWelcomeMessage();
    initializeStudentDashboard();
    initializeLogout();
});

// =========================================================
// CONFIGURATION
// Update these URLs to match your actual backend structure.
// =========================================================

const STUDENT_API = {
    // Expected JSON endpoint for student dashboard data.
    dashboard: "../api/student/dashboard.php",

    // Recommended logout endpoint.
    logout: "../api/student/logout.php",

    // Login page in the student directory.
    loginPage: "../../index.html"
};

// =========================================================
// 1. MOBILE SIDEBAR
// =========================================================

function initializeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const menuButton = document.getElementById("mobile-menu");
    const overlay = document.getElementById("sidebar-overlay");

    if (!sidebar || !menuButton || !overlay) return;

    function openSidebar() {
        sidebar.classList.add("open");
        overlay.classList.add("visible");

        menuButton.setAttribute("aria-expanded", "true");
        menuButton.setAttribute("aria-label", "Close navigation");

        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        overlay.classList.remove("visible");

        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation");

        document.body.style.overflow = "";
    }

    menuButton.addEventListener("click", () => {
        const isOpen = sidebar.classList.contains("open");

        if (isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 700) {
            closeSidebar();
        }
    });
}

// =========================================================
// 2. ACTIVE NAVIGATION
// =========================================================

function initializeActiveNavigation() {
    const currentFile = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    const pageMap = {
        "dashboard.html": "overview",
        "my-team.html": "team",
        "explore-projects.html": "explore",
        "my-requests.html": "requests",
        "my-projects.html": "projects",
        "profile-settings.html": "profile"
    };

    const currentPage = pageMap[currentFile] || "overview";

    document.querySelectorAll(".nav-link").forEach(link => {
        const isActive = link.dataset.page === currentPage;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    const breadcrumb = document.querySelector(".breadcrumb strong");

    const pageNames = {
        overview: "Overview",
        team: "My Team",
        explore: "Explore Projects",
        requests: "My Requests",
        projects: "My Projects",
        profile: "Profile & Settings"
    };

    if (breadcrumb) {
        breadcrumb.textContent = pageNames[currentPage];
    }
}

// =========================================================
// 3. SEARCH SHORTCUT
// =========================================================

function initializeSearch() {
    const searchForm = document.getElementById("workspace-search");
    const searchInput = document.getElementById(
        "workspace-search-input"
    );

    if (!searchForm || !searchInput) return;

    // Press "/" to focus the search field.
    document.addEventListener("keydown", event => {
        const target = event.target;

        const isTyping =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            target?.isContentEditable;

        if (
            event.key === "/" &&
            !isTyping &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            event.preventDefault();
            searchInput.focus();
        }

        if (event.key === "Escape" && document.activeElement === searchInput) {
            searchInput.value = "";
            searchInput.blur();
        }
    });

    searchForm.addEventListener("submit", event => {
        event.preventDefault();

        const query = searchInput.value.trim();

        if (!query) {
            searchInput.focus();
            return;
        }

        // Navigate to project discovery with a search term.
        const destination = new URL(
            "explore-projects.html",
            window.location.href
        );

        destination.searchParams.set("q", query);

        window.location.href = destination.href;
    });
}

// =========================================================
// 4. WELCOME MESSAGE
// =========================================================

function initializeWelcomeMessage() {
    const heading = document.getElementById("welcome-heading");

    if (!heading) return;

    const hour = new Date().getHours();

    let greeting = "Ideas become real here.";

    if (hour >= 5 && hour < 12) {
        greeting = "Good morning. Ready to build?";
    } else if (hour >= 12 && hour < 17) {
        greeting = "Good afternoon. Keep creating.";
    } else if (hour >= 17 && hour < 22) {
        greeting = "Good evening. Keep moving forward.";
    } else {
        greeting = "Great ideas start anywhere.";
    }

    heading.textContent = greeting;
}

// =========================================================
// 5. STUDENT DASHBOARD DATA
// =========================================================

async function initializeStudentDashboard() {
    const nameElement = document.getElementById("student-name");
    const institutionElement = document.getElementById(
        "student-institution"
    );
    const avatarElement = document.getElementById("student-avatar");
    const activityList = document.getElementById("activity-list");

    try {
        const response = await fetch(STUDENT_API.dashboard, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await response.json().catch(() => null);

        if (response.status === 401 || response.status === 403) {
            window.location.replace(STUDENT_API.loginPage);
            return;
        }

        if (!response.ok || !data || data.success !== true) {
            throw new Error(
                data?.message || "Unable to load dashboard data."
            );
        }

        const student = data.student || {};
        const stats = data.stats || {};

        // Student name and avatar.
        const studentName = safeText(student.name, "Student");

        if (nameElement) {
            nameElement.textContent = studentName;
        }

        if (avatarElement) {
            avatarElement.textContent = getInitials(studentName);
        }

        if (institutionElement) {
            institutionElement.textContent = safeText(
                student.institution_name,
                "Student account"
            );
        }

        // Dashboard statistics.
        setText("team-count", stats.team_members);
        setText("request-count", stats.pending_requests);
        setText("project-count", stats.approved_projects);

        // Recent activity.
        if (activityList) {
            renderActivity(
                activityList,
                Array.isArray(data.activities) ? data.activities : []
            );
        }

        const updated = document.getElementById("dashboard-updated");

        if (updated) {
            updated.textContent = "Updated just now";
        }

        // Notification dot.
        const notificationDot = document.getElementById(
            "notification-dot"
        );

        if (notificationDot && Number(stats.unread_notifications) > 0) {
            notificationDot.hidden = false;
            notificationDot.setAttribute(
                "aria-label",
                "Unread notifications"
            );
        } else if (notificationDot) {
            notificationDot.hidden = true;
        }

    } catch (error) {
        console.error("[Foundev Dashboard]", error);

        if (activityList) {
            activityList.replaceChildren();

            const message = document.createElement("p");
            message.className = "loading-message";
            message.textContent =
                "Your activity could not be loaded. Please refresh the page or try again later.";

            activityList.appendChild(message);
        }

        // Do not display fake statistics if the API fails.
        setText("team-count", "—");
        setText("request-count", "—");
        setText("project-count", "—");
    }
}

// =========================================================
// 6. SAFE TEXT HELPERS
// =========================================================

function safeText(value, fallback = "") {
    if (typeof value !== "string" && typeof value !== "number") {
        return fallback;
    }

    const result = String(value).trim();

    return result || fallback;
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);

    if (!element) return;

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        element.textContent = "—";
        return;
    }

    const number = Number(value);

    element.textContent = Number.isFinite(number)
        ? String(number)
        : "—";
}

function getInitials(name) {
    const words = safeText(name, "Student")
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) return "ST";

    return words
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");
}

// =========================================================
// 7. RECENT ACTIVITY
// =========================================================

function renderActivity(container, activities) {
    container.replaceChildren();

    if (!activities.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";

        const heading = document.createElement("strong");
        heading.textContent = "Your story starts here.";

        const description = document.createElement("p");
        description.textContent =
            "When you join a team, submit a request, or get approved for a project, your updates will appear here.";

        empty.append(heading, description);
        container.appendChild(empty);

        return;
    }

    activities.slice(0, 6).forEach((activity, index) => {
        const item = document.createElement("article");
        item.className = "activity-item";
        item.style.animationDelay = `${index * 55}ms`;

        const icon = document.createElement("span");
        icon.className = "activity-icon";

        const iconText = document.createElement("span");
        iconText.setAttribute("aria-hidden", "true");
        iconText.textContent = getActivitySymbol(activity.type);

        icon.appendChild(iconText);

        const content = document.createElement("div");

        const title = document.createElement("div");
        title.className = "activity-title";
        title.textContent = safeText(
            activity.title,
            "Workspace update"
        );

        const description = document.createElement("div");
        description.className = "activity-description";
        description.textContent = safeText(
            activity.description,
            "There's an update in your student workspace."
        );

        content.append(title, description);

        const time = document.createElement("time");
        time.className = "activity-time";
        time.textContent = formatActivityDate(activity.created_at);

        if (activity.created_at) {
            const parsedDate = new Date(activity.created_at);

            if (!Number.isNaN(parsedDate.getTime())) {
                time.dateTime = parsedDate.toISOString();
            }
        }

        item.append(icon, content, time);
        container.appendChild(item);
    });
}

function getActivitySymbol(type) {
    const symbols = {
        team: "◎",
        invitation: "↗",
        request: "≡",
        approved: "✓",
        rejected: "×",
        project: "◇",
        payment: "₹",
        announcement: "!",
        default: "·"
    };

    return symbols[String(type || "").toLowerCase()] || symbols.default;
}

function formatActivityDate(value) {
    if (!value) return "Recently";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Recently";
    }

    const now = new Date();
    const elapsed = now.getTime() - date.getTime();

    if (elapsed < 0) {
        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short"
        });
    }

    const minutes = Math.floor(elapsed / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);

    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
    });
}

// =========================================================
// 8. LOGOUT
// =========================================================

function initializeLogout() {
    const logoutButton = document.getElementById("student-logout");

    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
            "Are you sure you want to sign out of Foundev?"
        );

        if (!confirmed) return;

        logoutButton.disabled = true;

        const originalText = logoutButton.querySelector("span");

        if (originalText) {
            originalText.textContent = "Signing out...";
        }

        try {
            const response = await fetch(STUDENT_API.logout, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data || data.success !== true) {
                throw new Error(
                    data?.message || "Sign out failed."
                );
            }

            window.location.replace(STUDENT_API.loginPage);

        } catch (error) {
            console.error("[Foundev Logout]", error);

            window.alert(
                "We couldn't complete sign out. Please try again."
            );

            logoutButton.disabled = false;

            if (originalText) {
                originalText.textContent = "Sign out";
            }
        }
    });
}
