// =========================================================
// FOUNDEV — MY TEAM
// File: institute-users/assets/js/my-team.js
// =========================================================

"use strict";

const TEAM_CONFIG = {
    dashboardApi: "../api/student/dashboard.php",
    teamApi: "../api/student/team.php",
    logoutApi: "../api/student/logout.php",
    homePage: "../../index.html"
};

let teamMembers = [];
let teamInvitations = [];
let currentTeam = null;

// ---------------------------------------------------------
// INITIALIZE
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    initializeSidebar();
    initializeWorkspaceSearch();
    initializeProfile();
    initializeLogout();
    initializeTeamModals();
    initializeMemberFilters();
    initializeTeamPage();
});

// ---------------------------------------------------------
// 1. MOBILE SIDEBAR
// ---------------------------------------------------------

function initializeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const button = document.getElementById("mobile-menu");
    const overlay = document.getElementById("sidebar-overlay");

    if (!sidebar || !button || !overlay) return;

    function closeSidebar() {
        sidebar.classList.remove("open");
        overlay.classList.remove("visible");

        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Open navigation");

        document.body.style.overflow = "";
    }

    button.addEventListener("click", () => {
        const isOpen = !sidebar.classList.contains("open");

        sidebar.classList.toggle("open", isOpen);
        overlay.classList.toggle("visible", isOpen);

        button.setAttribute("aria-expanded", String(isOpen));
        button.setAttribute(
            "aria-label",
            isOpen ? "Close navigation" : "Open navigation"
        );

        document.body.style.overflow = isOpen ? "hidden" : "";
    });

    overlay.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeSidebar();
            closeAllModals();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 700) {
            closeSidebar();
        }
    });
}

// ---------------------------------------------------------
// 2. WORKSPACE SEARCH
// ---------------------------------------------------------

function initializeWorkspaceSearch() {
    const form = document.getElementById("workspace-search");
    const input = document.getElementById("workspace-search-input");

    if (!form || !input) return;

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
            input.focus();
        }

        if (event.key === "Escape" && document.activeElement === input) {
            input.value = "";
            input.blur();
        }
    });

    form.addEventListener("submit", event => {
        event.preventDefault();

        const query = input.value.trim();

        if (!query) {
            input.focus();
            return;
        }

        const destination = new URL(
            "explore-projects.html",
            window.location.href
        );

        destination.searchParams.set("q", query);

        window.location.href = destination.href;
    });
}

// ---------------------------------------------------------
// 3. STUDENT PROFILE
// ---------------------------------------------------------

async function initializeProfile() {
    try {
        const response = await fetch(TEAM_CONFIG.dashboardApi, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        });

        if (response.status === 401 || response.status === 403) {
            window.location.replace(TEAM_CONFIG.homePage);
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load your student profile.");
        }

        const data = await response.json();

        if (!data || data.success !== true) {
            throw new Error(
                data?.message || "Unable to load your student profile."
            );
        }

        const student = data.student || {};
        const name = safeText(student.name, "Student");

        setText("student-name", name);

        setText(
            "student-institution",
            safeText(student.institution_name, "Student account")
        );

        setText("student-avatar", getInitials(name));

        const stats = data.stats || {};
        const notificationDot = document.getElementById("notification-dot");

        if (notificationDot) {
            notificationDot.hidden =
                !(Number(stats.unread_notifications) > 0);
        }
    } catch (error) {
        console.error("[Foundev My Team] Profile loading:", error);
    }
}

// ---------------------------------------------------------
// 4. TEAM PAGE AND BACKEND DATA
// ---------------------------------------------------------

