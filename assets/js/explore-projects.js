/* =========================================================
   FOUNDEV — EXPLORE PROJECTS
   File: institute-users/assets/js/explore-projects.js

   Connects to:
   - Student dashboard API
   - Student projects API
   - Student logout API

   Does not create fake project records.
========================================================= */

"use strict";

/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */

const EXPLORE_CONFIG = {
    dashboardApi: "../api/student/dashboard.php",

    // Create this endpoint in the PHP backend.
    projectsApi: "../api/student/projects.php",

    logoutApi: "../api/student/logout.php",

    homePage: "../../index.html",

    pageSize: 9
};

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */

const exploreState = {
    projects: [],
    filteredProjects: [],
    currentPage: 1,
    pageSize: EXPLORE_CONFIG.pageSize,
    view: "grid",
    activeProject: null,
    isLoading: false,
    loadError: false,
    lastFocusedElement: null
};

/* ---------------------------------------------------------
   DOM HELPERS
--------------------------------------------------------- */

function getElement(id) {
    return document.getElementById(id);
}

function showElement(element) {
    if (element) {
        element.hidden = false;
    }
}

function hideElement(element) {
    if (element) {
        element.hidden = true;
    }
}

function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value == null ? "" : String(value);
    }
}

function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
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

function parseArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (error) {
            return value.split(",").map(item => item.trim()).filter(Boolean);
        }
    }

    return [];
}

function firstAvailable(object, keys, fallback = "") {
    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const key of keys) {
        if (
            Object.prototype.hasOwnProperty.call(object, key) &&
            object[key] !== null &&
            object[key] !== undefined &&
            object[key] !== ""
        ) {
            return object[key];
        }
    }

    return fallback;
}

/* ---------------------------------------------------------
   FETCH HELPER
--------------------------------------------------------- */

async function fetchJSON(url, options = {}) {
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
        window.location.replace(EXPLORE_CONFIG.homePage);
        throw new Error("Your session has expired. Please sign in again.");
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error(
            "The server did not return JSON. Check the PHP endpoint and its response."
        );
    }

    let result;

    try {
        result = await response.json();
    } catch (error) {
        throw new Error("The server returned invalid JSON.");
    }

    if (!response.ok) {
        throw new Error(
            result.message ||
            result.error ||
            `The request failed with status ${response.status}.`
        );
    }

    if (result && result.success === false) {
        throw new Error(
            result.message ||
            result.error ||
            "The request could not be completed."
        );
    }

    return result;
}

/* ---------------------------------------------------------
   STUDENT PROFILE
--------------------------------------------------------- */

async function loadStudentProfile() {
    try {
        const result = await fetchJSON(EXPLORE_CONFIG.dashboardApi);

        const student = result.student || result.data?.student || {};

        const name = firstAvailable(
            student,
            ["name", "full_name", "student_name"],
            "Student"
        );

        const institution = firstAvailable(
            student,
            ["institution_name", "college_name", "institute_name"],
            "Student workspace"
        );

        setText("student-name", name);
        setText("student-institution", institution);

        const avatar = getElement("student-avatar");

        if (avatar) {
            const initials = String(name)
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part.charAt(0))
                .join("")
                .toUpperCase();

            avatar.textContent = initials || "ST";
        }

        const unread = Number(
            result.stats?.unread_notifications ??
            result.data?.stats?.unread_notifications ??
            0
        );

        const notificationDot = getElement("notification-dot");

        if (notificationDot) {
            notificationDot.hidden = !(unread > 0);
        }

    } catch (error) {
        console.warn("Unable to load student profile:", error.message);
    }
}

/* ---------------------------------------------------------
   PROJECT DATA NORMALIZATION

   Supports common field names. Match these to the response
   returned by your actual projects.php endpoint.
--------------------------------------------------------- */

