
/* ============================================================
   FOUNDEV INSTITUTE WORKSPACE — SETTINGS
   File: assets/js/settings.js

   API expected:
   ../api/admin/settings.php

   Expected actions:
   GET  ?action=load
   POST action=save_institution
   POST action=save_administrator
   POST action=save_preferences
   POST action=change_password
   POST action=logout

   Expected JSON response:
   { "success": true, "data": { ... } }

   Adapt the API action names if your PHP backend uses
   different action names.
   ============================================================ */

(() => {
    "use strict";

    const API_URL = "../api/admin/settings.php";

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const elements = {
        sidebar: $("#institute-sidebar"),
        sidebarToggle: $("#sidebar-toggle"),
        sidebarOverlay: $("#sidebar-overlay"),

        accountMenuButton: $("#account-menu-button"),
        accountMenu: $("#account-menu"),
        logoutButton: $("#logout-button"),
        settingsLogoutButton: $("#settings-logout-button"),

        dashboardDate: $("#dashboard-date"),
        currentYear: $("#current-year"),
        systemStatus: $("#system-status"),
        systemStatusText: $("#system-status-text"),

        institutionName: $("#institution-name"),
        institutionInitial: $("#institution-initial"),
        adminName: $("#admin-name"),
        adminEmail: $("#admin-email"),

        settingsForm: $("#settings-form"),
        loading: $("#settings-loading"),
        error: $("#settings-error"),
        errorMessage: $("#settings-error-message"),
        retryButton: $("#retry-settings-button"),

        saveIndicator: $("#settings-save-indicator"),
        saveStatus: $("#settings-save-status"),
        feedback: $("#settings-form-feedback"),

        institutionAvatar: $("#settings-institution-avatar"),
        institutionDisplayName: $("#settings-institution-display-name"),
        institutionStatusBadge: $("#institution-status-badge"),

        institutionNameInput: $("#institution-name-input"),
        institutionEmailInput: $("#institution-email-input"),
        institutionPhoneInput: $("#institution-phone-input"),
        institutionWebsiteInput: $("#institution-website-input"),
        institutionAddressInput: $("#institution-address-input"),

        administratorNameInput: $("#administrator-name-input"),
        administratorEmailInput: $("#administrator-email-input"),

        notifyAssessments: $("#notify-assessments"),
        notifySubmissions: $("#notify-submissions"),
        notifyProjects: $("#notify-projects"),
        notifyMentors: $("#notify-mentors"),

        saveInstitutionButton: $("#save-institution-button"),
        saveAdministratorButton: $("#save-administrator-button"),
        savePreferencesButton: $("#save-preferences-button"),

        passwordDialog: $("#change-password-dialog"),
        openPasswordDialogButton: $("#open-password-dialog-button"),
        passwordForm: $("#change-password-form"),
        currentPassword: $("#current-password"),
        newPassword: $("#new-password"),
        confirmPassword: $("#confirm-password"),
        passwordMessage: $("#password-form-message"),
        passwordSubmit: $("#change-password-submit")
    };

    const state = {
        loading: false,
        saving: false,
        initialised: false,
        original: null,
        activeRequest: null
    };

    /* ========================================================
       1. GENERAL UTILITIES
       ======================================================== */

    function setText(element, value, fallback = "") {
        if (!element) return;
        element.textContent = value == null || value === ""
            ? fallback
            : String(value);
    }

    function getValue(element) {
        return element ? element.value.trim() : "";
    }

    function setValue(element, value) {
        if (!element) return;
        element.value = value == null ? "" : String(value);
    }

    function setChecked(element, value, fallback = false) {
        if (!element) return;
        element.checked = value == null ? fallback : Boolean(value);
    }

    function getInitial(value, fallback = "I") {
        const name = String(value || "").trim();

        return name
            ? Array.from(name)[0].toUpperCase()
            : fallback;
    }

    function setHidden(element, hidden) {
        if (element) element.hidden = hidden;
    }

    function setButtonLoading(button, loading, loadingText) {
        if (!button) return;

        if (loading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.textContent.trim();
            }

            button.disabled = true;

            if (loadingText) {
                button.textContent = loadingText;
            }

            button.setAttribute("aria-busy", "true");
        } else {
            button.disabled = false;

            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }

            button.removeAttribute("aria-busy");
        }
    }

    function setSaveStatus(message, status = "idle") {
        setText(elements.saveStatus, message);

        if (elements.saveIndicator) {
            elements.saveIndicator.dataset.status = status;
        }
    }

    function showFeedback(message, type = "success") {
        if (!elements.feedback) return;

        elements.feedback.textContent = message;
        elements.feedback.className = "settings-form-feedback";
        elements.feedback.classList.add(
            type === "error" ? "is-error" : "is-success"
        );

        setHidden(elements.feedback, false);
    }

    function clearFeedback() {
        if (!elements.feedback) return;

        elements.feedback.textContent = "";
        elements.feedback.className = "settings-form-feedback";
        setHidden(elements.feedback, true);
    }

    function showPasswordMessage(message, type = "error") {
        if (!elements.passwordMessage) return;

        elements.passwordMessage.textContent = message;
        elements.passwordMessage.className = "settings-dialog-message";
        elements.passwordMessage.classList.add(
            type === "success" ? "is-success" : "is-error"
        );

        setHidden(elements.passwordMessage, false);
    }

    function clearPasswordMessage() {
        if (!elements.passwordMessage) return;

        elements.passwordMessage.textContent = "";
        elements.passwordMessage.className = "settings-dialog-message";
        setHidden(elements.passwordMessage, true);
    }

    function setSystemStatus(message, status = "ready") {
        setText(elements.systemStatusText, message);

        if (elements.systemStatus) {
            elements.systemStatus.dataset.status = status;
        }
    }

    function normaliseBoolean(value, fallback = false) {
        if (value === undefined || value === null) return fallback;

        if (typeof value === "boolean") return value;

        if (typeof value === "number") return value === 1;

        if (typeof value === "string") {
            return ["1", "true", "yes", "on", "enabled"]
                .includes(value.toLowerCase());
        }

        return Boolean(value);
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function isValidWebsite(value) {
        if (!value) return true;

        try {
            const url = new URL(value);

            return url.protocol === "http:" ||
                url.protocol === "https:";
        } catch {
            return false;
        }
    }

    function formatDate(date = new Date()) {
        return new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function updatePageDate() {
        setText(elements.dashboardDate, formatDate());
        setText(
            elements.currentYear,
            String(new Date().getFullYear())
        );
    }

    /* ========================================================
       2. API REQUEST HELPER
       ======================================================== */

    async function apiRequest(action, options = {}) {
        const method = options.method || "GET";
        const params = new URLSearchParams();

        params.set("action", action);

        let url = API_URL;
        const requestOptions = {
            method,
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        };

        if (method === "GET") {
            url += "?" + params.toString();
        } else {
            requestOptions.headers["Content-Type"] = "application/json";

            requestOptions.body = JSON.stringify({
                action,
                ...(options.data || {})
            });
        }

        const response = await fetch(url, requestOptions);

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error(
                "The server returned an invalid response. Check the PHP API."
            );
        }

        if (!response.ok || result.success === false) {
            if (response.status === 401 || response.status === 403) {
                throw new Error(
                    result.message ||
                    "Your session may have expired. Please sign in again."
                );
            }

            throw new Error(
                result.message ||
                `Request failed (${response.status}).`
            );
        }

        return result;
    }

    /* ========================================================
       3. LOAD AND NORMALISE SETTINGS DATA
       ======================================================== */

    function extractData(result) {
        if (!result || typeof result !== "object") {
            return {};
        }

        if (result.data && typeof result.data === "object") {
            return result.data;
        }

        return result;
    }

    function getInstitutionData(data) {
        return data.institution ||
            data.institution_profile ||
            {};
    }

    function getAdministratorData(data) {
        return data.administrator ||
            data.admin ||
            data.account ||
            {};
    }

    function getPreferencesData(data) {
        return data.preferences ||
            data.notifications ||
            {};
    }

    function renderSettings(data) {
        const institution = getInstitutionData(data);
        const administrator = getAdministratorData(data);
        const preferences = getPreferencesData(data);

        const institutionName =
            institution.institution_name ||
            institution.name ||
            data.institution_name ||
            "";

        const institutionEmail =
            institution.institution_email ||
            institution.email ||
            "";

        const institutionPhone =
            institution.institution_phone ||
            institution.phone ||
            "";

        const institutionWebsite =
            institution.institution_website ||
            institution.website ||
            "";

        const institutionAddress =
            institution.institution_address ||
            institution.address ||
            "";

        const administratorName =
            administrator.administrator_name ||
            administrator.full_name ||
            administrator.name ||
            "";

        const administratorEmail =
            administrator.administrator_email ||
            administrator.email ||
            "";

        setValue(elements.institutionNameInput, institutionName);
        setValue(elements.institutionEmailInput, institutionEmail);
        setValue(elements.institutionPhoneInput, institutionPhone);
        setValue(elements.institutionWebsiteInput, institutionWebsite);
        setValue(elements.institutionAddressInput, institutionAddress);

        setValue(elements.administratorNameInput, administratorName);
        setValue(elements.administratorEmailInput, administratorEmail);

        setChecked(
            elements.notifyAssessments,
            normaliseBoolean(preferences.notify_assessments, true)
        );

        setChecked(
            elements.notifySubmissions,
            normaliseBoolean(preferences.notify_submissions, true)
        );

        setChecked(
            elements.notifyProjects,
            normaliseBoolean(preferences.notify_projects, true)
        );

        setChecked(
            elements.notifyMentors,
            normaliseBoolean(preferences.notify_mentors, true)
        );

        setText(
            elements.institutionName,
            institutionName,
            "Your institution"
        );

        setText(
            elements.institutionDisplayName,
            institutionName,
            "Your institution"
        );

        setText(
            elements.institutionInitial,
            getInitial(institutionName)
        );

        setText(
            elements.institutionAvatar,
            getInitial(institutionName)
        );

        setText(
            elements.adminName,
            administratorName,
            "Administrator"
        );

        setText(
            elements.adminEmail,
            administratorEmail,
            "Administrator account"
        );

        const status = institution.status ||
            institution.institution_status ||
            "";

        if (elements.institutionStatusBadge && status) {
            elements.institutionStatusBadge.textContent =
                status.replace(/[_-]/g, " ");
        }

        state.original = {
            institution: {
                institution_name: institutionName,
                institution_email: institutionEmail,
                institution_phone: institutionPhone,
                institution_website: institutionWebsite,
                institution_address: institutionAddress
            },
            administrator: {
                administrator_name: administratorName,
                administrator_email: administratorEmail
            },
            preferences: {
                notify_assessments: normaliseBoolean(
                    preferences.notify_assessments,
                    true
                ),
                notify_submissions: normaliseBoolean(
                    preferences.notify_submissions,
                    true
                ),
                notify_projects: normaliseBoolean(
                    preferences.notify_projects,
                    true
                ),
                notify_mentors: normaliseBoolean(
                    preferences.notify_mentors,
                    true
                )
            }
        };

        setSaveStatus("Your workspace settings");
    }

    async function loadSettings() {
        if (state.loading) return;

        state.loading = true;

        setHidden(elements.error, true);
        setHidden(elements.settingsForm, true);
        setHidden(elements.loading, false);
        clearFeedback();
        setSystemStatus("Connecting", "loading");

        if (elements.retryButton) {
            elements.retryButton.disabled = true;
        }

        try {
            const result = await apiRequest("load");
            const data = extractData(result);

            renderSettings(data);

            state.initialised = true;

            setHidden(elements.loading, true);
            setHidden(elements.error, true);
            setHidden(elements.settingsForm, false);

            setSystemStatus("Connected", "ready");
        } catch (error) {
            setHidden(elements.loading, true);
            setHidden(elements.settingsForm, true);
            setHidden(elements.error, false);

            setText(
                elements.errorMessage,
                error.message || "Unable to load settings."
            );

            setSystemStatus("Connection issue", "error");
        } finally {
            state.loading = false;

            if (elements.retryButton) {
                elements.retryButton.disabled = false;
            }
        }
    }

    /* ========================================================
       4. VALIDATION
       ======================================================== */

    function validateInstitution() {
        const name = getValue(elements.institutionNameInput);
        const email = getValue(elements.institutionEmailInput);
        const website = getValue(elements.institutionWebsiteInput);

        if (!name) {
            elements.institutionNameInput?.focus();
            showFeedback("Please enter the institution name.", "error");
            return false;
        }

        if (email && !isValidEmail(email)) {
            elements.institutionEmailInput?.focus();
            showFeedback(
                "Please enter a valid institution email address.",
                "error"
            );
            return false;
        }

        if (website && !isValidWebsite(website)) {
            elements.institutionWebsiteInput?.focus();
            showFeedback(
                "Enter a valid website URL beginning with https:// or http://.",
                "error"
            );
            return false;
        }

        return true;
    }

    function validateAdministrator() {
        const name = getValue(elements.administratorNameInput);
        const email = getValue(elements.administratorEmailInput);

        if (!name) {
            elements.administratorNameInput?.focus();
            showFeedback(
                "Please enter the administrator's full name.",
                "error"
            );
            return false;
        }

        if (!email || !isValidEmail(email)) {
            elements.administratorEmailInput?.focus();
            showFeedback(
                "Please enter a valid administrator email address.",
                "error"
            );
            return false;
        }

        return true;
    }

    /* ========================================================
       5. SAVE REQUEST WRAPPER
       ======================================================== */

    async function saveSection(action, button, payload, label) {
        if (state.saving) return;

        state.saving = true;
        clearFeedback();

        setButtonLoading(button, true, "Saving…");
        setSaveStatus("Saving changes", "loading");

        try {
            const result = await apiRequest(action, {
                method: "POST",
                data: payload
            });

            const returnedData = result.data &&
                typeof result.data === "object"
                ? result.data
                : null;

            if (returnedData) {
                const hasNestedSettings =
                    returnedData.institution ||
                    returnedData.administrator ||
                    returnedData.preferences;

                if (hasNestedSettings) {
                    renderSettings(returnedData);
                }
            }

            /*
             * Do not announce success until the server responds
             * with a successful response.
             */
            showFeedback(
                result.message || `${label} saved successfully.`,
                "success"
            );

            setSaveStatus("Changes saved", "saved");

            if (state.original) {
                updateOriginalSection(action, payload);
            }
        } catch (error) {
            showFeedback(
                error.message || `Unable to save ${label.toLowerCase()}.`,
                "error"
            );

            setSaveStatus("Unable to save changes", "error");
        } finally {
            state.saving = false;
            setButtonLoading(button, false);
        }
    }

    function updateOriginalSection(action, payload) {
        if (!state.original) return;

        if (action === "save_institution") {
            state.original.institution = { ...payload };
        } else if (action === "save_administrator") {
            state.original.administrator = { ...payload };
        } else if (action === "save_preferences") {
            state.original.preferences = { ...payload };
        }
    }

    /* ========================================================
       6. SAVE INSTITUTION PROFILE
       ======================================================== */

    async function saveInstitution() {
        if (!validateInstitution()) return;

        const payload = {
            institution_name: getValue(elements.institutionNameInput),
            institution_email: getValue(elements.institutionEmailInput),
            institution_phone: getValue(elements.institutionPhoneInput),
            institution_website: getValue(elements.institutionWebsiteInput),
            institution_address: getValue(elements.institutionAddressInput)
        };

        await saveSection(
            "save_institution",
            elements.saveInstitutionButton,
            payload,
            "Institution profile"
        );
    }

    /* ========================================================
       7. SAVE ADMINISTRATOR ACCOUNT
       ======================================================== */

    async function saveAdministrator() {
        if (!validateAdministrator()) return;

        const payload = {
            administrator_name: getValue(elements.administratorNameInput),
            administrator_email: getValue(elements.administratorEmailInput)
        };

        await saveSection(
            "save_administrator",
            elements.saveAdministratorButton,
            payload,
            "Administrator account"
        );
    }

    /* ========================================================
       8. SAVE NOTIFICATION PREFERENCES
       ======================================================== */

    async function savePreferences() {
        const payload = {
            notify_assessments: Boolean(
                elements.notifyAssessments?.checked
            ),
            notify_submissions: Boolean(
                elements.notifySubmissions?.checked
            ),
            notify_projects: Boolean(
                elements.notifyProjects?.checked
            ),
            notify_mentors: Boolean(
                elements.notifyMentors?.checked
            )
        };

        await saveSection(
            "save_preferences",
            elements.savePreferencesButton,
            payload,
            "Notification preferences"
        );
    }

    /* ========================================================
       9. PASSWORD DIALOG
       ======================================================== */

    function openPasswordDialog() {
        if (!elements.passwordDialog) return;

        clearPasswordMessage();

        elements.passwordForm?.reset();

        if (typeof elements.passwordDialog.showModal === "function") {
            elements.passwordDialog.showModal();
        } else {
            elements.passwordDialog.setAttribute("open", "");
        }

        window.setTimeout(() => {
            elements.currentPassword?.focus();
        }, 50);
    }

    function closePasswordDialog() {
        if (!elements.passwordDialog) return;

        if (typeof elements.passwordDialog.close === "function") {
            elements.passwordDialog.close();
        } else {
            elements.passwordDialog.removeAttribute("open");
        }

        elements.passwordForm?.reset();
        clearPasswordMessage();
    }

    async function changePassword(event) {
        event.preventDefault();

        if (state.saving) return;

        const currentPassword = elements.currentPassword?.value || "";
        const newPassword = elements.newPassword?.value || "";
        const confirmPassword = elements.confirmPassword?.value || "";

        clearPasswordMessage();

        if (!currentPassword) {
            showPasswordMessage("Enter your current password.");
            elements.currentPassword?.focus();
            return;
        }

        if (newPassword.length < 10) {
            showPasswordMessage(
                "Your new password must contain at least 10 characters."
            );
            elements.newPassword?.focus();
            return;
        }

        if (newPassword.length > 128) {
            showPasswordMessage(
                "Your new password is too long. Use no more than 128 characters."
            );
            elements.newPassword?.focus();
            return;
        }

        if (newPassword === currentPassword) {
            showPasswordMessage(
                "Choose a new password different from your current password."
            );
            elements.newPassword?.focus();
            return;
        }

        if (newPassword !== confirmPassword) {
            showPasswordMessage(
                "The new password and confirmation do not match."
            );
            elements.confirmPassword?.focus();
            return;
        }

        state.saving = true;
        setButtonLoading(
            elements.passwordSubmit,
            true,
            "Updating…"
        );

        try {
            const result = await apiRequest("change_password", {
                method: "POST",
                data: {
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                }
            });

            showPasswordMessage(
                result.message || "Password updated successfully.",
                "success"
            );

            elements.passwordForm?.reset();

            setSaveStatus("Password updated", "saved");

            /*
             * Keep the success message visible briefly so the
             * administrator can read it before closing the dialog.
             */
            window.setTimeout(() => {
                if (elements.passwordDialog?.open) {
                    closePasswordDialog();
                }
            }, 1200);
        } catch (error) {
            showPasswordMessage(
                error.message || "Unable to update your password."
            );
        } finally {
            state.saving = false;
            setButtonLoading(elements.passwordSubmit, false);
        }
    }

    /* ========================================================
       10. LOGOUT
       ======================================================== */

    async function logout() {
        const confirmed = window.confirm(
            "Are you sure you want to sign out of the Foundev workspace?"
        );

        if (!confirmed) return;

        setSystemStatus("Signing out", "loading");

        if (elements.logoutButton) {
            elements.logoutButton.disabled = true;
        }

        if (elements.settingsLogoutButton) {
            elements.settingsLogoutButton.disabled = true;
        }

        try {
            const result = await apiRequest("logout", {
                method: "POST",
                data: {}
            });

            /*
             * Redirect only after the server confirms logout.
             * Change this path if your existing login page differs.
             */
            window.location.href =
                result.redirect || "login.html";
        } catch (error) {
            setSystemStatus("Sign-out failed", "error");

            if (elements.logoutButton) {
                elements.logoutButton.disabled = false;
            }

            if (elements.settingsLogoutButton) {
                elements.settingsLogoutButton.disabled = false;
            }

            window.alert(
                error.message ||
                "Unable to sign out. Please try again."
            );
        }
    }

    /* ========================================================
       11. SIDEBAR
       ======================================================== */

    function setSidebarOpen(open) {
        if (!elements.sidebar) return;

        elements.sidebar.classList.toggle("is-open", open);
        elements.sidebar.classList.toggle("sidebar-open", open);

        if (elements.sidebarToggle) {
            elements.sidebarToggle.setAttribute(
                "aria-expanded",
                String(open)
            );

            elements.sidebarToggle.setAttribute(
                "aria-label",
                open ? "Close navigation" : "Open navigation"
            );
        }

        setHidden(elements.sidebarOverlay, !open);

        document.body.classList.toggle("sidebar-is-open", open);
    }

    function toggleSidebar() {
        if (!elements.sidebar) return;

        const isOpen =
            elements.sidebar.classList.contains("is-open") ||
            elements.sidebar.classList.contains("sidebar-open");

        setSidebarOpen(!isOpen);
    }

    /* ========================================================
       12. ACCOUNT MENU
       ======================================================== */

    function setAccountMenuOpen(open) {
        if (!elements.accountMenu) return;

        setHidden(elements.accountMenu, !open);

        elements.accountMenuButton?.setAttribute(
            "aria-expanded",
            String(open)
        );
    }

    function toggleAccountMenu() {
        if (!elements.accountMenu) return;

        setAccountMenuOpen(elements.accountMenu.hidden);
    }

    /* ========================================================
       13. SETTINGS SECTION NAVIGATION
       ======================================================== */

    function initialiseSectionNavigation() {
        const links = $$(".settings-section-link");

        links.forEach(link => {
            link.addEventListener("click", () => {
                links.forEach(item => {
                    item.classList.remove("active");
                });

                link.classList.add("active");
            });
        });

        if (!("IntersectionObserver" in window)) return;

        const sections = links
            .map(link => {
                const id = link.getAttribute("href");

                return id && id.startsWith("#")
                    ? $(id)
                    : null;
            })
            .filter(Boolean);

        if (!sections.length) return;

        const observer = new IntersectionObserver(entries => {
            const visibleEntries = entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) =>
                    b.intersectionRatio - a.intersectionRatio
                );

            if (!visibleEntries.length) return;

            const currentId = "#" + visibleEntries[0].target.id;

            links.forEach(link => {
                const active = link.getAttribute("href") === currentId;

                link.classList.toggle("active", active);
            });
        }, {
            root: null,
            rootMargin: "-15% 0px -65% 0px",
            threshold: [0, 0.1, 0.25, 0.5]
        });

        sections.forEach(section => observer.observe(section));
    }

    /* ========================================================
       14. EVENT LISTENERS
       ======================================================== */

    function bindEvents() {
        elements.retryButton?.addEventListener("click", loadSettings);

        elements.saveInstitutionButton?.addEventListener(
            "click",
            saveInstitution
        );

        elements.saveAdministratorButton?.addEventListener(
            "click",
            saveAdministrator
        );

        elements.savePreferencesButton?.addEventListener(
            "click",
            savePreferences
        );

        /*
         * Prevent accidental full-page submission.
         * Each settings section has its own Save button.
         */
        elements.settingsForm?.addEventListener("submit", event => {
            event.preventDefault();
        });

        elements.openPasswordDialogButton?.addEventListener(
            "click",
            openPasswordDialog
        );

        elements.passwordForm?.addEventListener(
            "submit",
            changePassword
        );

        $$("[data-close-password-dialog]").forEach(button => {
            button.addEventListener("click", closePasswordDialog);
        });

        elements.passwordDialog?.addEventListener("click", event => {
            if (event.target === elements.passwordDialog) {
                closePasswordDialog();
            }
        });

        elements.accountMenuButton?.addEventListener(
            "click",
            toggleAccountMenu
        );

        elements.logoutButton?.addEventListener("click", logout);

        elements.settingsLogoutButton?.addEventListener(
            "click",
            logout
        );

        elements.sidebarToggle?.addEventListener(
            "click",
            toggleSidebar
        );

        elements.sidebarOverlay?.addEventListener("click", () => {
            setSidebarOpen(false);
        });

        $$(".sidebar-link").forEach(link => {
            link.addEventListener("click", () => {
                if (window.matchMedia("(max-width: 900px)").matches) {
                    setSidebarOpen(false);
                }
            });
        });

        document.addEventListener("click", event => {
            if (
                elements.accountMenu &&
                elements.accountMenuButton &&
                !elements.accountMenu.hidden &&
                !elements.accountMenu.contains(event.target) &&
                !elements.accountMenuButton.contains(event.target)
            ) {
                setAccountMenuOpen(false);
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
                setAccountMenuOpen(false);
            }
        });

        /*
         * Mark the page as having unsaved changes when a value
         * differs from the last successful server response.
         */
        elements.settingsForm?.addEventListener("input", () => {
            if (state.saving || !state.initialised) return;

            setSaveStatus("Unsaved changes", "idle");
            clearFeedback();
        });

        elements.settingsForm?.addEventListener("change", () => {
            if (state.saving || !state.initialised) return;

            setSaveStatus("Unsaved changes", "idle");
            clearFeedback();
        });

        /*
         * Warn before leaving with unsaved settings.
         */
        window.addEventListener("beforeunload", event => {
            if (
                state.initialised &&
                !state.saving &&
                elements.saveStatus?.textContent === "Unsaved changes"
            ) {
                event.preventDefault();
                event.returnValue = "";
            }
        });
    }

    /* ========================================================
       15. INITIALISE
       ======================================================== */

    function initialise() {
        updatePageDate();
        bindEvents();
        initialiseSectionNavigation();

        setAccountMenuOpen(false);
        setSidebarOpen(false);

        loadSettings();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialise,
            { once: true }
        );
    } else {
        initialise();
    }
})();
