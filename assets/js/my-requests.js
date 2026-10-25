
/* =========================================================
   FOUNDEV — MY REQUESTS
   File: institute-users/assets/js/my-requests.js

   Requires:
   - student-dashboard.css
   - my-requests.css
   - my-requests.html

   API:
   - ../api/student/dashboard.php
   - ../api/student/requests.php
   - ../api/student/logout.php
========================================================= */

"use strict";

/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */

const REQUESTS_CONFIG = {
    dashboardApi: "../api/student/dashboard.php",
    requestsApi: "../api/student/requests.php",
    logoutApi: "../api/student/logout.php",
    homePage: "../../index.html",
    pageSize: 8
};

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */

const requestsState = {
    requests: [],
    filteredRequests: [],
    currentPage: 1,
    pageSize: REQUESTS_CONFIG.pageSize,
    activeStatus: "all",
    activeRequest: null,
    lastFocusedElement: null,
    isLoading: false,
    loadError: false,
    isWithdrawing: false
};

/* ---------------------------------------------------------
   DOM HELPERS
--------------------------------------------------------- */

function requestElement(id) {
    return document.getElementById(id);
}

function requestShow(element) {
    if (element) {
        element.hidden = false;
    }
}

function requestHide(element) {
    if (element) {
        element.hidden = true;
    }
}

function requestSetText(id, value) {
    const element = requestElement(id);

    if (element) {
        element.textContent =
            value === null || value === undefined || value === ""
                ? "—"
                : String(value);
    }
}

function requestNormalize(value) {
    return String(value ?? "").trim().toLowerCase();
}

function requestEscapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}

function requestFirstValue(object, keys, fallback = "") {
    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const key of keys) {
        const value = object[key];

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            return value;
        }
    }

    return fallback;
}

/* ---------------------------------------------------------
   API REQUEST HELPER
--------------------------------------------------------- */