function normalizeProject(raw, index) {
    const technologies = parseArray(
        firstAvailable(raw, [
            "technologies",
            "technology_stack",
            "tech_stack",
            "techStack"
        ], [])
    );

    const skills = parseArray(
        firstAvailable(raw, [
            "skills",
            "skills_required",
            "required_skills"
        ], [])
    );

    const owner = raw.owner || raw.created_by_user || {};

    const projectId = firstAvailable(raw, [
        "id",
        "project_id",
        "projectId"
    ], "");

    const category = firstAvailable(raw, [
        "category",
        "project_category"
    ], "Other");

    const difficulty = firstAvailable(raw, [
        "difficulty",
        "difficulty_level",
        "level"
    ], "Not specified");

    const status = firstAvailable(raw, [
        "status",
        "project_status"
    ], "Published");

    const teamSize = firstAvailable(raw, [
        "team_size",
        "teamSize",
        "max_team_size"
    ], "");

    const currentMembers = Number(
        firstAvailable(raw, [
            "current_members",
            "members_count",
            "team_members_count"
        ], 0)
    );

    const description = firstAvailable(raw, [
        "description",
        "project_description",
        "summary"
    ], "No description has been provided for this project yet.");

    const title = firstAvailable(raw, [
        "title",
        "project_title",
        "project_name",
        "name"
    ], "Untitled project");

    const createdAt = firstAvailable(raw, [
        "created_at",
        "createdAt",
        "published_at",
        "date_created"
    ], "");

    const ownerName = firstAvailable(raw, [
        "owner_name",
        "created_by_name",
        "student_name"
    ], firstAvailable(owner, ["name", "full_name"], ""));

    const isExplicitlyOpen =
        raw.is_open === true ||
        raw.is_open === 1 ||
        raw.is_open === "1" ||
        raw.accepting_members === true ||
        raw.accepting_members === 1 ||
        raw.accepting_members === "1";

    const isExplicitlyClosed =
        raw.is_open === false ||
        raw.is_open === 0 ||
        raw.is_open === "0" ||
        raw.accepting_members === false ||
        raw.accepting_members === 0 ||
        raw.accepting_members === "0";

    const normalizedStatus = normalizeText(status);

    const statusIsPublished = [
        "published",
        "active",
        "open",
        "in progress",
        "recruiting"
    ].includes(normalizedStatus);

    const statusIsFull = [
        "full",
        "team full",
        "closed",
        "completed",
        "archived"
    ].includes(normalizedStatus);

    const numericTeamSize = Number(teamSize);

    const isFull =
        statusIsFull ||
        (
            Number.isFinite(numericTeamSize) &&
            numericTeamSize > 0 &&
            currentMembers >= numericTeamSize
        );

    const isOpen = !isFull && (
        isExplicitlyOpen ||
        (!isExplicitlyClosed && statusIsPublished)
    );

    return {
        id: String(projectId || `project-${index}`),
        hasRealId: projectId !== "",
        title: String(title),
        description: String(description),
        category: String(category),
        difficulty: String(difficulty),
        status: String(status),
        teamSize: teamSize === "" ? "" : String(teamSize),
        currentMembers,
        technologies: technologies.map(item => String(item)),
        skills: skills.map(item => String(item)),
        createdAt: String(createdAt),
        ownerName: String(ownerName),
        isOpen,
        isFull,
        raw
    };
}

/* ---------------------------------------------------------
   LOAD PROJECTS
--------------------------------------------------------- */

async function loadProjects() {
    if (exploreState.isLoading) {
        return;
    }

    exploreState.isLoading = true;
    exploreState.loadError = false;

    showElement(getElement("projectsLoading"));
    hideElement(getElement("projectsError"));
    hideElement(getElement("projectsEmptyState"));
    hideElement(getElement("projectsPagination"));

    const grid = getElement("projectsGrid");

    if (grid) {
        grid.setAttribute("aria-busy", "true");
    }

    try {
        const result = await fetchJSON(EXPLORE_CONFIG.projectsApi);

        let records = [];

        if (Array.isArray(result.projects)) {
            records = result.projects;
        } else if (Array.isArray(result.data?.projects)) {
            records = result.data.projects;
        } else if (Array.isArray(result.data)) {
            records = result.data;
        } else if (Array.isArray(result.items)) {
            records = result.items;
        } else if (Array.isArray(result.projects?.data)) {
            records = result.projects.data;
        } else if (Array.isArray(result.data?.items)) {
            records = result.data.items;
        } else {
            throw new Error(
                "The projects API did not return a recognizable projects array."
            );
        }

        exploreState.projects = records.map(normalizeProject);

        updateSummary();
        populateTechnologyFilter();
        applyProjectFilters();

    } catch (error) {
        exploreState.loadError = true;

        console.error("Project loading failed:", error);

        showProjectError(error.message);

    } finally {
        exploreState.isLoading = false;
        hideElement(getElement("projectsLoading"));

        if (grid) {
            grid.setAttribute("aria-busy", "false");
        }
    }
}

