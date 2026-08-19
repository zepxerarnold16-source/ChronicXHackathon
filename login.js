// ============================================================
// CHRONICAI — MAIN FRONTEND APPLICATION
// ============================================================
// Handles:
// ------------------------------------------------------------
// 1. Firebase Authentication
// 2. Citizen Session
// 3. Login / Register Navigation
// 4. Logout
// 5. User Profile Display
// 6. Protected Pages
// 7. Report Problem
// 8. AI Chronic Analysis
// 9. Citizen Verification
// 10. Report Submission
// 11. Report Status
// 12. Report Timeline
// 13. Admin Status Update
// 14. Report Escalation
// 15. Theme Toggle
// 16. Mobile Navigation
// 17. Page Loader
// 18. Common UI
// ============================================================

"use strict";

// ============================================================
// FIREBASE
// ============================================================

import {
    onAuthStateChanged,
    signOut
} from "firebase/auth";

import {
    ref,
    get
} from "firebase/database";

import {
    auth,
    database
} from "./firebase.js";

// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;

let currentProfile = null;

let currentAnalysis = null;

let currentReport = null;

let isAuthReady = false;

// ============================================================
// DOM HELPER
// ============================================================

function $(id) {
    return document.getElementById(id);
}

// ============================================================
// DOM ELEMENTS
// ============================================================

const pageLoader =
    $("pageLoader");

const mainHeader =
    $("mainHeader");

const themeToggle =
    $("themeToggle");

const mobileMenuToggle =
    $("mobileMenuToggle");

const mobileMenu =
    $("mobileMenu");

const logoutButtons =
    document.querySelectorAll(
        "#logoutButton, .logoutButton, [data-action='logout']"
    );

// ============================================================
// PAGE NAME
// ============================================================

const currentPage =
    window.location.pathname
        .split("/")
        .pop()
        .toLowerCase() || "index.html";

// ============================================================
// API BASE URL
// ============================================================

const API_BASE =
    window.location.origin;

// ============================================================
// LOCAL SESSION KEYS
// ============================================================

const SESSION_KEYS = {

    user:
        "chronicAIUser",

    loggedIn:
        "chronicAILoggedIn",

    userId:
        "chronicAIUserId",

    userEmail:
        "chronicAIUserEmail",

    userName:
        "chronicAIUserName",

    role:
        "chronicAIRole",

    lastReport:
        "chronicAILastReport",

    currentAnalysis:
        "chronicAICurrentAnalysis",

    theme:
        "chronicAITheme"

};

// ============================================================
// PAGE TYPES
// ============================================================

const AUTH_PAGES = [

    "login.html",

    "register.html",

    "signup.html"

];

const PROTECTED_PAGES = [

    "report-problem.html",

    "report.html",

    "my-reports.html",

    "my-reports.html",

    "profile.html",

    "citizen-dashboard.html",

    "dashboard.html"

];

const ADMIN_PAGES = [

    "admin.html",

    "admin-dashboard.html",

    "admin-dashboard.html"

];

// ============================================================
// SAFE JSON PARSE
// ============================================================

function safeJSONParse(
    value,
    fallback = null
) {

    try {

        return JSON.parse(
            value
        );

    }

    catch {

        return fallback;

    }
}

// ============================================================
// GET LOCAL USER
// ============================================================

function getLocalUser() {

    const raw =
        localStorage.getItem(
            SESSION_KEYS.user
        );

    return safeJSONParse(
        raw,
        null
    );
}

// ============================================================
// SAVE LOCAL USER
// ============================================================

function saveLocalUser(
    user
) {

    if (!user) {
        return;
    }

    localStorage.setItem(
        SESSION_KEYS.user,
        JSON.stringify(user)
    );

    localStorage.setItem(
        SESSION_KEYS.loggedIn,
        "true"
    );

    if (user.uid) {

        localStorage.setItem(
            SESSION_KEYS.userId,
            user.uid
        );

    }

    if (user.email) {

        localStorage.setItem(
            SESSION_KEYS.userEmail,
            user.email
        );

    }

    if (user.name) {

        localStorage.setItem(
            SESSION_KEYS.userName,
            user.name
        );

    }

    if (user.role) {

        localStorage.setItem(
            SESSION_KEYS.role,
            user.role
        );

    }
}

// ============================================================
// CLEAR LOCAL SESSION
// ============================================================

function clearLocalSession() {

    Object.values(
        SESSION_KEYS
    ).forEach(
        key => {

            localStorage.removeItem(
                key
            );

        }
    );
}

// ============================================================
// CHECK LOCAL LOGIN
// ============================================================

function isLoggedInLocally() {

    return (
        localStorage.getItem(
            SESSION_KEYS.loggedIn
        ) === "true"
    );
}

// ============================================================
// GET CURRENT UID
// ============================================================

function getCurrentUID() {

    if (
        currentUser?.uid
    ) {

        return currentUser.uid;

    }

    return localStorage.getItem(
        SESSION_KEYS.userId
    );
}

// ============================================================
// GET CURRENT ROLE
// ============================================================

function getCurrentRole() {

    if (
        currentProfile?.role
    ) {

        return String(
            currentProfile.role
        ).toLowerCase();

    }

    return String(
        localStorage.getItem(
            SESSION_KEYS.role
        ) || "citizen"
    ).toLowerCase();
}

// ============================================================
// GET CURRENT NAME
// ============================================================

function getCurrentName() {

    return (
        currentProfile?.name ||
        currentUser?.displayName ||
        localStorage.getItem(
            SESSION_KEYS.userName
        ) ||
        "Citizen"
    );
}

// ============================================================
// GET CURRENT EMAIL
// ============================================================

function getCurrentEmail() {

    return (
        currentProfile?.email ||
        currentUser?.email ||
        localStorage.getItem(
            SESSION_KEYS.userEmail
        ) ||
        ""
    );
}

// ============================================================
// SHOW TOAST
// ============================================================

function showToast(
    message,
    type = "info"
) {

    let toast =
        $("chronicToast");

    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "chronicToast";

        toast.className =
            "chronic-toast";

        document.body.appendChild(
            toast
        );
    }

    toast.textContent =
        message;

    toast.dataset.type =
        type;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toast._timer
    );

    toast._timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3500
        );
}

