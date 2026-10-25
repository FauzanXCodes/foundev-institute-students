/* =========================================================
   FOUNDEV — PROFILE & SETTINGS
   File: assets/js/profile-settings.js

   Shared workspace layout:
   - student-dashboard.css
   - Shared sidebar and topbar
   - Student session and profile identity

   Note:
   Profile-update and preference API endpoints must exist
   on the backend before persistence can work.
   ========================================================= */

(() => {
    "use strict";

    const CONFIG = {
        dashboardApi: "../api/student/dashboard.php",
        profileApi: "../api/student/profile.php",
        preferencesApi: "../api/student/preferences.php",
        logoutApi: "../api/student/logout.php"
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const elements = {
        // Shared workspace
        studentName: $("#student-name"),
        studentInstitution: $("#student-institution"),
        studentAvatar: $("#student-avatar"),
        mobileMenu: $("#mobile-menu"),
        sidebar: $("#sidebar"),
        sidebarOverlay: $("#sidebar-overlay"),
        logoutLink: $("#student-logout"),
        workspaceSearch: $("#workspace-search"),
        workspaceSearchInput: $("#workspace-search-input"),
        notificationDot: $("#notification-dot"),

        // Profile overview
        profileAvatarLarge: $("#profile-avatar-large"),
        displayName: $("#profile-display-name"),
        displayInstitution: $("#profile-display-institution"),
        displayEmail: $("#profile-display-email"),

        // Form
        form: $("#profile-settings-form"),
        fullName: $("#profile-full-name"),
        email: $("#profile-email"),
        phone: $("#profile-phone"),
        institution: $("#profile-institution"),
        course: $("#profile-course"),
        academicYear: $("#profile-year"),
        bio: $("#profile-bio"),
        fullNameError: $("#full-name-error"),
        formMessage: $("#profile-form-message"),
        saveProfileButton: $("#save-profile-button"),

        // Preferences
        emailNotifications: $("#email-notifications"),
        projectNotifications: $("#project-notifications"),
        savePreferencesButton: $("#save-preferences-button"),
        preferencesMessage: $("#preferences-message"),

        // Secondary logout
        settingsLogoutButton: $("#settings-logout-button")
    };

    const state = {
        profile: null,
        preferences: {
            email_notifications: true,
            project_notifications: true
        },
        profileLoaded: false,
        preferencesLoaded: false,
        profileSaving: false,
        preferencesSaving: false,
        loggingOut: false,
        profileController: null,
        preferencesController: null
    };

    /* -----------------------------------------------------
       HELPERS
    ----------------------------------------------------- */

    function escapeText(value) {
        return String(value ?? "").trim();
    }

    function getValue(object, keys, fallback = "") {
        if (!object || typeof object !== "object") {
            return fallback;
        }

        for (const key of keys) {
            const value = object[key];

            if (value !== undefined && value !== null) {
                return value;
            }
        }

        return fallback;
    }

    function getErrorMessage(payload, fallback) {
        return String(
            getValue(payload, ["message", "error", "detail"], fallback)
        );
    }

    function setText(element, value) {
        if (element) {
            element.textContent = String(value ?? "");
        }
    }

    function setMessage(element, message, type = "") {
        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.remove("is-success", "is-error");

        if (type === "success") {
            element.classList.add("is-success");
        } else if (type === "error") {
            element.classList.add("is-error");
        }
    }

    function setBusy(button, busy, busyText = "Saving...") {
        if (!button) {
            return;
        }

        if (busy) {
            if (!button.dataset.originalHtml) {
                button.dataset.originalHtml = button.innerHTML;
            }

            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            button.textContent = busyText;
        } else {
            button.disabled = false;
            button.removeAttribute("aria-busy");

            if (button.dataset.originalHtml) {
                button.innerHTML = button.dataset.originalHtml;
                delete button.dataset.originalHtml;
            }
        }
    }

    function getInitials(name) {
        const words = escapeText(name)
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) {
            return "S";
        }

        return words
            .slice(0, 2)
            .map(word => word[0].toUpperCase())
            .join("");
    }

    function normalizeProfile(payload) {
        const data = payload?.profile ||
            payload?.student ||
            payload?.data?.profile ||
            payload?.data?.student ||
            payload?.data ||
            payload;

        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("The server returned invalid profile data.");
        }

        return {
            full_name: getValue(data, [
                "full_name",
                "name",
                "student_name",
                "fullName"
            ], ""),

            email: getValue(data, [
                "email",
                "email_address"
            ], ""),

            phone: getValue(data, [
                "phone",
                "phone_number",
                "mobile"
            ], ""),

            institution_name: getValue(data, [
                "institution_name",
                "institution",
                "college_name",
                "institute_name"
            ], ""),

            course: getValue(data, [
                "course",
                "department",
                "course_name",
                "department_name"
            ], ""),

            academic_year: getValue(data, [
                "academic_year",
                "year_of_study",
                "year"
            ], ""),

            bio: getValue(data, [
                "bio",
                "about",
                "description"
            ], "")
        };
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
                ...(options.body ? {
                    "Content-Type": "application/json"
                } : {}),
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
                    `The request failed (${response.status}).`
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
                getErrorMessage(payload, "The operation was unsuccessful.")
            );
        }

        return payload;
    }

    /* -----------------------------------------------------
       SHARED PROFILE DISPLAY
    ----------------------------------------------------- */

    function updateSharedProfile(profile) {
        const name = escapeText(profile.full_name) || "Student";
        const institution = escapeText(profile.institution_name) ||
            "Student workspace";
        const initials = getInitials(name);

        setText(elements.studentName, name);
        setText(elements.studentInstitution, institution);
        setText(elements.studentAvatar, initials);

        if (elements.studentAvatar) {
            elements.studentAvatar.setAttribute(
                "aria-label",
                `Profile: ${name}`
            );
        }

        setText(elements.profileAvatarLarge, initials);
        setText(elements.displayName, name);
        setText(elements.displayInstitution, institution);
        setText(
            elements.displayEmail,
            escapeText(profile.email) || "Email not available"
        );
    }

    function populateProfileForm(profile) {
        if (elements.fullName) {
            elements.fullName.value = profile.full_name;
        }

        if (elements.email) {
            elements.email.value = profile.email;
        }

        if (elements.phone) {
            elements.phone.value = profile.phone;
        }

        if (elements.institution) {
            elements.institution.value = profile.institution_name;
        }

        if (elements.course) {
            elements.course.value = profile.course;
        }

        if (elements.academicYear) {
            elements.academicYear.value =
                String(profile.academic_year ?? "");
        }

        if (elements.bio) {
            elements.bio.value = profile.bio;
        }
    }

    /* -----------------------------------------------------
       LOAD PROFILE
    ----------------------------------------------------- */

    async function loadProfile() {
        if (state.profileController) {
            state.profileController.abort();
        }

        const controller = new AbortController();
        state.profileController = controller;

        try {
            /*
             * The dashboard endpoint is already part of the
             * student workspace. Use it to populate the shared
             * topbar while the dedicated profile endpoint is
             * checked separately.
             */
            const dashboard = await apiRequest(CONFIG.dashboardApi, {
                signal: controller.signal
            });

            if (state.profileController !== controller) {
                return;
            }

            const dashboardStudent =
                dashboard.student || dashboard.data?.student;

            if (dashboardStudent) {
                const sharedProfile = normalizeProfile(dashboardStudent);
                updateSharedProfile(sharedProfile);
            }

            const unread = getValue(
                dashboard.stats,
                ["unread_notifications", "unreadNotifications"],
                null
            );

            if (elements.notificationDot && unread !== null) {
                elements.notificationDot.hidden = Number(unread) <= 0;
            }

            /*
             * This endpoint must exist and return the current
             * authenticated student's profile.
             */
            const payload = await apiRequest(CONFIG.profileApi, {
                signal: controller.signal
            });

            if (state.profileController !== controller) {
                return;
            }

            const profile = normalizeProfile(payload);

            state.profile = profile;
            state.profileLoaded = true;

            populateProfileForm(profile);
            updateSharedProfile(profile);

            setMessage(elements.formMessage, "");
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            console.error("Foundev profile loading failed:", error);

            if (!state.profileLoaded) {
                setMessage(
                    elements.formMessage,
                    error.message ||
                    "Could not load your profile. Check your backend endpoint.",
                    "error"
                );
            }
        } finally {
            if (state.profileController === controller) {
                state.profileController = null;
            }
        }
    }

    /* -----------------------------------------------------
       VALIDATE PROFILE
    ----------------------------------------------------- */

    function validateProfile() {
        let valid = true;

        const name = escapeText(elements.fullName?.value);

        if (!name) {
            if (elements.fullName) {
                elements.fullName.setAttribute("aria-invalid", "true");
            }

            setText(
                elements.fullNameError,
                "Please enter your full name."
            );

            valid = false;
        } else {
            elements.fullName?.removeAttribute("aria-invalid");
            setText(elements.fullNameError, "");
        }

        const phone = escapeText(elements.phone?.value);

        if (phone && !/^[+\d\s().-]{7,25}$/.test(phone)) {
            elements.phone?.setAttribute("aria-invalid", "true");

            setMessage(
                elements.formMessage,
                "Please enter a valid phone number.",
                "error"
            );

            valid = false;
        } else {
            elements.phone?.removeAttribute("aria-invalid");
        }

        return valid;
    }

    function collectProfileForm() {
        return {
            full_name: escapeText(elements.fullName?.value),
            phone: escapeText(elements.phone?.value),
            course: escapeText(elements.course?.value),
            academic_year: escapeText(elements.academicYear?.value),
            bio: escapeText(elements.bio?.value)
        };
    }

    /* -----------------------------------------------------
       SAVE PROFILE
    ----------------------------------------------------- */

    async function saveProfile(event) {
        event.preventDefault();

        if (state.profileSaving) {
            return;
        }

        if (!validateProfile()) {
            return;
        }

        if (!state.profileLoaded) {
            setMessage(
                elements.formMessage,
                "Your profile has not loaded yet. Reload the page and try again.",
                "error"
            );
            return;
        }

        state.profileSaving = true;
        setBusy(elements.saveProfileButton, true, "Saving...");

        setMessage(elements.formMessage, "");

        try {
            /*
             * Expected endpoint:
             * POST ../api/student/profile.php
             * JSON body containing the editable fields.
             *
             * The backend must validate and update only the
             * currently authenticated student's record.
             */
            const payload = await apiRequest(CONFIG.profileApi, {
                method: "POST",
                body: JSON.stringify(collectProfileForm())
            });

            const updatedSource =
                payload.profile ||
                payload.student ||
                payload.data?.profile ||
                payload.data?.student;

            const updated = updatedSource
                ? normalizeProfile(updatedSource)
                : {
                    ...state.profile,
                    ...collectProfileForm()
                };

            state.profile = updated;
            state.profileLoaded = true;

            populateProfileForm(updated);
            updateSharedProfile(updated);

            setMessage(
                elements.formMessage,
                getErrorMessage(payload, "Your profile has been updated."),
                "success"
            );
        } catch (error) {
            console.error("Foundev profile update failed:", error);

            setMessage(
                elements.formMessage,
                error.message ||
                "Could not save your profile. Please try again.",
                "error"
            );
        } finally {
            state.profileSaving = false;
            setBusy(elements.saveProfileButton, false);
        }
    }

    /* -----------------------------------------------------
       PREFERENCES
    ----------------------------------------------------- */

    function readPreferencesForm() {
        return {
            email_notifications:
                Boolean(elements.emailNotifications?.checked),

            project_notifications:
                Boolean(elements.projectNotifications?.checked)
        };
    }

    function populatePreferences(preferences) {
        if (elements.emailNotifications) {
            elements.emailNotifications.checked =
                Boolean(preferences.email_notifications);
        }

        if (elements.projectNotifications) {
            elements.projectNotifications.checked =
                Boolean(preferences.project_notifications);
        }
    }

    async function loadPreferences() {
        if (state.preferencesController) {
            state.preferencesController.abort();
        }

        const controller = new AbortController();
        state.preferencesController = controller;

        try {
            const payload = await apiRequest(CONFIG.preferencesApi, {
                signal: controller.signal
            });

            if (state.preferencesController !== controller) {
                return;
            }

            const preferences = payload.preferences ||
                payload.data?.preferences ||
                payload.data ||
                payload;

            state.preferences = {
                email_notifications: Boolean(
                    getValue(
                        preferences,
                        ["email_notifications", "emailNotifications"],
                        true
                    )
                ),

                project_notifications: Boolean(
                    getValue(
                        preferences,
                        ["project_notifications", "projectNotifications"],
                        true
                    )
                )
            };

            state.preferencesLoaded = true;

            populatePreferences(state.preferences);
            setMessage(elements.preferencesMessage, "");
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            console.warn(
                "Foundev preferences could not be loaded:",
                error.message
            );

            setMessage(
                elements.preferencesMessage,
                "Saved preferences could not be loaded. The displayed switches may not reflect your saved settings.",
                "error"
            );
        } finally {
            if (state.preferencesController === controller) {
                state.preferencesController = null;
            }
        }
    }

    async function savePreferences() {
        if (state.preferencesSaving) {
            return;
        }

        if (!state.preferencesLoaded) {
            setMessage(
                elements.preferencesMessage,
                "Preferences have not loaded. Reload the page before saving.",
                "error"
            );
            return;
        }

        state.preferencesSaving = true;
        setBusy(
            elements.savePreferencesButton,
            true,
            "Saving..."
        );

        setMessage(elements.preferencesMessage, "");

        const preferences = readPreferencesForm();

        try {
            /*
             * Expected endpoint:
             * POST ../api/student/preferences.php
             *
             * Preferences must be saved to the authenticated
             * student's record by the backend.
             */
            const payload = await apiRequest(CONFIG.preferencesApi, {
                method: "POST",
                body: JSON.stringify(preferences)
            });

            const saved = payload.preferences ||
                payload.data?.preferences;

            state.preferences = saved
                ? {
                    email_notifications: Boolean(
                        getValue(
                            saved,
                            ["email_notifications", "emailNotifications"],
                            preferences.email_notifications
                        )
                    ),
                    project_notifications: Boolean(
                        getValue(
                            saved,
                            ["project_notifications", "projectNotifications"],
                            preferences.project_notifications
                        )
                    )
                }
                : preferences;

            populatePreferences(state.preferences);

            setMessage(
                elements.preferencesMessage,
                getErrorMessage(payload, "Your preferences have been saved."),
                "success"
            );
        } catch (error) {
            console.error("Foundev preferences update failed:", error);

            setMessage(
                elements.preferencesMessage,
                error.message ||
                "Could not save your preferences. Please try again.",
                "error"
            );
        } finally {
            state.preferencesSaving = false;
            setBusy(elements.savePreferencesButton, false);
        }
    }

    /* -----------------------------------------------------
       SHARED SIDEBAR
    ----------------------------------------------------- */

    function openSidebar() {
        if (!elements.sidebar) {
            return;
        }

        elements.sidebar.classList.add("active");
        elements.sidebar.classList.add("open");

        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.hidden = false;
            elements.sidebarOverlay.classList.add("active");
            elements.sidebarOverlay.classList.add("visible");
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

    function toggleSidebar() {
        const open = elements.sidebar?.classList.contains("active") ||
            elements.sidebar?.classList.contains("open");

        if (open) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    /* -----------------------------------------------------
       WORKSPACE SEARCH
    ----------------------------------------------------- */

    function handleWorkspaceSearch(event) {
        event.preventDefault();

        const query = escapeText(elements.workspaceSearchInput?.value);

        if (!query) {
            elements.workspaceSearchInput?.focus();
            return;
        }

        /*
         * This is a simple workspace search fallback.
         * Add additional pages here as search functionality
         * is implemented across the workspace.
         */
        const routes = [
            {
                terms: ["overview", "dashboard", "home"],
                url: "dashboard.html"
            },
            {
                terms: ["team", "members", "teammates"],
                url: "my-team.html"
            },
            {
                terms: ["explore", "available projects"],
                url: "explore-projects.html"
            },
            {
                terms: ["requests", "applications"],
                url: "my-requests.html"
            },
            {
                terms: ["my projects", "your projects"],
                url: "my-projects.html"
            },
            {
                terms: ["profile", "settings", "account"],
                url: "profile-settings.html"
            },
            {
                terms: ["notifications", "alerts"],
                url: "notifications.html"
            },
            {
                terms: ["support", "help"],
                url: "support.html"
            }
        ];

        const normalized = query.toLowerCase();

        const match = routes.find(route =>
            route.terms.some(term => term.includes(normalized))
        );

        if (match) {
            window.location.href = match.url;
            return;
        }

        setMessage(
            elements.formMessage,
            `No workspace page matched "${query}". Try searching for team, projects, requests, profile or notifications.`,
            "error"
        );
    }

    /* -----------------------------------------------------
       LOGOUT
    ----------------------------------------------------- */

    async function logout() {
        if (state.loggingOut) {
            return;
        }

        state.loggingOut = true;

        setBusy(elements.settingsLogoutButton, true, "Logging out...");
        setBusy(elements.logoutLink, true, "Logging out...");

        try {
            await apiRequest(CONFIG.logoutApi, {
                method: "POST"
            });

            window.location.href = "../../index.html";
        } catch (error) {
            console.error("Foundev logout failed:", error);

            const message = error.message.toLowerCase();

            if (
                message.includes("session") ||
                message.includes("sign in")
            ) {
                window.location.href = "../../index.html";
                return;
            }

            state.loggingOut = false;

            setBusy(elements.settingsLogoutButton, false);
            setBusy(elements.logoutLink, false);

            setMessage(
                elements.formMessage,
                "Unable to log out. Please try again.",
                "error"
            );
        }
    }

    /* -----------------------------------------------------
       EVENTS
    ----------------------------------------------------- */

    function bindEvents() {
        elements.form?.addEventListener("submit", saveProfile);

        elements.savePreferencesButton?.addEventListener(
            "click",
            savePreferences
        );

        elements.mobileMenu?.addEventListener(
            "click",
            toggleSidebar
        );

        elements.sidebarOverlay?.addEventListener(
            "click",
            closeSidebar
        );

        elements.sidebar?.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", closeSidebar);
        });

        elements.logoutLink?.addEventListener("click", event => {
            event.preventDefault();
            logout();
        });

        elements.settingsLogoutButton?.addEventListener(
            "click",
            logout
        );

        elements.workspaceSearch?.addEventListener(
            "submit",
            handleWorkspaceSearch
        );

        elements.workspaceSearchInput?.addEventListener("keydown", event => {
            if (event.key === "/" && document.activeElement !==
                elements.workspaceSearchInput) {
                event.preventDefault();
                elements.workspaceSearchInput.focus();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeSidebar();
            }

            if (
                event.key === "/" &&
                !["INPUT", "TEXTAREA", "SELECT"].includes(
                    document.activeElement?.tagName
                ) &&
                !document.activeElement?.isContentEditable
            ) {
                event.preventDefault();
                elements.workspaceSearchInput?.focus();
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

    async function initialize() {
        bindEvents();

        if (elements.mobileMenu) {
            elements.mobileMenu.setAttribute("aria-expanded", "false");
        }

        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.hidden = true;
        }

        await Promise.all([
            loadProfile(),
            loadPreferences()
        ]);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }
})();