/* ---------------------------------------------------------
   SUMMARY COUNTS
--------------------------------------------------------- */

function updateSummary() {
    const projects = exploreState.projects;

    const technologies = new Set();

    projects.forEach(project => {
        project.technologies.forEach(technology => {
            if (technology.trim()) {
                technologies.add(normalizeText(technology));
            }
        });
    });

    setText("availableProjectsCount", projects.length);
    setText("technologiesCount", technologies.size);
    setText(
        "openOpportunitiesCount",
        projects.filter(project => project.isOpen).length
    );
}

/* ---------------------------------------------------------
   TECHNOLOGY FILTER
--------------------------------------------------------- */

function populateTechnologyFilter() {
    const select = getElement("technologyFilter");

    if (!select) {
        return;
    }

    const currentValue = select.value;

    const technologyMap = new Map();

    exploreState.projects.forEach(project => {
        project.technologies.forEach(technology => {
            const trimmed = technology.trim();

            if (trimmed) {
                technologyMap.set(normalizeText(trimmed), trimmed);
            }
        });
    });

    select.replaceChildren();

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "All technologies";
    select.appendChild(defaultOption);

    [...technologyMap.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([key, label]) => {
            const option = document.createElement("option");

            option.value = key;
            option.textContent = label;

            select.appendChild(option);
        });

    if (technologyMap.has(currentValue)) {
        select.value = currentValue;
    }
}

/* ---------------------------------------------------------
   FILTERING AND SEARCH
--------------------------------------------------------- */

function applyProjectFilters() {
    const search = normalizeText(getElement("projectSearch")?.value);
    const category = normalizeText(getElement("categoryFilter")?.value);
    const difficulty = normalizeText(getElement("difficultyFilter")?.value);
    const technology = normalizeText(getElement("technologyFilter")?.value);
    const availability = normalizeText(getElement("availabilityFilter")?.value);
    const sort = getElement("sortProjects")?.value || "newest";

    const filtered = exploreState.projects.filter(project => {
        const searchable = [
            project.title,
            project.description,
            project.category,
            project.difficulty,
            project.status,
            project.ownerName,
            ...project.technologies,
            ...project.skills
        ].join(" ").toLowerCase();

        const matchesSearch =
            !search || searchable.includes(search);

        const projectCategory = normalizeText(project.category)
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        const categoryAliases = {
            "artificial-intelligence": [
                "artificial-intelligence",
                "artificial intelligence",
                "ai",
                "machine-learning",
                "machine learning",
                "ai-ml"
            ],
            "machine-learning": [
                "machine-learning",
                "machine learning",
                "ml",
                "artificial-intelligence",
                "artificial intelligence",
                "ai"
            ],
            "web-development": [
                "web-development",
                "web development",
                "website development",
                "web"
            ],
            "mobile-development": [
                "mobile-development",
                "mobile development",
                "mobile app development",
                "mobile applications",
                "mobile apps"
            ],
            "cybersecurity": [
                "cybersecurity",
                "cyber security",
                "information security"
            ],
            "data-science": [
                "data-science",
                "data science",
                "data analytics"
            ],
            "cloud-computing": [
                "cloud-computing",
                "cloud computing",
                "cloud"
            ],
            "internet-of-things": [
                "internet-of-things",
                "internet of things",
                "iot"
            ],
            "other": ["other", "others", "miscellaneous"]
        };

        const acceptedCategories = categoryAliases[category] || [category];

        const matchesCategory =
            !category ||
            acceptedCategories.some(alias => {
                const normalizedAlias = normalizeText(alias)
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");

                return projectCategory === normalizedAlias ||
                    normalizeText(project.category) === normalizeText(alias);
            });

        const matchesDifficulty =
            !difficulty ||
            normalizeText(project.difficulty) === difficulty;

        const matchesTechnology =
            !technology ||
            project.technologies.some(item => normalizeText(item) === technology);

        const matchesAvailability =
            !availability ||
            (availability === "open" && project.isOpen) ||
            (availability === "full" && project.isFull);

        return (
            matchesSearch &&
            matchesCategory &&
            matchesDifficulty &&
            matchesTechnology &&
            matchesAvailability
        );
    });

    sortProjects(filtered, sort);

    exploreState.filteredProjects = filtered;
    exploreState.currentPage = 1;

    renderProjects();
    updateResultsDescription();
}