// ============================================================
// SHOW MESSAGE
// ============================================================

function showMessage(
element,
message,
success = false
) {

    if (!element) {

        showToast(
            message,
            success
                ? "success"
                : "error"
        );

        return;
    }

    element.textContent =
        message;

    element.style.color =
        success
            ? "#35e69a"
            : "#ff6b6b";

    element.classList.add(
        "visible"
    );
}

// ============================================================
// BUTTON LOADING
// ============================================================

function setButtonLoading(
button,
loading,
loadingText = "Please wait..."
) {

    if (!button) {
        return;
    }

    if (loading) {

        if (
            !button.dataset.originalHTML
        ) {

            button.dataset.originalHTML =
                button.innerHTML;

        }

        button.disabled =
            true;

        button.innerHTML =
            `
            <i class="fa-solid fa-spinner fa-spin"></i>
            ${loadingText}
            `;

    }

    else {

        button.disabled =
            false;

        if (
            button.dataset.originalHTML
        ) {

            button.innerHTML =
                button.dataset.originalHTML;

        }

    }
}

// ============================================================
// PAGE LOADER
// ============================================================

function hidePageLoader() {

    if (!pageLoader) {
        return;
    }

    pageLoader.classList.add(
        "hidden"
    );

    setTimeout(
        () => {

            pageLoader.style.display =
                "none";

        },
        500
    );
}

// ============================================================
// THEME
// ============================================================

function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            SESSION_KEYS.theme
        );

    if (
        savedTheme === "light" ||
        savedTheme === "dark"
    ) {

        document.documentElement.dataset.theme =
            savedTheme;

        document.body.classList.toggle(
            "light-theme",
            savedTheme === "light"
        );

        document.body.classList.toggle(
            "dark-theme",
            savedTheme === "dark"
        );

    }
}

// ============================================================
// THEME TOGGLE
// ============================================================

function setupThemeToggle() {

    if (!themeToggle) {
        return;
    }

    themeToggle.addEventListener(
        "click",
        () => {

            const current =
                document.documentElement
                    .dataset
                    .theme === "light"
                    ? "light"
                    : "dark";

            const next =
                current === "dark"
                    ? "light"
                    : "dark";

            document.documentElement.dataset.theme =
                next;

            document.body.classList.toggle(
                "light-theme",
                next === "light"
            );

            document.body.classList.toggle(
                "dark-theme",
                next === "dark"
            );

            localStorage.setItem(
                SESSION_KEYS.theme,
                next
            );

        }
    );
}

// ============================================================
// MOBILE MENU
// ============================================================

function setupMobileMenu() {

    if (!mobileMenuToggle) {
        return;
    }

    mobileMenuToggle.addEventListener(
        "click",
        () => {

            mobileMenu?.classList.toggle(
                "active"
            );

            mobileMenuToggle.classList.toggle(
                "active"
            );

        }
    );

    document.addEventListener(
        "click",
        event => {

            if (
                !mobileMenu ||
                !mobileMenuToggle
            ) {
                return;
            }

            if (
                !mobileMenu.contains(
                    event.target
                ) &&
                !mobileMenuToggle.contains(
                    event.target
                )
            ) {

                mobileMenu.classList.remove(
                    "active"
                );

                mobileMenuToggle.classList.remove(
                    "active"
                );

            }

        }
    );
}

// ============================================================
// FETCH USER PROFILE
// ============================================================

async function fetchUserProfile(
    uid
) {

    if (!uid) {
        return null;
    }

    try {

        const snapshot =
            await get(
                ref(
                    database,
                    `users/${uid}`
                )
            );

        if (
            !snapshot.exists()
        ) {

            return null;

        }

        return snapshot.val();

    }

    catch (
        error
    ) {

        console.error(
            "ChronicAI: Profile load failed:",
            error
        );

        return null;

    }
}

// ============================================================
// UPDATE USER UI
// ============================================================

function updateUserUI() {

    const name =
        getCurrentName();

    const email =
        getCurrentEmail();

    const role =
        getCurrentRole();

    // --------------------------------------------------------
    // NAME ELEMENTS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "#userName, .userName, [data-user-name]"
        )
        .forEach(
            element => {

                element.textContent =
                    name;

            }
        );

    // --------------------------------------------------------
    // EMAIL ELEMENTS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "#userEmail, .userEmail, [data-user-email]"
        )
        .forEach(
            element => {

                element.textContent =
                    email;

            }
        );

    // --------------------------------------------------------
    // ROLE ELEMENTS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "#userRole, .userRole, [data-user-role]"
        )
        .forEach(
            element => {

                element.textContent =
                    role;

            }
        );

    // --------------------------------------------------------
    // LOGGED IN / LOGGED OUT
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-auth='logged-in']"
        )
        .forEach(
            element => {

                element.style.display =
                    currentUser
                        ? ""
                        : "none";

            }
        );

    document
        .querySelectorAll(
            "[data-auth='logged-out']"
        )
        .forEach(
            element => {

                element.style.display =
                    currentUser
                        ? "none"
                        : "";

            }
        );

    // --------------------------------------------------------
    // CITIZEN ONLY
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-role='citizen']"
        )
        .forEach(
            element => {

                element.style.display =
                    role === "citizen"
                        ? ""
                        : "none";

            }
        );

    // --------------------------------------------------------
    // ADMIN ONLY
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-role='admin']"
        )
        .forEach(
            element => {

                element.style.display =
                    role === "admin"
                        ? ""
                        : "none";

            }
        );
}

// ============================================================
// SET AUTH NAVIGATION
// ============================================================

function setupAuthNavigation() {

    document
        .querySelectorAll(
            "[data-action='login'], .loginLink"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    event => {

                        if (
                            currentUser
                        ) {

                            event.preventDefault();

                            window.location.href =
                                "index.html";

                        }

                    }
                );

            }
        );

    document
        .querySelectorAll(
            "[data-action='register'], .registerLink"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        console.log(
                            "ChronicAI: Opening registration."
                        );

                    }
                );

            }
        );
}