async function initializeTeamPage() {
    renderMembers();
    renderInvitations();
    updateTeamSummary();

    /*
     * Integration contract for the planned team API:
     *
     * GET ../api/student/team.php
     *
     * Expected JSON:
     * {
     *   "success": true,
     *   "team": {
     *     "name": "Team name",
     *     "description": "Team description"
     *   },
     *   "members": [
     *     {
     *       "name": "Member name",
     *       "email": "member@example.com",
     *       "role": "leader"
     *     }
     *   ],
     *   "invitations": [
     *     {
     *       "email": "invitee@example.com",
     *       "status": "pending",
     *       "created_at": "2026-10-24"
     *     }
     *   ]
     * }
     *
     * This API must validate the logged-in student's session
     * and return only data that student is authorized to view.
     */

    try {
        const response = await fetch(TEAM_CONFIG.teamApi, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        });

        if (response.status === 401 || response.status === 403) {
            window.location.replace(TEAM_CONFIG.homePage);
            return;
        }

        /*
         * The team API has not been implemented yet.
         * Keep the empty state instead of inventing team data.
         */
        if (response.status === 404) {
            console.info(
                "[Foundev My Team] Team API is not implemented yet."
            );
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to retrieve team information.");
        }

        const data = await response.json();

        if (!data || data.success !== true) {
            throw new Error(
                data?.message || "Unable to retrieve team information."
            );
        }

        currentTeam = data.team || null;

        teamMembers = Array.isArray(data.members)
            ? data.members
            : [];

        teamInvitations = Array.isArray(data.invitations)
            ? data.invitations
            : [];

        updateTeamSummary();
        renderMembers();
        renderInvitations();

    } catch (error) {
        /*
         * The UI remains usable when the API is not ready.
         * No fake member names or counts are displayed.
         */
        console.info(
            "[Foundev My Team] Live team data is currently unavailable."
        );
    }
}

// ---------------------------------------------------------
// 5. TEAM SUMMARY
// ---------------------------------------------------------

function updateTeamSummary() {
    const teamName = currentTeam
        ? safeText(currentTeam.name, "Unnamed team")
        : "Not in a team yet";

    const caption = currentTeam
        ? safeText(
            currentTeam.description,
            "Your team, working towards something meaningful."
        )
        : "Your next collaboration starts here.";

    setText("summary-team-name", teamName);
    setText("summary-team-caption", caption);
    setText("summary-member-count", teamMembers.length);

    const pendingCount = teamInvitations.filter(invitation => {
        return String(invitation.status || "").toLowerCase() === "pending";
    }).length;

    setText("summary-pending-count", pendingCount);
}

// ---------------------------------------------------------
// 6. MEMBER SEARCH AND ROLE FILTER
// ---------------------------------------------------------

function initializeMemberFilters() {
    const searchInput = document.getElementById("member-search");
    const roleFilter = document.getElementById("role-filter");

    if (searchInput) {
        searchInput.addEventListener("input", renderMembers);
    }

    if (roleFilter) {
        roleFilter.addEventListener("change", renderMembers);
    }
}

function renderMembers() {
    const container = document.getElementById("team-member-list");

    if (!container) return;

    const searchInput = document.getElementById("member-search");
    const roleFilter = document.getElementById("role-filter");

    const query = safeText(searchInput?.value, "").toLowerCase();
    const selectedRole = roleFilter?.value || "all";

    const filteredMembers = teamMembers.filter(member => {
        const name = safeText(member.name, "").toLowerCase();
        const email = safeText(member.email, "").toLowerCase();
        const role = normalizeRole(member.role);

        const matchesSearch =
            name.includes(query) || email.includes(query);

        const matchesRole =
            selectedRole === "all" || selectedRole === role;

        return matchesSearch && matchesRole;
    });

    container.replaceChildren();

    if (filteredMembers.length === 0) {
        renderMemberEmptyState(container);
        return;
    }

    filteredMembers.forEach((member, index) => {
        const row = document.createElement("article");

        row.className = "team-member-row";
        row.style.animationDelay = `${index * 45}ms`;

        const nameText = safeText(member.name, "Team member");
        const emailText = safeText(member.email, "Email not provided");
        const role = normalizeRole(member.role);

        const avatar = document.createElement("span");
        avatar.className = "member-avatar";
        avatar.textContent = getInitials(nameText);
        avatar.setAttribute("aria-hidden", "true");

        const details = document.createElement("div");
        details.className = "member-details";

        const name = document.createElement("strong");
        name.textContent = nameText;

        const email = document.createElement("small");
        email.textContent = emailText;

        details.append(name, email);

        const roleBadge = document.createElement("span");

        roleBadge.className = "member-role";

        if (role === "leader") {
            roleBadge.classList.add("leader");
            roleBadge.textContent = "Team leader";
        } else {
            roleBadge.textContent = "Member";
        }

        row.append(avatar, details, roleBadge);
        container.appendChild(row);
    });
}