/* ---------------------------------------------------------
   SORTING
--------------------------------------------------------- */

function sortProjects(projects, sort) {
    const difficultyRank = {
        beginner: 1,
        easy: 1,
        intermediate: 2,
        medium: 2,
        advanced: 3,
        hard: 3
    };

    projects.sort((a, b) => {
        if (sort === "alphabetical") {
            return a.title.localeCompare(b.title);
        }

        if (sort === "oldest") {
            return dateValue(a.createdAt) - dateValue(b.createdAt);
        }

        if (sort === "difficulty") {
            const rankA = difficultyRank[normalizeText(a.difficulty)] || 99;
            const rankB = difficultyRank[normalizeText(b.difficulty)] || 99;

            return rankA - rankB || a.title.localeCompare(b.title);
        }

        return dateValue(b.createdAt) - dateValue(a.createdAt);
    });
}

function dateValue(value) {
    if (!value) {
        return 0;
    }

    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function updateResultsDescription() {
    const count = exploreState.filteredProjects.length;

    const element = getElement("projectResultsDescription");

    if (!element) {
        return;
    }

    if (exploreState.projects.length === 0) {
        element.textContent = "No published projects are available yet.";
        return;
    }

    element.textContent = count === 1
        ? "Showing 1 project matching your search."
        : `Showing ${count} projects matching your search.`;
}

/* ---------------------------------------------------------
   PROJECT RENDERING
--------------------------------------------------------- */

function renderProjects() {
    const grid = getElement("projectsGrid");
    const emptyState = getElement("projectsEmptyState");
    const errorState = getElement("projectsError");
    const loading = getElement("projectsLoading");
    const pagination = getElement("projectsPagination");

    if (!grid) {
        return;
    }

    hideElement(loading);
    hideElement(errorState);

    grid.replaceChildren();
    grid.classList.toggle("list-view", exploreState.view === "list");

    const projects = exploreState.filteredProjects;

    if (projects.length === 0) {
        hideElement(pagination);
        showElement(emptyState);

        const noPublishedProjects = exploreState.projects.length === 0;

        setText(
            "projectsEmptyTitle",
            noPublishedProjects
                ? "No projects to show just yet."
                : "No projects match your filters."
        );

        setText(
            "projectsEmptyDescription",
            noPublishedProjects
                ? "Published projects will appear here once they are available in your workspace."
                : "Try changing your search or clearing one or more filters to find projects."
        );

        return;
    }

    hideElement(emptyState);

    const totalPages = Math.ceil(projects.length / exploreState.pageSize);

    if (exploreState.currentPage > totalPages) {
        exploreState.currentPage = totalPages;
    }

    const start = (exploreState.currentPage - 1) * exploreState.pageSize;
    const pageProjects = projects.slice(start, start + exploreState.pageSize);

    pageProjects.forEach(project => {
        grid.appendChild(createProjectCard(project));
    });

    renderPagination(totalPages);
}

/* ---------------------------------------------------------
   PROJECT CARD
--------------------------------------------------------- */

function createProjectCard(project) {
    const article = document.createElement("article");

    article.className = "project-card";
    article.dataset.projectId = project.id;

    const category = escapeHTML(project.category);
    const title = escapeHTML(project.title);
    const description = escapeHTML(project.description);
    const difficulty = escapeHTML(project.difficulty);
    const status = escapeHTML(project.status);

    const tags = project.technologies.slice(0, 4)
        .map(item => `<span class="project-tag">${escapeHTML(item)}</span>`)
        .join("");

    const statusClass = project.isFull ? "full" : "";

    const teamSizeLabel = project.teamSize
        ? `${project.currentMembers} / ${escapeHTML(project.teamSize)} members`
        : project.currentMembers > 0
            ? `${project.currentMembers} members`
            : "Team size varies";

    const joinLabel = project.isFull
        ? "Team full"
        : "Request to join";

    article.innerHTML = `
        <div class="project-card-top">
            <span class="project-category-label">${category}</span>
            <span class="project-status-label ${statusClass}">
                ${project.isFull ? "Team full" : status}
            </span>
        </div>

        <h3>${title}</h3>

        <p class="project-card-description">${description}</p>

        <div class="project-card-tags">
            ${tags}
        </div>

        <div class="project-card-meta">
            <span>Difficulty: ${difficulty}</span>
            <span>${teamSizeLabel}</span>
        </div>

        <div class="project-card-actions">
            <button
                type="button"
                class="project-details-button"
                data-action="details"
                data-project-id="${escapeHTML(project.id)}"
            >
                View details ↗
            </button>

            <button
                type="button"
                class="team-secondary-button"
                data-action="join"
                data-project-id="${escapeHTML(project.id)}"
                ${project.isOpen && project.hasRealId ? "" : "disabled"}
            >
                ${joinLabel}
            </button>
        </div>
    `;

    return article;
}

/* ---------------------------------------------------------
   PAGINATION
--------------------------------------------------------- */

function renderPagination(totalPages) {
    const pagination = getElement("projectsPagination");
    const pagesContainer = getElement("paginationPages");
    const previous = getElement("previousProjectsPage");
    const next = getElement("nextProjectsPage");

    if (!pagination || !pagesContainer || !previous || !next) {
        return;
    }

    pagesContainer.replaceChildren();

    if (totalPages <= 1) {
        hideElement(pagination);
        return;
    }

    showElement(pagination);

    previous.disabled = exploreState.currentPage <= 1;
    next.disabled = exploreState.currentPage >= totalPages;

    for (let page = 1; page <= totalPages; page++) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = String(page);
        button.setAttribute("aria-label", `Page ${page}`);

        if (page === exploreState.currentPage) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", () => {
            exploreState.currentPage = page;
            renderProjects();
            scrollToProjects();
        });

        pagesContainer.appendChild(button);
    }
}

