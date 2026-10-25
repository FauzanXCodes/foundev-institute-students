
// ============================================================
// FOUNDEV INSTITUTE WORKSPACE — ASSESSMENTS
// File: assets/js/assessments.js
// API:  ../api/admin/assessments.php
// ============================================================

(() => {
    "use strict";

    const API_URL = "../api/admin/assessments.php";
    const PAGE_SIZE = 8;

    const state = {
        assessments: [],
        filteredAssessments: [],
        currentPage: 1,
        search: "",
        status: "all",
        sort: "newest",
        loading: false,
        submitting: false,
        requestVersion: 0
    };

    const $ = (selector, root = document) => root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const elements = {
        search: $("#assessment-search"),
        statusFilter: $("#assessment-status-filter"),
        sort: $("#assessment-sort"),

        total: $("#assessments-total"),
        active: $("#assessments-active"),
        pendingReview: $("#assessments-pending-review"),

        resultsCount: $("#assessments-results-count"),
        clearFilters: $("#clear-assessment-filters"),

        loading: $("#assessments-loading"),
        error: $("#assessments-error"),
        errorMessage: $("#assessments-error-message"),
        retry: $("#retry-assessments-button"),

        empty: $("#assessments-empty"),
        emptyTitle: $("#assessments-empty-title"),
        emptyDescription: $("#assessments-empty-description"),
        emptyAction: $("#assessments-empty-action"),

        tableWrap: $("#assessments-table-wrap"),
        tableBody: $("#assessments-table-body"),
        mobileList: $("#assessments-mobile-list"),

        pagination: $("#assessments-pagination"),
        paginationInfo: $("#assessments-pagination-info"),
        pageIndicator: $("#assessments-page-indicator"),
        previousPage: $("#assessments-previous-page"),
        nextPage: $("#assessments-next-page"),

        exportButton: $("#export-assessments-button"),
        addButton: $("#add-assessment-button"),
        refreshButton: $("#refresh-assessments-button"),

        dialog: $("#add-assessment-dialog"),
        form: $("#assessment-form"),
        titleInput: $("#new-assessment-title"),
        subjectInput: $("#new-assessment-subject"),
        mentorInput: $("#new-assessment-mentor"),
        dateInput: $("#new-assessment-date"),
        deadlineInput: $("#new-assessment-deadline"),
        descriptionInput: $("#new-assessment-description"),
        statusInput: $("#new-assessment-status"),
        formMessage: $("#assessment-form-message"),
        saveButton: $("#save-assessment-button"),

        currentYear: $("#current-year"),
        dashboardDate: $("#dashboard-date"),
        systemStatus: $("#system-status"),
        systemStatusText: $("#system-status-text")
    };

    // --------------------------------------------------------
    // Helpers
    // --------------------------------------------------------

    function escapeHTML(value) {
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

    function normaliseStatus(status) {
        const value = String(status ?? "")
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");

        const aliases = {
            "inprogress": "in_progress",
            "underreview": "under_review",
            "pending_review": "under_review",
            "review": "under_review",
            "published": "active",
            "scheduled": "upcoming",
            "finished": "completed",
            "complete": "completed",
            "pending": "upcoming"
        };

        return aliases[value] || value || "draft";
    }

    function statusLabel(status) {
        const labels = {
            draft: "Draft",
            upcoming: "Upcoming",
            active: "Active",
            in_progress: "In Progress",
            submitted: "Submitted",
            under_review: "Under Review",
            completed: "Completed",
            cancelled: "Cancelled"
        };

        const value = normaliseStatus(status);

        return labels[value] ||
            value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
    }

    function statusClass(status) {
        return normaliseStatus(status).replace(/[^a-z0-9_-]/g, "");
    }

    function getAssessmentId(assessment) {
        return assessment.id ??
            assessment.assessment_id ??
            assessment.assessmentId ??
            "";
    }

    function getAssessmentTitle(assessment) {
        return assessment.title ??
            assessment.assessment_title ??
            assessment.name ??
            "Untitled assessment";
    }

    function getAssessmentSubject(assessment) {
        return assessment.subject ??
            assessment.subject_name ??
            assessment.technology ??
            "";
    }

    function getAssessmentMentor(assessment) {
        return assessment.mentor_name ??
            assessment.mentor ??
            assessment.instructor_name ??
            "";
    }

    function getAssessmentDate(assessment) {
        return assessment.assessment_date ??
            assessment.scheduled_date ??
            assessment.start_date ??
            assessment.date ??
            "";
    }

    function getAssessmentDeadline(assessment) {
        return assessment.deadline ??
            assessment.due_date ??
            assessment.end_date ??
            "";
    }

    function getAssessmentDescription(assessment) {
        return assessment.description ?? "";
    }

    function getAssessmentStatus(assessment) {
        return normaliseStatus(assessment.status);
    }

    function parseDate(value) {
        if (!value) return null;

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = parseDate(value);

        if (!date) {
            return String(value);
        }

        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function formatDateTime(value) {
        const date = parseDate(value);

        if (!date) return "—";

        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function compareDates(a, b) {
        const dateA = parseDate(a);
        const dateB = parseDate(b);

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateA.getTime() - dateB.getTime();
    }

    function compareText(a, b) {
        return String(a ?? "").localeCompare(
            String(b ?? ""),
            undefined,
            { sensitivity: "base", numeric: true }
        );
    }

    function setText(element, value) {
        if (element) {
            element.textContent = String(value ?? "");
        }
    }

    function showElement(element, visible) {
        if (element) {
            element.hidden = !visible;
        }
    }

    function setSystemStatus(type, message) {
        if (elements.systemStatus) {
            elements.systemStatus.dataset.status = type;
            elements.systemStatus.setAttribute(
                "aria-label",
                message || type
            );
        }

        setText(elements.systemStatusText, message);
    }

    function setLoading(loading) {
        state.loading = loading;

        showElement(elements.loading, loading);

        if (elements.refreshButton) {
            elements.refreshButton.disabled = loading;
        }

        if (loading) {
            showElement(elements.error, false);
            showElement(elements.empty, false);
            showElement(elements.tableWrap, false);
            showElement(elements.mobileList, false);
            showElement(elements.pagination, false);
        }
    }

    function showError(message) {
        setText(
            elements.errorMessage,
            message || "Unable to load assessments. Please try again."
        );

        showElement(elements.error, true);
        showElement(elements.loading, false);
        showElement(elements.empty, false);
        showElement(elements.tableWrap, false);
        showElement(elements.mobileList, false);
        showElement(elements.pagination, false);

        setSystemStatus("error", "Connection issue");
    }

    function getSearchableText(assessment) {
        return [
            getAssessmentTitle(assessment),
            getAssessmentSubject(assessment),
            getAssessmentMentor(assessment),
            getAssessmentDescription(assessment),
            statusLabel(getAssessmentStatus(assessment)),
            getAssessmentDate(assessment),
            getAssessmentDeadline(assessment)
        ].join(" ").toLowerCase();
    }

    // --------------------------------------------------------
    // API helpers
    // --------------------------------------------------------

    async function requestAPI(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? {
                    "Content-Type": "application/json"
                } : {}),
                ...(options.headers || {})
            }
        });

        const responseText = await response.text();

        let data;

        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch {
            throw new Error(
                `The server returned an invalid response (HTTP ${response.status}). ` +
                "Check the PHP endpoint for warnings or errors."
            );
        }

        if (!response.ok || data.success === false || data.status === "error") {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed with HTTP ${response.status}.`
            );
        }

        return data;
    }

    function extractAssessmentList(response) {
        // Accept common API response formats:
        // { success: true, data: [...] }
        // { success: true, assessments: [...] }
        // { data: { assessments: [...] } }

        if (Array.isArray(response)) {
            return response;
        }

        const candidates = [
            response.assessments,
            response.data,
            response.results,
            response.items
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }

            if (candidate && typeof candidate === "object") {
                if (Array.isArray(candidate.assessments)) {
                    return candidate.assessments;
                }

                if (Array.isArray(candidate.items)) {
                    return candidate.items;
                }

                if (Array.isArray(candidate.results)) {
                    return candidate.results;
                }
            }
        }

        return [];
    }

    // --------------------------------------------------------
    // Load assessments
    // --------------------------------------------------------

    async function loadAssessments() {
        const requestVersion = ++state.requestVersion;

        setLoading(true);
        setSystemStatus("loading", "Loading assessments");

        try {
            const response = await requestAPI(
                `${API_URL}?action=list`,
                { method: "GET" }
            );

            // Ignore an older request if a newer refresh has started.
            if (requestVersion !== state.requestVersion) {
                return;
            }

            state.assessments = extractAssessmentList(response);
            state.currentPage = 1;

            setLoading(false);
            setSystemStatus("online", "Connected");

            applyFilters();
        } catch (error) {
            if (requestVersion !== state.requestVersion) {
                return;
            }

            setLoading(false);
            showError(error.message);

            console.error("Failed to load assessments:", error);
        }
    }

    // --------------------------------------------------------
    // Summary cards
    // --------------------------------------------------------

    function renderSummary() {
        const assessments = state.assessments;

        const total = assessments.length;

        const active = assessments.filter(assessment => {
            const status = getAssessmentStatus(assessment);

            return [
                "active",
                "in_progress",
                "upcoming"
            ].includes(status);
        }).length;

        const pendingReview = assessments.filter(assessment => {
            return [
                "submitted",
                "under_review"
            ].includes(getAssessmentStatus(assessment));
        }).length;

        setText(elements.total, total);
        setText(elements.active, active);
        setText(elements.pendingReview, pendingReview);
    }

    // --------------------------------------------------------
    // Filtering and sorting
    // --------------------------------------------------------

    function applyFilters() {
        const query = state.search.trim().toLowerCase();

        let results = state.assessments.filter(assessment => {
            const matchesSearch =
                !query || getSearchableText(assessment).includes(query);

            const assessmentStatus = getAssessmentStatus(assessment);

            const matchesStatus =
                state.status === "all" ||
                assessmentStatus === normaliseStatus(state.status);

            return matchesSearch && matchesStatus;
        });

        results.sort((a, b) => {
            switch (state.sort) {
                case "oldest":
                    return compareDates(
                        a.created_at ?? a.createdAt ?? getAssessmentDate(a),
                        b.created_at ?? b.createdAt ?? getAssessmentDate(b)
                    );

                case "deadline-asc":
                    return compareDates(
                        getAssessmentDeadline(a),
                        getAssessmentDeadline(b)
                    );

                case "name-asc":
                    return compareText(
                        getAssessmentTitle(a),
                        getAssessmentTitle(b)
                    );

                case "name-desc":
                    return compareText(
                        getAssessmentTitle(b),
                        getAssessmentTitle(a)
                    );

                case "newest":
                default:
                    return compareDates(
                        b.created_at ?? b.createdAt ?? getAssessmentDate(b),
                        a.created_at ?? a.createdAt ?? getAssessmentDate(a)
                    );
            }
        });

        state.filteredAssessments = results;
        state.currentPage = Math.min(
            state.currentPage,
            Math.max(1, Math.ceil(results.length / PAGE_SIZE))
        );

        renderSummary();
        renderAssessments();
    }

    // --------------------------------------------------------
    // Assessment row templates
    // --------------------------------------------------------

    function renderStatusBadge(status) {
        const normalised = statusClass(status);

        return `
            <span class="assessment-status assessment-status-${normalised}">
                ${escapeHTML(statusLabel(status))}
            </span>
        `;
    }

    function renderTableRow(assessment) {
        const id = getAssessmentId(assessment);
        const title = getAssessmentTitle(assessment);
        const subject = getAssessmentSubject(assessment);
        const mentor = getAssessmentMentor(assessment);
        const assessmentDate = getAssessmentDate(assessment);
        const deadline = getAssessmentDeadline(assessment);
        const status = getAssessmentStatus(assessment);

        return `
            <tr data-assessment-id="${escapeHTML(id)}">
                <td>
                    <div class="assessment-name-cell">
                        <span class="assessment-name"
                              title="${escapeHTML(title)}">
                            ${escapeHTML(title)}
                        </span>
                        <span class="assessment-subtitle">
                            ${escapeHTML(getAssessmentDescription(assessment))}
                        </span>
                    </div>
                </td>

                <td>
                    <span class="assessment-subject"
                          title="${escapeHTML(subject || "—")}">
                        ${escapeHTML(subject || "—")}
                    </span>
                </td>

                <td>
                    <span class="assessment-mentor"
                          title="${escapeHTML(mentor || "—")}">
                        ${escapeHTML(mentor || "—")}
                    </span>
                </td>

                <td>
                    <span class="assessment-date">
                        ${escapeHTML(formatDate(assessmentDate))}
                    </span>
                </td>

                <td>
                    <span class="assessment-date">
                        ${escapeHTML(formatDate(deadline))}
                    </span>
                </td>

                <td>
                    ${renderStatusBadge(status)}
                </td>

                <td>
                    <div class="assessment-table-actions">
                        <button
                            type="button"
                            class="assessment-row-action"
                            data-action="view"
                            data-id="${escapeHTML(id)}"
                            aria-label="View ${escapeHTML(title)}"
                            title="View assessment">
                            <svg viewBox="0 0 24 24"
                                 fill="none"
                                 stroke="currentColor"
                                 stroke-width="1.7"
                                 stroke-linecap="round"
                                 stroke-linejoin="round"
                                 aria-hidden="true">
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderMobileCard(assessment) {
        const id = getAssessmentId(assessment);
        const title = getAssessmentTitle(assessment);
        const subject = getAssessmentSubject(assessment);
        const mentor = getAssessmentMentor(assessment);
        const assessmentDate = getAssessmentDate(assessment);
        const deadline = getAssessmentDeadline(assessment);
        const status = getAssessmentStatus(assessment);

        return `
            <article class="assessment-mobile-card"
                     data-assessment-id="${escapeHTML(id)}">

                <div class="assessment-mobile-card-top">
                    <div>
                        <h3 class="assessment-mobile-card-title">
                            ${escapeHTML(title)}
                        </h3>

                        <p class="assessment-mobile-card-subject">
                            ${escapeHTML(subject || "No subject specified")}
                        </p>
                    </div>

                    ${renderStatusBadge(status)}
                </div>

                <div class="assessment-mobile-card-details">
                    <div>
                        <span class="assessment-mobile-detail-label">
                            Mentor
                        </span>
                        <span class="assessment-mobile-detail-value">
                            ${escapeHTML(mentor || "Not assigned")}
                        </span>
                    </div>

                    <div>
                        <span class="assessment-mobile-detail-label">
                            Assessment date
                        </span>
                        <span class="assessment-mobile-detail-value">
                            ${escapeHTML(formatDate(assessmentDate))}
                        </span>
                    </div>

                    <div>
                        <span class="assessment-mobile-detail-label">
                            Deadline
                        </span>
                        <span class="assessment-mobile-detail-value">
                            ${escapeHTML(formatDate(deadline))}
                        </span>
                    </div>

                    <div>
                        <span class="assessment-mobile-detail-label">
                            Description
                        </span>
                        <span class="assessment-mobile-detail-value">
                            ${escapeHTML(
                                getAssessmentDescription(assessment) || "—"
                            )}
                        </span>
                    </div>
                </div>

                <div class="assessment-mobile-card-actions">
                    <button
                        type="button"
                        class="assessment-button assessment-button-secondary"
                        data-action="view"
                        data-id="${escapeHTML(id)}">
                        View details
                    </button>
                </div>
            </article>
        `;
    }

    // --------------------------------------------------------
    // Render list, empty state and pagination
    // --------------------------------------------------------

    function renderAssessments() {
        const total = state.filteredAssessments.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        const startIndex = (state.currentPage - 1) * PAGE_SIZE;
        const endIndex = Math.min(startIndex + PAGE_SIZE, total);

        const pageItems = state.filteredAssessments.slice(
            startIndex,
            endIndex
        );

        setText(
            elements.resultsCount,
            `${total} ${total === 1 ? "assessment" : "assessments"}`
        );

        const hasResults = total > 0;
        const hasAssessments = state.assessments.length > 0;
        const hasFilters = Boolean(
            state.search.trim() || state.status !== "all"
        );

        showElement(elements.empty, !hasResults);
        showElement(elements.tableWrap, hasResults);
        showElement(elements.mobileList, hasResults);
        showElement(elements.pagination, hasResults);

        if (!hasResults) {
            if (elements.emptyTitle) {
                elements.emptyTitle.textContent = hasFilters
                    ? "No matching assessments"
                    : "No assessments yet";
            }

            if (elements.emptyDescription) {
                elements.emptyDescription.textContent = hasFilters
                    ? "Try changing your search or filters to find an assessment."
                    : "Create your first assessment to start organising institute evaluations.";
            }

            if (elements.emptyAction) {
                elements.emptyAction.textContent = hasFilters
                    ? "Clear filters"
                    : "Create assessment";

                elements.emptyAction.dataset.action = hasFilters
                    ? "clear-filters"
                    : "create";
            }

            if (elements.tableBody) {
                elements.tableBody.innerHTML = "";
            }

            if (elements.mobileList) {
                elements.mobileList.innerHTML = "";
            }

            return;
        }

        if (elements.tableBody) {
            elements.tableBody.innerHTML = pageItems
                .map(renderTableRow)
                .join("");
        }

        if (elements.mobileList) {
            elements.mobileList.innerHTML = pageItems
                .map(renderMobileCard)
                .join("");
        }

        setText(
            elements.paginationInfo,
            `Showing ${startIndex + 1}–${endIndex} of ${total} assessments`
        );

        setText(
            elements.pageIndicator,
            `Page ${state.currentPage} of ${totalPages}`
        );

        if (elements.previousPage) {
            elements.previousPage.disabled = state.currentPage <= 1;
        }

        if (elements.nextPage) {
            elements.nextPage.disabled = state.currentPage >= totalPages;
        }
    }

    // --------------------------------------------------------
    // Search and filter event handlers
    // --------------------------------------------------------

    function handleSearch() {
        state.search = elements.search?.value ?? "";
        state.currentPage = 1;
        applyFilters();
    }

    function handleStatusFilter() {
        state.status = elements.statusFilter?.value ?? "all";
        state.currentPage = 1;
        applyFilters();
    }

    function handleSort() {
        state.sort = elements.sort?.value ?? "newest";
        state.currentPage = 1;
        applyFilters();
    }

    function clearFilters() {
        state.search = "";
        state.status = "all";
        state.currentPage = 1;

        if (elements.search) {
            elements.search.value = "";
        }

        if (elements.statusFilter) {
            elements.statusFilter.value = "all";
        }

        applyFilters();
    }

    // --------------------------------------------------------
    // CSV export
    // --------------------------------------------------------

    function csvEscape(value) {
        const string = String(value ?? "");

        return `"${string.replace(/"/g, '""')}"`;
    }

    function exportCSV() {
        const assessments = state.filteredAssessments;

        if (!assessments.length) {
            alert("There are no assessments to export.");
            return;
        }

        const headers = [
            "ID",
            "Title",
            "Subject",
            "Mentor",
            "Assessment Date",
            "Deadline",
            "Status",
            "Description"
        ];

        const rows = assessments.map(assessment => [
            getAssessmentId(assessment),
            getAssessmentTitle(assessment),
            getAssessmentSubject(assessment),
            getAssessmentMentor(assessment),
            getAssessmentDate(assessment),
            getAssessmentDeadline(assessment),
            statusLabel(getAssessmentStatus(assessment)),
            getAssessmentDescription(assessment)
        ]);

        const csv = [
            headers.map(csvEscape).join(","),
            ...rows.map(row => row.map(csvEscape).join(","))
        ].join("\r\n");

        // UTF-8 BOM helps spreadsheet applications display text correctly.
        const blob = new Blob(
            ["\uFEFF", csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `foundev-assessments-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    // --------------------------------------------------------
    // Create assessment dialog
    // --------------------------------------------------------

    function showFormMessage(message, type = "error") {
        if (!elements.formMessage) return;

        elements.formMessage.textContent = message;
        elements.formMessage.classList.remove("is-error", "is-success");
        elements.formMessage.classList.add(
            type === "success" ? "is-success" : "is-error"
        );

        showElement(elements.formMessage, true);
    }

    function clearFormMessage() {
        if (!elements.formMessage) return;

        elements.formMessage.textContent = "";
        elements.formMessage.classList.remove("is-error", "is-success");
        showElement(elements.formMessage, false);
    }

    function openCreateDialog() {
        if (!elements.dialog) {
            console.error("Assessment dialog was not found in the HTML.");
            return;
        }

        clearFormMessage();

        if (elements.form) {
            elements.form.reset();
        }

        // Default the assessment date to today, using local date.
        const now = new Date();
        const localDate = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");

        if (elements.dateInput && !elements.dateInput.value) {
            elements.dateInput.value = localDate;
        }

        if (typeof elements.dialog.showModal === "function") {
            elements.dialog.showModal();
        } else {
            elements.dialog.setAttribute("open", "");
        }

        window.setTimeout(() => {
            elements.titleInput?.focus();
        }, 0);
    }

    function closeCreateDialog() {
        if (!elements.dialog) return;

        if (typeof elements.dialog.close === "function") {
            elements.dialog.close();
        } else {
            elements.dialog.removeAttribute("open");
        }
    }

    function getFormValue(element) {
        return element ? element.value.trim() : "";
    }

    function validateAssessmentForm(payload) {
        if (!payload.title) {
            return "Please enter an assessment title.";
        }

        if (!payload.subject) {
            return "Please enter a subject or technology.";
        }

        if (
            payload.assessment_date &&
            payload.deadline &&
            payload.deadline < payload.assessment_date
        ) {
            return "The deadline cannot be earlier than the assessment date.";
        }

        return "";
    }

    async function createAssessment(event) {
        event.preventDefault();

        if (state.submitting || !elements.form) {
            return;
        }

        clearFormMessage();

        const payload = {
            action: "create",
            title: getFormValue(elements.titleInput),
            subject: getFormValue(elements.subjectInput),
            mentor_name: getFormValue(elements.mentorInput),
            assessment_date: getFormValue(elements.dateInput),
            deadline: getFormValue(elements.deadlineInput),
            description: getFormValue(elements.descriptionInput),
            status: getFormValue(elements.statusInput) || "draft"
        };

        const validationError = validateAssessmentForm(payload);

        if (validationError) {
            showFormMessage(validationError);
            return;
        }

        state.submitting = true;

        if (elements.saveButton) {
            elements.saveButton.disabled = true;
            elements.saveButton.dataset.originalText =
                elements.saveButton.textContent.trim();

            elements.saveButton.textContent = "Saving...";
        }

        try {
            const response = await requestAPI(API_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            // If the API returns the created record, use it immediately.
            const created = response.assessment ??
                (response.data && !Array.isArray(response.data)
                    ? response.data
                    : null);

            if (created && typeof created === "object") {
                state.assessments.unshift(created);
            }

            closeCreateDialog();
            elements.form.reset();

            // Reload from the database to keep the UI authoritative.
            await loadAssessments();

            // If reloading failed, the creation may still have succeeded.
            // Avoid claiming the server-side create failed just because
            // the subsequent list request failed.
            if (!state.loading && !elements.error?.hidden) {
                showFormMessage(
                    response.message ||
                    "Assessment created, but refreshing the list failed.",
                    "success"
                );
            }
        } catch (error) {
            console.error("Failed to create assessment:", error);
            showFormMessage(
                error.message || "Unable to create the assessment. Please try again."
            );
        } finally {
            state.submitting = false;

            if (elements.saveButton) {
                elements.saveButton.disabled = false;
                elements.saveButton.textContent =
                    elements.saveButton.dataset.originalText ||
                    "Create assessment";
            }
        }
    }

    // --------------------------------------------------------
    // Assessment view action
    // --------------------------------------------------------

    function viewAssessment(id) {
        const assessment = state.assessments.find(item => {
            return String(getAssessmentId(item)) === String(id);
        });

        if (!assessment) {
            alert("This assessment could not be found. Refresh the page and try again.");
            return;
        }

        const details = [
            `Title: ${getAssessmentTitle(assessment)}`,
            `Subject: ${getAssessmentSubject(assessment) || "—"}`,
            `Mentor: ${getAssessmentMentor(assessment) || "—"}`,
            `Assessment date: ${formatDate(getAssessmentDate(assessment))}`,
            `Deadline: ${formatDate(getAssessmentDeadline(assessment))}`,
            `Status: ${statusLabel(getAssessmentStatus(assessment))}`,
            `Description: ${getAssessmentDescription(assessment) || "—"}`
        ];

        // Read-only detail fallback until a dedicated detail page/dialog
        // is implemented.
        alert(details.join("\n\n"));
    }

    // --------------------------------------------------------
    // Event delegation for row and mobile actions
    // --------------------------------------------------------

    function handleActionClick(event) {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;

        if (action === "view") {
            viewAssessment(button.dataset.id);
        } else if (action === "create") {
            openCreateDialog();
        } else if (action === "clear-filters") {
            clearFilters();
        }
    }

    // --------------------------------------------------------
    // Initialise
    // --------------------------------------------------------

    function initialise() {
        if (elements.currentYear) {
            elements.currentYear.textContent = new Date().getFullYear();
        }

        if (elements.dashboardDate) {
            elements.dashboardDate.textContent =
                new Intl.DateTimeFormat("en-IN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }).format(new Date());
        }

        elements.search?.addEventListener("input", handleSearch);
        elements.statusFilter?.addEventListener("change", handleStatusFilter);
        elements.sort?.addEventListener("change", handleSort);

        elements.clearFilters?.addEventListener("click", clearFilters);
        elements.retry?.addEventListener("click", loadAssessments);
        elements.refreshButton?.addEventListener("click", loadAssessments);
        elements.exportButton?.addEventListener("click", exportCSV);
        elements.addButton?.addEventListener("click", openCreateDialog);

        elements.previousPage?.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderAssessments();
            }
        });

        elements.nextPage?.addEventListener("click", () => {
            const totalPages = Math.max(
                1,
                Math.ceil(state.filteredAssessments.length / PAGE_SIZE)
            );

            if (state.currentPage < totalPages) {
                state.currentPage++;
                renderAssessments();
            }
        });

        elements.tableBody?.addEventListener("click", handleActionClick);
        elements.mobileList?.addEventListener("click", handleActionClick);
        elements.emptyAction?.addEventListener("click", handleActionClick);

        elements.form?.addEventListener("submit", createAssessment);

        $$("[data-close-assessment-dialog]").forEach(button => {
            button.addEventListener("click", closeCreateDialog);
        });

        // Close the dialog when the user clicks its backdrop.
        elements.dialog?.addEventListener("click", event => {
            if (event.target === elements.dialog) {
                closeCreateDialog();
            }
        });

        // Check date validity as the user changes either date.
        elements.dateInput?.addEventListener("change", () => {
            if (
                elements.deadlineInput?.value &&
                elements.dateInput.value &&
                elements.deadlineInput.value < elements.dateInput.value
            ) {
                elements.deadlineInput.setCustomValidity(
                    "Deadline cannot be earlier than the assessment date."
                );
            } else {
                elements.deadlineInput?.setCustomValidity("");
            }
        });

        elements.deadlineInput?.addEventListener("change", () => {
            if (
                elements.dateInput?.value &&
                elements.deadlineInput.value &&
                elements.deadlineInput.value < elements.dateInput.value
            ) {
                elements.deadlineInput.setCustomValidity(
                    "Deadline cannot be earlier than the assessment date."
                );
            } else {
                elements.deadlineInput.setCustomValidity("");
            }
        });

        // Initial state.
        setSystemStatus("loading", "Connecting");
        loadAssessments();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialise, {
            once: true
        });
    } else {
        initialise();
    }
})();