// ============================================================
// LOGOUT
// ============================================================

async function logoutUser() {

    try {

        await signOut(
            auth
        );

        clearLocalSession();

        currentUser =
            null;

        currentProfile =
            null;

        showToast(
            "Logged out successfully.",
            "success"
        );

        setTimeout(
            () => {

                window.location.href =
                    "login.html";

            },
            500
        );

    }

    catch (
        error
    ) {

        console.error(
            "ChronicAI Logout Error:",
            error
        );

        showToast(
            "Logout failed. Please try again.",
            "error"
        );

    }
}

// ============================================================
// LOGOUT BUTTONS
// ============================================================

function setupLogout() {

    document
        .querySelectorAll(
            "#logoutButton, .logoutButton, [data-action='logout']"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();

                        await logoutUser();

                    }
                );

            }
        );
}

// ============================================================
// PROTECTED PAGE CHECK
// ============================================================

function isProtectedPage() {

    return PROTECTED_PAGES.includes(
        currentPage
    );
}

// ============================================================
// ADMIN PAGE CHECK
// ============================================================

function isAdminPage() {

    return ADMIN_PAGES.includes(
        currentPage
    );
}

// ============================================================
// AUTH PAGE CHECK
// ============================================================

function isAuthPage() {

    return AUTH_PAGES.includes(
        currentPage
    );
}

// ============================================================
// AUTH GUARD
// ============================================================

function runAuthGuard() {

    if (
        isProtectedPage() &&
        !currentUser
    ) {

        sessionStorage.setItem(
            "civicAIRedirectAfterLogin",
            currentPage
        );

        window.location.href =
            "login.html";

        return false;
    }

    return true;
}

// ============================================================
// ADMIN GUARD
// ============================================================

function runAdminGuard() {

    if (
        !isAdminPage()
    ) {

        return true;

    }

    const role =
        getCurrentRole();

    if (
        role !== "admin"
    ) {

        showToast(
            "Admin access required.",
            "error"
        );

        setTimeout(
            () => {

                window.location.href =
                    "index.html";

            },
            700
        );

        return false;

    }

    return true;
}

// ============================================================
// API REQUEST HELPER
// ============================================================

async function apiRequest(
    endpoint,
    options = {}
) {

    const url =
        endpoint.startsWith(
            "http"
        )
            ? endpoint
            : `${API_BASE}${endpoint}`;

    const config = {

        method:
            options.method ||
            "GET",

        headers: {

            ...(options.body
                ? {
                    "Content-Type":
                        "application/json"
                }
                : {}),

            ...(options.headers || {})

        }

    };

    if (
        options.body !== undefined
    ) {

        config.body =
            typeof options.body === "string"
                ? options.body
                : JSON.stringify(
                    options.body
                );

    }

    const response =
        await fetch(
            url,
            config
        );

    let data =
        null;

    try {

        data =
            await response.json();

    }

    catch {

        data =
            null;

    }

    if (
        !response.ok
    ) {

        throw new Error(
            data?.error ||
            `Request failed with status ${response.status}.`
        );

    }

    return data;

}

// ============================================================
// ANALYZE CHRONIC REPORT
// ============================================================

async function analyzeReport({
    description = "",
    location = "",
    image = "",
    reporterName = ""
} = {}) {

    const payload = {

        description:
            String(
                description || ""
            ).trim(),

        location:
            String(
                location || ""
            ).trim(),

        image:
            image || null,

        reporterName:
            String(
                reporterName || ""
            ).trim()

    };

    if (
        !payload.description &&
        !payload.image
    ) {

        throw new Error(
            "Please provide a description or image."
        );

    }

    const result =
        await apiRequest(
            "/api/analyze",
            {
                method:
                    "POST",

                body:
                    payload
            }
        );

    if (
        !result?.success ||
        !result?.analysis
    ) {

        throw new Error(
            result?.error ||
            "AI analysis failed."
        );

    }

    currentAnalysis =
        result.analysis;

    localStorage.setItem(
        SESSION_KEYS.currentAnalysis,
        JSON.stringify(
            currentAnalysis
        )
    );

    return result;
}

// ============================================================
// DISPLAY AI ANALYSIS
// ============================================================

function displayAIAnalysis(
    analysis
) {

    if (!analysis) {
        return;
    }

    // --------------------------------------------------------
    // Generic data binding
    // --------------------------------------------------------

    const bindings = {

        problem:
            analysis.problem,

        category:
            analysis.category,

        severity:
            analysis.severity,

        department:
            analysis.department,

        location:
            analysis.location,

        confidence:
            analysis.confidence,

        summary:
            analysis.summary,

        recommendation:
            analysis.recommendation,

        objectionTitle:
            analysis.objectionTitle,

        officialComplaint:
            analysis.officialComplaint,

        problemDescription:
            analysis.problemDescription,

        requestedAction:
            analysis.requestedAction,

        priority:
            analysis.priority,

        responsibleAuthority:
            analysis.responsibleAuthority,

        authorityReason:
            analysis.authorityReason,

        suggestedSlaHours:
            analysis.suggestedSlaHours

    };

    Object.entries(
        bindings
    ).forEach(
        ([key, value]) => {

            document
                .querySelectorAll(
                    `[data-analysis="${key}"], #${key}`
                )
                .forEach(
                    element => {

                        element.textContent =
                            value ??
                            "";

                    }
                );

        }
    );

    // --------------------------------------------------------
    // Evidence
    // --------------------------------------------------------

    const evidenceContainer =
        document.querySelector(
            "[data-analysis='requiredEvidence']"
        ) ||
        $("requiredEvidence");

    if (
        evidenceContainer
    ) {

        evidenceContainer.innerHTML =
            "";

        const evidence =
            Array.isArray(
                analysis.requiredEvidence
            )
                ? analysis.requiredEvidence
                : [];

        evidence.forEach(
            item => {

                const li =
                    document.createElement(
                        "li"
                    );

                li.textContent =
                    item;

                evidenceContainer.appendChild(
                    li
                );

            }
        );

    }

    // --------------------------------------------------------
    // AI result section
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "#aiResult, .aiResult, [data-ai-result]"
        )
        .forEach(
            element => {

                element.style.display =
                    "";

                element.classList.add(
                    "active"
                );

            }
        );
}