function scrollToProjects() {
    getElement("projectsHeading")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* ---------------------------------------------------------
   PROJECT DETAILS MODAL
--------------------------------------------------------- */

function openProjectDetails(project) {
    const modal = getElement("projectDetailsModal");

    if (!modal || !project) {
        return;
    }

    exploreState.lastFocusedElement = document.activeElement;
    exploreState.activeProject = project;

    setText("projectDetailsTitle", project.title);
    setText("detailsCategory", project.category);
    setText("detailsDescription", project.description);
    setText("detailsDifficulty", project.difficulty);
    setText("detailsStatus", project.status);

    setText(
        "detailsTeamSize",
        project.teamSize
            ? `${project.currentMembers} / ${project.teamSize}`
            : project.currentMembers > 0
                ? `${project.currentMembers} members`
                : "Not specified"
    );

    renderDetailTags("detailsTechnologies", project.technologies);
    renderDetailTags("detailsSkills", project.skills);

    const joinButton = getElement("requestToJoinButton");

    if (joinButton) {
        joinButton.disabled = !project.isOpen || !project.hasRealId;
        joinButton.textContent = project.isFull
            ? "Team full"
            : "Request to join";
    }

    // Remove hidden only in response to an explicit user action.
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    requestAnimationFrame(() => {
        modal.querySelector(".modal-close-button")?.focus();
        modal.querySelector(".modal-dialog")?.focus();
    });
}

function renderDetailTags(containerId, values) {
    const container = getElement(containerId);

    if (!container) {
        return;
    }

    container.replaceChildren();

    values.forEach(value => {
        const tag = document.createElement("span");
        tag.textContent = value;
        container.appendChild(tag);
    });
}

function closeProjectDetails() {
    const modal = getElement("projectDetailsModal");

    if (!modal || modal.hidden) {
        return;
    }

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    exploreState.activeProject = null;

    if (
        exploreState.lastFocusedElement &&
        typeof exploreState.lastFocusedElement.focus === "function"
    ) {
        exploreState.lastFocusedElement.focus();
    }
}

/* ---------------------------------------------------------
   REQUEST TO JOIN

   This sends the request to the endpoint only when the user
   explicitly clicks. Adjust the payload to match your PHP API.
--------------------------------------------------------- */

async function requestToJoinProject(project) {
    if (!project || !project.hasRealId || !project.isOpen) {
        return;
    }

    const button = getElement("requestToJoinButton");

    if (!button) {
        return;
    }

    const confirmed = window.confirm(
        `Send a request to join "${project.title}"?`
    );

    if (!confirmed) {
        return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Sending request...";

    try {
        const result = await fetchJSON(EXPLORE_CONFIG.projectsApi, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "request_to_join",
                project_id: project.id
            })
        });

        window.alert(
            result.message || "Your request was submitted successfully."
        );

        closeProjectDetails();

        await loadProjects();

    } catch (error) {
        console.error("Request to join failed:", error);

        window.alert(
            error.message ||
            "Unable to submit your request. Please try again."
        );

    } finally {
        if (button.isConnected) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

/* ---------------------------------------------------------
   RESET FILTERS
--------------------------------------------------------- */

function resetProjectFilters() {
    const search = getElement("projectSearch");
    const category = getElement("categoryFilter");
    const difficulty = getElement("difficultyFilter");
    const technology = getElement("technologyFilter");
    const availability = getElement("availabilityFilter");
    const sort = getElement("sortProjects");

    if (search) search.value = "";
    if (category) category.value = "";
    if (difficulty) difficulty.value = "";
    if (technology) technology.value = "";
    if (availability) availability.value = "";
    if (sort) sort.value = "newest";

    document.querySelectorAll(".category-chip.active").forEach(button => {
        button.classList.remove("active");
    });

    applyProjectFilters();
}

/* ---------------------------------------------------------
   GRID / LIST VIEW
--------------------------------------------------------- */

function setProjectView(view) {
    exploreState.view = view === "list" ? "list" : "grid";

    const gridButton = getElement("gridViewButton");
    const listButton = getElement("listViewButton");

    if (gridButton) {
        gridButton.classList.toggle("active", exploreState.view === "grid");
        gridButton.setAttribute(
            "aria-pressed",
            String(exploreState.view === "grid")
        );
    }

    if (listButton) {
        listButton.classList.toggle("active", exploreState.view === "list");
        listButton.setAttribute(
            "aria-pressed",
            String(exploreState.view === "list")
        );
    }

    renderProjects();
}

/* ---------------------------------------------------------
   MOBILE SIDEBAR
--------------------------------------------------------- */

function setSidebarOpen(open) {
    const sidebar = getElement("sidebar");
    const overlay = getElement("sidebar-overlay");
    const menuButton = getElement("mobile-menu");

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
   LOGOUT
--------------------------------------------------------- */

async function logoutStudent() {
    const button = getElement("student-logout");

    if (button) {
        button.disabled = true;
    }

    try {
        await fetchJSON(EXPLORE_CONFIG.logoutApi, {
            method: "POST"
        });
    } catch (error) {
        console.warn("Logout endpoint response:", error.message);
    } finally {
        window.location.replace(EXPLORE_CONFIG.homePage);
    }
}

/* ---------------------------------------------------------
   EVENT LISTENERS
--------------------------------------------------------- */

function bindEvents() {
    const searchForm = getElement("projectSearchForm");
    const searchInput = getElement("projectSearch");
    const workspaceSearch = getElement("workspace-search");
    const workspaceSearchInput = getElement("workspace-search-input");

    searchForm?.addEventListener("submit", event => {
        event.preventDefault();
        applyProjectFilters();
        scrollToProjects();
    });

    searchInput?.addEventListener("input", applyProjectFilters);

    getElement("categoryFilter")?.addEventListener("change", applyProjectFilters);
    getElement("difficultyFilter")?.addEventListener("change", applyProjectFilters);
    getElement("technologyFilter")?.addEventListener("change", applyProjectFilters);
    getElement("availabilityFilter")?.addEventListener("change", applyProjectFilters);
    getElement("sortProjects")?.addEventListener("change", applyProjectFilters);

    getElement("resetFiltersButton")?.addEventListener("click", resetProjectFilters);
    getElement("emptyStateResetButton")?.addEventListener("click", resetProjectFilters);
    getElement("retryProjectsButton")?.addEventListener("click", loadProjects);

    getElement("gridViewButton")?.addEventListener("click", () => {
        setProjectView("grid");
    });

    getElement("listViewButton")?.addEventListener("click", () => {
        setProjectView("list");
    });

    getElement("previousProjectsPage")?.addEventListener("click", () => {
        if (exploreState.currentPage > 1) {
            exploreState.currentPage--;
            renderProjects();
            scrollToProjects();
        }
    });

    getElement("nextProjectsPage")?.addEventListener("click", () => {
        const totalPages = Math.ceil(
            exploreState.filteredProjects.length / exploreState.pageSize
        );

        if (exploreState.currentPage < totalPages) {
            exploreState.currentPage++;
            renderProjects();
            scrollToProjects();
        }
    });

    document.querySelectorAll(".category-chip").forEach(button => {
        button.addEventListener("click", () => {
            const selectedCategory = button.dataset.category || "";
            const categorySelect = getElement("categoryFilter");

            if (categorySelect) {
                categorySelect.value =
                    categorySelect.value === selectedCategory
                        ? ""
                        : selectedCategory;
            }

            document.querySelectorAll(".category-chip").forEach(chip => {
                chip.classList.toggle(
                    "active",
                    chip === button &&
                    categorySelect?.value === selectedCategory
                );
            });

            applyProjectFilters();
        });
    });

    // Event delegation for dynamically created project cards.
    getElement("projectsGrid")?.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const project = exploreState.projects.find(item => {
            return item.id === button.dataset.projectId;
        });

        if (!project) {
            return;
        }

        if (button.dataset.action === "details") {
            openProjectDetails(project);
        }

        if (button.dataset.action === "join") {
            if (!project.hasRealId) {
                window.alert("This project does not have a valid project ID.");
                return;
            }

            openProjectDetails(project);
        }
    });

    const modal = getElement("projectDetailsModal");

    // Close only when a close control is clicked.
    modal?.querySelectorAll("[data-close-modal]").forEach(button => {
        button.addEventListener("click", closeProjectDetails);
    });

    // Clicking the backdrop closes the modal, but clicking
    // inside the dialog does not.
    modal?.addEventListener("click", event => {
        if (event.target === modal) {
            closeProjectDetails();
        }
    });

    document.addEventListener("keydown", event => {
        const activeModal = getElement("projectDetailsModal");

        if (event.key === "Escape" && activeModal && !activeModal.hidden) {
            closeProjectDetails();
            return;
        }

        if (
            event.key === "/" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            const target = event.target;

            const isTyping = target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target?.isContentEditable;

            if (!isTyping) {
                event.preventDefault();
                searchInput?.focus();
            }
        }
    });

    getElement("requestToJoinButton")?.addEventListener("click", () => {
        requestToJoinProject(exploreState.activeProject);
    });

    getElement("mobile-menu")?.addEventListener("click", () => {
        const sidebar = getElement("sidebar");
        setSidebarOpen(!sidebar?.classList.contains("open"));
    });

    getElement("sidebar-overlay")?.addEventListener("click", () => {
        setSidebarOpen(false);
    });

    // Close the mobile sidebar after navigating.
    getElement("sidebar")?.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => setSidebarOpen(false));
    });

    getElement("student-logout")?.addEventListener("click", logoutStudent);

    // Topbar search forwards its text into the project search.
    workspaceSearch?.addEventListener("submit", event => {
        event.preventDefault();

        if (searchInput && workspaceSearchInput) {
            searchInput.value = workspaceSearchInput.value;
            applyProjectFilters();
            scrollToProjects();
        }
    });

    workspaceSearchInput?.addEventListener("input", () => {
        if (searchInput) {
            searchInput.value = workspaceSearchInput.value;
            applyProjectFilters();
        }
    });

    // On narrow screens, reset the sidebar state if the window
    // becomes desktop-sized.
    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            setSidebarOpen(false);
        }
    });
}

/* ---------------------------------------------------------
   ERROR UI
--------------------------------------------------------- */

function showProjectError(message) {
    const errorContainer = getElement("projectsError");
    const errorMessage = getElement("projectsErrorMessage");
    const grid = getElement("projectsGrid");

    hideElement(getElement("projectsLoading"));
    hideElement(getElement("projectsEmptyState"));
    hideElement(getElement("projectsPagination"));

    if (grid) {
        grid.replaceChildren();
    }

    if (errorMessage) {
        errorMessage.textContent = message ||
            "Please try again or check the projects API.";
    }

    showElement(errorContainer);
}

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

async function initializeExploreProjects() {
    // Explicitly ensure the modal cannot appear on initial load.
    const modal = getElement("projectDetailsModal");

    if (modal) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("modal-open");

    const year = getElement("currentYear");

    if (year) {
        year.textContent = String(new Date().getFullYear());
    }

    bindEvents();

    // Profile loading and project loading are independent.
    await Promise.allSettled([
        loadStudentProfile(),
        loadProjects()
    ]);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeExploreProjects,
        { once: true }
    );
} else {
    initializeExploreProjects();
}
