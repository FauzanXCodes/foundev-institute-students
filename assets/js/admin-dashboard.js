
"use strict";

/**
 * Foundev Institute Administrator Dashboard
 *
 * API:
 * ../api/admin/admin-dashboard.php
 *
 * Expected JSON:
 * {
 *   "success": true,
 *   "message": "Dashboard data retrieved successfully.",
 *   "data": {
 *     "administrator": {
 *       "id": 7,
 *       "name": "Administrator",
 *       "email": "admin@example.com"
 *     },
 *     "institution": {
 *       "application_id": 4,
 *       "name": "Example Institution"
 *     },
 *     "stats": {
 *       "students": 0,
 *       "mentors": 0,
 *       "projects": 0,
 *       "assessments": 0
 *     },
 *     "activity": []
 *   }
 * }
 */

document.addEventListener("DOMContentLoaded", initAdminDashboard);

function initAdminDashboard() {
    const apiMeta = document.querySelector('meta[name="dashboard-api"]');

    const API_URL = apiMeta
        ? apiMeta.content
        : "../api/admin/admin-dashboard.php";

    const LOGIN_URL = "../../pages/institute-admin-login.html";

    const elements = {
        administratorName: document.getElementById("admin-name"),
        administratorEmail: document.getElementById("admin-email"),
        administratorInitial: document.getElementById("admin-initial"),
        welcomeAdministratorName: document.getElementById("welcome-admin-name"),
        institutionName: document.getElementById("institution-name"),

        totalStudents: document.getElementById("total-students"),
        totalMentors: document.getElementById("total-mentors"),
        totalProjects: document.getElementById("total-projects"),
        totalAssessments: document.getElementById("total-assessments"),

        dashboardNotice: document.getElementById("dashboard-notice"),
        dashboardNoticeText: document.getElementById("dashboard-notice-text"),
        dismissNotice: document.getElementById("dismiss-notice"),

        systemStatus: document.getElementById("system-status"),
        systemStatusText: document.getElementById("system-status-text"),

        refreshButton: document.getElementById("refresh-dashboard"),

        activityList: document.getElementById("activity-list"),
        activityLoading: document.getElementById("activity-loading"),
        activityEmpty: document.getElementById("activity-empty"),
        activityError: document.getElementById("activity-error"),
        retryActivity: document.getElementById("retry-activity"),

        logoutButton: document.getElementById("logout-button")
    };

    let requestController = null;
    let latestRequestId = 0;
    let hasLoadedSuccessfully = false;

    function showNotice(message, type = "info") {
        if (!elements.dashboardNotice || !elements.dashboardNoticeText) {
            return;
        }

        elements.dashboardNoticeText.textContent = message;
        elements.dashboardNotice.hidden = false;

        elements.dashboardNotice.dataset.type = type;
    }

    function hideNotice() {
        if (elements.dashboardNotice) {
            elements.dashboardNotice.hidden = true;
        }
    }

    function setSystemStatus(status, text) {
        if (!elements.systemStatus || !elements.systemStatusText) {
            return;
        }

        elements.systemStatus.classList.remove(
            "is-online",
            "is-offline"
        );

        if (status === "online") {
            elements.systemStatus.classList.add("is-online");
        } else if (status === "offline") {
            elements.systemStatus.classList.add("is-offline");
        }

        elements.systemStatusText.textContent = text;
    }

    function setRefreshing(isRefreshing) {
        if (!elements.refreshButton) {
            return;
        }

        elements.refreshButton.disabled = isRefreshing;
        elements.refreshButton.classList.toggle(
            "is-loading",
            isRefreshing
        );

        elements.refreshButton.setAttribute(
            "aria-busy",
            String(isRefreshing)
        );
    }

    function formatNumber(value) {
        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0
        ) {
            return "—";
        }

        return new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 0
        }).format(value);
    }

    function setText(element, value, fallback = "") {
        if (!element) return;

        element.textContent =
            typeof value === "string" && value.trim() !== ""
                ? value.trim()
                : fallback;
    }

    function setMetric(element, value) {
        if (!element) return;

        element.textContent = formatNumber(value);

        if (
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0
        ) {
            element.dataset.loaded = "true";
        } else {
            delete element.dataset.loaded;
        }
    }

    function setAdministrator(administrator) {
        if (!administrator || typeof administrator !== "object") {
            return;
        }

        const name =
            typeof administrator.name === "string" &&
            administrator.name.trim()
                ? administrator.name.trim()
                : "Administrator";

        const email =
            typeof administrator.email === "string"
                ? administrator.email.trim()
                : "";

        setText(elements.administratorName, name, "Administrator");
        setText(
            elements.welcomeAdministratorName,
            name,
            "Administrator"
        );

        setText(
            elements.administratorEmail,
            email,
            "Institute administrator"
        );

        if (elements.administratorInitial) {
            const firstCharacter = Array.from(name)[0] || "A";

            elements.administratorInitial.textContent =
                firstCharacter.toLocaleUpperCase();
        }
    }

    function setInstitution(institution) {
        if (!institution || typeof institution !== "object") {
            return;
        }

        // Prefer a real institution name if the API supplies one.
        if (
            typeof institution.name === "string" &&
            institution.name.trim()
        ) {
            setText(
                elements.institutionName,
                institution.name,
                "Your institution"
            );
            return;
        }

        // Do not invent an institution name.
        if (
            Number.isInteger(institution.application_id) &&
            institution.application_id > 0
        ) {
            setText(
                elements.institutionName,
                `Institution #${institution.application_id}`,
                "Your institution"
            );
        }
    }

    function setStatistics(stats) {
        if (!stats || typeof stats !== "object") {
            return;
        }

        setMetric(elements.totalStudents, stats.students);
        setMetric(elements.totalMentors, stats.mentors);
        setMetric(elements.totalProjects, stats.projects);
        setMetric(elements.totalAssessments, stats.assessments);
    }

    function createActivityIcon(type) {
        const wrapper = document.createElement("span");

        wrapper.className = "activity-icon";

        const normalizedType =
            typeof type === "string" ? type.toLowerCase() : "";

        if (normalizedType.includes("student")) {
            wrapper.classList.add("activity-student");
        } else if (normalizedType.includes("mentor")) {
            wrapper.classList.add("activity-mentor");
        } else if (normalizedType.includes("project")) {
            wrapper.classList.add("activity-project");
        }

        wrapper.setAttribute("aria-hidden", "true");

        // Construct icons with SVG DOM methods rather than injecting HTML.
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");

        svg.setAttribute("viewBox", "0 0 24 24");

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "8");

        const hand = document.createElementNS(svgNS, "path");
        hand.setAttribute("d", "M12 7v5l3 2");

        svg.append(circle, hand);
        wrapper.appendChild(svg);

        return wrapper;
    }

    function formatActivityTime(value) {
        if (!value || typeof value !== "string") {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date);
    }

    function renderActivity(activity) {
        if (!elements.activityList) {
            return;
        }

        elements.activityList.replaceChildren();

        if (elements.activityLoading) {
            elements.activityLoading.hidden = true;
        }

        if (elements.activityError) {
            elements.activityError.hidden = true;
        }

        const items = Array.isArray(activity) ? activity : [];

        if (items.length === 0) {
            if (elements.activityEmpty) {
                elements.activityEmpty.hidden = false;
            }

            return;
        }

        if (elements.activityEmpty) {
            elements.activityEmpty.hidden = true;
        }

        items.forEach((item) => {
            if (!item || typeof item !== "object") {
                return;
            }

            const article = document.createElement("article");
            article.className = "activity-item";

            const type =
                typeof item.type === "string" ? item.type : "activity";

            const icon = createActivityIcon(type);

            const copy = document.createElement("div");
            copy.className = "activity-copy";

            const title = document.createElement("strong");
            title.textContent =
                typeof item.title === "string"
                    ? item.title
                    : "Workspace activity";

            const description = document.createElement("p");
            description.textContent =
                typeof item.description === "string"
                    ? item.description
                    : "";

            copy.append(title);

            if (description.textContent) {
                copy.append(description);
            }

            article.append(icon, copy);

            const timeText = formatActivityTime(
                item.created_at || item.timestamp || ""
            );

            if (timeText) {
                const time = document.createElement("time");
                time.className = "activity-time";
                time.textContent = timeText;

                if (
                    typeof item.created_at === "string" &&
                    !Number.isNaN(new Date(item.created_at).getTime())
                ) {
                    time.dateTime = item.created_at;
                }

                article.appendChild(time);
            }

            elements.activityList.appendChild(article);
        });

        if (!elements.activityList.children.length) {
            if (elements.activityEmpty) {
                elements.activityEmpty.hidden = false;
            }
        }
    }

    function handleSessionExpired() {
        showNotice(
            "Your administrator session has expired. Redirecting you to sign in...",
            "error"
        );

        window.setTimeout(() => {
            window.location.replace(LOGIN_URL);
        }, 900);
    }

    async function loadDashboard(options = {}) {
        const requestId = ++latestRequestId;

        if (requestController) {
            requestController.abort();
        }

        requestController = new AbortController();

        const { signal } = requestController;

        const isRefresh = options.refresh === true;

        setRefreshing(true);
        setSystemStatus("connecting", "Connecting");

        if (elements.activityLoading) {
            elements.activityLoading.hidden = false;
        }

        if (elements.activityEmpty) {
            elements.activityEmpty.hidden = true;
        }

        if (elements.activityError) {
            elements.activityError.hidden = true;
        }

        if (elements.activityList && !hasLoadedSuccessfully) {
            elements.activityList.replaceChildren();
        }

        if (isRefresh) {
            hideNotice();
        }

        try {
            const response = await fetch(API_URL, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                signal,
                headers: {
                    Accept: "application/json"
                }
            });

            if (requestId !== latestRequestId) {
                return;
            }

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error(
                    "The server returned an invalid response. Check the PHP error log."
                );
            }

            if (response.status === 401) {
                handleSessionExpired();
                return;
            }

            if (!response.ok || result.success !== true) {
                throw new Error(
                    result.message ||
                    "The dashboard could not be loaded."
                );
            }

            const data = result.data;

            if (!data || typeof data !== "object") {
                throw new Error(
                    "The dashboard API returned incomplete data."
                );
            }

            setAdministrator(data.administrator);
            setInstitution(data.institution);
            setStatistics(data.stats);
            renderActivity(data.activity);

            hasLoadedSuccessfully = true;

            setSystemStatus("online", "Connected");
            hideNotice();

        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            if (requestId !== latestRequestId) {
                return;
            }

            console.error(
                "[Foundev Dashboard] Failed to load dashboard:",
                error
            );

            setSystemStatus("offline", "Unavailable");

            showNotice(
                error.message ||
                "Unable to connect to the dashboard. Please try again.",
                "error"
            );

            if (elements.activityLoading) {
                elements.activityLoading.hidden = true;
            }

            if (!hasLoadedSuccessfully && elements.activityList) {
                elements.activityList.replaceChildren();
            }

            if (elements.activityError) {
                elements.activityError.hidden = false;
            }

            if (elements.activityEmpty) {
                elements.activityEmpty.hidden = true;
            }

        } finally {
            if (requestId === latestRequestId) {
                setRefreshing(false);
            }
        }
    }

    if (elements.refreshButton) {
        elements.refreshButton.addEventListener("click", () => {
            loadDashboard({ refresh: true });
        });
    }

    if (elements.retryActivity) {
        elements.retryActivity.addEventListener("click", () => {
            loadDashboard({ refresh: true });
        });
    }

    if (elements.dismissNotice) {
        elements.dismissNotice.addEventListener("click", hideNotice);
    }

    /*
     * Sign-out needs a server-side logout endpoint to invalidate
     * the session securely. This button will use that endpoint
     * once it is implemented.
     */
    if (elements.logoutButton) {
        elements.logoutButton.addEventListener("click", async () => {
            const confirmed = window.confirm(
                "Are you sure you want to sign out?"
            );

            if (!confirmed) {
                return;
            }

            // Do not pretend the session has been invalidated.
            showNotice(
                "Sign-out endpoint is not configured yet. Your session remains active.",
                "error"
            );
        });
    }

    // Load real data on first page visit.
    loadDashboard();
}