// ============================================================
// REPORT IMAGE → DATA URL
// ============================================================

function fileToDataURL(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (!file) {

                resolve(
                    null
                );

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );

                };

            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Unable to read image."
                        )
                    );

                };

            reader.readAsDataURL(
                file
            );

        }
    );
}

// ============================================================
// IMAGE INPUT
// ============================================================

function setupImagePreview() {

    const imageInput =
        $("reportImage") ||
        $("image");

    const preview =
        $("imagePreview");

    if (
        !imageInput
    ) {

        return;

    }

    imageInput.addEventListener(
        "change",
        () => {

            const file =
                imageInput.files?.[0];

            if (
                !file
            ) {

                if (
                    preview
                ) {

                    preview.style.display =
                        "none";

                    preview.src =
                        "";

                }

                return;
            }

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                showToast(
                    "Please select an image file.",
                    "error"
                );

                imageInput.value =
                    "";

                return;

            }

            if (
                file.size >
                10 * 1024 * 1024
            ) {

                showToast(
                    "Image must be smaller than 10MB.",
                    "error"
                );

                imageInput.value =
                    "";

                return;

            }

            if (
                preview
            ) {

                preview.src =
                    URL.createObjectURL(
                        file
                    );

                preview.style.display =
                    "";

            }

        }
    );
}

// ============================================================
// REPORT FORM
// ============================================================

function setupReportForm() {

    const form =
        $("reportForm");

    if (
        !form
    ) {

        return;

    }

    const analyzeButton =
        $("analyzeButton");

    const submitButton =
        $("submitReportButton");

    const message =
        $("reportMessage");

    const descriptionInput =
        $("description") ||
        $("problemDescription");

    const locationInput =
        $("location");

    const imageInput =
        $("reportImage") ||
        $("image");

    // --------------------------------------------------------
    // ANALYZE
    // --------------------------------------------------------

    if (
        analyzeButton
    ) {

        analyzeButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                if (
                    !currentUser
                ) {

                    showMessage(
                        message,
                        "Please login before reporting a problem."
                    );

                    return;

                }

                const description =
                    descriptionInput?.value
                        ?.trim() ||
                    "";

                const location =
                    locationInput?.value
                        ?.trim() ||
                    "";

                if (
                    !description &&
                    !imageInput?.files?.[0]
                ) {

                    showMessage(
                        message,
                        "Please enter a problem description or upload an image."
                    );

                    return;

                }

                try {

                    setButtonLoading(
                        analyzeButton,
                        true,
                        "AI Analyzing..."
                    );

                    showMessage(
                        message,
                        "ChronicAI is analyzing your report..."
                    );

                    let image =
                        null;

                    if (
                        imageInput?.files?.[0]
                    ) {

                        image =
                            await fileToDataURL(
                                imageInput.files[0]
                            );

                    }

                    const result =
                        await analyzeReport({

                            description,

                            location,

                            image,

                            reporterName:
                                getCurrentName()

                        });

                    displayAIAnalysis(
                        result.analysis
                    );

                    showMessage(
                        message,
                        "AI analysis completed. Please verify the information before submitting.",
                        true
                    );

                    // ------------------------------------------------
                    // Verification section
                    // ------------------------------------------------

                    document
                        .querySelectorAll(
                            "#citizenVerification, .citizenVerification, [data-verification]"
                        )
                        .forEach(
                            element => {

                                element.style.display =
                                    "";

                                element.classList.add(
                                    "active"
                                );

                            }
                        );

                }

                catch (
                    error
                ) {

                    console.error(
                        "ChronicAI Analyze Error:",
                        error
                    );

                    showMessage(
                        message,
                        error.message ||
                        "AI analysis failed."
                    );

                }

                finally {

                    setButtonLoading(
                        analyzeButton,
                        false
                    );

                }

            }
        );

    }

    // --------------------------------------------------------
    // SUBMIT
    // --------------------------------------------------------

    if (
        submitButton
    ) {

        submitButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                if (
                    !currentUser
                ) {

                    showMessage(
                        message,
                        "Please login before submitting a report."
                    );

                    return;

                }

                if (
                    !currentAnalysis
                ) {

                    showMessage(
                        message,
                        "Please analyze the report before submitting."
                    );

                    return;

                }

                const description =
                    descriptionInput?.value
                        ?.trim() ||
                    "";

                const location =
                    locationInput?.value
                        ?.trim() ||
                    "";

                if (
                    !location
                ) {

                    showMessage(
                        message,
                        "Please enter the report location."
                    );

                    return;

                }

                // ------------------------------------------------
                // CITIZEN VERIFICATION
                // ------------------------------------------------

                const verification =
                    $("citizenVerification");

                const verificationCheckbox =
                    $("verifyInformation") ||
                    $("citizenVerify") ||
                    $("verification");

                if (
                    verificationCheckbox &&
                    !verificationCheckbox.checked
                ) {

                    showMessage(
                        message,
                        "Please verify that the AI-generated report information is correct."
                    );

                    return;

                }

                try {

                    setButtonLoading(
                        submitButton,
                        true,
                        "Submitting..."
                    );

                    showMessage(
                        message,
                        "Submitting your civic report..."
                    );

                    const result =
                        await apiRequest(
                            "/api/reports",
                            {

                                method:
                                    "POST",

                                body: {

                                    reporterName:
                                        getCurrentName(),

                                    description,

                                    location,

                                    analysis:
                                        currentAnalysis,

                                    submittedAt:
                                        new Date()
                                            .toISOString(),

                                    citizenUid:
                                        getCurrentUID()

                                }

                            }
                        );

                    if (
                        !result?.success
                    ) {

                        throw new Error(
                            result?.error ||
                            "Report submission failed."
                        );

                    }

                    currentReport =
                        result.report;

                    // ------------------------------------------------
                    // SAVE REPORT LOCALLY
                    // ------------------------------------------------

                    localStorage.setItem(
                        SESSION_KEYS.lastReport,
                        JSON.stringify(
                            result.report
                        )
                    );

                    // ------------------------------------------------
                    // SHOW SUCCESS
                    // ------------------------------------------------

                    showMessage(
                        message,
                        `Report submitted successfully. Report ID: ${result.reportId}`,
                        true
                    );

                    // ------------------------------------------------
                    // DISPLAY REPORT ID
                    // ------------------------------------------------

                    document
                        .querySelectorAll(
                            "#reportId, .reportId, [data-report-id]"
                        )
                        .forEach(
                            element => {

                                element.textContent =
                                    result.reportId;

                                element.style.display =
                                    "";

                            }
                        );

                    // ------------------------------------------------
                    // SUCCESS SECTION
                    // ------------------------------------------------

                    document
                        .querySelectorAll(
                            "#reportSuccess, .reportSuccess, [data-report-success]"
                        )
                        .forEach(
                            element => {

                                element.style.display =
                                    "";

                                element.classList.add(
                                    "active"
                                );

                            }
                        );

                    // ------------------------------------------------
                    // RESET
                    // ------------------------------------------------

                    form.reset();

                    currentAnalysis =
                        null;

                    localStorage.removeItem(
                        SESSION_KEYS.currentAnalysis
                    );

                }

                catch (
                    error
                ) {

                    console.error(
                        "ChronicAI Report Submission Error:",
                        error
                    );

                    showMessage(
                        message,
                        error.message ||
                        "Unable to submit report."
                    );

                }

                finally {

                    setButtonLoading(
                        submitButton,
                        false
                    );

                }

            }
        );

    }
}