function renderMemberEmptyState(container) {
    const empty = document.createElement("div");
    empty.className = "team-empty-state";

    const illustration = document.createElement("div");
    illustration.className = "empty-illustration";
    illustration.setAttribute("aria-hidden", "true");

    const symbol = document.createElement("span");
    symbol.textContent = teamMembers.length ? "⌕" : "＋";

    illustration.appendChild(symbol);

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";

    const heading = document.createElement("h3");
    const description = document.createElement("p");

    if (teamMembers.length > 0) {
        eyebrow.textContent = "NO MATCHES FOUND";
        heading.textContent = "No members match your search.";
        description.textContent =
            "Try another name, email address, or role filter.";
    } else {
        eyebrow.textContent = "EVERY GREAT IDEA STARTS SOMEWHERE";
        heading.textContent = "Your team story starts here.";
        description.textContent =
            "Create a team to bring collaborators together, or wait for an invitation to join an existing team.";
    }

    empty.append(illustration, eyebrow, heading, description);

    if (teamMembers.length === 0) {
        const createButton = document.createElement("button");

        createButton.className = "team-primary-button";
        createButton.type = "button";
        createButton.textContent = "Create your first team ↗";

        createButton.addEventListener("click", () => {
            openModal("team");
        });

        empty.appendChild(createButton);
    }

    container.appendChild(empty);
}

// ---------------------------------------------------------
// 7. INVITATIONS
// ---------------------------------------------------------

function renderInvitations() {
    const container = document.getElementById("invitation-list");

    if (!container) return;

    const pendingInvitations = teamInvitations.filter(invitation => {
        return String(invitation.status || "").toLowerCase() === "pending";
    });

    setText("invitation-count", `${pendingInvitations.length} pending`);
    setText("summary-pending-count", pendingInvitations.length);

    container.replaceChildren();

    if (pendingInvitations.length === 0) {
        const empty = document.createElement("div");
        empty.className = "invitation-empty";

        const mark = document.createElement("span");
        mark.className = "invitation-empty-mark";
        mark.textContent = "↗";
        mark.setAttribute("aria-hidden", "true");

        const content = document.createElement("div");

        const heading = document.createElement("strong");
        heading.textContent = "No pending invitations";

        const description = document.createElement("p");
        description.textContent =
            "Team invitations will appear here when available.";

        content.append(heading, description);
        empty.append(mark, content);

        container.appendChild(empty);
        return;
    }

    pendingInvitations.forEach(invitation => {
        const row = document.createElement("div");
        row.className = "invitation-row";

        const person = document.createElement("div");
        person.className = "invitation-person";

        const email = document.createElement("strong");
        email.textContent = safeText(invitation.email, "Student");

        const date = document.createElement("small");

        date.textContent = invitation.created_at
            ? `Invited ${formatDate(invitation.created_at)}`
            : "Invitation pending";

        person.append(email, date);

        const status = document.createElement("span");
        status.className = "invitation-status";
        status.textContent = "Pending";

        row.append(person, status);
        container.appendChild(row);
    });
}

// ---------------------------------------------------------
// 8. CREATE TEAM AND INVITE MEMBER MODALS
// ---------------------------------------------------------

function initializeTeamModals() {
    document.getElementById("create-team-button")
        ?.addEventListener("click", () => openModal("team"));

    document.getElementById("empty-create-team-button")
        ?.addEventListener("click", () => openModal("team"));

    document.getElementById("invite-member-button")
        ?.addEventListener("click", () => openModal("invite"));

    document.querySelectorAll("[data-close-modal]").forEach(button => {
        button.addEventListener("click", closeAllModals);
    });

    document.querySelectorAll(".team-modal-backdrop").forEach(backdrop => {
        backdrop.addEventListener("click", event => {
            if (event.target === backdrop) {
                closeAllModals();
            }
        });
    });

    document.getElementById("create-team-form")
        ?.addEventListener("submit", handleCreateTeamSubmit);

    document.getElementById("invite-member-form")
        ?.addEventListener("submit", handleInviteSubmit);
}

