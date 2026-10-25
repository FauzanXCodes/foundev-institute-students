/* =========================================
   FOUNDEV SUPPORT PAGE
   File: assets/js/support.js
   ========================================= */

(() => {
    "use strict";

    const CONFIG = {
        dashboardApi: "../api/student/dashboard.php",
        logoutApi: "../api/student/logout.php",
        supportEmail: "thefoundev@gmail.com"
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const elements = {
        form: $("#support-form"),
        name: $("#support-name"),
        email: $("#support-email"),
        topic: $("#support-topic"),
        subject: $("#support-subject"),
        message: $("#support-message"),

        nameError: $("#support-name-error"),
        emailError: $("#support-email-error"),
        topicError: $("#support-topic-error"),
        subjectError: $("#support-subject-error"),
        messageError: $("#support-message-error"),

        characterCount: $("#support-character-count"),
        feedback: $("#support-feedback"),
        submitButton: $("#support-submit"),

        studentName: $("#student-name"),
        studentInstitution: $("#student-institution"),
        studentAvatar: $("#student-avatar"),
        notificationDot: $("#notification-dot"),

        workspaceSearch: $("#workspace-search"),
        workspaceSearchInput: $("#workspace-search-input"),

        mobileMenu: $("#mobile-menu"),
        sidebar: $("#sidebar"),
        sidebarOverlay: $("#sidebar-overlay"),

        logoutLink: $("#student-logout"),
        supportYear: $("#support-year")
    };

    let isLoggingOut = false;

    /* -------------------------------------
       HELPERS
    ------------------------------------- */

    function text(value) {
        return String(value ?? "").trim();
    }

    function getInitials(name) {
        const parts = text(name).split(/\s+/).filter(Boolean);

        return parts.length
            ? parts.slice(0, 2).map(part => part[0].toUpperCase()).join("")
            : "S";
    }

    function showFeedback(message, type = "success") {
        if (!elements.feedback) return;

        elements.feedback.textContent = message;
        elements.feedback.classList.remove("is-success", "is-error");
        elements.feedback.classList.add(
            type === "error" ? "is-error" : "is-success"
        );
        elements.feedback.hidden = false;
    }

    function clearFeedback() {
        if (!elements.feedback) return;

        elements.feedback.textContent = "";
        elements.feedback.hidden = true;
        elements.feedback.classList.remove("is-success", "is-error");
    }

    function setFieldError(input, errorElement, message) {
        if (input) {
            if (message) {
                input.setAttribute("aria-invalid", "true");
            } else {
                input.removeAttribute("aria-invalid");
            }
        }

        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.headers || {})
            }
        });

        const contentType = response.headers.get("content-type") || "";
        let data = null;

        if (contentType.includes("application/json")) {
            data = await response.json();
        }

        if (!response.ok || data?.success === false) {
            throw new Error(
                data?.message ||
                `Request failed (${response.status}).`
            );
        }

        return data;
    }

    /* -------------------------------------
       LOAD STUDENT DETAILS
    ------------------------------------- */

    async function loadStudentDetails() {
        try {
            const data = await requestJson(CONFIG.dashboardApi);
            const student = data.student || data.data?.student;

            if (student) {
                const name = text(
                    student.full_name ||
                    student.name ||
                    student.student_name ||
                    "Student"
                );

                const institution = text(
                    student.institution_name ||
                    student.institution ||
                    student.college_name ||
                    "Student workspace"
                );

                if (elements.studentName) {
                    elements.studentName.textContent = name;
                }

                if (elements.studentInstitution) {
                    elements.studentInstitution.textContent = institution;
                }

                if (elements.studentAvatar) {
                    elements.studentAvatar.textContent = getInitials(name);
                }

                // Prefill the form only when the field is still empty.
                if (elements.name && !elements.name.value.trim()) {
                    elements.name.value = name === "Student" ? "" : name;
                }
            }

            const unread = data.stats?.unread_notifications;

            if (elements.notificationDot && unread !== undefined) {
                elements.notificationDot.hidden = Number(unread) <= 0;
            }
        } catch (error) {
            // The support form remains usable if the dashboard API fails.
            console.warn("Could not load student details:", error.message);
        }
    }

    /* -------------------------------------
       FORM VALIDATION
    ------------------------------------- */

    function validateForm() {
        let valid = true;

        const name = text(elements.name?.value);
        const email = text(elements.email?.value);
        const topic = text(elements.topic?.value);
        const subject = text(elements.subject?.value);
        const message = text(elements.message?.value);

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const errors = [
            {
                input: elements.name,
                element: elements.nameError,
                message: name.length < 2
                    ? "Please enter your name."
                    : ""
            },
            {
                input: elements.email,
                element: elements.emailError,
                message: !emailPattern.test(email)
                    ? "Please enter a valid email address."
                    : ""
            },
            {
                input: elements.topic,
                element: elements.topicError,
                message: !topic
                    ? "Please select a support topic."
                    : ""
            },
            {
                input: elements.subject,
                element: elements.subjectError,
                message: subject.length < 3
                    ? "Please enter a short subject."
                    : ""
            },
            {
                input: elements.message,
                element: elements.messageError,
                message: message.length < 20
                    ? "Please describe the issue in at least 20 characters."
                    : ""
            }
        ];

        errors.forEach(item => {
            setFieldError(item.input, item.element, item.message);

            if (item.message) {
                valid = false;
            }
        });

        if (!valid) {
            const firstInvalid = errors.find(item => item.message);

            firstInvalid?.input?.focus();

            showFeedback(
                "Please check the highlighted fields and try again.",
                "error"
            );
        }

        return valid;
    }

    /* -------------------------------------
       CHARACTER COUNTER
    ------------------------------------- */

    function updateCharacterCount() {
        if (!elements.message || !elements.characterCount) return;

        const count = elements.message.value.length;

        elements.characterCount.textContent = `${count} / 5000`;

        elements.characterCount.classList.toggle(
            "is-near-limit",
            count >= 4500
        );

        elements.characterCount.classList.toggle(
            "is-at-limit",
            count >= 5000
        );
    }

    /* -------------------------------------
       BUILD EMAIL
    ------------------------------------- */

    function createEmailUrl() {
        const name = text(elements.name.value);
        const email = text(elements.email.value);
        const topic = text(elements.topic.value);
        const subject = text(elements.subject.value);
        const message = text(elements.message.value);

        const emailSubject = `[Foundev Support] ${subject}`;

        const emailBody = [
            "Hello Foundev Support Team,",
            "",
            "I need assistance with the following:",
            "",
            `Name: ${name}`,
            `Contact email: ${email}`,
            `Support topic: ${topic}`,
            `Subject: ${subject}`,
            "",
            "Issue details:",
            message,
            "",
            "Thank you,",
            name
        ].join("\n");

        return (
            `mailto:${CONFIG.supportEmail}` +
            `?subject=${encodeURIComponent(emailSubject)}` +
            `&body=${encodeURIComponent(emailBody)}`
        );
    }

    function openEmailApplication() {
        const emailUrl = createEmailUrl();

        showFeedback(
            "Your email draft is ready. If your email app did not open, use the direct email link on this page.",
            "success"
        );

        /*
         * This opens the user's configured email application.
         * It does not send the email automatically.
         */
        window.location.href = emailUrl;
    }

    /* -------------------------------------
       FORM EVENTS
    ------------------------------------- */

    function bindFormEvents() {
        if (!elements.form) return;

        elements.form.addEventListener("submit", event => {
            event.preventDefault();
            clearFeedback();

            if (!validateForm()) return;

            openEmailApplication();
        });

        elements.message?.addEventListener(
            "input",
            updateCharacterCount
        );

        const fieldPairs = [
            [elements.name, elements.nameError],
            [elements.email, elements.emailError],
            [elements.topic, elements.topicError],
            [elements.subject, elements.subjectError],
            [elements.message, elements.messageError]
        ];

        fieldPairs.forEach(([input, error]) => {
            input?.addEventListener("input", () => {
                if (input.getAttribute("aria-invalid") === "true") {
                    setFieldError(input, error, "");
                }
            });

            input?.addEventListener("change", () => {
                if (input.getAttribute("aria-invalid") === "true") {
                    setFieldError(input, error, "");
                }
            });
        });

        updateCharacterCount();
    }

    /* -------------------------------------
       WORKSPACE SEARCH
    ------------------------------------- */

    function bindWorkspaceSearch() {
        elements.workspaceSearch?.addEventListener("submit", event => {
            event.preventDefault();

            const query = text(elements.workspaceSearchInput?.value)
                .toLowerCase();

            if (!query) {
                elements.workspaceSearchInput?.focus();
                return;
            }

            const pages = [
                { terms: ["overview", "dashboard", "home"], url: "dashboard.html" },
                { terms: ["team", "members"], url: "my-team.html" },
                { terms: ["explore", "discover"], url: "explore-projects.html" },
                { terms: ["requests", "applications"], url: "my-requests.html" },
                { terms: ["my projects", "projects"], url: "my-projects.html" },
                { terms: ["profile", "settings", "account"], url: "profile-settings.html" },
                { terms: ["support", "help"], url: "support.html" },
                { terms: ["notifications", "alerts"], url: "notifications.html" }
            ];

            const match = pages.find(page =>
                page.terms.some(term => term.includes(query))
            );

            if (match) {
                window.location.href = match.url;
            } else {
                showFeedback(
                    `No workspace page matched "${query}". Try "projects", "team", "profile" or "support".`,
                    "error"
                );
            }
        });

        elements.workspaceSearchInput?.addEventListener("keydown", event => {
            if (event.key === "/" && event.target !== document.activeElement) {
                event.preventDefault();
                elements.workspaceSearchInput.focus();
            }
        });

        document.addEventListener("keydown", event => {
            const tag = document.activeElement?.tagName;

            if (
                event.key === "/" &&
                !["INPUT", "TEXTAREA", "SELECT"].includes(tag) &&
                !document.activeElement?.isContentEditable
            ) {
                event.preventDefault();
                elements.workspaceSearchInput?.focus();
            }

            if (event.key === "Escape") {
                closeSidebar();
            }
        });
    }

    /* -------------------------------------
       MOBILE SIDEBAR
    ------------------------------------- */

    function openSidebar() {
        elements.sidebar?.classList.add("active", "open");

        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.hidden = false;
            elements.sidebarOverlay.classList.add("active", "visible");
        }

        elements.mobileMenu?.setAttribute("aria-expanded", "true");
        document.body.classList.add("sidebar-open");
    }

    function closeSidebar() {
        elements.sidebar?.classList.remove("active", "open");

        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.remove("active", "visible");
            elements.sidebarOverlay.hidden = true;
        }

        elements.mobileMenu?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("sidebar-open");
    }

    function bindSidebar() {
        elements.mobileMenu?.addEventListener("click", () => {
            const isOpen =
                elements.sidebar?.classList.contains("active") ||
                elements.sidebar?.classList.contains("open");

            if (isOpen) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        elements.sidebarOverlay?.addEventListener("click", closeSidebar);

        elements.sidebar?.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", closeSidebar);
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) {
                closeSidebar();
            }
        });
    }

    /* -------------------------------------
       LOGOUT
    ------------------------------------- */

    async function logout(event) {
        event?.preventDefault();

        if (isLoggingOut) return;

        isLoggingOut = true;

        if (elements.logoutLink) {
            elements.logoutLink.style.pointerEvents = "none";
            elements.logoutLink.setAttribute("aria-busy", "true");
        }

        try {
            await requestJson(CONFIG.logoutApi, {
                method: "POST"
            });

            window.location.href = "../../index.html";
        } catch (error) {
            console.error("Logout failed:", error.message);

            if (elements.logoutLink) {
                elements.logoutLink.style.pointerEvents = "";
                elements.logoutLink.removeAttribute("aria-busy");
            }

            isLoggingOut = false;

            showFeedback(
                "We couldn't log you out. Please try again.",
                "error"
            );
        }
    }

    /* -------------------------------------
       INITIALIZE
    ------------------------------------- */

    function initialize() {
        if (elements.supportYear) {
            elements.supportYear.textContent =
                new Date().getFullYear();
        }

        bindFormEvents();
        bindWorkspaceSearch();
        bindSidebar();

        elements.logoutLink?.addEventListener("click", logout);

        loadStudentDetails();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }
})();
