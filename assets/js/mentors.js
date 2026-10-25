
// ============================================================
// FOUNDEV INSTITUTE WORKSPACE — MENTORS
// File: assets/js/mentors.js
// API: ../api/admin/mentors.php
// ============================================================

(() => {
    "use strict";

    const API_URL = "../api/admin/mentors.php";
    const PAGE_SIZE = 10;

    const state = {
        mentors: [],
        filtered: [],
        currentPage: 1,
        loading: false,
        initialized: false
    };

    const $ = (id) => document.getElementById(id);

    const elements = {
        total: $("mentors-total"),
        active: $("mentors-active"),
        assigned: $("mentors-assigned"),

        search: $("mentor-search"),
        statusFilter: $("mentor-status-filter"),
        sort: $("mentor-sort"),

        tableBody: $("mentors-table-body"),
        mobileList: $("mentors-mobile-list"),

        loading: $("mentors-loading"),
        error: $("mentors-error"),
        empty: $("mentors-empty"),

        pagination: $("mentors-pagination"),
        paginationInfo: $("mentors-pagination-info"),
        previous: $("mentors-previous-page"),
        next: $("mentors-next-page"),

        addButton: $("add-mentor-button"),
        exportButton: $("export-mentors-button"),
        refreshButton: $("refresh-mentors-button"),
        clearFilters: $("clear-mentor-filters"),
        retryButton: $("retry-mentors-button"),
        emptyAction: $("mentors-empty-action"),

        dialog: $("add-mentor-dialog"),
        form: $("mentor-form"),
        name: $("new-mentor-name"),
        email: $("new-mentor-email"),
        expertise: $("new-mentor-expertise"),
        formMessage: $("mentor-form-message"),
        saveButton: $("save-mentor-button"),

        systemStatus: $("system-status")
    };

    // --------------------------------------------------------
    // Utilities
    // --------------------------------------------------------

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function firstValue(object, keys, fallback = "") {
        for (const key of keys) {
            if (
                object &&
                Object.prototype.hasOwnProperty.call(object, key) &&
                object[key] !== null &&
                object[key] !== undefined
            ) {
                return object[key];
            }
        }

        return fallback;
    }

    function getName(mentor) {
        return String(firstValue(
            mentor,
            ["full_name", "name", "mentor_name"],
            "Unnamed mentor"
        ));
    }

    function getEmail(mentor) {
        return String(firstValue(
            mentor,
            ["email", "mentor_email"],
            ""
        ));
    }

    function getExpertise(mentor) {
        return String(firstValue(
            mentor,
            ["expertise", "specialization", "skills", "domain"],
            "Not specified"
        ));
    }

    function getStatus(mentor) {
        return normalize(firstValue(
            mentor,
            ["status", "mentor_status"],
            "active"
        ));
    }

    function getAssignments(mentor) {
        const value = firstValue(
            mentor,
            ["assigned_students", "students_assigned", "assignment_count"],
            0
        );

        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : 0;
    }

    function getId(mentor) {
        return firstValue(mentor, ["id", "mentor_id", "user_id"], null);
    }

    function getInitials(name) {
        const words = String(name).trim().split(/\s+/).filter(Boolean);

        if (words.length === 0) {
            return "M";
        }

        return words.length === 1
            ? words[0].slice(0, 2).toUpperCase()
            : (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }

    function formatStatus(status) {
        if (!status) return "Unknown";

        return status
            .split(/[_\s-]+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
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

    function setSystemStatus(message, isError = false) {
        if (!elements.systemStatus) return;

        elements.systemStatus.textContent = message;
        elements.systemStatus.classList.toggle("is-error", isError);
    }

    function setFormMessage(message, type = "") {
        if (!elements.formMessage) return;

        elements.formMessage.textContent = message;
        elements.formMessage.className = "form-message";

        if (type) {
            elements.formMessage.classList.add(type);
        }

        setVisible(elements.formMessage, Boolean(message));
    }

    function setButtonLoading(button, loading, loadingText = "Saving...") {
        if (!button) return;

        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
            button.disabled = true;
        } else {
            button.textContent = button.dataset.originalText || button.textContent;
            button.disabled = false;
        }
    }

    // --------------------------------------------------------
    // API requests
    // --------------------------------------------------------

    async function requestAPI(action, options = {}) {
        const method = options.method || "GET";
        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        const requestOptions = {
            method,
            headers,
            credentials: "same-origin",
            cache: "no-store"
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            requestOptions.body = JSON.stringify(options.body);
        }

        const url = new URL(API_URL, window.location.href);

        if (action && method === "GET") {
            url.searchParams.set("action", action);
        }

        let response;

        try {
            response = await fetch(url.toString(), requestOptions);
        } catch {
            throw new Error(
                "Unable to connect to the server. Check XAMPP and your network connection."
            );
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error(
                response.status === 401 || response.status === 403
                    ? "Your session may have expired. Please sign in again."
                    : "The mentors API did not return JSON. Check the PHP endpoint and server logs."
            );
        }

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error("The server returned an invalid JSON response.");
        }

        if (!response.ok || result.success === false) {
            if (response.status === 401 || response.status === 403) {
                throw new Error("Access denied or session expired. Please sign in again.");
            }

            throw new Error(
                result.message ||
                result.error ||
                `Request failed with HTTP ${response.status}.`
            );
        }

        return result;
    }

    // --------------------------------------------------------
    // Load mentor records
    // --------------------------------------------------------

    async function loadMentors() {
        if (state.loading) return;

        state.loading = true;

        setVisible(elements.loading, true);
        setVisible(elements.error, false);
        setVisible(elements.empty, false);

        if (elements.refreshButton) {
            elements.refreshButton.disabled = true;
        }

        setSystemStatus("Connecting to server...");

        try {
            const response = await requestAPI();

            const data = response.data ?? response;

            if (!Array.isArray(data.mentors)) {
                throw new Error(
                    "The mentors API response must contain a data.mentors array."
                );
            }

            state.mentors = data.mentors;
            state.initialized = true;

            updateStats(data.stats || null);
            applyFilters();

            setSystemStatus("Connected");
        } catch (error) {
            setVisible(elements.error, true);
            setVisible(elements.empty, false);

            if (elements.tableBody) {
                elements.tableBody.innerHTML = "";
            }

            if (elements.mobileList) {
                elements.mobileList.innerHTML = "";
            }

            setText(
                $("mentors-error-message"),
                error.message || "Unable to load mentor records."
            );

            setSystemStatus("Connection error", true);
            console.error("[Foundev Mentors]", error);
        } finally {
            state.loading = false;
            setVisible(elements.loading, false);

            if (elements.refreshButton) {
                elements.refreshButton.disabled = false;
            }
        }
    }

    // --------------------------------------------------------
    // Statistics
    // --------------------------------------------------------

    function updateStats(stats) {
        const mentors = state.mentors;

        const total = stats && stats.total !== undefined
            ? Number(stats.total)
            : mentors.length;

        const active = stats && stats.active !== undefined
            ? Number(stats.active)
            : mentors.filter(mentor => getStatus(mentor) === "active").length;

        const assigned = stats && stats.assigned_students !== undefined
            ? Number(stats.assigned_students)
            : mentors.reduce((sum, mentor) => sum + getAssignments(mentor), 0);

        setText(elements.total, Number.isFinite(total) ? total : mentors.length);
        setText(elements.active, Number.isFinite(active) ? active : 0);
        setText(elements.assigned, Number.isFinite(assigned) ? assigned : 0);
    }

    // --------------------------------------------------------
    // Filtering, searching and sorting
    // --------------------------------------------------------

    function applyFilters() {
        const query = normalize(elements.search?.value);
        const selectedStatus = normalize(elements.statusFilter?.value || "all");
        const sortBy = elements.sort?.value || "name-asc";

        let result = state.mentors.filter(mentor => {
            const searchable = [
                getName(mentor),
                getEmail(mentor),
                getExpertise(mentor),
                getStatus(mentor)
            ].map(normalize).join(" ");

            const matchesSearch = !query || searchable.includes(query);

            const status = getStatus(mentor);
            const matchesStatus =
                selectedStatus === "all" ||
                status === selectedStatus;

            return matchesSearch && matchesStatus;
        });

        result.sort((a, b) => {
            switch (sortBy) {
                case "name-desc":
                    return getName(b).localeCompare(getName(a));

                case "name-asc":
                    return getName(a).localeCompare(getName(b));

                case "email-asc":
                    return getEmail(a).localeCompare(getEmail(b));

                case "assignments-desc":
                    return getAssignments(b) - getAssignments(a);

                case "assignments-asc":
                    return getAssignments(a) - getAssignments(b);

                case "newest":
                    return String(
                        firstValue(b, ["created_at", "created_on"], "")
                    ).localeCompare(
                        String(firstValue(a, ["created_at", "created_on"], ""))
                    );

                default:
                    return getName(a).localeCompare(getName(b));
            }
        });

        state.filtered = result;
        state.currentPage = 1;

        renderMentors();
    }

    function clearFilters() {
        if (elements.search) elements.search.value = "";
        if (elements.statusFilter) elements.statusFilter.value = "all";
        if (elements.sort) elements.sort.value = "name-asc";

        applyFilters();
    }

    // --------------------------------------------------------
    // Mentor row templates
    // --------------------------------------------------------

    function statusClass(status) {
        const allowed = ["active", "pending", "inactive", "suspended"];
        return allowed.includes(status) ? status : "inactive";
    }

    function renderTableRow(mentor) {
        const name = getName(mentor);
        const email = getEmail(mentor);
        const expertise = getExpertise(mentor);
        const status = getStatus(mentor);
        const assignments = getAssignments(mentor);
        const id = getId(mentor);

        return `
            <tr>
                <td>
                    <div class="mentor-person person-cell">
                        <span class="mentor-avatar person-avatar">
                            ${escapeHTML(getInitials(name))}
                        </span>
                        <span>
                            <span class="mentor-name person-name">
                                ${escapeHTML(name)}
                            </span>
                            <span class="mentor-email person-email">
                                ${escapeHTML(email || "No email provided")}
                            </span>
                        </span>
                    </div>
                </td>
                <td>
                    <span class="mentor-expertise">
                        ${escapeHTML(expertise)}
                    </span>
                </td>
                <td>
                    <span class="mentor-assignment">${assignments}</span>
                </td>
                <td>
                    <span class="status-badge status-${statusClass(status)}">
                        ${escapeHTML(formatStatus(status))}
                    </span>
                </td>
                <td>
                    <div class="row-actions">
                        ${
                            email
                                ? `<a class="icon-button"
                                      href="mailto:${escapeHTML(email)}"
                                      aria-label="Email ${escapeHTML(name)}"
                                      title="Email mentor">✉</a>`
                                : ""
                        }
                        <button
                            class="icon-button"
                            type="button"
                            data-action="view"
                            data-id="${escapeHTML(id ?? "")}"
                            aria-label="View mentor ${escapeHTML(name)}"
                            title="View details">↗</button>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderMobileCard(mentor) {
        const name = getName(mentor);
        const email = getEmail(mentor);
        const expertise = getExpertise(mentor);
        const status = getStatus(mentor);
        const assignments = getAssignments(mentor);
        const id = getId(mentor);

        return `
            <article class="mobile-mentor-card">
                <div class="mobile-mentor-header">
                    <div class="mentor-person">
                        <span class="mentor-avatar">
                            ${escapeHTML(getInitials(name))}
                        </span>
                        <span>
                            <span class="mentor-name">${escapeHTML(name)}</span>
                            <span class="mentor-email">
                                ${escapeHTML(email || "No email provided")}
                            </span>
                        </span>
                    </div>
                    <span class="status-badge status-${statusClass(status)}">
                        ${escapeHTML(formatStatus(status))}
                    </span>
                </div>

                <div class="mobile-mentor-details">
                    <div>
                        <span class="mobile-detail-label">Expertise</span>
                        <span class="mobile-detail-value">
                            ${escapeHTML(expertise)}
                        </span>
                    </div>
                    <div>
                        <span class="mobile-detail-label">Assigned students</span>
                        <span class="mobile-detail-value">${assignments}</span>
                    </div>
                </div>

                <div class="mobile-mentor-actions">
                    ${
                        email
                            ? `<a class="secondary-button"
                                  href="mailto:${escapeHTML(email)}">Email mentor</a>`
                            : ""
                    }
                    <button
                        class="secondary-button"
                        type="button"
                        data-action="view"
                        data-id="${escapeHTML(id ?? "")}">
                        View details
                    </button>
                </div>
            </article>
        `;
    }

    // --------------------------------------------------------
    // Render directory and pagination
    // --------------------------------------------------------

    function renderMentors() {
        const total = state.filtered.length;
        const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

        state.currentPage = Math.min(state.currentPage, pageCount);

        const start = (state.currentPage - 1) * PAGE_SIZE;
        const pageMentors = state.filtered.slice(start, start + PAGE_SIZE);

        const hasResults = total > 0;

        setVisible(elements.empty, !hasResults);
        setVisible(elements.pagination, hasResults);

        if (elements.tableBody) {
            elements.tableBody.innerHTML = pageMentors
                .map(renderTableRow)
                .join("");
        }

        if (elements.mobileList) {
            elements.mobileList.innerHTML = pageMentors
                .map(renderMobileCard)
                .join("");
        }

        const first = hasResults ? start + 1 : 0;
        const last = Math.min(start + PAGE_SIZE, total);

        setText(
            elements.paginationInfo,
            `Showing ${first}–${last} of ${total} mentors`
        );

        if (elements.previous) {
            elements.previous.disabled = state.currentPage <= 1;
        }

        if (elements.next) {
            elements.next.disabled = state.currentPage >= pageCount;
        }

        renderPageNumbers(pageCount);
    }

    function renderPageNumbers(pageCount) {
        const container = $("mentors-page-numbers");

        if (!container) return;

        const startPage = Math.max(1, state.currentPage - 2);
        const endPage = Math.min(pageCount, startPage + 4);

        let html = "";

        for (let page = startPage; page <= endPage; page++) {
            html += `
                <button
                    type="button"
                    class="${page === state.currentPage ? "active" : ""}"
                    data-page="${page}"
                    aria-label="Go to page ${page}"
                    ${page === state.currentPage ? 'aria-current="page"' : ""}>
                    ${page}
                </button>
            `;
        }

        container.innerHTML = html;
    }

    function changePage(direction) {
        const pageCount = Math.max(
            1,
            Math.ceil(state.filtered.length / PAGE_SIZE)
        );

        state.currentPage = Math.max(
            1,
            Math.min(pageCount, state.currentPage + direction)
        );

        renderMentors();
    }

    // --------------------------------------------------------
    // CSV export
    // --------------------------------------------------------

    function exportCSV() {
        if (!state.filtered.length) {
            showNotice("There are no mentor records to export.", "error");
            return;
        }

        const columns = [
            ["Name", getName],
            ["Email", getEmail],
            ["Expertise", getExpertise],
            ["Assigned students", getAssignments],
            ["Status", mentor => formatStatus(getStatus(mentor))]
        ];

        const csvCell = value => {
            let textValue = String(value ?? "");

            // Prevent spreadsheet formula injection for untrusted data.
            if (/^[\s]*[=+\-@]/.test(textValue)) {
                textValue = "'" + textValue;
            }

            return `"${textValue.replace(/"/g, '""')}"`;
        };

        const rows = [
            columns.map(column => csvCell(column[0])).join(","),
            ...state.filtered.map(mentor =>
                columns.map(column => csvCell(column[1](mentor))).join(",")
            )
        ];

        const blob = new Blob(
            ["\uFEFF" + rows.join("\r\n")],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `foundev-mentors-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    // --------------------------------------------------------
    // Add mentor dialog
    // --------------------------------------------------------

    function openDialog() {
        if (!elements.dialog) {
            showNotice("The add-mentor dialog was not found in the HTML.", "error");
            return;
        }

        setFormMessage("");

        if (typeof elements.dialog.showModal === "function") {
            if (!elements.dialog.open) {
                elements.dialog.showModal();
            }
        } else {
            elements.dialog.hidden = false;
            elements.dialog.setAttribute("aria-modal", "true");
        }

        window.setTimeout(() => elements.name?.focus(), 50);
    }

    function closeDialog() {
        if (!elements.dialog) return;

        if (typeof elements.dialog.close === "function") {
            if (elements.dialog.open) {
                elements.dialog.close();
            }
        } else {
            elements.dialog.hidden = true;
            elements.dialog.removeAttribute("aria-modal");
        }

        elements.form?.reset();
        setFormMessage("");
    }

    async function createMentor(event) {
        event.preventDefault();

        if (!elements.form) return;

        const fullName = elements.name?.value.trim() || "";
        const email = elements.email?.value.trim() || "";
        const expertise = elements.expertise?.value.trim() || "";

        if (!fullName || !email || !expertise) {
            setFormMessage("Please complete all required fields.", "error");
            return;
        }

        if (!elements.form.reportValidity()) {
            return;
        }

        setButtonLoading(elements.saveButton, true, "Adding mentor...");
        setFormMessage("");

        try {
            const result = await requestAPI(null, {
                method: "POST",
                body: {
                    action: "create",
                    full_name: fullName,
                    email,
                    expertise
                }
            });

            setFormMessage(
                result.message || "Mentor added successfully.",
                "success"
            );

            await loadMentors();
            closeDialog();
            showNotice(result.message || "Mentor added successfully.", "success");
        } catch (error) {
            setFormMessage(
                error.message || "Unable to add mentor.",
                "error"
            );
        } finally {
            setButtonLoading(elements.saveButton, false);
        }
    }

    // --------------------------------------------------------
    // Notices
    // --------------------------------------------------------

    function showNotice(message, type = "") {
        const existing = $("mentors-notice");

        if (existing) {
            existing.textContent = message;
            existing.className = "form-message";

            if (type) existing.classList.add(type);

            setVisible(existing, true);
            return;
        }

        // Use a native notification fallback without requiring extra HTML.
        if (type === "error") {
            console.error("[Foundev Mentors]", message);
        } else {
            console.info("[Foundev Mentors]", message);
        }
    }

    // --------------------------------------------------------
    // View mentor details
    // --------------------------------------------------------

    function viewMentor(id) {
        if (id === "" || id === null || id === undefined) {
            showNotice("This mentor record has no identifier.", "error");
            return;
        }

        const mentor = state.mentors.find(
            item => String(getId(item)) === String(id)
        );

        if (!mentor) {
            showNotice("Mentor record not found.", "error");
            return;
        }

        const name = getName(mentor);
        const email = getEmail(mentor);
        const expertise = getExpertise(mentor);
        const status = formatStatus(getStatus(mentor));
        const assignments = getAssignments(mentor);

        // Use a safe text-only dialog rather than injecting untrusted values.
        const detailDialog = $("mentor-details-dialog");

        if (detailDialog) {
            const fields = {
                "mentor-details-name": name,
                "mentor-details-email": email || "Not provided",
                "mentor-details-expertise": expertise,
                "mentor-details-status": status,
                "mentor-details-assignments": assignments
            };

            Object.entries(fields).forEach(([elementId, value]) => {
                setText($(elementId), value);
            });

            if (typeof detailDialog.showModal === "function") {
                detailDialog.showModal();
            } else {
                setVisible(detailDialog, true);
            }

            return;
        }

        showNotice(
            `${name} — ${expertise}; status: ${status}; assigned students: ${assignments}.`,
            "success"
        );
    }

    // --------------------------------------------------------
    // Event handlers
    // --------------------------------------------------------

    function bindEvents() {
        elements.search?.addEventListener("input", applyFilters);
        elements.statusFilter?.addEventListener("change", applyFilters);
        elements.sort?.addEventListener("change", applyFilters);

        elements.addButton?.addEventListener("click", openDialog);
        elements.exportButton?.addEventListener("click", exportCSV);
        elements.refreshButton?.addEventListener("click", loadMentors);

        elements.clearFilters?.addEventListener("click", clearFilters);
        elements.retryButton?.addEventListener("click", loadMentors);
        elements.emptyAction?.addEventListener("click", openDialog);

        elements.previous?.addEventListener("click", () => changePage(-1));
        elements.next?.addEventListener("click", () => changePage(1));

        elements.form?.addEventListener("submit", createMentor);

        document.addEventListener("click", event => {
            const actionButton = event.target.closest("[data-action]");
            if (actionButton && elements.tableBody?.contains(actionButton)) {
                if (actionButton.dataset.action === "view") {
                    viewMentor(actionButton.dataset.id);
                }
                return;
            }

            const mobileAction = event.target.closest(
                '#mentors-mobile-list [data-action]'
            );

            if (mobileAction?.dataset.action === "view") {
                viewMentor(mobileAction.dataset.id);
                return;
            }

            const pageButton = event.target.closest("[data-page]");

            if (pageButton && $("mentors-page-numbers")?.contains(pageButton)) {
                const page = Number(pageButton.dataset.page);

                if (Number.isInteger(page) && page >= 1) {
                    state.currentPage = page;
                    renderMentors();
                }
            }
        });

        // Close dialog with explicit close/cancel controls.
        document.querySelectorAll("[data-close-mentor-dialog]").forEach(button => {
            button.addEventListener("click", closeDialog);
        });

        // Clicking the native dialog backdrop closes it.
        elements.dialog?.addEventListener("click", event => {
            if (event.target === elements.dialog) {
                closeDialog();
            }
        });

        $("close-mentor-details")?.addEventListener("click", () => {
            const dialog = $("mentor-details-dialog");

            if (dialog?.close) {
                dialog.close();
            } else {
                setVisible(dialog, false);
            }
        });
    }

    // --------------------------------------------------------
    // Initialize
    // --------------------------------------------------------

    function init() {
        bindEvents();

        if (!elements.tableBody) {
            console.error(
                "[Foundev Mentors] Missing #mentors-table-body in mentors.html."
            );
            return;
        }

        loadMentors();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