function openModal(type) {
    const modalId = type === "team"
        ? "team-modal-backdrop"
        : "invite-modal-backdrop";

    const modal = document.getElementById(modalId);

    if (!modal) return;

    closeAllModals();

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    const input = modal.querySelector("input");

    window.setTimeout(() => {
        input?.focus();
    }, 30);
}

function closeAllModals() {
    document.querySelectorAll(".team-modal-backdrop").forEach(modal => {
        modal.hidden = true;
    });

    document.body.style.overflow = "";
}

// ---------------------------------------------------------
// 9. CREATE TEAM FORM
// ---------------------------------------------------------

function handleCreateTeamSubmit(event) {
    event.preventDefault();

    const input = document.getElementById("team-name-input");
    const message = document.getElementById("create-team-message");

    if (!input || !message) return;

    const teamName = input.value.trim();

    message.className = "form-message";
    message.textContent = "";

    if (teamName.length < 2) {
        message.classList.add("error");
        message.textContent =
            "Please enter a team name containing at least two characters.";
        input.focus();
        return;
    }

    if (teamName.length > 80) {
        message.classList.add("error");
        message.textContent =
            "The team name cannot exceed 80 characters.";
        input.focus();
        return;
    }

    /*
     * The backend endpoint has not been implemented.
     * Do not display a false success message or save
     * the team only in browser memory.
     */
    message.textContent =
        "Team creation is not connected yet. Your team has not been saved.";
}

// ---------------------------------------------------------
// 10. INVITE MEMBER FORM
// ---------------------------------------------------------

function handleInviteSubmit(event) {
    event.preventDefault();

    const input = document.getElementById("invite-email-input");
    const message = document.getElementById("invite-member-message");

    if (!input || !message) return;

    const email = input.value.trim();

    message.className = "form-message";
    message.textContent = "";

    if (!email || !input.validity.valid) {
        message.classList.add("error");
        message.textContent =
            "Enter a valid student email address.";
        input.focus();
        return;
    }

    /*
     * An invitation API is required to validate the student,
     * authorize the sender, and save/send the invitation.
     */
    message.textContent =
        "Invitations are not connected yet. No invitation has been sent.";
}

// ---------------------------------------------------------
// 11. LOGOUT
// ---------------------------------------------------------

function initializeLogout() {
    const button = document.getElementById("student-logout");

    if (!button) return;

    button.addEventListener("click", async () => {
        const confirmed = window.confirm(
            "Are you sure you want to sign out of Foundev?"
        );

        if (!confirmed) return;

        button.disabled = true;

        const label = button.querySelector("span");

        if (label) {
            label.textContent = "Signing out...";
        }

        try {
            const response = await fetch(TEAM_CONFIG.logoutApi, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json"
                },
                cache: "no-store"
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data || data.success !== true) {
                throw new Error(
                    data?.message || "Sign out failed."
                );
            }

            window.location.replace(TEAM_CONFIG.homePage);

        } catch (error) {
            console.error("[Foundev Logout]", error);

            window.alert(
                "We couldn't complete sign out. Please try again."
            );

            button.disabled = false;

            if (label) {
                label.textContent = "Sign out";
            }
        }
    });
}

// ---------------------------------------------------------
// 12. SAFE TEXT HELPERS
// ---------------------------------------------------------

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

    element.textContent = String(value ?? "");
}

function getInitials(name) {
    const parts = safeText(name, "Student")
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return "ST";

    return parts
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}

function normalizeRole(value) {
    const role = String(value || "").toLowerCase().trim();

    if (["leader", "team leader", "owner"].includes(role)) {
        return "leader";
    }

    return "member";
}

function formatDate(value) {
    if (!value) return "recently";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "recently";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}