async function requestsFetchJSON(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.headers || {})
        }
    });

    if (response.status === 401 || response.status === 403) {
        window.location.replace(REQUESTS_CONFIG.homePage);

        throw new Error("Your session has expired. Please sign in again.");
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error(
            "The server did not return JSON. Check the PHP endpoint."
        );
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("The server returned invalid JSON.");
    }

    if (!response.ok || data?.success === false) {
        throw new Error(
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

/* ---------------------------------------------------------
   STUDENT PROFILE
--------------------------------------------------------- */

async function requestsLoadStudentProfile() {
    try {
        const data = await requestsFetchJSON(
            REQUESTS_CONFIG.dashboardApi
        );

        const student = data.student || data.data?.student || {};

        const name = requestFirstValue(
            student,
            ["name", "full_name", "student_name"],
            "Student"
        );

        const institution = requestFirstValue(
            student,
            ["institution_name", "college_name", "institute_name"],
            "Student workspace"
        );

        requestSetText("student-name", name);
        requestSetText("student-institution", institution);

        const avatar = requestElement("student-avatar");

        if (avatar) {
            avatar.textContent = String(name)
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part.charAt(0))
                .join("")
                .toUpperCase() || "ST";
        }

        const unreadCount = Number(
            data.stats?.unread_notifications ??
            data.data?.stats?.unread_notifications ??
            0
        );

        const notificationDot = requestElement("notification-dot");

        if (notificationDot) {
            notificationDot.hidden = unreadCount <= 0;
        }

    } catch (error) {
        console.warn(
            "Unable to load the student profile:",
            error.message
        );
    }
}

/* ---------------------------------------------------------
   REQUEST STATUS NORMALIZATION
--------------------------------------------------------- */

function normalizeRequestStatus(value) {
    const status = requestNormalize(value)
        .replace(/[\s-]+/g, "_");

    const aliases = {
        pending: "pending",
        submitted: "pending",
        awaiting_review: "pending",
        under_review: "pending",
        in_review: "pending",
        approved: "approved",
        accepted: "approved",
        rejected: "rejected",
        declined: "rejected",
        denied: "rejected",
        withdrawn: "withdrawn",
        cancelled: "withdrawn",
        canceled: "withdrawn"
    };

    return aliases[status] || "pending";
}

function requestStatusLabel(status) {
    const labels = {
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
        withdrawn: "Withdrawn"
    };

    return labels[status] || "Pending";
}

function requestStatusClass(status) {
    const classes = {
        pending: "",
        approved: "approved",
        rejected: "rejected",
        withdrawn: "withdrawn"
    };

    return classes[status] || "";
}

/* ---------------------------------------------------------
   DATE HELPERS
--------------------------------------------------------- */

function requestDateValue(value) {
    if (!value) {
        return 0;
    }

    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function requestFormatDate(value) {
    if (!value) {
        return "Not available";
    }

    const timestamp = requestDateValue(value);

    if (!timestamp) {
        return String(value);
    }

    return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date(timestamp));
}

/* ---------------------------------------------------------
   NORMALIZE API RECORDS

   Adjust these aliases if your database uses different
   column names.
--------------------------------------------------------- */

function normalizeRequestRecord(raw, index) {
    const project = raw.project || raw.project_details || {};

    const requestId = requestFirstValue(raw, [
        "id",
        "request_id",
        "application_id",
        "project_request_id"
    ], "");

    const projectId = requestFirstValue(raw, [
        "project_id",
        "projectId"
    ], requestFirstValue(project, [
        "id",
        "project_id"
    ], ""));

    const title = requestFirstValue(raw, [
        "project_title",
        "project_name",
        "title"
    ], requestFirstValue(project, [
        "title",
        "project_title",
        "project_name",
        "name"
    ], "Untitled project"));

    const description = requestFirstValue(raw, [
        "project_description",
        "description"
    ], requestFirstValue(project, [
        "description",
        "project_description",
        "summary"
    ], "No project description has been provided."));

    const category = requestFirstValue(raw, [
        "project_category",
        "category"
    ], requestFirstValue(project, [
        "category",
        "project_category"
    ], "Other"));

    const status = normalizeRequestStatus(
        requestFirstValue(raw, [
            "status",
            "request_status",
            "application_status"
        ], "pending")
    );

    const createdAt = requestFirstValue(raw, [
        "created_at",
        "submitted_at",
        "requested_at",
        "request_date",
        "date_created"
    ], "");

    const updatedAt = requestFirstValue(raw, [
        "updated_at",
        "reviewed_at",
        "last_updated"
    ], createdAt);

    const responseMessage = requestFirstValue(raw, [
        "response_message",
        "review_message",
        "owner_message",
        "admin_message",
        "decision_note"
    ], "");

    return {
        id: String(requestId || `record-${index}`),
        hasRealId: requestId !== "",
        projectId: String(projectId),
        hasRealProjectId: projectId !== "",
        title: String(title),
        description: String(description),
        category: String(category),
        status,
        createdAt: String(createdAt),
        updatedAt: String(updatedAt),
        responseMessage: String(responseMessage),
        raw
    };
}

/* ---------------------------------------------------------
   LOAD REQUESTS
--------------------------------------------------------- */

async function requestsLoad() {
    if (requestsState.isLoading) {
        return;
    }

    requestsState.isLoading = true;
    requestsState.loadError = false;

    requestShow(requestElement("requestsLoading"));
    requestHide(requestElement("requestsError"));
    requestHide(requestElement("requestsEmpty"));
    requestHide(requestElement("requestsPagination"));

    const list = requestElement("requestsList");

    if (list) {
        list.replaceChildren();
        list.setAttribute("aria-busy", "true");
    }

    try {
        const data = await requestsFetchJSON(
            REQUESTS_CONFIG.requestsApi
        );

        let records = [];

        if (Array.isArray(data.requests)) {
            records = data.requests;
        } else if (Array.isArray(data.data?.requests)) {
            records = data.data.requests;
        } else if (Array.isArray(data.data)) {
            records = data.data;
        } else if (Array.isArray(data.items)) {
            records = data.items;
        } else {
            throw new Error(
                "The requests API did not return a recognizable requests array."
            );
        }

        requestsState.requests = records.map(normalizeRequestRecord);

        requestsUpdateSummary();
        requestsUpdateStatusCounts();
        requestsApplyFilters();

    } catch (error) {
        requestsState.loadError = true;

        console.error("Failed to load student requests:", error);

        requestsShowError(error.message);

    } finally {
        requestsState.isLoading = false;

        requestHide(requestElement("requestsLoading"));

        if (list) {
            list.setAttribute("aria-busy", "false");
        }
    }
}

/* ---------------------------------------------------------
   SUMMARY COUNTS
--------------------------------------------------------- */

function requestsCountByStatus(status) {
    if (status === "all") {
        return requestsState.requests.length;
    }

    return requestsState.requests.filter(
        request => request.status === status
    ).length;
}

function requestsUpdateSummary() {
    requestSetText(
        "totalRequestsCount",
        requestsCountByStatus("all")
    );

    requestSetText(
        "pendingRequestsCount",
        requestsCountByStatus("pending")
    );

    requestSetText(
        "approvedRequestsCount",
        requestsCountByStatus("approved")
    );

    requestSetText(
        "rejectedRequestsCount",
        requestsCountByStatus("rejected")
    );
}

function requestsUpdateStatusCounts() {
    const counts = {
        all: requestsCountByStatus("all"),
        pending: requestsCountByStatus("pending"),
        approved: requestsCountByStatus("approved"),
        rejected: requestsCountByStatus("rejected"),
        withdrawn: requestsCountByStatus("withdrawn")
    };

    requestSetText("allTabCount", counts.all);
    requestSetText("pendingTabCount", counts.pending);
    requestSetText("approvedTabCount", counts.approved);
    requestSetText("rejectedTabCount", counts.rejected);
    requestSetText("withdrawnTabCount", counts.withdrawn);
}

/* ---------------------------------------------------------
   SEARCH, FILTERS, SORTING
--------------------------------------------------------- */

function requestsApplyFilters() {
    const search = requestNormalize(
        requestElement("requestSearch")?.value
    );

    const dropdownStatus = requestNormalize(
        requestElement("requestStatusFilter")?.value || "all"
    );

    const selectedStatus = requestsState.activeStatus !== "all"
        ? requestsState.activeStatus
        : dropdownStatus;

    const sort = requestElement("requestSort")?.value || "newest";

    let filtered = requestsState.requests.filter(request => {
        const searchableText = [
            request.title,
            request.description,
            request.category,
            request.status,
            request.responseMessage
        ].join(" ").toLowerCase();

        const matchesSearch =
            !search || searchableText.includes(search);

        const matchesStatus =
            selectedStatus === "all" ||
            request.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
        if (sort === "alphabetical") {
            return a.title.localeCompare(b.title);
        }

        if (sort === "oldest") {
            return requestDateValue(a.createdAt) -
                requestDateValue(b.createdAt);
        }

        return requestDateValue(b.createdAt) -
            requestDateValue(a.createdAt);
    });

    requestsState.filteredRequests = filtered;
    requestsState.currentPage = 1;

    requestsRender();
    requestsUpdateDescription();
}

function requestsSetStatus(status) {
    requestsState.activeStatus = status || "all";

    const dropdown = requestElement("requestStatusFilter");

    if (dropdown) {
        dropdown.value = requestsState.activeStatus;
    }

    document.querySelectorAll(".request-status-tab").forEach(button => {
        const active = button.dataset.status === requestsState.activeStatus;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    requestsApplyFilters();
}

function requestsResetFilters() {
    const search = requestElement("requestSearch");
    const status = requestElement("requestStatusFilter");
    const sort = requestElement("requestSort");

    if (search) search.value = "";
    if (status) status.value = "all";
    if (sort) sort.value = "newest";

    requestsState.activeStatus = "all";

    document.querySelectorAll(".request-status-tab").forEach(button => {
        const active = button.dataset.status === "all";

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    requestsApplyFilters();
}

function requestsUpdateDescription() {
    const description = requestElement("requestsDescription");

    if (!description) {
        return;
    }

    const total = requestsState.filteredRequests.length;

    if (requestsState.requests.length === 0) {
        description.textContent =
            "Your submitted project requests will appear here.";
        return;
    }

    description.textContent = total === 1
        ? "Showing 1 request matching your filters."
        : `Showing ${total} requests matching your filters.`;
}

/* ---------------------------------------------------------
   RENDER REQUESTS
--------------------------------------------------------- */

function requestsRender() {
    const list = requestElement("requestsList");
    const empty = requestElement("requestsEmpty");
    const pagination = requestElement("requestsPagination");

    if (!list) {
        return;
    }

    list.replaceChildren();

    const requests = requestsState.filteredRequests;

    if (requests.length === 0) {
        requestHide(pagination);
        requestShow(empty);

        const noRequestsExist = requestsState.requests.length === 0;

        requestSetText(
            "requestsEmptyTitle",
            noRequestsExist
                ? "No requests yet."
                : "No requests match your filters."
        );

        requestSetText(
            "requestsEmptyDescription",
            noRequestsExist
                ? "When you request to join a project, you can follow its progress here."
                : "Try another search or status filter to find your requests."
        );

        return;
    }

    requestHide(empty);

    const totalPages = Math.ceil(
        requests.length / requestsState.pageSize
    );

    if (requestsState.currentPage > totalPages) {
        requestsState.currentPage = totalPages;
    }

    const start = (requestsState.currentPage - 1) *
        requestsState.pageSize;

    const currentRequests = requests.slice(
        start,
        start + requestsState.pageSize
    );

    currentRequests.forEach(request => {
        list.appendChild(requestCreateCard(request));
    });

    requestsRenderPagination(totalPages);
}

/* ---------------------------------------------------------
   REQUEST CARD
--------------------------------------------------------- */

function requestCreateCard(request) {
    const article = document.createElement("article");

    article.className = "request-item";
    article.dataset.requestId = request.id;

    const category = requestEscapeHTML(request.category);
    const title = requestEscapeHTML(request.title);
    const description = requestEscapeHTML(request.description);
    const status = requestEscapeHTML(
        requestStatusLabel(request.status)
    );

    const statusClass = requestStatusClass(request.status);
    const date = requestEscapeHTML(
        requestFormatDate(request.createdAt)
    );

    const canWithdraw =
        request.status === "pending" && request.hasRealId;

    article.innerHTML = `
        <div class="request-item-main">

            <div class="request-item-topline">
                <span class="request-category">${category}</span>

                <span class="request-status-badge ${statusClass}">
                    ${status}
                </span>
            </div>

            <h3 class="request-item-title">${title}</h3>

            <p class="request-item-description">${description}</p>

            <div class="request-item-meta">
                <span>
                    Submitted
                    <strong>${date}</strong>
                </span>
            </div>

        </div>

        <div class="request-item-actions">

            <button
                type="button"
                class="request-details-button"
                data-action="details"
                data-request-id="${requestEscapeHTML(request.id)}"
            >
                View details ↗
            </button>

            ${
                canWithdraw
                    ? `
                        <button
                            type="button"
                            class="request-withdraw-button"
                            data-action="withdraw"
                            data-request-id="${requestEscapeHTML(request.id)}"
                        >
                            Withdraw
                        </button>
                    `
                    : ""
            }

        </div>
    `;

    return article;
}

/* ---------------------------------------------------------
   PAGINATION
--------------------------------------------------------- */

function requestsRenderPagination(totalPages) {
    const container = requestElement("requestsPagination");
    const pages = requestElement("requestPaginationPages");
    const previous = requestElement("previousRequestPage");
    const next = requestElement("nextRequestPage");

    if (!container || !pages || !previous || !next) {
        return;
    }

    pages.replaceChildren();

    if (totalPages <= 1) {
        requestHide(container);
        return;
    }

    requestShow(container);

    previous.disabled = requestsState.currentPage <= 1;
    next.disabled = requestsState.currentPage >= totalPages;

    for (let page = 1; page <= totalPages; page++) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = String(page);
        button.setAttribute("aria-label", `Page ${page}`);

        if (page === requestsState.currentPage) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", () => {
            requestsState.currentPage = page;
            requestsRender();

            requestElement("requestsHeading")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        pages.appendChild(button);
    }
}

function requestsChangePage(direction) {
    const totalPages = Math.ceil(
        requestsState.filteredRequests.length /
        requestsState.pageSize
    );

    const nextPage = requestsState.currentPage + direction;

    if (nextPage < 1 || nextPage > totalPages) {
        return;
    }

    requestsState.currentPage = nextPage;
    requestsRender();

    requestElement("requestsHeading")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* ---------------------------------------------------------
   REQUEST DETAILS MODAL
--------------------------------------------------------- */

function requestsOpenDetails(request) {
    const modal = requestElement("requestDetailsModal");

    if (!modal || !request) {
        return;
    }

    requestsState.activeRequest = request;
    requestsState.lastFocusedElement = document.activeElement;

    requestSetText("requestModalTitle", "Request details");
    requestSetText("modalProjectName", request.title);
    requestSetText("modalProjectDescription", request.description);
    requestSetText(
        "modalRequestDate",
        requestFormatDate(request.createdAt)
    );
    requestSetText(
        "modalUpdatedDate",
        requestFormatDate(request.updatedAt)
    );
    requestSetText("modalProjectCategory", request.category);

    requestSetText(
        "modalRequestMessage",
        request.responseMessage || "No response message yet."
    );

    const statusBadge = requestElement("modalRequestStatus");

    if (statusBadge) {
        statusBadge.textContent = requestStatusLabel(request.status);
        statusBadge.className =
            "request-status-badge " +
            requestStatusClass(request.status);
    }

    const withdrawButton = requestElement("withdrawRequestButton");

    if (withdrawButton) {
        const canWithdraw =
            request.status === "pending" && request.hasRealId;

        withdrawButton.hidden = !canWithdraw;
        withdrawButton.disabled = false;
        withdrawButton.textContent = "Withdraw request";
    }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    requestAnimationFrame(() => {
        modal.querySelector(".request-modal-close")?.focus();
    });
}

function requestsCloseDetails() {
    const modal = requestElement("requestDetailsModal");

    if (!modal || modal.hidden) {
        return;
    }

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    requestsState.activeRequest = null;
    requestsState.isWithdrawing = false;

    if (
        requestsState.lastFocusedElement &&
        typeof requestsState.lastFocusedElement.focus === "function"
    ) {
        requestsState.lastFocusedElement.focus();
    }
}

/* ---------------------------------------------------------
   WITHDRAW A REQUEST

   Backend support is required.

   Expected POST body:
   {
       "action": "withdraw",
       "request_id": 123
   }

   Expected response:
   {
       "success": true,
       "message": "Request withdrawn successfully."
   }
--------------------------------------------------------- */

async function requestsWithdraw(request) {
    if (
        !request ||
        !request.hasRealId ||
        request.status !== "pending" ||
        requestsState.isWithdrawing
    ) {
        return;
    }

    const confirmed = window.confirm(
        `Are you sure you want to withdraw your request for "${request.title}"?`
    );

    if (!confirmed) {
        return;
    }

    requestsState.isWithdrawing = true;

    const modalButton = requestElement("withdrawRequestButton");

    const cardButton = document.querySelector(
        `.request-withdraw-button[data-request-id="${CSS.escape(request.id)}"]`
    );

    if (modalButton && !modalButton.hidden) {
        modalButton.disabled = true;
        modalButton.textContent = "Withdrawing...";
    }

    if (cardButton) {
        cardButton.disabled = true;
        cardButton.textContent = "Withdrawing...";
    }

    try {
        const result = await requestsFetchJSON(
            REQUESTS_CONFIG.requestsApi,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "withdraw",
                    request_id: request.id
                })
            }
        );

        requestsCloseDetails();

        await requestsLoad();

        window.alert(
            result.message || "Your request has been withdrawn."
        );

    } catch (error) {
        console.error("Unable to withdraw request:", error);

        window.alert(
            error.message ||
            "We couldn't withdraw your request. Please try again."
        );

        if (modalButton) {
            modalButton.disabled = false;
            modalButton.textContent = "Withdraw request";
        }

        if (cardButton) {
            cardButton.disabled = false;
            cardButton.textContent = "Withdraw";
        }

    } finally {
        requestsState.isWithdrawing = false;
    }
}

/* ---------------------------------------------------------
   ERROR STATE
--------------------------------------------------------- */

function requestsShowError(message) {
    requestHide(requestElement("requestsLoading"));
    requestHide(requestElement("requestsEmpty"));
    requestHide(requestElement("requestsPagination"));

    const list = requestElement("requestsList");

    if (list) {
        list.replaceChildren();
    }

    requestSetText(
        "requestsErrorMessage",
        message || "Please try again in a moment."
    );

    requestShow(requestElement("requestsError"));
}

/* ---------------------------------------------------------
   MOBILE SIDEBAR
--------------------------------------------------------- */

function requestsSetSidebarOpen(open) {
    const sidebar = requestElement("sidebar");
    const overlay = requestElement("sidebar-overlay");
    const menuButton = requestElement("mobile-menu");

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle("open", open);

    if (overlay) {
        overlay.hidden = !open;
    }

    if (menuButton) {
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute(
            "aria-label",
            open ? "Close navigation" : "Open navigation"
        );
    }
}

/* ---------------------------------------------------------
   SIGN OUT
--------------------------------------------------------- */

async function requestsLogout() {
    const button = requestElement("student-logout");

    if (button) {
        button.disabled = true;
    }

    try {
        await requestsFetchJSON(REQUESTS_CONFIG.logoutApi, {
            method: "POST"
        });
    } catch (error) {
        console.warn("Sign-out endpoint response:", error.message);
    } finally {
        window.location.replace(REQUESTS_CONFIG.homePage);
    }
}

/* ---------------------------------------------------------
   EVENT BINDING
--------------------------------------------------------- */

function requestsBindEvents() {
    requestElement("requestSearch")?.addEventListener(
        "input",
        requestsApplyFilters
    );

    requestElement("requestStatusFilter")?.addEventListener(
        "change",
        event => {
            requestsSetStatus(event.target.value);
        }
    );

    requestElement("requestSort")?.addEventListener(
        "change",
        requestsApplyFilters
    );

    requestElement("resetRequestFilters")?.addEventListener(
        "click",
        requestsResetFilters
    );

    requestElement("retryRequestsButton")?.addEventListener(
        "click",
        requestsLoad
    );

    document.querySelectorAll(".request-status-tab").forEach(button => {
        button.addEventListener("click", () => {
            requestsSetStatus(button.dataset.status || "all");
        });
    });

    requestElement("previousRequestPage")?.addEventListener(
        "click",
        () => requestsChangePage(-1)
    );

    requestElement("nextRequestPage")?.addEventListener(
        "click",
        () => requestsChangePage(1)
    );

    // Delegated events: the request cards are generated dynamically.
    requestElement("requestsList")?.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const request = requestsState.requests.find(item => {
            return item.id === button.dataset.requestId;
        });

        if (!request) {
            return;
        }

        if (button.dataset.action === "details") {
            requestsOpenDetails(request);
        }

        if (button.dataset.action === "withdraw") {
            requestsWithdraw(request);
        }
    });

    const modal = requestElement("requestDetailsModal");

    modal?.querySelectorAll("[data-close-request-modal]").forEach(button => {
        button.addEventListener("click", requestsCloseDetails);
    });

    modal?.addEventListener("click", event => {
        if (event.target === modal) {
            requestsCloseDetails();
        }
    });

    requestElement("withdrawRequestButton")?.addEventListener(
        "click",
        () => requestsWithdraw(requestsState.activeRequest)
    );

    document.addEventListener("keydown", event => {
        const activeModal = requestElement("requestDetailsModal");

        if (
            event.key === "Escape" &&
            activeModal &&
            !activeModal.hidden
        ) {
            requestsCloseDetails();
            return;
        }

        if (
            event.key === "/" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            const target = event.target;

            const typing =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target?.isContentEditable;

            if (!typing) {
                event.preventDefault();
                requestElement("requestSearch")?.focus();
            }
        }
    });

    // Topbar search shares the same filter as the page search.
    requestElement("workspace-search")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const topbarInput = requestElement("workspace-search-input");
            const requestSearch = requestElement("requestSearch");

            if (topbarInput && requestSearch) {
                requestSearch.value = topbarInput.value;
                requestsApplyFilters();

                requestElement("requestsHeading")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }
    );

    requestElement("workspace-search-input")?.addEventListener(
        "input",
        event => {
            const search = requestElement("requestSearch");

            if (search) {
                search.value = event.target.value;
                requestsApplyFilters();
            }
        }
    );

    requestElement("mobile-menu")?.addEventListener("click", () => {
        const sidebar = requestElement("sidebar");

        requestsSetSidebarOpen(
            !sidebar?.classList.contains("open")
        );
    });

    requestElement("sidebar-overlay")?.addEventListener(
        "click",
        () => requestsSetSidebarOpen(false)
    );

    requestElement("sidebar")?.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            requestsSetSidebarOpen(false);
        });
    });

    requestElement("student-logout")?.addEventListener(
        "click",
        requestsLogout
    );

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            requestsSetSidebarOpen(false);
        }
    });
}

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

async function initializeMyRequests() {
    // Never show the modal automatically on page load.
    const modal = requestElement("requestDetailsModal");

    if (modal) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("modal-open");

    requestsBindEvents();

    await Promise.allSettled([
        requestsLoadStudentProfile(),
        requestsLoad()
    ]);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeMyRequests,
        { once: true }
    );
} else {
    initializeMyRequests();
}