// ============================================================
// LOAD REPORT
// ============================================================

async function loadReport(
reportId
) {

    if (
        !reportId
    ) {

        throw new Error(
            "Report ID is required."
        );

    }

    const result =
        await apiRequest(
            `/api/reports/${encodeURIComponent(reportId)}`
        );

    if (
        !result?.success ||
        !result?.report
    ) {

        throw new Error(
            result?.error ||
            "Report not found."
        );

    }

    currentReport =
        result.report;

    return result.report;
}

// ============================================================
// DISPLAY REPORT
// ============================================================

function displayReport(
report
) {

    if (!report) {
        return;
    }

    const values = {

        reportId:
            report.reportId,

        reporterName:
            report.reporterName,

        description:
            report.description,

        location:
            report.location,

        status:
            report.status,

        priority:
            report.priority,

        problem:
            report.analysis?.problem,

        category:
            report.analysis?.category,

        severity:
            report.analysis?.severity,

        department:
            report.authority?.department,

        responsibleAuthority:
            report.authority?.responsibleAuthority,

        objectionTitle:
            report.objection?.title,

        officialComplaint:
            report.objection?.officialComplaint,

        requestedAction:
            report.objection?.requestedAction,

        slaHours:
            report.sla?.hours,

        slaDeadline:
            report.sla?.deadline

    };

    Object.entries(
        values
    ).forEach(
        ([key, value]) => {

            document
                .querySelectorAll(
                    `[data-report="${key}"], #${key}`
                )
                .forEach(
                    element => {

                        element.textContent =
                            value ?? "";

                    }
                );

        }
    );

    // --------------------------------------------------------
    // STATUS CLASS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-report='status'], #reportStatus, .reportStatus"
        )
        .forEach(
            element => {

                element.dataset.status =
                    String(
                        report.status || ""
                    )
                        .toLowerCase()
                        .replace(
                            /\s+/g,
                            "-"
                        );

            }
        );
}

// ============================================================
// LOAD MY REPORTS
// ============================================================

async function loadMyReports() {

    const container =
        $("reportsContainer") ||
        $("myReportsContainer") ||
        document.querySelector(
            "[data-my-reports]"
        );

    if (
        !container
    ) {

        return;

    }

    try {

        container.innerHTML =
            `
            <div class="loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading reports...
            </div>
            `;

        const result =
            await apiRequest(
                "/api/reports"
            );

        const uid =
            getCurrentUID();

        const name =
            getCurrentName();

        const email =
            getCurrentEmail();

        let reports =
            Array.isArray(
                result?.reports
            )
                ? result.reports
                : [];

        // --------------------------------------------------------
        // Citizen filtering
        // --------------------------------------------------------
        //
        // Your current server stores reporterName but does not
        // yet persist citizenUid in the report object.
        //
        // So we safely filter by reporter name/email where possible.
        //
        // --------------------------------------------------------

        reports =
            reports.filter(
                report => {

                    if (
                        report.citizenUid &&
                        uid
                    ) {

                        return (
                            report.citizenUid ===
                            uid
                        );

                    }

                    return (
                        report.reporterName ===
                        name
                    );

                }
            );

        if (
            reports.length === 0
        ) {

            container.innerHTML =
                `
                <div class="empty-state">
                    <i class="fa-solid fa-file-circle-xmark"></i>
                    <p>No reports found.</p>
                </div>
                `;

            return;

        }

        container.innerHTML =
            "";

        reports
            .slice()
            .reverse()
            .forEach(
                report => {

                    const card =
                        document.createElement(
                            "div"
                        );

                    card.className =
                        "report-card";

                    card.innerHTML =
                        `
                        <div class="report-card-header">
                            <strong>
                                ${escapeHTML(
                                    report.reportId
                                )}
                            </strong>

                            <span class="report-status">
                                ${escapeHTML(
                                    report.status
                                )}
                            </span>
                        </div>

                        <div class="report-card-body">

                            <p>
                                <strong>Problem:</strong>
                                ${escapeHTML(
                                    report.analysis?.problem ||
                                    report.description ||
                                    "Civic Issue"
                                )}
                            </p>

                            <p>
                                <strong>Category:</strong>
                                ${escapeHTML(
                                    report.analysis?.category ||
                                    "General Civic Issue"
                                )}
                            </p>

                            <p>
                                <strong>Location:</strong>
                                ${escapeHTML(
                                    report.location
                                )}
                            </p>

                            <p>
                                <strong>Authority:</strong>
                                ${escapeHTML(
                                    report.authority?.responsibleAuthority ||
                                    "Pending"
                                )}
                            </p>

                        </div>
                        `;

                    card.addEventListener(
                        "click",
                        () => {

                            localStorage.setItem(
                                SESSION_KEYS.lastReport,
                                JSON.stringify(
                                    report
                                )
                            );

                            window.location.href =
                                `report-status.html?id=${encodeURIComponent(
                                    report.reportId
                                )}`;

                        }
                    );

                    container.appendChild(
                        card
                    );

                }
            );

    }

    catch (
        error
    ) {

        console.error(
            "ChronicAI: My reports error:",
            error
        );

        container.innerHTML =
            `
            <div class="error-state">
                Unable to load reports.
            </div>
            `;

    }
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ??
        "";

    return div.innerHTML;
}

