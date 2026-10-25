
/* =========================================================
   FOUNDEV INSTITUTION WORKSPACE
   Student Teams — Requests, Payment & Approval
   File: assets/js/students.js

   Expected API:
   ../api/admin/students.php

   GET:
     ?action=list

   POST JSON:
     { action: "verify_payment", team_id, admin_note }
     { action: "approve", team_id, admin_note }
     { action: "reject", team_id, admin_note }
     { action: "logout" }

   Expected list response:
   {
     success: true,
     data: {
       requests: [
         {
           id, team_name, leader_name, leader_email,
           project_name, project_category, project_fee,
           status, payment_status, payment_reference,
           payment_amount, submitted_at,
           members: [
             { name, roll_number, academic_year, email }
           ]
         }
       ]
     }
   }

   Adjust the endpoint contract to match the actual PHP API.
========================================================= */

(() => {
    "use strict";

    const API_URL = "../api/admin/students.php";
    const PAGE_SIZE = 10;

    const state = {
        requests: [],
        filteredRequests: [],
        currentPage: 1,
        selectedRequest: null,
        loading: false,
        error: null
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    const elements = {
        institutionName: $("#institution-name"),
        institutionInitial: $("#institution-initial"),
        adminName: $("#admin-name"),
        adminEmail: $("#admin-email"),
        adminInitial: $("#admin-initial"),

        systemStatus: $("#system-status"),
        systemStatusText: $("#system-status-text"),
        dashboardDate: $("#dashboard-date"),
        currentYear: $("#current-year"),

        total: $("#students-total"),
        pending: $("#students-pending"),
        paymentPending: $("#students-payment-pending"),
        approved: $("#students-approved"),

        search: $("#student-search"),
        statusFilter: $("#student-status-filter"),
        paymentFilter: $("#student-payment-filter"),
        sort: $("#student-sort"),
        resultCount: $("#students-result-count"),
        clearFilters: $("#clear-student-filters"),

        loading: $("#students-loading"),
        error: $("#students-error"),
        errorMessage: $("#students-error-message"),
        empty: $("#students-empty"),
        emptyTitle: $("#students-empty-title"),
        emptyDescription: $("#students-empty-description"),

        tableWrap: $("#students-table-wrap"),
        tableBody: $("#students-table-body"),
        mobileList: $("#students-mobile-list"),

        pagination: $("#students-pagination"),
        paginationInfo: $("#students-pagination-info"),
        pageNumber: $("#students-page-number"),
        previousPage: $("#students-previous-page"),
        nextPage: $("#students-next-page"),

        refresh: $("#refresh-students-button"),
        retry: $("#retry-students-button"),
        export: $("#export-students-button"),

        dialog: $("#student-dialog"),
        closeDialog: $("#close-student-dialog"),
        cancelDialog: $("#cancel-student-dialog"),

        reviewTeamName: $("#review-team-name"),
        reviewTeamLeader: $("#review-team-leader"),
        reviewTeamEmail: $("#review-team-email"),
        reviewProjectName: $("#review-project-name"),
        reviewProjectFee: $("#review-project-fee"),
        reviewSubmittedDate: $("#review-submitted-date"),
        reviewMembers: $("#review-team-members"),

        reviewPaymentStatus: $("#review-payment-status"),
        reviewPaymentReference: $("#review-payment-reference"),
        reviewPaymentAmount: $("#review-payment-amount"),
        reviewPaymentNote: $("#review-payment-note"),
        confirmPayment: $("#confirm-payment-checkbox"),

        adminNote: $("#review-admin-note"),
        formMessage: $("#student-form-message"),

        verifyPayment: $("#verify-payment-button"),
        approve: $("#approve-student-button"),
        reject: $("#reject-student-button"),

        logout: $("#logout-button")
    };

    /* =====================================================
       GENERAL UTILITIES
    ===================================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function getValue(object, keys, fallback = "") {
        for (const key of keys) {
            const value = object?.[key];

            if (value !== undefined && value !== null && value !== "") {
                return value;
            }
        }

        return fallback;
    }

    function normalizeStatus(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");
    }

    function normalizeRequestStatus(request) {
        const status = normalizeStatus(
            getValue(request, ["status", "request_status", "approval_status"], "")
        );

        if (["approved", "accepted"].includes(status)) return "approved";
        if (["rejected", "declined"].includes(status)) return "rejected";

        const paymentStatus = normalizePaymentStatus(request);

        if ([
            "pending_review",
            "submitted",
            "pending",
            "under_review",
            "requested"
        ].includes(status)) {
            if (
                ["verified", "paid", "completed"].includes(paymentStatus) &&
                ["pending", "submitted", "under_review", "pending_review"].includes(status)
            ) {
                return "payment_verified";
            }

            return "pending_review";
        }

        if ([
            "payment_pending",
            "awaiting_payment",
            "unpaid"
        ].includes(status)) {
            return "payment_pending";
        }

        if ([
            "payment_verified",
            "verified"
        ].includes(status)) {
            return "payment_verified";
        }

        if (["active", "completed"].includes(status)) {
            return "approved";
        }

        return status || "pending_review";
    }

    function normalizePaymentStatus(request) {
        const value = normalizeStatus(
            getValue(request, ["payment_status", "payment_verification_status"], "")
        );

        if (["verified", "paid", "completed", "success", "successful"].includes(value)) {
            return "verified";
        }

        if ([
            "submitted",
            "proof_submitted",
            "under_review",
            "pending_verification"
        ].includes(value)) {
            return "submitted";
        }

        if (["rejected", "failed", "invalid"].includes(value)) {
            return "rejected";
        }

        if (["unpaid", "not_paid", "not_submitted", "pending"].includes(value)) {
            return "unpaid";
        }

        return value || "unpaid";
    }

    function getTeamId(request) {
        return getValue(request, ["id", "team_id", "request_id"], "");
    }

    function getTeamName(request) {
        return getValue(request, ["team_name", "name", "team_title"], "Unnamed team");
    }

    function getLeaderName(request) {
        return getValue(
            request,
            ["leader_name", "team_leader_name", "student_name", "leader"],
            "Not provided"
        );
    }

    function getLeaderEmail(request) {
        return getValue(
            request,
            ["leader_email", "team_leader_email", "student_email", "email"],
            "Not provided"
        );
    }

    function getProjectName(request) {
        return getValue(
            request,
            ["project_name", "selected_project_name", "project_title"],
            "Project not specified"
        );
    }

    function getMembers(request) {
        const members = getValue(
            request,
            ["members", "team_members", "students"],
            []
        );

        if (Array.isArray(members)) return members;

        if (typeof members === "string") {
            try {
                const parsed = JSON.parse(members);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }

        return [];
    }

    function getSubmittedDate(request) {
        return getValue(
            request,
            ["submitted_at", "created_at", "request_date", "created_on"],
            ""
        );
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function formatCurrency(value) {
        if (value === null || value === undefined || value === "") {
            return "Not available";
        }

        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return String(value);
        }

        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(amount);
    }

    function initials(value) {
        return String(value || "T")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0))
            .join("")
            .toUpperCase();
    }

    function setSystemStatus(status, message) {
        if (elements.systemStatus) {
            elements.systemStatus.dataset.status = status;
        }

        if (elements.systemStatusText) {
            elements.systemStatusText.textContent = message;
        }
    }

    function updateWorkspaceIdentity(data) {
        const institution = data?.institution || {};
        const admin = data?.administrator || data?.admin || {};

        const institutionName = getValue(
            institution,
            ["name", "institution_name"],
            ""
        );

        const adminName = getValue(
            admin,
            ["name", "full_name", "admin_name"],
            ""
        );

        const adminEmail = getValue(
            admin,
            ["email", "admin_email"],
            ""
        );

        if (institutionName && elements.institutionName) {
            elements.institutionName.textContent = institutionName;
        }

        if (institutionName && elements.institutionInitial) {
            elements.institutionInitial.textContent = initials(institutionName);
        }

        if (adminName && elements.adminName) {
            elements.adminName.textContent = adminName;
        }

        if (adminEmail && elements.adminEmail) {
            elements.adminEmail.textContent = adminEmail;
        }

        if (adminName && elements.adminInitial) {
            elements.adminInitial.textContent = initials(adminName);
        }
    }

    function setBusy(button, busy, busyLabel) {
        if (!button) return;

        if (!button.dataset.originalHTML) {
            button.dataset.originalHTML = button.innerHTML;
        }

        button.disabled = busy;

        if (busy) {
            button.textContent = busyLabel || "Please wait…";
        } else {
            button.innerHTML = button.dataset.originalHTML;
        }
    }

    /* =====================================================
       API REQUESTS
    ===================================================== */

    async function apiRequest(action, payload = null, options = {}) {
        const url = new URL(API_URL, window.location.href);

        const fetchOptions = {
            method: payload ? "POST" : "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        };

        if (payload) {
            fetchOptions.headers["Content-Type"] = "application/json";
            fetchOptions.body = JSON.stringify({
                ...payload,
                action
            });
        } else {
            url.searchParams.set("action", action);
        }

        if (options.signal) {
            fetchOptions.signal = options.signal;
        }

        const response = await fetch(url.toString(), fetchOptions);

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error(
                `The server returned an invalid response (HTTP ${response.status}).`
            );
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                result.message || "Your session may have expired. Please sign in again."
            );
        }

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || `The request failed (HTTP ${response.status}).`
            );
        }

        return result;
    }

    function extractRequests(result) {
        const data = result?.data ?? result;

        const possibleLists = [
            data?.requests,
            data?.teams,
            data?.applications,
            data?.student_teams,
            result?.requests,
            result?.teams
        ];

        const requests = possibleLists.find(Array.isArray);

        if (!requests) {
            throw new Error(
                "The API response did not contain a team request list. " +
                "Expected data.requests or data.teams."
            );
        }

        return {
            requests,
            data
        };
    }

    /* =====================================================
       PAGE STATES
    ===================================================== */

    function setPageState(mode) {
        if (elements.loading) {
            elements.loading.hidden = mode !== "loading";
        }

        if (elements.error) {
            elements.error.hidden = mode !== "error";
        }

        if (elements.empty) {
            elements.empty.hidden = mode !== "empty";
        }

        if (elements.tableWrap) {
            elements.tableWrap.hidden = mode !== "content";
        }

        if (elements.mobileList) {
            elements.mobileList.hidden = mode !== "content";
        }

        if (elements.pagination) {
            elements.pagination.hidden =
                mode !== "content" || state.filteredRequests.length === 0;
        }
    }

    function showError(message) {
        state.error = message;

        if (elements.errorMessage) {
            elements.errorMessage.textContent = message;
        }

        setPageState("error");
        setSystemStatus("error", "Connection issue");
    }

    /* =====================================================
       SUMMARY METRICS
    ===================================================== */

    function updateSummary() {
        const requests = state.requests;

        const pending = requests.filter(request =>
            normalizeRequestStatus(request) === "pending_review"
        ).length;

        const paymentPending = requests.filter(request =>
            normalizePaymentStatus(request) !== "verified" &&
            normalizeRequestStatus(request) !== "rejected" &&
            normalizeRequestStatus(request) !== "approved"
        ).length;

        const approved = requests.filter(request =>
            normalizeRequestStatus(request) === "approved"
        ).length;

        if (elements.total) {
            elements.total.textContent = requests.length.toLocaleString("en-IN");
        }

        if (elements.pending) {
            elements.pending.textContent = pending.toLocaleString("en-IN");
        }

        if (elements.paymentPending) {
            elements.paymentPending.textContent =
                paymentPending.toLocaleString("en-IN");
        }

        if (elements.approved) {
            elements.approved.textContent = approved.toLocaleString("en-IN");
        }
    }

    /* =====================================================
       STATUS PRESENTATION
    ===================================================== */

    function requestStatusLabel(request) {
        const status = normalizeRequestStatus(request);

        const labels = {
            pending_review: "Awaiting review",
            payment_pending: "Payment pending",
            payment_verified: "Payment verified",
            approved: "Approved",
            rejected: "Rejected",
            under_review: "Under review"
        };

        return labels[status] || status.replace(/_/g, " ");
    }

    function requestStatusClass(request) {
        const status = normalizeRequestStatus(request);

        const classes = {
            pending_review: "students-status-pending-review",
            payment_pending: "students-status-payment-pending",
            payment_verified: "students-status-payment-verified",
            approved: "students-status-approved",
            rejected: "students-status-rejected",
            under_review: "students-status-under-review"
        };

        return classes[status] || "students-status-neutral";
    }

    function paymentStatusLabel(request) {
        const status = normalizePaymentStatus(request);

        const labels = {
            unpaid: "Unpaid",
            submitted: "Proof submitted",
            verified: "Verified",
            rejected: "Payment rejected"
        };

        return labels[status] || status.replace(/_/g, " ");
    }

    function paymentStatusClass(request) {
        const status = normalizePaymentStatus(request);

        const classes = {
            unpaid: "students-status-payment-pending",
            submitted: "students-status-payment-submitted",
            verified: "students-status-payment-verified",
            rejected: "students-status-payment-rejected"
        };

        return classes[status] || "students-status-neutral";
    }

    function statusBadge(label, className) {
        return `
            <span class="students-status ${className}">
                ${escapeHTML(label)}
            </span>
        `;
    }

    /* =====================================================
       RENDER REQUEST TABLE
    ===================================================== */

    function renderTable(requests) {
        if (!elements.tableBody) return;

        if (!requests.length) {
            elements.tableBody.innerHTML = "";
            return;
        }

        elements.tableBody.innerHTML = requests.map(request => {
            const id = getTeamId(request);
            const teamName = getTeamName(request);
            const leaderName = getLeaderName(request);
            const projectName = getProjectName(request);
            const members = getMembers(request);
            const submitted = getSubmittedDate(request);

            const status = normalizeRequestStatus(request);
            const paymentStatus = normalizePaymentStatus(request);

            const canReview = !["approved", "rejected"].includes(status);

            return `
                <tr>
                    <td>
                        <div class="students-team-cell">
                            <span class="students-team-avatar">
                                ${escapeHTML(initials(teamName))}
                            </span>

                            <span class="students-team-copy">
                                <span class="students-team-name">
                                    ${escapeHTML(teamName)}
                                </span>
                                <span class="students-team-leader">
                                    Lead: ${escapeHTML(leaderName)}
                                </span>
                            </span>
                        </div>
                    </td>

                    <td>
                        <span class="students-project-name">
                            ${escapeHTML(projectName)}
                        </span>

                        ${
                            getValue(request, ["project_category", "category"], "")
                                ? `<span class="students-project-category">
                                    ${escapeHTML(
                                        getValue(request, ["project_category", "category"])
                                    )}
                                   </span>`
                                : ""
                        }
                    </td>

                    <td>
                        <span class="students-member-count">
                            ${escapeHTML(String(members.length))}
                            ${members.length === 1 ? "member" : "members"}
                        </span>
                    </td>

                    <td>
                        ${statusBadge(
                            paymentStatusLabel(request),
                            paymentStatusClass(request)
                        )}
                    </td>

                    <td>
                        ${statusBadge(
                            requestStatusLabel(request),
                            requestStatusClass(request)
                        )}
                    </td>

                    <td>
                        <span class="students-table-date">
                            ${escapeHTML(formatDate(submitted))}
                        </span>
                    </td>

                    <td>
                        <div class="students-row-actions">
                            <button
                                type="button"
                                class="students-review-button"
                                data-review-id="${escapeHTML(String(id))}"
                                ${canReview ? "" : 'data-readonly="true"'}
                            >
                                ${canReview ? "Review" : "View"}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    /* =====================================================
       RENDER MOBILE CARDS
    ===================================================== */

    function renderMobileCards(requests) {
        if (!elements.mobileList) return;

        elements.mobileList.innerHTML = requests.map(request => {
            const id = getTeamId(request);
            const teamName = getTeamName(request);
            const leaderName = getLeaderName(request);
            const projectName = getProjectName(request);
            const members = getMembers(request);
            const status = normalizeRequestStatus(request);
            const canReview = !["approved", "rejected"].includes(status);

            return `
                <article class="students-mobile-card">
                    <div class="students-mobile-card-header">
                        <div class="students-mobile-team">
                            <span class="students-team-avatar">
                                ${escapeHTML(initials(teamName))}
                            </span>

                            <div class="students-mobile-team-copy">
                                <h3>${escapeHTML(teamName)}</h3>
                                <p>Leader: ${escapeHTML(leaderName)}</p>
                            </div>
                        </div>

                        ${statusBadge(
                            requestStatusLabel(request),
                            requestStatusClass(request)
                        )}
                    </div>

                    <div class="students-mobile-details">
                        <div class="students-mobile-detail">
                            <span class="students-mobile-detail-label">Selected project</span>
                            <span class="students-mobile-detail-value">
                                ${escapeHTML(projectName)}
                            </span>
                        </div>

                        <div class="students-mobile-detail">
                            <span class="students-mobile-detail-label">Team members</span>
                            <span class="students-mobile-detail-value">
                                ${escapeHTML(String(members.length))}
                                ${members.length === 1 ? "member" : "members"}
                            </span>
                        </div>

                        <div class="students-mobile-detail">
                            <span class="students-mobile-detail-label">Payment</span>
                            ${statusBadge(
                                paymentStatusLabel(request),
                                paymentStatusClass(request)
                            )}
                        </div>

                        <div class="students-mobile-detail">
                            <span class="students-mobile-detail-label">Submitted</span>
                            <span class="students-mobile-detail-value">
                                ${escapeHTML(formatDate(getSubmittedDate(request)))}
                            </span>
                        </div>
                    </div>

                    <div class="students-mobile-card-footer">
                        <span>Team application</span>

                        <button
                            type="button"
                            class="students-review-button"
                            data-review-id="${escapeHTML(String(id))}"
                            ${canReview ? "" : 'data-readonly="true"'}
                        >
                            ${canReview ? "Review request" : "View details"}
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    /* =====================================================
       SEARCH, FILTER AND SORT
    ===================================================== */

    function searchableText(request) {
        const memberText = getMembers(request).map(member => [
            getValue(member, ["name", "full_name", "student_name"], ""),
            getValue(member, ["roll_number", "roll_no", "student_roll_number"], ""),
            getValue(member, ["academic_year", "year", "study_year"], ""),
            getValue(member, ["email", "student_email"], "")
        ].join(" ")).join(" ");

        return [
            getTeamName(request),
            getLeaderName(request),
            getLeaderEmail(request),
            getProjectName(request),
            getValue(request, ["id", "team_id", "request_id"], ""),
            getValue(request, ["project_category", "category"], ""),
            memberText
        ].join(" ").toLowerCase();
    }

    function matchesStatusFilter(request, filter) {
        if (!filter) return true;

        const requestStatus = normalizeRequestStatus(request);
        const paymentStatus = normalizePaymentStatus(request);

        switch (filter) {
            case "pending_review":
                return requestStatus === "pending_review";

            case "payment_pending":
                return paymentStatus === "unpaid" ||
                    (
                        paymentStatus !== "verified" &&
                        !["approved", "rejected"].includes(requestStatus)
                    );

            case "payment_verified":
                return paymentStatus === "verified";

            case "approved":
                return requestStatus === "approved";

            case "rejected":
                return requestStatus === "rejected";

            default:
                return requestStatus === filter;
        }
    }

    function matchesPaymentFilter(request, filter) {
        if (!filter) return true;
        return normalizePaymentStatus(request) === filter;
    }

    function sortRequests(requests) {
        const sort = elements.sort?.value || "newest";
        const sorted = [...requests];

        sorted.sort((a, b) => {
            const dateA = new Date(getSubmittedDate(a) || 0).getTime() || 0;
            const dateB = new Date(getSubmittedDate(b) || 0).getTime() || 0;

            switch (sort) {
                case "oldest":
                    return dateA - dateB;

                case "team-asc":
                    return getTeamName(a).localeCompare(getTeamName(b));

                case "team-desc":
                    return getTeamName(b).localeCompare(getTeamName(a));

                case "newest":
                default:
                    return dateB - dateA;
            }
        });

        return sorted;
    }

    function applyFilters() {
        const query = (elements.search?.value || "").trim().toLowerCase();
        const status = elements.statusFilter?.value || "";
        const payment = elements.paymentFilter?.value || "";

        let filtered = state.requests.filter(request => {
            return (
                (!query || searchableText(request).includes(query)) &&
                matchesStatusFilter(request, status) &&
                matchesPaymentFilter(request, payment)
            );
        });

        filtered = sortRequests(filtered);

        state.filteredRequests = filtered;

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

        state.currentPage = Math.min(state.currentPage, totalPages);
        state.currentPage = Math.max(1, state.currentPage);

        renderCurrentPage();

        if (elements.clearFilters) {
            elements.clearFilters.hidden = !(
                query || status || payment ||
                (elements.sort?.value && elements.sort.value !== "newest")
            );
        }
    }

    function renderCurrentPage() {
        const requests = state.filteredRequests;
        const total = requests.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const startIndex = (state.currentPage - 1) * PAGE_SIZE;
        const pageRequests = requests.slice(startIndex, startIndex + PAGE_SIZE);

        if (elements.resultCount) {
            elements.resultCount.textContent =
                `${total.toLocaleString("en-IN")} ` +
                `${total === 1 ? "request" : "requests"} found`;
        }

        if (state.loading) {
            setPageState("loading");
            return;
        }

        if (state.error) {
            setPageState("error");
            return;
        }

        if (total === 0) {
            if (elements.emptyTitle) {
                elements.emptyTitle.textContent = state.requests.length
                    ? "No matching team requests"
                    : "No team requests yet";
            }

            if (elements.emptyDescription) {
                elements.emptyDescription.textContent = state.requests.length
                    ? "Try changing your search or filters to find a team application."
                    : "Student teams will appear here after they submit project requests.";
            }

            setPageState("empty");
            return;
        }

        setPageState("content");

        renderTable(pageRequests);
        renderMobileCards(pageRequests);

        if (elements.paginationInfo) {
            const first = startIndex + 1;
            const last = Math.min(startIndex + PAGE_SIZE, total);

            elements.paginationInfo.textContent =
                `Showing ${first}–${last} of ${total} requests`;
        }

        if (elements.pageNumber) {
            elements.pageNumber.textContent =
                `Page ${state.currentPage} of ${totalPages}`;
        }

        if (elements.previousPage) {
            elements.previousPage.disabled = state.currentPage <= 1;
        }

        if (elements.nextPage) {
            elements.nextPage.disabled = state.currentPage >= totalPages;
        }
    }

    /* =====================================================
       LOAD TEAM REQUESTS
    ===================================================== */

    async function loadRequests() {
        if (state.loading) return;

        state.loading = true;
        state.error = null;

        setPageState("loading");
        setBusy(elements.refresh, true, "Refreshing…");
        setSystemStatus("loading", "Loading requests");

        try {
            const result = await apiRequest("list");
            const extracted = extractRequests(result);

            state.requests = extracted.requests;
            state.error = null;

            updateWorkspaceIdentity(extracted.data);
            updateSummary();

            state.loading = false;

            setSystemStatus("connected", "Connected");

            applyFilters();
        } catch (error) {
            state.loading = false;

            showError(
                error.message ||
                "Unable to load team requests. Please try again."
            );
        } finally {
            setBusy(elements.refresh, false);
        }
    }

    /* =====================================================
       TEAM REVIEW DIALOG
    ===================================================== */

    function setFormMessage(message, type = "error") {
        if (!elements.formMessage) return;

        elements.formMessage.textContent = message;
        elements.formMessage.hidden = !message;
        elements.formMessage.classList.toggle("is-success", type === "success");
    }

    function setText(element, value) {
        if (element) {
            element.textContent = value == null || value === "" ? "—" : String(value);
        }
    }

    function renderMembers(members) {
        if (!elements.reviewMembers) return;

        if (!members.length) {
            elements.reviewMembers.innerHTML =
                "<p>No member details were returned by the server.</p>";
            return;
        }

        elements.reviewMembers.innerHTML = members.map((member, index) => {
            const name = getValue(
                member,
                ["name", "full_name", "student_name"],
                `Member ${index + 1}`
            );

            const roll = getValue(
                member,
                ["roll_number", "roll_no", "student_roll_number"],
                "Not provided"
            );

            const year = getValue(
                member,
                ["academic_year", "year", "study_year"],
                "Not provided"
            );

            return `
                <div class="students-member-row">
                    <div>
                        <span class="students-member-label">Member name</span>
                        <span class="students-member-value">
                            ${escapeHTML(name)}
                        </span>
                    </div>

                    <div>
                        <span class="students-member-label">Roll number</span>
                        <span class="students-member-value">
                            ${escapeHTML(roll)}
                        </span>
                    </div>

                    <div>
                        <span class="students-member-label">Academic year</span>
                        <span class="students-member-value">
                            ${escapeHTML(year)}
                        </span>
                    </div>
                </div>
            `;
        }).join("");
    }

    function updateReviewButtons(request) {
        const requestStatus = normalizeRequestStatus(request);
        const paymentStatus = normalizePaymentStatus(request);
        const finalStatus = ["approved", "rejected"].includes(requestStatus);
        const paymentVerified = paymentStatus === "verified";

        if (elements.confirmPayment) {
            elements.confirmPayment.checked = false;
            elements.confirmPayment.disabled = finalStatus || paymentVerified;
        }

        if (elements.verifyPayment) {
            elements.verifyPayment.hidden = finalStatus || paymentVerified;
            elements.verifyPayment.disabled = finalStatus || paymentVerified;
        }

        if (elements.approve) {
            elements.approve.disabled = finalStatus || !paymentVerified;
            elements.approve.title = paymentVerified
                ? "Approve this team"
                : "Verify payment before approving this team";
        }

        if (elements.reject) {
            elements.reject.disabled = finalStatus;
        }

        if (elements.reviewPaymentNote) {
            if (paymentVerified) {
                elements.reviewPaymentNote.textContent =
                    "The server reports this payment as verified. Confirm your records before approving.";
            } else {
                elements.reviewPaymentNote.textContent =
                    "Check the actual payment records. A transaction reference or screenshot alone is not proof of receipt.";
            }
        }
    }

    function openReviewDialog(id) {
        const request = state.requests.find(
            item => String(getTeamId(item)) === String(id)
        );

        if (!request || !elements.dialog) return;

        state.selectedRequest = request;

        setFormMessage("");

        if (elements.adminNote) {
            elements.adminNote.value = getValue(
                request,
                ["admin_note", "review_note"],
                ""
            );
        }

        setText(elements.reviewTeamName, getTeamName(request));
        setText(elements.reviewTeamLeader, getLeaderName(request));
        setText(elements.reviewTeamEmail, getLeaderEmail(request));
        setText(elements.reviewProjectName, getProjectName(request));

        setText(
            elements.reviewProjectFee,
            formatCurrency(
                getValue(request, ["project_fee", "fee", "amount_due"], "")
            )
        );

        setText(elements.reviewSubmittedDate, formatDate(getSubmittedDate(request)));

        setText(
            elements.reviewPaymentStatus,
            paymentStatusLabel(request)
        );

        setText(
            elements.reviewPaymentReference,
            getValue(
                request,
                ["payment_reference", "transaction_reference", "transaction_id"],
                "Not provided"
            )
        );

        setText(
            elements.reviewPaymentAmount,
            formatCurrency(
                getValue(
                    request,
                    ["payment_amount", "amount_paid", "paid_amount"],
                    ""
                )
            )
        );

        renderMembers(getMembers(request));
        updateReviewButtons(request);

        if (!elements.dialog.open) {
            elements.dialog.showModal();
        }
    }

    function closeReviewDialog() {
        if (elements.dialog?.open) {
            elements.dialog.close();
        }

        state.selectedRequest = null;
    }

    /* =====================================================
       PAYMENT AND DECISION ACTIONS
    ===================================================== */

    async function submitDecision(action) {
        const request = state.selectedRequest;

        if (!request) {
            setFormMessage("Select a team request first.");
            return;
        }

        const teamId = getTeamId(request);

        if (teamId === "") {
            setFormMessage("This request does not have a valid team ID.");
            return;
        }

        const paymentStatus = normalizePaymentStatus(request);
        const requestStatus = normalizeRequestStatus(request);

        if (["approved", "rejected"].includes(requestStatus)) {
            setFormMessage("This request has already received a final decision.");
            return;
        }

        if (action === "verify_payment") {
            if (!elements.confirmPayment?.checked) {
                setFormMessage(
                    "Confirm that you independently verified receipt of payment before continuing."
                );
                return;
            }

            if (paymentStatus === "verified") {
                setFormMessage("Payment is already marked as verified.");
                return;
            }
        }

        if (action === "approve" && paymentStatus !== "verified") {
            setFormMessage(
                "Payment must be verified before this team can be approved."
            );
            return;
        }

        if (action === "reject") {
            const confirmed = window.confirm(
                `Reject the request from "${getTeamName(request)}"?`
            );

            if (!confirmed) return;
        }

        const button = action === "verify_payment"
            ? elements.verifyPayment
            : action === "approve"
                ? elements.approve
                : elements.reject;

        const labels = {
            verify_payment: "Verifying…",
            approve: "Approving…",
            reject: "Rejecting…"
        };

        setFormMessage("");
        setBusy(button, true, labels[action]);

        try {
            const result = await apiRequest(action, {
                team_id: teamId,
                admin_note: elements.adminNote?.value.trim() || ""
            });

            const data = result.data || {};

            if (action === "verify_payment") {
                const updatedRequest = {
                    ...request,
                    ...(data.request || {}),
                    payment_status: "verified"
                };

                state.requests = state.requests.map(item =>
                    String(getTeamId(item)) === String(teamId)
                        ? updatedRequest
                        : item
                );

                state.selectedRequest = updatedRequest;

                setFormMessage(
                    result.message || "Payment verification recorded.",
                    "success"
                );
            }

            if (action === "approve") {
                const updatedRequest = {
                    ...request,
                    ...(data.request || {}),
                    status: "approved"
                };

                state.requests = state.requests.map(item =>
                    String(getTeamId(item)) === String(teamId)
                        ? updatedRequest
                        : item
                );

                state.selectedRequest = updatedRequest;

                setFormMessage(
                    result.message || "Team approved successfully.",
                    "success"
                );
            }

            if (action === "reject") {
                const updatedRequest = {
                    ...request,
                    ...(data.request || {}),
                    status: "rejected"
                };

                state.requests = state.requests.map(item =>
                    String(getTeamId(item)) === String(teamId)
                        ? updatedRequest
                        : item
                );

                state.selectedRequest = updatedRequest;

                setFormMessage(
                    result.message || "Team request rejected.",
                    "success"
                );
            }

            /*
             * Update the dialog using the new state.
             * Preserve the admin note and display the result message.
             */
            const message = elements.formMessage?.textContent || "";

            updateSummary();
            updateReviewButtons(state.selectedRequest);

            if (elements.reviewPaymentStatus) {
                elements.reviewPaymentStatus.textContent =
                    paymentStatusLabel(state.selectedRequest);
            }

            if (action === "approve" || action === "reject") {
                /*
                 * Close after a short confirmation is displayed.
                 * Reload the list from the server after closing.
                 */
                window.setTimeout(() => {
                    closeReviewDialog();
                    loadRequests();
                }, 900);
            } else {
                applyFilters();
                setFormMessage(message, "success");
            }
        } catch (error) {
            setFormMessage(
                error.message || "The action could not be completed."
            );
        } finally {
            setBusy(button, false);
        }
    }

    /* =====================================================
       CSV EXPORT
    ===================================================== */

    function csvEscape(value) {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
    }

    function exportRequests() {
        const requests = state.filteredRequests;

        if (!requests.length) {
            window.alert("There are no team requests to export.");
            return;
        }

        const headings = [
            "Request ID",
            "Team Name",
            "Team Leader",
            "Leader Email",
            "Project",
            "Member Count",
            "Team Members",
            "Roll Numbers",
            "Academic Years",
            "Payment Status",
            "Payment Reference",
            "Payment Amount",
            "Request Status",
            "Submitted At"
        ];

        const rows = requests.map(request => {
            const members = getMembers(request);

            return [
                getTeamId(request),
                getTeamName(request),
                getLeaderName(request),
                getLeaderEmail(request),
                getProjectName(request),
                members.length,
                members.map(member =>
                    getValue(member, ["name", "full_name", "student_name"], "")
                ).join("; "),
                members.map(member =>
                    getValue(member, ["roll_number", "roll_no"], "")
                ).join("; "),
                members.map(member =>
                    getValue(member, ["academic_year", "year"], "")
                ).join("; "),
                paymentStatusLabel(request),
                getValue(
                    request,
                    ["payment_reference", "transaction_reference", "transaction_id"],
                    ""
                ),
                getValue(
                    request,
                    ["payment_amount", "amount_paid", "paid_amount"],
                    ""
                ),
                requestStatusLabel(request),
                getSubmittedDate(request)
            ];
        });

        const csv = [
            headings,
            ...rows
        ].map(row => row.map(csvEscape).join(",")).join("\r\n");

        const blob = new Blob(
            ["\uFEFF", csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download =
            `foundev-team-requests-${new Date().toISOString().slice(0, 10)}.csv`;

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }

    /* =====================================================
       SIDEBAR ACCOUNT MENU / LOGOUT
    ===================================================== */

    function initializeAccountMenu() {
        const menuButton = $("#account-menu-button");
        const menu = $("#account-menu");

        if (!menuButton || !menu) return;

        menuButton.addEventListener("click", event => {
            event.stopPropagation();

            const isOpen = menuButton.getAttribute("aria-expanded") === "true";

            menuButton.setAttribute("aria-expanded", String(!isOpen));
            menu.hidden = isOpen;
        });

        document.addEventListener("click", event => {
            if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
                menu.hidden = true;
                menuButton.setAttribute("aria-expanded", "false");
            }
        });
    }

    async function logout() {
        if (!window.confirm("Are you sure you want to sign out?")) {
            return;
        }

        if (elements.logout) {
            setBusy(elements.logout, true, "Signing out…");
        }

        try {
            await apiRequest("logout", {});
        } catch (error) {
            /*
             * The server may already have expired the session.
             * Redirect to the login page so the user can authenticate again.
             */
        } finally {
            window.location.href = "login.html";
        }
    }

    /* =====================================================
       EVENT LISTENERS
    ===================================================== */

    function bindEvents() {
        elements.refresh?.addEventListener("click", loadRequests);
        elements.retry?.addEventListener("click", loadRequests);
        elements.export?.addEventListener("click", exportRequests);

        elements.search?.addEventListener("input", () => {
            state.currentPage = 1;
            applyFilters();
        });

        elements.statusFilter?.addEventListener("change", () => {
            state.currentPage = 1;
            applyFilters();
        });

        elements.paymentFilter?.addEventListener("change", () => {
            state.currentPage = 1;
            applyFilters();
        });

        elements.sort?.addEventListener("change", () => {
            state.currentPage = 1;
            applyFilters();
        });

        elements.clearFilters?.addEventListener("click", () => {
            if (elements.search) elements.search.value = "";
            if (elements.statusFilter) elements.statusFilter.value = "";
            if (elements.paymentFilter) elements.paymentFilter.value = "";
            if (elements.sort) elements.sort.value = "newest";

            state.currentPage = 1;
            applyFilters();
        });

        elements.previousPage?.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage -= 1;
                renderCurrentPage();
            }
        });

        elements.nextPage?.addEventListener("click", () => {
            const totalPages = Math.max(
                1,
                Math.ceil(state.filteredRequests.length / PAGE_SIZE)
            );

            if (state.currentPage < totalPages) {
                state.currentPage += 1;
                renderCurrentPage();
            }
        });

        /*
         * Event delegation handles buttons rendered dynamically.
         */
        document.addEventListener("click", event => {
            const reviewButton = event.target.closest("[data-review-id]");

            if (!reviewButton) return;

            openReviewDialog(reviewButton.dataset.reviewId);
        });

        elements.closeDialog?.addEventListener("click", closeReviewDialog);
        elements.cancelDialog?.addEventListener("click", closeReviewDialog);

        elements.dialog?.addEventListener("click", event => {
            if (event.target === elements.dialog) {
                closeReviewDialog();
            }
        });

        elements.verifyPayment?.addEventListener("click", () => {
            submitDecision("verify_payment");
        });

        elements.approve?.addEventListener("click", () => {
            submitDecision("approve");
        });

        elements.reject?.addEventListener("click", () => {
            submitDecision("reject");
        });

        elements.logout?.addEventListener("click", logout);

        /*
         * Keyboard shortcut: press / to focus search.
         */
        document.addEventListener("keydown", event => {
            const target = event.target;

            const isTyping = target instanceof HTMLElement && (
                target.isContentEditable ||
                ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
            );

            if (
                event.key === "/" &&
                !isTyping &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
            ) {
                event.preventDefault();
                elements.search?.focus();
            }
        });
    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initializePage() {
        if (elements.dashboardDate) {
            elements.dashboardDate.textContent =
                new Intl.DateTimeFormat("en-IN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }).format(new Date());
        }

        if (elements.currentYear) {
            elements.currentYear.textContent = String(new Date().getFullYear());
        }

        initializeAccountMenu();
        bindEvents();
        loadRequests();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializePage, { once: true });
    } else {
        initializePage();
    }
})();
