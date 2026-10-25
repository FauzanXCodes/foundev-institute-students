
/* =========================================================
   FOUNDEV INSTITUTE WORKSPACE — PROJECTS
   File: assets/js/projects.js

   Features:
   - Load project records from PHP API
   - Update summary statistics
   - Search and filter
   - Sort by date or name
   - Desktop table and mobile cards
   - Pagination
   - CSV export
   - Add-project dialog and submission
   - Loading, empty and error states

   Shared sidebar and topbar are handled by
   institute-layout.js and are not modified here.
   ========================================================= */

(() => {
    "use strict";

    /* =====================================================
       1. CONFIGURATION
       ===================================================== */

    const CONFIG = {
        apiUrl: "../api/admin/projects.php",
        pageSize: 10,
        timeoutMs: 20000
    };

    const STATUS_LABELS = {
        pending: "Pending",
        approved: "Approved",
        in_progress: "In progress",
        submitted: "Submitted",
        under_review: "Under review",
        completed: "Completed",
        rejected: "Rejected",
        unknown: "Unknown"
    };

    const STATUS_CLASSES = {
        pending: "pending",
        approved: "approved",
        in_progress: "in-progress",
        submitted: "submitted",
        under_review: "under-review",
        completed: "completed",
        rejected: "rejected",
        unknown: "unknown"
    };

    /* =====================================================
       2. ELEMENT REFERENCES
       ===================================================== */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const el = {
        search: $("#project-search"),
        statusFilter: $("#project-status-filter"),
        sort: $("#project-sort"),

        total: $("#projects-total"),
        inProgress: $("#projects-in-progress"),
        pendingReview: $("#projects-pending-review"),

        resultsCount: $("#projects-results-count"),
        clearFilters: $("#clear-project-filters"),

        loading: $("#projects-loading"),
        error: $("#projects-error"),
        errorMessage: $("#projects-error-message"),

        empty: $("#projects-empty"),
        emptyTitle: $("#projects-empty-title"),
        emptyDescription: $("#projects-empty-description"),
        emptyAction: $("#projects-empty-action"),

        tableWrap: $("#projects-table-wrap"),
        tableBody: $("#projects-table-body"),
        mobileList: $("#projects-mobile-list"),

        pagination: $("#projects-pagination"),
        paginationInfo: $("#projects-pagination-info"),
        pageIndicator: $("#projects-page-indicator"),
        previousPage: $("#projects-previous-page"),
        nextPage: $("#projects-next-page"),

        addButton: $("#add-project-button"),
        exportButton: $("#export-projects-button"),
        refreshButton: $("#refresh-projects-button"),
        retryButton: $("#retry-projects-button"),

        dialog: $("#add-project-dialog"),
        form: $("#project-form"),
        formMessage: $("#project-form-message"),
        saveButton: $("#save-project-button"),

        name: $("#new-project-name"),
        student: $("#new-project-student"),
        technology: $("#new-project-technology"),
        description: $("#new-project-description"),
        status: $("#new-project-status"),

        systemStatus: $("#system-status"),
        systemStatusText: $("#system-status-text"),

        date: $("#dashboard-date"),
        year: $("#current-year")
    };

    /* =====================================================
       3. APPLICATION STATE
       ===================================================== */

    let projects = [];
    let currentPage = 1;
    let isLoading = false;
    let isSaving = false;
    let loadController = null;
    let loadSequence = 0;

    /* =====================================================
       4. BASIC HELPERS
       ===================================================== */

    function text(value) {
        return String(value ?? "").trim();
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function initials(value) {
        const parts = text(value).split(/\s+/).filter(Boolean);

        if (!parts.length) {
            return "NA";
        }

        return parts.slice(0, 2)
            .map(part => part.charAt(0))
            .join("")
            .toUpperCase();
    }

    function normalizeStatus(value) {
        const normalized = text(value)
            .toLowerCase()
            .replace(/[\s-]+/g, "_");

        return Object.hasOwn(STATUS_LABELS, normalized)
            ? normalized
            : "unknown";
    }

    function statusLabel(status) {
        return STATUS_LABELS[status] || STATUS_LABELS.unknown;
    }

    function statusClass(status) {
        return STATUS_CLASSES[status] || STATUS_CLASSES.unknown;
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return text(value) || "—";
        }

        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function dateValue(value) {
        if (!value) {
            return 0;
        }

        const timestamp = new Date(value).getTime();

        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    function getProjectId(project) {
        return project.id ??
            project.project_id ??
            project.projectId ??
            null;
    }

    function getProjectName(project) {
        return text(
            project.project_name ||
            project.name ||
            project.title ||
            "Untitled project"
        );
    }

    function getStudentName(project) {
        const student = project.student;

        if (typeof student === "string") {
            return text(student);
        }

        if (student && typeof student === "object") {
            return text(
                student.full_name ||
                student.name ||
                ""
            );
        }

        if (typeof project.team === "string") {
            return text(project.team);
        }

        return text(
            project.student_name ||
            project.full_name ||
            project.team_name ||
            project.owner_name ||
            ""
        );
    }

    function getTechnologies(project) {
        const value =
            project.technologies ??
            project.technology ??
            project.tech_stack ??
            project.domain ??
            "";

        if (Array.isArray(value)) {
            return value.map(item => {
                if (typeof item === "string") {
                    return text(item);
                }

                return text(item?.name || item?.label || "");
            }).filter(Boolean);
        }

        return text(value)
            .split(/[,;|]/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function getDescription(project) {
        return text(
            project.description ||
            project.project_description ||
            project.summary ||
            ""
        );
    }

    function getProjectDate(project) {
        return (
            project.submitted_at ||
            project.submission_date ||
            project.created_at ||
            project.createdAt ||
            project.created_date ||
            project.date ||
            ""
        );
    }

    function normalizeProject(project) {
        return {
            ...project,
            _id: getProjectId(project),
            _name: getProjectName(project),
            _student: getStudentName(project),
            _technologies: getTechnologies(project),
            _description: getDescription(project),
            _status: normalizeStatus(
                project.status ||
                project.project_status ||
                project.approval_status
            ),
            _date: getProjectDate(project)
        };
    }

    /* =====================================================
       5. API HELPER
       ===================================================== */

    async function apiRequest(action, options = {}) {
        const controller = new AbortController();

        const timeoutId = window.setTimeout(
            () => controller.abort(),
            CONFIG.timeoutMs
        );

        const url = new URL(CONFIG.apiUrl, window.location.href);

        if (action) {
            url.searchParams.set("action", action);
        }

        const headers = {
            Accept: "application/json"
        };

        const fetchOptions = {
            method: options.method || "GET",
            credentials: "same-origin",
            headers,
            signal: controller.signal
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            fetchOptions.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url.toString(), fetchOptions);
            const responseText = await response.text();

            let data;

            try {
                data = responseText
                    ? JSON.parse(responseText)
                    : {};
            } catch {
                throw new Error(
                    "The API returned invalid JSON. Check projects.php for PHP warnings or errors."
                );
            }

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    data.error ||
                    `The request failed with HTTP ${response.status}.`
                );
            }

            return data;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error(
                    "The request timed out. Please check the server and retry."
                );
            }

            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    /* =====================================================
       6. CONNECTION STATUS
       ===================================================== */

    function setConnectionStatus(state, message) {
        if (el.systemStatus) {
            el.systemStatus.dataset.state = state;
        }

        if (el.systemStatusText) {
            el.systemStatusText.textContent = message;
        }
    }

    /* =====================================================
       7. LOADING / ERROR STATES
       ===================================================== */

    function setLoading(show) {
        isLoading = show;

        if (el.loading) {
            el.loading.hidden = !show;
        }

        if (show) {
            if (el.error) el.error.hidden = true;
            if (el.empty) el.empty.hidden = true;
            if (el.tableWrap) el.tableWrap.hidden = true;
            if (el.mobileList) el.mobileList.hidden = true;
            if (el.pagination) el.pagination.hidden = true;
        }
    }

    function showError(message) {
        if (el.loading) el.loading.hidden = true;
        if (el.error) el.error.hidden = false;
        if (el.errorMessage) el.errorMessage.textContent = message;
        if (el.empty) el.empty.hidden = true;
        if (el.tableWrap) el.tableWrap.hidden = true;
        if (el.mobileList) el.mobileList.hidden = true;
        if (el.pagination) el.pagination.hidden = true;

        if (el.resultsCount) {
            el.resultsCount.textContent = "Unable to load project records.";
        }

        setConnectionStatus("error", "Connection issue");
    }

    /* =====================================================
       8. RESPONSE NORMALIZATION
       ===================================================== */

    function extractProjects(response) {
        if (Array.isArray(response)) {
            return response;
        }

        if (Array.isArray(response.projects)) {
            return response.projects;
        }

        if (Array.isArray(response.data)) {
            return response.data;
        }

        if (response.data && Array.isArray(response.data.projects)) {
            return response.data.projects;
        }

        if (response.result && Array.isArray(response.result.projects)) {
            return response.result.projects;
        }

        return null;
    }

    /* =====================================================
       9. LOAD PROJECTS
       ===================================================== */

    async function loadProjects() {
        if (loadController) {
            loadController.abort();
        }

        const sequence = ++loadSequence;
        loadController = new AbortController();

        setLoading(true);
        setConnectionStatus("loading", "Connecting");

        if (el.refreshButton) {
            el.refreshButton.disabled = true;
            el.refreshButton.classList.add("is-loading");
        }

        try {
            const response = await apiRequest("list");

            if (sequence !== loadSequence) {
                return;
            }

            const records = extractProjects(response);

            if (!records) {
                throw new Error(
                    "The API response does not contain a projects array. Check the JSON format returned by projects.php."
                );
            }

            projects = records.map(normalizeProject);

            updateSummary(response);
            currentPage = 1;
            renderProjects();

            setConnectionStatus("connected", "Connected");
        } catch (error) {
            if (sequence !== loadSequence) {
                return;
            }

            console.error("[Foundev Projects]", error);
            showError(error.message || "Could not load project records.");
        } finally {
            if (sequence === loadSequence) {
                setLoading(false);

                if (el.refreshButton) {
                    el.refreshButton.disabled = false;
                    el.refreshButton.classList.remove("is-loading");
                }
            }
        }
    }

    /* =====================================================
       10. SUMMARY STATISTICS
       ===================================================== */

    function updateSummary(response = {}) {
        const stats =
            response.stats ||
            response.statistics ||
            response.data?.stats ||
            {};

        const total = Number(
            stats.total ??
            stats.total_projects ??
            projects.length
        );

        const inProgress = Number(
            stats.in_progress ??
            stats.inProgress ??
            stats.in_progress_projects ??
            projects.filter(project =>
                project._status === "in_progress"
            ).length
        );

        const pendingReview = Number(
            stats.pending_review ??
            stats.pendingReview ??
            stats.under_review ??
            projects.filter(project =>
                ["submitted", "under_review"].includes(project._status)
            ).length
        );

        if (el.total) {
            el.total.textContent = total.toLocaleString("en-IN");
        }

        if (el.inProgress) {
            el.inProgress.textContent =
                inProgress.toLocaleString("en-IN");
        }

        if (el.pendingReview) {
            el.pendingReview.textContent =
                pendingReview.toLocaleString("en-IN");
        }
    }

    /* =====================================================
       11. SEARCH, FILTER AND SORT
       ===================================================== */

    function getFilteredProjects() {
        const query = text(el.search?.value).toLocaleLowerCase();

        const selectedStatus = el.statusFilter?.value || "all";
        const sortMode = el.sort?.value || "newest";

        const filtered = projects.filter(project => {
            const matchesStatus =
                selectedStatus === "all" ||
                project._status === selectedStatus;

            const searchable = [
                project._name,
                project._student,
                project._description,
                project._technologies.join(" "),
                project._status
            ].join(" ").toLocaleLowerCase();

            return matchesStatus &&
                (!query || searchable.includes(query));
        });

        filtered.sort((a, b) => {
            switch (sortMode) {
                case "oldest":
                    return dateValue(a._date) - dateValue(b._date);

                case "name-asc":
                    return a._name.localeCompare(b._name);

                case "name-desc":
                    return b._name.localeCompare(a._name);

                case "newest":
                default:
                    return dateValue(b._date) - dateValue(a._date);
            }
        });

        return filtered;
    }

    /* =====================================================
       12. STATUS BADGE
       ===================================================== */

    function renderStatus(status) {
        return `
            <span class="project-status project-status--${statusClass(status)}">
                ${escapeHtml(statusLabel(status))}
            </span>
        `;
    }

    /* =====================================================
       13. TECHNOLOGY TAGS
       ===================================================== */

    function renderTechnologyTags(technologies, limit = 2) {
        if (!technologies.length) {
            return '<span class="project-tech-tag">Not specified</span>';
        }

        const visible = technologies.slice(0, limit);

        const tags = visible.map(technology => `
            <span class="project-tech-tag">${escapeHtml(technology)}</span>
        `).join("");

        const extra = technologies.length - visible.length;

        return tags + (
            extra > 0
                ? `<span class="project-tech-more">+${extra}</span>`
                : ""
        );
    }

    /* =====================================================
       14. PROJECT ACTION BUTTON
       ===================================================== */

    function renderProjectActions(project) {
        if (
            project._id === null ||
            project._id === undefined ||
            project._id === ""
        ) {
            return "";
        }

        return `
            <div class="project-row-actions">
                <button
                    type="button"
                    class="project-action-button"
                    data-project-action="view"
                    data-project-id="${escapeHtml(project._id)}"
                    aria-label="View ${escapeHtml(project._name)}"
                    title="View project"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
            </div>
        `;
    }

    /* =====================================================
       15. DESKTOP TABLE ROW
       ===================================================== */

    function renderTableRow(project) {
        const student = project._student || "Unassigned";

        return `
            <tr data-project-id="${escapeHtml(project._id ?? "")}">
                <td>
                    <div class="project-identity">
                        <span class="project-avatar" aria-hidden="true">
                            ${escapeHtml(initials(project._name))}
                        </span>

                        <span class="project-identity-copy">
                            <span
                                class="project-name"
                                title="${escapeHtml(project._name)}"
                            >${escapeHtml(project._name)}</span>

                            <span
                                class="project-description"
                                title="${escapeHtml(project._description)}"
                            >${escapeHtml(project._description || "No description added")}</span>
                        </span>
                    </div>
                </td>

                <td>
                    <div class="project-student">
                        <span class="project-student-avatar" aria-hidden="true">
                            ${escapeHtml(initials(student))}
                        </span>

                        <span
                            class="project-student-name"
                            title="${escapeHtml(student)}"
                        >${escapeHtml(student)}</span>
                    </div>
                </td>

                <td>
                    <div class="project-technologies">
                        ${renderTechnologyTags(project._technologies, 2)}
                    </div>
                </td>

                <td>
                    <span class="project-date">
                        ${escapeHtml(formatDate(project._date))}
                    </span>
                </td>

                <td>${renderStatus(project._status)}</td>

                <td class="project-actions-cell">
                    ${renderProjectActions(project)}
                </td>
            </tr>
        `;
    }

    /* =====================================================
       16. MOBILE PROJECT CARD
       ===================================================== */

    function renderMobileCard(project) {
        const student = project._student || "Unassigned";

        const action = (
            project._id !== null &&
            project._id !== undefined &&
            project._id !== ""
        ) ? `
            <div class="project-mobile-card-footer">
                <button
                    type="button"
                    class="projects-button projects-button-secondary"
                    data-project-action="view"
                    data-project-id="${escapeHtml(project._id)}"
                >View project</button>
            </div>
        ` : "";

        return `
            <article
                class="project-mobile-card"
                data-project-id="${escapeHtml(project._id ?? "")}"
            >
                <div class="project-mobile-card-header">
                    <div class="project-identity">
                        <span class="project-avatar" aria-hidden="true">
                            ${escapeHtml(initials(project._name))}
                        </span>

                        <span class="project-identity-copy">
                            <span class="project-name">
                                ${escapeHtml(project._name)}
                            </span>

                            <span class="project-description">
                                ${escapeHtml(project._description || "No description added")}
                            </span>
                        </span>
                    </div>

                    ${renderStatus(project._status)}
                </div>

                <div class="project-mobile-card-details">
                    <div>
                        <span class="project-mobile-detail-label">Student / Team</span>
                        <span class="project-mobile-detail-value">
                            ${escapeHtml(student)}
                        </span>
                    </div>

                    <div>
                        <span class="project-mobile-detail-label">Created / Submitted</span>
                        <span class="project-mobile-detail-value">
                            ${escapeHtml(formatDate(project._date))}
                        </span>
                    </div>
                </div>

                <div class="project-mobile-technologies">
                    ${renderTechnologyTags(project._technologies, 4)}
                </div>

                ${action}
            </article>
        `;
    }

    /* =====================================================
       17. RENDER PROJECT LIST
       ===================================================== */

    function renderProjects() {
        const filtered = getFilteredProjects();

        const total = filtered.length;
        const totalPages = Math.max(
            1,
            Math.ceil(total / CONFIG.pageSize)
        );

        currentPage = Math.min(currentPage, totalPages);

        const start = (currentPage - 1) * CONFIG.pageSize;

        const visibleProjects = filtered.slice(
            start,
            start + CONFIG.pageSize
        );

        const hasFilters =
            text(el.search?.value) !== "" ||
            (el.statusFilter?.value || "all") !== "all";

        if (el.resultsCount) {
            el.resultsCount.textContent =
                `${total.toLocaleString("en-IN")} project${total === 1 ? "" : "s"} found`;
        }

        if (el.clearFilters) {
            el.clearFilters.hidden = !hasFilters;
        }

        if (el.error) {
            el.error.hidden = true;
        }

        if (el.loading) {
            el.loading.hidden = true;
        }

        if (total === 0) {
            showEmptyState(hasFilters);
            return;
        }

        if (el.empty) {
            el.empty.hidden = true;
        }

        if (el.tableWrap) {
            el.tableWrap.hidden = false;
        }

        if (el.mobileList) {
            el.mobileList.hidden = false;
        }

        if (el.tableBody) {
            el.tableBody.innerHTML =
                visibleProjects.map(renderTableRow).join("");
        }

        if (el.mobileList) {
            el.mobileList.innerHTML =
                visibleProjects.map(renderMobileCard).join("");
        }

        updatePagination(total, totalPages, start, visibleProjects.length);
    }

    /* =====================================================
       18. EMPTY STATE
       ===================================================== */

    function showEmptyState(hasFilters) {
        if (el.tableWrap) {
            el.tableWrap.hidden = true;
        }

        if (el.mobileList) {
            el.mobileList.hidden = true;
        }

        if (el.pagination) {
            el.pagination.hidden = true;
        }

        if (el.empty) {
            el.empty.hidden = false;
        }

        if (el.emptyTitle) {
            el.emptyTitle.textContent = hasFilters
                ? "No matching projects"
                : "Your project directory starts here";
        }

        if (el.emptyDescription) {
            el.emptyDescription.textContent = hasFilters
                ? "Try another search term or change the selected filters."
                : "Projects will appear here once records are available for your institution.";
        }

        if (el.emptyAction) {
            el.emptyAction.textContent = hasFilters
                ? "Clear filters"
                : "Add your first project";
        }
    }

    /* =====================================================
       19. PAGINATION
       ===================================================== */

    function updatePagination(total, pages, start, count) {
        if (!el.pagination) {
            return;
        }

        el.pagination.hidden = total === 0;

        if (el.paginationInfo) {
            const first = start + 1;
            const last = start + count;

            el.paginationInfo.textContent =
                `Showing ${first}–${last} of ${total} project${total === 1 ? "" : "s"}`;
        }

        if (el.pageIndicator) {
            el.pageIndicator.textContent =
                `Page ${currentPage} of ${pages}`;
        }

        if (el.previousPage) {
            el.previousPage.disabled = currentPage <= 1;
        }

        if (el.nextPage) {
            el.nextPage.disabled = currentPage >= pages;
        }
    }

    /* =====================================================
       20. SEARCH AND FILTER EVENTS
       ===================================================== */

    function resetPageAndRender() {
        currentPage = 1;
        renderProjects();
    }

    if (el.search) {
        el.search.addEventListener("input", resetPageAndRender);
    }

    if (el.statusFilter) {
        el.statusFilter.addEventListener("change", resetPageAndRender);
    }

    if (el.sort) {
        el.sort.addEventListener("change", resetPageAndRender);
    }

    if (el.previousPage) {
        el.previousPage.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderProjects();
            }
        });
    }

    if (el.nextPage) {
        el.nextPage.addEventListener("click", () => {
            const pages = Math.max(
                1,
                Math.ceil(getFilteredProjects().length / CONFIG.pageSize)
            );

            if (currentPage < pages) {
                currentPage++;
                renderProjects();
            }
        });
    }

    function clearFilters() {
        if (el.search) el.search.value = "";
        if (el.statusFilter) el.statusFilter.value = "all";
        if (el.sort) el.sort.value = "newest";

        currentPage = 1;
        renderProjects();
    }

    if (el.clearFilters) {
        el.clearFilters.addEventListener("click", clearFilters);
    }

    /* =====================================================
       21. REFRESH / RETRY
       ===================================================== */

    if (el.refreshButton) {
        el.refreshButton.addEventListener("click", loadProjects);
    }

    if (el.retryButton) {
        el.retryButton.addEventListener("click", loadProjects);
    }

    /* =====================================================
       22. ADD PROJECT DIALOG
       ===================================================== */

    function showFormMessage(message, type = "info") {
        if (!el.formMessage) {
            return;
        }

        el.formMessage.textContent = message;
        el.formMessage.className =
            `projects-form-message is-${type}`;
        el.formMessage.hidden = false;
    }

    function clearFormMessage() {
        if (!el.formMessage) {
            return;
        }

        el.formMessage.textContent = "";
        el.formMessage.className = "projects-form-message";
        el.formMessage.hidden = true;
    }

    function openDialog() {
        if (!el.dialog) {
            return;
        }

        clearFormMessage();

        if (typeof el.dialog.showModal === "function") {
            el.dialog.showModal();
        } else {
            el.dialog.setAttribute("open", "");
        }

        window.setTimeout(() => el.name?.focus(), 50);
    }

    function closeDialog() {
        if (!el.dialog) {
            return;
        }

        if (typeof el.dialog.close === "function") {
            el.dialog.close();
        } else {
            el.dialog.removeAttribute("open");
        }
    }

    if (el.addButton) {
        el.addButton.addEventListener("click", openDialog);
    }

    if (el.emptyAction) {
        el.emptyAction.addEventListener("click", () => {
            const hasFilters =
                text(el.search?.value) !== "" ||
                (el.statusFilter?.value || "all") !== "all";

            if (hasFilters) {
                clearFilters();
            } else {
                openDialog();
            }
        });
    }

    $$("[data-close-project-dialog]").forEach(button => {
        button.addEventListener("click", closeDialog);
    });

    if (el.dialog) {
        el.dialog.addEventListener("click", event => {
            if (event.target === el.dialog) {
                closeDialog();
            }
        });
    }

    /* =====================================================
       23. CREATE PROJECT
       ===================================================== */

    async function createProject(event) {
        event.preventDefault();

        if (isSaving || !el.form) {
            return;
        }

        clearFormMessage();

        const projectName = text(el.name?.value);

        if (!projectName) {
            showFormMessage("Please enter a project name.", "error");
            el.name?.focus();
            return;
        }

        const payload = {
            action: "create",
            project_name: projectName,
            student_name: text(el.student?.value),
            technology: text(el.technology?.value),
            description: text(el.description?.value),
            status: el.status?.value || "pending"
        };

        isSaving = true;

        if (el.saveButton) {
            el.saveButton.disabled = true;
            el.saveButton.textContent = "Saving…";
        }

        try {
            const response = await apiRequest("create", {
                method: "POST",
                body: payload
            });

            if (response.success === false) {
                throw new Error(response.message || "Project could not be saved.");
            }

            el.form.reset();

            await loadProjects();

            if (el.error?.hidden !== false) {
                closeDialog();
            } else {
                showFormMessage(
                    "The project may have been saved, but the list could not refresh. Refresh the page to verify.",
                    "info"
                );
            }
        } catch (error) {
            console.error("[Foundev Projects] Create failed:", error);

            showFormMessage(
                error.message || "Unable to save the project.",
                "error"
            );
        } finally {
            isSaving = false;

            if (el.saveButton) {
                el.saveButton.disabled = false;
                el.saveButton.textContent = "Add project";
            }
        }
    }

    if (el.form) {
        el.form.addEventListener("submit", createProject);
    }

    /* =====================================================
       24. CSV EXPORT
       ===================================================== */

    function exportProjects() {
        const records = getFilteredProjects();

        if (!records.length) {
            window.alert("There are no projects to export.");
            return;
        }

        const headers = [
            "Project ID",
            "Project Name",
            "Student / Team",
            "Technology",
            "Description",
            "Status",
            "Created / Submitted"
        ];

        function csvCell(value) {
            let result = String(value ?? "");

            // Reduce formula-injection risk when opening in spreadsheets.
            if (/^[\s]*[=+\-@]/.test(result)) {
                result = "'" + result;
            }

            return `"${result.replace(/"/g, '""')}"`;
        }

        const rows = records.map(project => [
            project._id ?? "",
            project._name,
            project._student,
            project._technologies.join(", "),
            project._description,
            statusLabel(project._status),
            formatDate(project._date)
        ]);

        const csv = [
            headers,
            ...rows
        ].map(row => row.map(csvCell).join(",")).join("\r\n");

        const blob = new Blob(
            ["\uFEFF", csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download =
            `foundev-projects-${new Date().toISOString().slice(0, 10)}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    if (el.exportButton) {
        el.exportButton.addEventListener("click", exportProjects);
    }

    /* =====================================================
       25. VIEW PROJECT ACTION
       ===================================================== */

    document.addEventListener("click", event => {
        const button = event.target.closest("[data-project-action]");

        if (!button) {
            return;
        }

        if (button.dataset.projectAction === "view") {
            viewProject(button.dataset.projectId);
        }
    });

    function viewProject(projectId) {
        const project = projects.find(item =>
            String(item._id) === String(projectId)
        );

        if (!project) {
            window.alert("Project not found. Refresh the list and try again.");
            return;
        }

        /*
         * This is intentionally a placeholder.
         * Connect it to a real details/review page when that route exists.
         */
        window.alert(
            `Project: ${project._name}\n` +
            `Student / Team: ${project._student || "Unassigned"}\n` +
            `Status: ${statusLabel(project._status)}\n` +
            `Technology: ${project._technologies.join(", ") || "Not specified"}`
        );
    }

    /* =====================================================
       26. PAGE DATE
       ===================================================== */

    function initializePageMetadata() {
        const now = new Date();

        if (el.date) {
            el.date.textContent = new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric"
            }).format(now);
        }

        if (el.year) {
            el.year.textContent = String(now.getFullYear());
        }
    }

    /* =====================================================
       27. INITIALIZATION
       ===================================================== */

    function initialize() {
        initializePageMetadata();
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