// ============================================================
// LOAD REPORT TIMELINE
// ============================================================

async function loadReportTimeline(
reportId
) {

    const result =
        await apiRequest(
            `/api/reports/${encodeURIComponent(
                reportId
            )}/timeline`
        );

    return (
        result?.timeline || []
    );
}

// ============================================================
// DISPLAY TIMELINE
// ============================================================

function displayTimeline(
timeline
) {

    const container =
        $("reportTimeline") ||
        $("timeline") ||
        document.querySelector(
            "[data-report-timeline]"
        );

    if (
        !container
    ) {

        return;

    }

    container.innerHTML =
        "";

    if (
        !Array.isArray(
            timeline
        ) ||
        timeline.length === 0
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                No timeline events yet.
            </div>
            `;

        return;

    }

    timeline.forEach(
        event => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "timeline-item";

            item.innerHTML =
                `
                <div class="timeline-content">

                    <h4>
                        ${escapeHTML(
                            event.status ||
                            event.type ||
                            "Update"
                        )}
                    </h4>

                    <p>
                        ${escapeHTML(
                            event.message ||
                            ""
                        )}
                    </p>

                    <small>
                        ${escapeHTML(
                            event.actor ||
                            "System"
                        )}
                        ·
                        ${formatDate(
                            event.timestamp
                        )}
                    </small>

                </div>
                `;

            container.appendChild(
                item
            );

        }
    );
}

// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(
date
) {

    if (!date) {
        return "";
    }

    const parsed =
        new Date(
            date
        );

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return String(
            date
        );

    }

    return parsed.toLocaleString(
        undefined,
        {
            dateStyle:
                "medium",

            timeStyle:
                "short"
        }
    );
}

// ============================================================
// REPORT STATUS PAGE
// ============================================================

async function initializeReportStatusPage() {

    if (
        !currentPage.includes(
            "report-status"
        )
    ) {

        return;

    }

    const params =
        new URLSearchParams(
            window.location.search
        );

    const reportId =
        params.get(
            "id"
        ) ||
        params.get(
            "reportId"
        );

    if (
        !reportId
    ) {

        showToast(
            "Report ID is missing.",
            "error"
        );

        return;

    }

    try {

        const report =
            await loadReport(
                reportId
            );

        displayReport(
            report
        );

        const timeline =
            await loadReportTimeline(
                reportId
            );

        displayTimeline(
            timeline
        );

    }

    catch (
        error
    ) {

        console.error(
            "ChronicAI Status Page Error:",
            error
        );

        showToast(
            error.message ||
            "Unable to load report.",
            "error"
        );

    }
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================

async function loadAdminReports() {

    const container =
        $("adminReportsContainer") ||
        $("reportsTableBody") ||
        document.querySelector(
            "[data-admin-reports]"
        );

    if (
        !container
    ) {

        return;

    }

    if (
        getCurrentRole() !==
        "admin"
    ) {

        return;

    }

    try {

        const result =
            await apiRequest(
                "/api/reports"
            );

        const reports =
            Array.isArray(
                result?.reports
            )
                ? result.reports
                : [];

        if (
            reports.length === 0
        ) {

            container.innerHTML =
                `
                <div class="empty-state">
                    No civic reports available.
                </div>
                `;

            return;

        }

        container.innerHTML =
            "";

        reports
            .slice()
            .reverse()
            .forEach(
                report => {

                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "admin-report-row";

                    row.innerHTML =
                        `
                        <div>
                            <strong>
                                ${escapeHTML(
                                    report.reportId
                                )}
                            </strong>
                        </div>

                        <div>
                            ${escapeHTML(
                                report.analysis?.problem ||
                                report.description ||
                                ""
                            )}
                        </div>

                        <div>
                            ${escapeHTML(
                                report.location ||
                                ""
                            )}
                        </div>

                        <div>
                            ${escapeHTML(
                                report.status ||
                                ""
                            )}
                        </div>

                        <div>
                            <select
                                class="admin-status-select"
                                data-report-id="${escapeHTML(
                                    report.reportId
                                )}"
                            >

                                ${[
                                    "Submitted",
                                    "Verified",
                                    "Assigned",
                                    "In Progress",
                                    "Resolved",
                                    "Rejected",
                                    "Escalated"
                                ]
                                    .map(
                                        status =>
                                            `
                                            <option
                                                value="${status}"
                                                ${
                                                    status ===
                                                    report.status
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                ${status}
                                            </option>
                                            `
                                    )
                                    .join("")}

                            </select>

                            <button
                                type="button"
                                class="admin-update-status"
                                data-report-id="${escapeHTML(
                                    report.reportId
                                )}"
                            >
                                Update
                            </button>

                            <button
                                type="button"
                                class="admin-escalate"
                                data-report-id="${escapeHTML(
                                    report.reportId
                                )}"
                            >
                                Escalate
                            </button>

                        </div>
                        `;

                    container.appendChild(
                        row
                    );

                }
            );

        setupAdminReportActions();

    }

    catch (
        error
    ) {

        console.error(
            "ChronicAI Admin Reports Error:",
            error
        );

        container.innerHTML =
            `
            <div class="error-state">
                Unable to load admin reports.
            </div>
            `;

    }
}

// ============================================================
// ADMIN STATUS UPDATE
// ============================================================

function setupAdminReportActions() {

    document
        .querySelectorAll(
            ".admin-update-status"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const reportId =
                            button.dataset.reportId;

                        const row =
                            button.closest(
                                ".admin-report-row"
                            );

                        const select =
                            row?.querySelector(
                                ".admin-status-select"
                            );

                        const status =
                            select?.value;

                        if (
                            !reportId ||
                            !status
                        ) {

                            return;

                        }

                        try {

                            setButtonLoading(
                                button,
                                true,
                                "Updating..."
                            );

                            await apiRequest(
                                `/api/reports/${encodeURIComponent(
                                    reportId
                                )}/status`,
                                {

                                    method:
                                        "PATCH",

                                    body: {

                                        status,

                                        assignedTo:
                                            getCurrentName(),

                                        adminNote:
                                            `Status updated to ${status} by admin.`

                                    }

                                }
                            );

                            showToast(
                                "Report status updated.",
                                "success"
                            );

                            await loadAdminReports();

                        }

                        catch (
                            error
                        ) {

                            console.error(
                                "Status Update Error:",
                                error
                            );

                            showToast(
                                error.message ||
                                "Unable to update status.",
                                "error"
                            );

                            setButtonLoading(
                                button,
                                false
                            );

                        }

                    }
                );

            }
        );

    // ========================================================
    // ESCALATION
    // ========================================================

    document
        .querySelectorAll(
            ".admin-escalate"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const reportId =
                            button.dataset.reportId;

                        if (
                            !reportId
                        ) {

                            return;

                        }

                        const reason =
                            window.prompt(
                                "Enter escalation reason:",
                                "Report requires higher-authority review."
                            );

                        if (
                            reason ===
                            null
                        ) {

                            return;

                        }

                        try {

                            setButtonLoading(
                                button,
                                true,
                                "Escalating..."
                            );

                            await apiRequest(
                                `/api/reports/${encodeURIComponent(
                                    reportId
                                )}/escalate`,
                                {

                                    method:
                                        "POST",

                                    body: {

                                        reason,

                                        escalatedTo:
                                            "Higher Civic Authority"

                                    }

                                }
                            );

                            showToast(
                                "Report escalated successfully.",
                                "success"
                            );

                            await loadAdminReports();

                        }

                        catch (
                            error
                        ) {

                            console.error(
                                "Escalation Error:",
                                error
                            );

                            showToast(
                                error.message ||
                                "Unable to escalate report.",
                                "error"
                            );

                            setButtonLoading(
                                button,
                                false
                            );

                        }

                    }
                );

            }
        );
}

// ============================================================
// DASHBOARD INITIALIZATION
// ============================================================

async function initializeDashboard() {

    if (
        currentPage.includes(
            "my-reports"
        )
    ) {

        await loadMyReports();

    }

    if (
        currentPage.includes(
            "admin"
        )
    ) {

        await loadAdminReports();

    }

}

// ============================================================
// API HEALTH CHECK
// ============================================================

async function checkBackendHealth() {

    try {

        const result =
            await apiRequest(
                "/api/health"
            );

        console.log(
            "ChronicAI Backend:",
            result?.status ||
            "online"
        );

        if (
            result?.aiConfigured ===
            false
        ) {

            console.warn(
                "ChronicAI: GROQ_API_KEY is not configured on the server."
            );

        }

        return result;

    }

    catch (
        error
    ) {

        console.warn(
            "ChronicAI Backend is unavailable:",
            error.message
        );

        return null;

    }
}

// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

    document
        .querySelectorAll(
            "[data-navigate]"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        const destination =
                            element.dataset.navigate;

                        if (
                            destination
                        ) {

                            window.location.href =
                                destination;

                        }

                    }
                );

            }
        );

}

// ============================================================
// SCROLL ANIMATION
// ============================================================

function setupScrollAnimation() {

    const elements =
        document.querySelectorAll(
            "[data-animate]"
        );

    if (
        elements.length ===
        0
    ) {

        return;

    }

    if (
        !("IntersectionObserver" in window)
    ) {

        elements.forEach(
            element => {

                element.classList.add(
                    "visible"
                );

            }
        );

        return;

    }

    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target.classList.add(
                                "visible"
                            );

                            observer.unobserve(
                                entry.target
                            );

                        }

                    }
                );

            },
            {
                threshold:
                    0.12
            }
        );

    elements.forEach(
        element => {

            observer.observe(
                element
            );

        }
    );

}

// ============================================================
// SMOOTH ANCHOR LINKS
// ============================================================

function setupSmoothLinks() {

    document
        .querySelectorAll(
            "a[href^='#']"
        )
        .forEach(
            link => {

                link.addEventListener(
                    "click",
                    event => {

                        const targetId =
                            link.getAttribute(
                                "href"
                            );

                        if (
                            !targetId ||
                            targetId === "#"
                        ) {

                            return;

                        }

                        const target =
                            document.querySelector(
                                targetId
                            );

                        if (
                            !target
                        ) {

                            return;

                        }

                        event.preventDefault();

                        target.scrollIntoView(
                            {
                                behavior:
                                    "smooth",

                                block:
                                    "start"
                            }
                        );

                    }
                );

            }
        );

}

// ============================================================
// FORM ENTER KEY
// ============================================================

function setupKeyboardSupport() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {

                return;

            }

            mobileMenu?.classList.remove(
                "active"
            );

            mobileMenuToggle?.classList.remove(
                "active"
            );

        }
    );

}

// ============================================================
// AUTH STATE
// ============================================================

function initializeAuth() {

    return new Promise(
        resolve => {

            let firstRun =
                true;

            onAuthStateChanged(
                auth,
                async user => {

                    currentUser =
                        user ||
                        null;

                    // ------------------------------------------------
                    // LOGGED IN
                    // ------------------------------------------------

                    if (
                        user
                    ) {

                        console.log(
                            "ChronicAI Auth:",
                            "Logged in",
                            user.email
                        );

                        currentProfile =
                            await fetchUserProfile(
                                user.uid
                            );

                        // ------------------------------------------------
                        // Fallback profile
                        // ------------------------------------------------

                        if (
                            !currentProfile
                        ) {

                            currentProfile = {

                                uid:
                                    user.uid,

                                name:
                                    user.displayName ||
                                    "Citizen",

                                email:
                                    user.email ||
                                    "",

                                role:
                                    "citizen"

                            };

                        }

                        const sessionUser = {

                            uid:
                                user.uid,

                            name:
                                currentProfile.name ||
                                user.displayName ||
                                "Citizen",

                            email:
                                currentProfile.email ||
                                user.email ||
                                "",

                            role:
                                currentProfile.role ||
                                "citizen",

                            loggedIn:
                                true

                        };

                        saveLocalUser(
                            sessionUser
                        );

                    }

                    // ------------------------------------------------
                    // LOGGED OUT
                    // ------------------------------------------------

                    else {

                        console.log(
                            "ChronicAI Auth:",
                            "Logged out"
                        );

                        currentUser =
                            null;

                        currentProfile =
                            null;

                    }

                    isAuthReady =
                        true;

                    updateUserUI();

                    // ------------------------------------------------
                    // FIRST AUTH CHECK
                    // ------------------------------------------------

                    if (
                        firstRun
                    ) {

                        firstRun =
                            false;

                        if (
                            !runAuthGuard()
                        ) {

                            hidePageLoader();

                            resolve();

                            return;

                        }

                        if (
                            !runAdminGuard()
                        ) {

                            hidePageLoader();

                            resolve();

                            return;

                        }

                        resolve();

                    }

                }
            );

        }
    );
}

// ============================================================
// RESTORE ANALYSIS
// ============================================================

function restoreSavedAnalysis() {

    const saved =
        localStorage.getItem(
            SESSION_KEYS.currentAnalysis
        );

    if (
        !saved
    ) {

        return;

    }

    currentAnalysis =
        safeJSONParse(
            saved,
            null
        );

    if (
        currentAnalysis
    ) {

        displayAIAnalysis(
            currentAnalysis
        );

    }

}

// ============================================================
// RESTORE LAST REPORT
// ============================================================

function restoreLastReport() {

    const saved =
        localStorage.getItem(
            SESSION_KEYS.lastReport
        );

    if (
        !saved
    ) {

        return;

    }

    currentReport =
        safeJSONParse(
            saved,
            null
        );

}

// ============================================================
// ONLINE / OFFLINE
// ============================================================

function setupConnectionStatus() {

    window.addEventListener(
        "online",
        () => {

            showToast(
                "Internet connection restored.",
                "success"
            );

        }
    );

    window.addEventListener(
        "offline",
        () => {

            showToast(
                "You are offline. Some ChronicAI features may not work.",
                "error"
            );

        }
    );

}

// ============================================================
// PAGE VISIBILITY
// ============================================================

function setupVisibilityRefresh() {

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                updateUserUI();

            }

        }
    );

}

// ============================================================
// GLOBAL CHRONICAI API
// ============================================================
//
// Other page-specific JS files can use:
//
// ChronicAI.user()
// ChronicAI.analyzeReport()
// ChronicAI.loadReport()
// ChronicAI.logout()
// ChronicAI.showToast()
//
// ============================================================

window.ChronicAI = {

    get user() {

        return currentUser;

    },

    get profile() {

        return currentProfile;

    },

    get analysis() {

        return currentAnalysis;

    },

    get report() {

        return currentReport;

    },

    isLoggedIn() {

        return Boolean(
            currentUser
        );

    },

    getUID() {

        return getCurrentUID();

    },

    getName() {

        return getCurrentName();

    },

    getEmail() {

        return getCurrentEmail();

    },

    getRole() {

        return getCurrentRole();

    },

    login() {

        window.location.href =
            "login.html";

    },

    register() {

        window.location.href =
            "register.html";

    },

    logout() {

        return logoutUser();

    },

    analyzeReport,

    loadReport,

    loadMyReports,

    loadReportTimeline,

    displayReport,

    displayTimeline,

    displayAIAnalysis,

    showToast,

    apiRequest

};

// ============================================================
// INITIALIZE APPLICATION
// ============================================================

async function initializeApp() {

    console.log(
        "================================================"
    );

    console.log(
        "CHRONICAI MAIN APPLICATION STARTING"
    );

    console.log(
        "Page:",
        currentPage
    );

    console.log(
        "================================================"
    );

    // ----------------------------------------------------------
    // UI
    // ----------------------------------------------------------

    initializeTheme();

    setupThemeToggle();

    setupMobileMenu();

    setupLogout();

    setupAuthNavigation();

    setupNavigation();

    setupScrollAnimation();

    setupSmoothLinks();

    setupKeyboardSupport();

    setupConnectionStatus();

    setupVisibilityRefresh();

    setupImagePreview();

    setupReportForm();

    restoreSavedAnalysis();

    restoreLastReport();

    // ----------------------------------------------------------
    // FIREBASE AUTH
    // ----------------------------------------------------------

    await initializeAuth();

    // ----------------------------------------------------------
    // DASHBOARD
    // ----------------------------------------------------------

    await initializeDashboard();

    // ----------------------------------------------------------
    // REPORT STATUS
    // ----------------------------------------------------------

    await initializeReportStatusPage();

    // ----------------------------------------------------------
    // BACKEND
    // ----------------------------------------------------------

    checkBackendHealth();

    // ----------------------------------------------------------
    // READY
    // ----------------------------------------------------------

    hidePageLoader();

    document.body.classList.add(
        "chronicai-ready"
    );

    console.log(
        "================================================"
    );

    console.log(
        "CHRONICAI MAIN APPLICATION READY"
    );

    console.log(
        "Authentication:",
        isAuthReady
            ? "READY"
            : "WAITING"
    );

    console.log(
        "Current User:",
        currentUser?.email ||
        "Not logged in"
    );

    console.log(
        "Current Role:",
        getCurrentRole()
    );

    console.log(
        "================================================"
    );
}

// ============================================================
// START
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp,
        {
            once:
                true
        }
    );

}

else {

    initializeApp();

}