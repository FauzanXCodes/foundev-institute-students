/* =========================================================
   FOUNDEV — MY PROJECTS
   File: assets/js/my-projects.js

   Features:
   - Student profile loading
   - Projects API integration
   - Search, filters, sorting and pagination
   - Project details modal
   - Mobile navigation
   - Logout and error handling
   ========================================================= */

(() => {
    "use strict";

    const CONFIG = {
        projectsApi: "../api/student/projects.php",
        dashboardApi: "../api/student/dashboard.php",
        logoutApi: "../api/student/logout.php",
        pageSize: 6
    };

    const state = {
        projects: [],
        filteredProjects: [],
        currentPage: 1,
        search: "",
        status: "all",
        sort: "updated",
        loading: false,
        error: false,
        requestController: null,
        activeProject: null
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const elements = {
        studentName: $("#student-name"),
        studentInstitution: $("#student-institution"),
        studentAvatar: $("#student-avatar"),

        mobileMenu: $("#mobile-menu"),
        sidebar: $("#sidebar"),
        sidebarOverlay: $("#sidebar-overlay"),
        logout: $("#student-logout"),

        workspaceSearch: $("#workspace-search"),
        workspaceSearchInput: $("#workspace-search-input"),

        notificationDot: $("#notification-dot"),

        totalProjects: $("#totalProjects"),
        inProgressProjects: $("#inProgressProjects"),
        completedProjects: $("#completedProjects"),
        pendingProjects: $("#pendingProjects"),

        projectSearch: $("#projectSearch"),
        statusFilter: $("#projectStatusFilter"),
        sortFilter: $("#projectSort"),
        clearFilters: $("#clearProjectFilters"),

        resultCount: $("#projectResultCount"),
        projectsList: $("#projectsList"),
        projectsLoading: $("#projectsLoading"),
        projectsError: $("#projectsError"),
        projectsErrorText: $("#projectsErrorText"),
        retryButton: $("#retryProjectsButton"),
        projectsEmpty: $("#projectsEmpty"),
        emptyTitle: $("#projectsEmptyTitle"),
        emptyText: $("#projectsEmptyText"),
        exploreLink: $("#exploreProjectsLink"),

        pagination: $("#projectsPagination"),
        previousPage: $("#previousProjectPage"),
        nextPage: $("#nextProjectPage"),
        pageInfo: $("#projectPageInfo"),

        modal: $("#projectDetailsModal"),
        modalTitle: $("#projectModalTitle"),
        modalContent: $("#projectModalContent"),
        closeModal: $("#closeProjectModal"),
        closeModalFooter: $("#closeProjectModalFooter")
    };

    /* -----------------------------------------------------
       HELPERS
    ----------------------------------------------------- */

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function firstValue(object, keys, fallback = "") {
        if (!object || typeof object !== "object") {
            return fallback;
        }

        for (const key of keys) {
            const value = object[key];

            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ""
            ) {
                return value;
            }
        }

        return fallback;
    }

    function normalizeText(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ");
    }

    function normalizeStatus(value) {
        const status = normalizeText(value);

        const aliases = {
            active: "active",
            approved: "active",
            ongoing: "in progress",
            "in progress": "in progress",
            "in development": "in progress",
            completed: "completed",
            complete: "completed",
            finished: "completed",
            pending: "pending",
            requested: "pending",
            "pending approval": "pending",
            paused: "paused",
            onhold: "paused",
            "on hold": "paused",
            rejected: "rejected",
            declined: "rejected",
            cancelled: "cancelled",
            canceled: "cancelled",
            withdrawn: "withdrawn"
        };

        return aliases[status] || status || "unknown";
    }

    function displayStatus(value) {
        const status = normalizeStatus(value);

        const labels = {
            active: "Active",
            "in progress": "In progress",
            completed: "Completed",
            pending: "Pending",
            paused: "Paused",
            rejected: "Rejected",
            cancelled: "Cancelled",
            withdrawn: "Withdrawn",
            unknown: "Unspecified"
        };

        return labels[status] ||
            status.replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function statusClass(value) {
        const status = normalizeStatus(value);

        const known = [
            "active",
            "in progress",
            "completed",
            "pending",
            "paused",
            "rejected",
            "cancelled",
            "withdrawn"
        ];

        if (!known.includes(status)) {
            return "status-unknown";
        }

        return "status-" + status.replace(/\s+/g, "-");
    }

    function formatDate(value) {
        if (!value) {
            return "Not specified";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function formatDateTimestamp(project) {
        const value = firstValue(project, [
            "updated_at",
            "modified_at",
            "last_updated",
            "created_at",
            "createdAt",
            "updatedAt"
        ]);

        if (!value) {
            return 0;
        }

        const timestamp = new Date(value).getTime();

        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    function formatInitials(name) {
        const words = String(name || "Student")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (words.length === 0) {
            return "S";
        }

        return words
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join("");
    }

    function setText(element, value) {
        if (element) {
            element.textContent = String(value ?? "");
        }
    }

    function setVisible(element, visible) {
        if (element) {
            element.hidden = !visible;
        }
    }

    function showMessage(element, message) {
        if (element) {
            element.textContent = message;
            element.hidden = false;
        }
    }

    function getProjectId(project) {
        return String(firstValue(project, [
            "id",
            "project_id",
            "projectId",
            "student_project_id",
            "request_id"
        ], ""));
    }

    function getProjectTitle(project) {
        return String(firstValue(project, [
            "title",
            "project_title",
            "name",
            "project_name"
        ], "Untitled project"));
    }

    function getProjectDescription(project) {
        return String(firstValue(project, [
            "description",
            "project_description",
            "summary",
            "short_description"
        ], "No description has been provided."));
    }

    function getProjectStatus(project) {
        return normalizeStatus(firstValue(project, [
            "status",
            "project_status",
            "approval_status"
        ], "unknown"));
    }

    function getProjectDate(project) {
        return firstValue(project, [
            "updated_at",
            "modified_at",
            "last_updated",
            "created_at",
            "createdAt",
            "updatedAt"
        ], "");
    }

    function getProjectTeam(project) {
        const team = firstValue(project, [
            "team_name",
            "team",
            "team_title",
            "group_name"
        ], "");

        if (typeof team === "object" && team !== null) {
            return String(firstValue(team, [
                "name",
                "title",
                "team_name"
            ], "Team assigned"));
        }

        return String(team || "Not assigned");
    }

    function getProjectCategory(project) {
        return String(firstValue(project, [
            "category",
            "project_category",
            "domain",
            "technology",
            "project_type"
        ], "General"));
    }

    function getProjectProgress(project) {
        const value = firstValue(project, [
            "progress",
            "progress_percentage",
            "completion_percentage",
            "completion"
        ], null);

        if (value === null || value === "") {
            return null;
        }

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return null;
        }

        return Math.max(0, Math.min(100, number));
    }

    function getProjectMembers(project) {
        const members = firstValue(project, [
            "members",
            "team_members",
            "member_count"
        ], null);

        if (Array.isArray(members)) {
            return members.length;
        }

        if (members !== null && Number.isFinite(Number(members))) {
            return Number(members);
        }

        return null;
    }

    function getProjectMentor(project) {
        return String(firstValue(project, [
            "mentor_name",
            "mentor",
            "supervisor_name",
            "guide_name"
        ], "Not assigned"));
    }

    function getProjectTechnologies(project) {
        const technologies = firstValue(project, [
            "technologies",
            "tech_stack",
            "tools",
            "skills"
        ], []);

        if (Array.isArray(technologies)) {
            return technologies.map(item => {
                if (typeof item === "object" && item !== null) {
                    return String(firstValue(item, [
                        "name",
                        "title",
                        "technology"
                    ], ""));
                }

                return String(item);
            }).filter(Boolean);
        }

        if (typeof technologies === "string" && technologies.trim()) {
            return technologies
                .split(/[,|]/)
                .map(item => item.trim())
                .filter(Boolean);
        }

        return [];
    }

    function getErrorMessage(payload, fallback) {
        return String(firstValue(
            payload,
            ["message", "error", "detail"],
            fallback
        ));
    }

    /* -----------------------------------------------------
       API REQUESTS
    ----------------------------------------------------- */

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.headers || {})
            }
        });

        const contentType = response.headers.get("content-type") || "";

        let payload = null;

        if (contentType.includes("application/json")) {
            payload = await response.json();
        } else {
            const text = await response.text();

            if (text.trim()) {
                try {
                    payload = JSON.parse(text);
                } catch {
                    payload = null;
                }
            }
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                "Your session may have expired. Please sign in again."
            );
        }

        if (!response.ok) {
            throw new Error(
                getErrorMessage(
                    payload,
                    `Request failed with status ${response.status}.`
                )
            );
        }

        if (!payload || typeof payload !== "object") {
            throw new Error(
                "The server returned an invalid response. Check the PHP endpoint."
            );
        }

        if (payload.success === false) {
            throw new Error(
                getErrorMessage(payload, "The request could not be completed.")
            );
        }

        return payload;
    }

    function extractProjects(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }

        const candidates = [
            payload.projects,
            payload.data,
            payload.items,
            payload.results,
            payload.student_projects
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }

            if (candidate && typeof candidate === "object") {
                for (const nestedKey of [
                    "projects",
                    "items",
                    "results",
                    "records"
                ]) {
                    if (Array.isArray(candidate[nestedKey])) {
                        return candidate[nestedKey];
                    }
                }
            }
        }

        if (payload.success === true) {
            return [];
        }

        throw new Error(
            "The projects API did not return a recognizable projects list."
        );
    }

    /* -----------------------------------------------------
       STUDENT PROFILE
    ----------------------------------------------------- */

    function updateStudentProfile(student) {
        if (!student || typeof student !== "object") {
            return;
        }

        const name = firstValue(student, [
            "name",
            "full_name",
            "student_name",
            "fullName"
        ], "");

        const institution = firstValue(student, [
            "institution_name",
            "institution",
            "college_name",
            "institute_name"
        ], "");

        if (name) {
            setText(elements.studentName, name);

            if (elements.studentAvatar) {
                elements.studentAvatar.textContent = formatInitials(name);
                elements.studentAvatar.setAttribute(
                    "aria-label",
                    `Profile: ${name}`
                );
            }
        }

        if (institution) {
            setText(elements.studentInstitution, institution);
        }
    }

    async function loadStudentProfile() {
        try {
            const payload = await apiRequest(CONFIG.dashboardApi);

            updateStudentProfile(payload.student || payload.data?.student);

            const unread = firstValue(
                payload.stats,
                ["unread_notifications", "unreadNotifications"],
                null
            );

            if (elements.notificationDot && unread !== null) {
                elements.notificationDot.hidden = Number(unread) <= 0;
            }
        } catch (error) {
            console.warn(
                "Foundev: student profile could not be loaded.",
                error.message
            );
        }
    }

    /* -----------------------------------------------------
       PROJECT COUNTS
    ----------------------------------------------------- */

    function updateSummary() {
        const projects = state.projects;

        const inProgress = projects.filter(project => {
            const status = getProjectStatus(project);

            return status === "active" || status === "in progress";
        }).length;

        const completed = projects.filter(project =>
            getProjectStatus(project) === "completed"
        ).length;

        const pending = projects.filter(project =>
            getProjectStatus(project) === "pending"
        ).length;

        setText(elements.totalProjects, projects.length);
        setText(elements.inProgressProjects, inProgress);
        setText(elements.completedProjects, completed);
        setText(elements.pendingProjects, pending);
    }

    /* -----------------------------------------------------
       PROJECT FILTERING AND SORTING
    ----------------------------------------------------- */

    function matchesStatus(project) {
        if (state.status === "all") {
            return true;
        }

        const status = getProjectStatus(project);

        if (state.status === "active") {
            return status === "active" || status === "in progress";
        }

        if (state.status === "completed") {
            return status === "completed";
        }

        if (state.status === "pending") {
            return status === "pending";
        }

        if (state.status === "paused") {
            return status === "paused";
        }

        return true;
    }

    function matchesSearch(project) {
        if (!state.search) {
            return true;
        }

        const searchable = [
            getProjectTitle(project),
            getProjectDescription(project),
            getProjectStatus(project),
            getProjectCategory(project),
            getProjectTeam(project),
            getProjectMentor(project),
            getProjectTechnologies(project).join(" ")
        ].join(" ").toLowerCase();

        return searchable.includes(state.search);
    }

    function sortProjects(projects) {
        const sorted = [...projects];

        switch (state.sort) {
            case "newest":
                sorted.sort((a, b) =>
                    formatDateTimestamp(b) - formatDateTimestamp(a)
                );
                break;

            case "oldest":
                sorted.sort((a, b) =>
                    formatDateTimestamp(a) - formatDateTimestamp(b)
                );
                break;

            case "name":
                sorted.sort((a, b) =>
                    getProjectTitle(a).localeCompare(getProjectTitle(b))
                );
                break;

            case "updated":
            default:
                sorted.sort((a, b) =>
                    formatDateTimestamp(b) - formatDateTimestamp(a)
                );
                break;
        }

        return sorted;
    }

    function applyFilters() {
        state.filteredProjects = sortProjects(
            state.projects.filter(project =>
                matchesStatus(project) && matchesSearch(project)
            )
        );

        state.currentPage = 1;
        renderProjects();
    }

    function clearFilters() {
        state.search = "";
        state.status = "all";
        state.sort = "updated";

        if (elements.projectSearch) {
            elements.projectSearch.value = "";
        }

        if (elements.statusFilter) {
            elements.statusFilter.value = "all";
        }

        if (elements.sortFilter) {
            elements.sortFilter.value = "updated";
        }

        if (elements.workspaceSearchInput) {
            elements.workspaceSearchInput.value = "";
        }

        applyFilters();
    }

    /* -----------------------------------------------------
       PROJECT ICONS
    ----------------------------------------------------- */

    function projectIcon() {
        return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="4" width="17" height="16" rx="2"></rect>
                <path d="M8 4V2.5h8V4"></path>
                <path d="M7.5 9h9"></path>
                <path d="M7.5 13h9"></path>
                <path d="M7.5 17h5"></path>
            </svg>
        `;
    }

    function metaIcon(type) {
        const icons = {
            date: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                    <path d="M16 3v4M8 3v4M3 10h18"></path>
                </svg>
            `,
            team: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            `,
            category: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 5h6l2 2h8v12H4z"></path>
                </svg>
            `
        };

        return icons[type] || "";
    }

    /* -----------------------------------------------------
       PROJECT ROWS
    ----------------------------------------------------- */

    function renderProjectRow(project, index) {
        const id = getProjectId(project);
        const title = getProjectTitle(project);
        const description = getProjectDescription(project);
        const status = getProjectStatus(project);
        const category = getProjectCategory(project);
        const team = getProjectTeam(project);
        const date = getProjectDate(project);
        const members = getProjectMembers(project);
        const progress = getProjectProgress(project);

        const progressHtml = progress === null ? "" : `
            <div class="project-progress">
                <div class="project-progress-heading">
                    <span>Progress</span>
                    <strong>${progress}%</strong>
                </div>
                <div
                    class="project-progress-track"
                    role="progressbar"
                    aria-label="Project progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow="${progress}"
                >
                    <div
                        class="project-progress-fill"
                        style="width: ${progress}%"
                    ></div>
                </div>
            </div>
        `;

        const teamLabel = members === null
            ? team
            : `${members} member${members === 1 ? "" : "s"}`;

        return `
            <article
                class="project-row"
                data-project-id="${escapeHtml(id)}"
                style="animation-delay: ${Math.min(index * 35, 210)}ms"
            >
                <div class="project-row-main">
                    <div class="project-symbol">
                        ${projectIcon()}
                    </div>

                    <div class="project-information">
                        <div class="project-heading-line">
                            <h3 class="project-title">
                                ${escapeHtml(title)}
                            </h3>

                            <span class="project-status ${statusClass(status)}">
                                ${escapeHtml(displayStatus(status))}
                            </span>
                        </div>

                        <p class="project-description">
                            ${escapeHtml(description)}
                        </p>

                        <div class="project-meta">
                            <span class="project-meta-item">
                                ${metaIcon("category")}
                                <span>${escapeHtml(category)}</span>
                            </span>

                            <span class="project-meta-item">
                                ${metaIcon("team")}
                                <span>${escapeHtml(teamLabel)}</span>
                            </span>

                            <span class="project-meta-item">
                                ${metaIcon("date")}
                                <span>
                                    ${date
                                        ? `Updated ${escapeHtml(formatDate(date))}`
                                        : "Date unavailable"}
                                </span>
                            </span>
                        </div>

                        ${progressHtml}
                    </div>
                </div>

                <div class="project-row-actions">
                    <button
                        class="project-view-button"
                        type="button"
                        data-action="view-project"
                        data-project-id="${escapeHtml(id)}"
                        aria-label="View details for ${escapeHtml(title)}"
                    >
                        View details <span aria-hidden="true">↗</span>
                    </button>
                </div>
            </article>
        `;
    }

    /* -----------------------------------------------------
       EMPTY, LOADING AND ERROR STATES
    ----------------------------------------------------- */

    function setLoading(loading) {
        state.loading = loading;

        setVisible(elements.projectsLoading, loading);

        if (loading) {
            setVisible(elements.projectsError, false);
            setVisible(elements.projectsEmpty, false);
            setVisible(elements.projectsList, false);
            setVisible(elements.pagination, false);
        }
    }

    function showError(message) {
        state.error = true;

        setVisible(elements.projectsLoading, false);
        setVisible(elements.projectsEmpty, false);
        setVisible(elements.projectsList, false);
        setVisible(elements.pagination, false);
        setVisible(elements.projectsError, true);

        showMessage(
            elements.projectsErrorText,
            message || "Unable to load your projects. Please try again."
        );

        setText(elements.resultCount, "Unable to load projects");
    }

    function showEmptyState() {
        setVisible(elements.projectsLoading, false);
        setVisible(elements.projectsError, false);
        setVisible(elements.projectsList, false);
        setVisible(elements.pagination, false);
        setVisible(elements.projectsEmpty, true);

        const hasFilters =
            state.search.length > 0 || state.status !== "all";

        if (hasFilters) {
            setText(elements.emptyTitle, "No matching projects");
            setText(
                elements.emptyText,
                "Try changing your search or filters to find your projects."
            );

            if (elements.exploreLink) {
                elements.exploreLink.textContent = "Clear filters";
                elements.exploreLink.setAttribute(
                    "data-action",
                    "clear-filters"
                );
                elements.exploreLink.setAttribute("href", "#projects-heading");
            }
        } else {
            setText(elements.emptyTitle, "Your next project starts here");
            setText(
                elements.emptyText,
                "You do not have any projects to display yet. Explore available projects to find an opportunity that matches your interests."
            );

            if (elements.exploreLink) {
                elements.exploreLink.textContent = "Explore projects";
                elements.exploreLink.setAttribute(
                    "data-action",
                    "explore-projects"
                );
                elements.exploreLink.setAttribute(
                    "href",
                    "explore-projects.html"
                );
            }
        }
    }

    /* -----------------------------------------------------
       PAGINATION
    ----------------------------------------------------- */

    function renderPagination(totalPages) {
        const total = state.filteredProjects.length;

        if (!elements.pagination) {
            return;
        }

        if (total === 0 || totalPages <= 1) {
            setVisible(elements.pagination, false);
            return;
        }

        setVisible(elements.pagination, true);

        if (elements.previousPage) {
            elements.previousPage.disabled = state.currentPage <= 1;
        }

        if (elements.nextPage) {
            elements.nextPage.disabled = state.currentPage >= totalPages;
        }

        setText(
            elements.pageInfo,
            `Page ${state.currentPage} of ${totalPages}`
        );
    }

    /* -----------------------------------------------------
       RENDER PROJECTS
    ----------------------------------------------------- */

    function renderProjects() {
        state.error = false;

        setVisible(elements.projectsLoading, false);
        setVisible(elements.projectsError, false);

        const total = state.filteredProjects.length;

        setText(
            elements.resultCount,
            `${total} project${total === 1 ? "" : "s"}`
        );

        if (total === 0) {
            if (elements.projectsList) {
                elements.projectsList.innerHTML = "";
            }

            showEmptyState();
            return;
        }

        setVisible(elements.projectsEmpty, false);
        setVisible(elements.projectsList, true);

        const totalPages = Math.ceil(total / CONFIG.pageSize);

        state.currentPage = Math.min(
            Math.max(1, state.currentPage),
            totalPages
        );

        const start = (state.currentPage - 1) * CONFIG.pageSize;

        const pageProjects = state.filteredProjects.slice(
            start,
            start + CONFIG.pageSize
        );

        if (elements.projectsList) {
            elements.projectsList.innerHTML = pageProjects
                .map((project, index) => renderProjectRow(project, index))
                .join("");
        }

        renderPagination(totalPages);
    }

    /* -----------------------------------------------------
       LOAD PROJECTS
    ----------------------------------------------------- */

    async function loadProjects() {
        if (state.requestController) {
            state.requestController.abort();
        }

        const controller = new AbortController();
        state.requestController = controller;

        setLoading(true);

        try {
            const payload = await apiRequest(CONFIG.projectsApi, {
                signal: controller.signal
            });

            if (state.requestController !== controller) {
                return;
            }

            state.projects = extractProjects(payload).filter(project =>
                project && typeof project === "object"
            );

            updateSummary();
            applyFilters();
            setLoading(false);
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            if (state.requestController !== controller) {
                return;
            }

            console.error("Foundev projects API error:", error);

            showError(
                error.message ||
                "We could not load your projects. Please try again."
            );
        } finally {
            if (state.requestController === controller) {
                state.requestController = null;
            }
        }
    }

    /* -----------------------------------------------------
       PROJECT DETAILS MODAL
    ----------------------------------------------------- */

    function detailField(label, value) {
        return `
            <div class="project-detail-field">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value || "Not specified")}</strong>
            </div>
        `;
    }

    function renderProjectDetails(project) {
        const title = getProjectTitle(project);
        const description = getProjectDescription(project);
        const status = getProjectStatus(project);
        const category = getProjectCategory(project);
        const team = getProjectTeam(project);
        const mentor = getProjectMentor(project);
        const date = getProjectDate(project);
        const members = getProjectMembers(project);
        const progress = getProjectProgress(project);
        const technologies = getProjectTechnologies(project);

        const technologyHtml = technologies.length
            ? `
                <div class="project-detail-tags">
                    ${technologies.map(technology => `
                        <span class="project-detail-tag">
                            ${escapeHtml(technology)}
                        </span>
                    `).join("")}
                </div>
            `
            : `
                <p class="project-detail-empty">
                    No technologies have been provided.
                </p>
            `;

        return `
            <p class="project-detail-description">
                ${escapeHtml(description)}
            </p>

            <section class="project-detail-section">
                <h3>Project overview</h3>

                <div class="project-detail-grid">
                    ${detailField("Status", displayStatus(status))}
                    ${detailField("Category", category)}
                    ${detailField("Team", team)}
                    ${detailField(
                        "Team members",
                        members === null ? "Not specified" : String(members)
                    )}
                    ${detailField("Mentor", mentor)}
                    ${detailField("Last updated", formatDate(date))}
                    ${detailField(
                        "Progress",
                        progress === null ? "Not specified" : `${progress}%`
                    )}
                </div>
            </section>

            <section class="project-detail-section">
                <h3>Technologies and tools</h3>
                ${technologyHtml}
            </section>
        `;
    }

    function openProjectModal(project) {
        if (!elements.modal || !elements.modalTitle ||
            !elements.modalContent) {
            return;
        }

        state.activeProject = project;

        setText(elements.modalTitle, getProjectTitle(project));

        elements.modalContent.innerHTML = renderProjectDetails(project);

        setVisible(elements.modal, true);
        elements.modal.setAttribute("aria-hidden", "false");

        document.body.dataset.projectModalOpen = "true";

        if (elements.closeModal) {
            elements.closeModal.focus();
        }
    }

    function closeProjectModal() {
        if (!elements.modal) {
            return;
        }

        setVisible(elements.modal, false);
        elements.modal.setAttribute("aria-hidden", "true");

        delete document.body.dataset.projectModalOpen;

        state.activeProject = null;
    }

    function findProjectById(id) {
        return state.projects.find(project =>
            getProjectId(project) === String(id)
        );
    }

    /* -----------------------------------------------------
       MOBILE SIDEBAR
    ----------------------------------------------------- */

    function openSidebar() {
        if (!elements.sidebar) {
            return;
        }

        elements.sidebar.classList.add("active");
        elements.sidebar.classList.add("open");

        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.add("active");
            elements.sidebarOverlay.classList.add("visible");
            elements.sidebarOverlay.hidden = false;
        }

        if (elements.mobileMenu) {
            elements.mobileMenu.setAttribute("aria-expanded", "true");
        }

        document.body.classList.add("sidebar-open");
    }

    function closeSidebar() {
        if (elements.sidebar) {
            elements.sidebar.classList.remove("active");
            elements.sidebar.classList.remove("open");
        }

        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.remove("active");
            elements.sidebarOverlay.classList.remove("visible");
            elements.sidebarOverlay.hidden = true;
        }

        if (elements.mobileMenu) {
            elements.mobileMenu.setAttribute("aria-expanded", "false");
        }

        document.body.classList.remove("sidebar-open");
    }

    function toggleSidebar() {
        const isOpen = elements.sidebar?.classList.contains("active") ||
            elements.sidebar?.classList.contains("open");

        if (isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    /* -----------------------------------------------------
       LOGOUT
    ----------------------------------------------------- */

    async function logout() {
        if (!elements.logout || elements.logout.dataset.loggingOut === "true") {
            return;
        }

        elements.logout.dataset.loggingOut = "true";

        try {
            await apiRequest(CONFIG.logoutApi, {
                method: "POST"
            });

            window.location.href = "../../index.html";
        } catch (error) {
            console.error("Foundev logout error:", error);

            delete elements.logout.dataset.loggingOut;

            if (
                error.message.toLowerCase().includes("session") ||
                error.message.toLowerCase().includes("sign in")
            ) {
                window.location.href = "../../index.html";
                return;
            }

            alert("Unable to log out right now. Please try again.");
        }
    }

    /* -----------------------------------------------------
       EVENT LISTENERS
    ----------------------------------------------------- */

    function handleSearch(value) {
        state.search = String(value || "").trim().toLowerCase();

        if (
            elements.projectSearch &&
            elements.projectSearch.value !== value
        ) {
            elements.projectSearch.value = value;
        }

        if (
            elements.workspaceSearchInput &&
            elements.workspaceSearchInput.value !== value
        ) {
            elements.workspaceSearchInput.value = value;
        }

        applyFilters();
    }

    function bindEvents() {
        elements.projectSearch?.addEventListener("input", event => {
            handleSearch(event.target.value);
        });

        elements.workspaceSearchInput?.addEventListener("input", event => {
            handleSearch(event.target.value);
        });

        elements.workspaceSearch?.addEventListener("submit", event => {
            event.preventDefault();

            handleSearch(elements.workspaceSearchInput?.value || "");

            elements.projectSearch?.focus();
        });

        elements.statusFilter?.addEventListener("change", event => {
            state.status = event.target.value || "all";
            applyFilters();
        });

        elements.sortFilter?.addEventListener("change", event => {
            state.sort = event.target.value || "updated";
            applyFilters();
        });

        elements.clearFilters?.addEventListener("click", clearFilters);

        elements.retryButton?.addEventListener("click", loadProjects);

        elements.previousPage?.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage -= 1;
                renderProjects();
            }
        });

        elements.nextPage?.addEventListener("click", () => {
            const totalPages = Math.ceil(
                state.filteredProjects.length / CONFIG.pageSize
            );

            if (state.currentPage < totalPages) {
                state.currentPage += 1;
                renderProjects();
            }
        });

        elements.projectsList?.addEventListener("click", event => {
            const button = event.target.closest(
                '[data-action="view-project"]'
            );

            if (!button) {
                return;
            }

            const project = findProjectById(button.dataset.projectId);

            if (project) {
                openProjectModal(project);
            }
        });

        elements.projectsEmpty?.addEventListener("click", event => {
            const action = event.target.closest("[data-action]");

            if (!action) {
                return;
            }

            if (action.dataset.action === "clear-filters") {
                event.preventDefault();
                clearFilters();
                return;
            }

            if (action.dataset.action === "explore-projects") {
                window.location.href = "explore-projects.html";
            }
        });

        elements.closeModal?.addEventListener("click", closeProjectModal);
        elements.closeModalFooter?.addEventListener("click", closeProjectModal);

        elements.modal?.addEventListener("click", event => {
            if (event.target === elements.modal) {
                closeProjectModal();
            }
        });

        elements.mobileMenu?.addEventListener("click", toggleSidebar);
        elements.sidebarOverlay?.addEventListener("click", closeSidebar);

        elements.sidebar?.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", closeSidebar);
        });

        elements.logout?.addEventListener("click", event => {
            event.preventDefault();
            logout();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                if (elements.modal && !elements.modal.hidden) {
                    closeProjectModal();
                }

                closeSidebar();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) {
                closeSidebar();
            }
        });
    }

    /* -----------------------------------------------------
       INITIALIZE
    ----------------------------------------------------- */

    function initialize() {
        bindEvents();

        if (elements.modal) {
            elements.modal.hidden = true;
            elements.modal.setAttribute("aria-hidden", "true");
        }

        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.hidden = true;
        }

        if (elements.mobileMenu) {
            elements.mobileMenu.setAttribute("aria-expanded", "false");
            elements.mobileMenu.setAttribute(
                "aria-label",
                "Toggle navigation"
            );
        }

        loadStudentProfile();
        loadProjects();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }
})();
