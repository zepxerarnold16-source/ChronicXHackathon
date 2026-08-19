/* =========================================================
   CHRONICAI — CITIZEN DASHBOARD JAVASCRIPT
   Compatible with:
   citizen.html
   citizen.css
   app.js
   server.js
========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       API CONFIGURATION
    ===================================================== */

    const API_BASE =
        window.CHRONICAI_API_URL ||
        "http://localhost:5000";


    /* =====================================================
       DOM ELEMENTS
    ===================================================== */

    const welcomeName =
        document.getElementById("welcomeName");

    const totalReports =
        document.getElementById("totalReports");

    const pendingReports =
        document.getElementById("pendingReports");

    const progressReports =
        document.getElementById("progressReports");

    const resolvedReports =
        document.getElementById("resolvedReports");

    const citizenReportList =
        document.getElementById("citizenReportList");

    const citizenEmptyState =
        document.getElementById("citizenEmptyState");

    const profileButton =
        document.getElementById("profileButton");

    const profilePopup =
        document.getElementById("profilePopup");

    const logoutButton =
        document.getElementById("logoutButton");


    /* =====================================================
       STATE
    ===================================================== */

    let allReports = [];

    let currentFilter = "all";


    /* =====================================================
       UTILITY
    ===================================================== */

    function cleanText(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }

        return String(value).trim();

    }


    function escapeHTML(value) {

        return cleanText(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function formatDate(dateValue) {

        if (!dateValue) {

            return "Date unavailable";

        }

        const date =
            new Date(dateValue);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "Date unavailable";

        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    }


    function formatDateTime(dateValue) {

        if (!dateValue) {

            return "Date unavailable";

        }

        const date =
            new Date(dateValue);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "Date unavailable";

        }

        return date.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    /* =====================================================
       USER INFORMATION
    ===================================================== */

    function loadCitizenName() {

        let name = "";

        /*
         * Try common localStorage keys.
         */

        const possibleKeys = [

            "citizenName",
            "userName",
            "username",
            "name",
            "displayName"

        ];


        for (
            const key of possibleKeys
        ) {

            const value =
                localStorage.getItem(key);

            if (
                value &&
                value.trim()
            ) {

                name =
                    value.trim();

                break;

            }

        }


        /*
         * Firebase-style user object
         * if previously saved.
         */

        if (!name) {

            try {

                const userData =
                    JSON.parse(
                        localStorage.getItem(
                            "citizenUser"
                        ) || "null"
                    );

                if (
                    userData &&
                    (
                        userData.name ||
                        userData.displayName
                    )
                ) {

                    name =
                        cleanText(
                            userData.name ||
                            userData.displayName
                        );

                }

            } catch (error) {

                console.warn(
                    "Citizen user data unavailable:",
                    error
                );

            }

        }


        if (!name) {

            name = "Citizen";

        }


        if (welcomeName) {

            welcomeName.textContent =
                name;

        }


        return name;

    }


    /* =====================================================
       LOAD REPORTS FROM BACKEND
    ===================================================== */

    async function loadReports() {

        try {

            showLoadingState();


            const response =
                await fetch(
                    `${API_BASE}/api/reports`,
                    {
                        method: "GET",
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Server returned ${response.status}`
                );

            }


            const data =
                await response.json();


            if (
                !data ||
                !Array.isArray(
                    data.reports
                )
            ) {

                throw new Error(
                    "Invalid reports response."
                );

            }


            allReports =
                data.reports;


            /*
             * Newest reports first.
             */

            allReports.sort(
                (a, b) => {

                    const dateA =
                        new Date(
                            a.createdAt ||
                            a.submittedAt ||
                            0
                        ).getTime();

                    const dateB =
                        new Date(
                            b.createdAt ||
                            b.submittedAt ||
                            0
                        ).getTime();

                    return dateB - dateA;

                }
            );


            updateDashboardStats();

            renderReports();


        } catch (error) {

            console.error(
                "ChronicAI report loading error:",
                error
            );


            allReports = [];


            updateDashboardStats();


            showServerError();

        }

    }


    /* =====================================================
       LOADING STATE
    ===================================================== */

    function showLoadingState() {

        if (!citizenReportList) {

            return;

        }


        citizenReportList.innerHTML = `

            <div class="citizen-loading">

                <div class="citizen-loading-spinner">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                </div>

                <p>
                    Loading your civic reports...
                </p>

            </div>

        `;


        if (citizenEmptyState) {

            citizenEmptyState.hidden =
                true;

        }

    }


    /* =====================================================
       SERVER ERROR
    ===================================================== */

    function showServerError() {

        if (!citizenReportList) {

            return;

        }


        citizenReportList.innerHTML = `

            <div class="citizen-error-state">

                <div class="citizen-error-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3>
                    Unable to load reports
                </h3>

                <p>
                    ChronicAI could not connect to the
                    reporting server.
                </p>

                <button
                    type="button"
                    class="primary-button"
                    id="retryReports"
                >

                    <i class="fa-solid fa-rotate"></i>

                    Try Again

                </button>

            </div>

        `;


        if (citizenEmptyState) {

            citizenEmptyState.hidden =
                true;

        }


        const retryButton =
            document.getElementById(
                "retryReports"
            );


        if (retryButton) {

            retryButton.addEventListener(
                "click",
                loadReports
            );

        }

    }


    /* =====================================================
       REPORT STATUS
    ===================================================== */

    function getReportStatus(report) {

        const status =
            cleanText(
                report?.status
            ).toLowerCase();


        if (
            status.includes(
                "resolved"
            ) ||
            status.includes(
                "completed"
            ) ||
            status.includes(
                "closed"
            )
        ) {

            return "resolved";

        }


        if (
            status.includes(
                "progress"
            ) ||
            status.includes(
                "processing"
            ) ||
            status.includes(
                "working"
            )
        ) {

            return "progress";

        }


        return "pending";

    }


    /* =====================================================
       DASHBOARD STATISTICS
    ===================================================== */

    function updateDashboardStats() {

        const total =
            allReports.length;


        let pending = 0;

        let progress = 0;

        let resolved = 0;


        allReports.forEach(
            report => {

                const status =
                    getReportStatus(
                        report
                    );


                if (
                    status ===
                    "resolved"
                ) {

                    resolved++;

                } else if (
                    status ===
                    "progress"
                ) {

                    progress++;

                } else {

                    pending++;

                }

            }
        );


        if (totalReports) {

            totalReports.textContent =
                total;

        }


        if (pendingReports) {

            pendingReports.textContent =
                pending;

        }


        if (progressReports) {

            progressReports.textContent =
                progress;

        }


        if (resolvedReports) {

            resolvedReports.textContent =
                resolved;

        }

    }


    /* =====================================================
       FILTER BUTTONS
    ===================================================== */

    const filterButtons =
        document.querySelectorAll(
            "[data-filter]"
        );


    filterButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    currentFilter =
                        cleanText(
                            button.dataset.filter
                        ).toLowerCase() ||
                        "all";


                    filterButtons.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    renderReports();

                }
            );

        }
    );


    /* =====================================================
       FILTER REPORTS
    ===================================================== */

    function getFilteredReports() {

        if (
            currentFilter ===
            "all"
        ) {

            return allReports;

        }


        return allReports.filter(
            report => {

                return (
                    getReportStatus(
                        report
                    ) ===
                    currentFilter
                );

            }
        );

    }


    /* =====================================================
       RENDER REPORTS
    ===================================================== */

    function renderReports() {

        if (!citizenReportList) {

            return;

        }


        const reports =
            getFilteredReports();


        if (!reports.length) {

            citizenReportList.innerHTML =
                "";


            if (citizenEmptyState) {

                citizenEmptyState.hidden =
                    false;

            }


            return;

        }


        if (citizenEmptyState) {

            citizenEmptyState.hidden =
                true;

        }


        citizenReportList.innerHTML =
            reports
                .map(
                    report =>
                        createReportCard(
                            report
                        )
                )
                .join("");


        attachReportActions();

    }


    /* =====================================================
       CREATE REPORT CARD
    ===================================================== */

    function createReportCard(report) {

        const reportId =
            escapeHTML(
                report.reportId ||
                "N/A"
            );


        const analysis =
            report.analysis ||
            {};


        const problem =
            escapeHTML(
                analysis.problem ||
                "Civic issue"
            );


        const category =
            escapeHTML(
                analysis.category ||
                "General Civic Issue"
            );


        const severity =
            escapeHTML(
                analysis.severity ||
                "Medium"
            );


        const department =
            escapeHTML(
                analysis.department ||
                "Municipal Authority"
            );


        const location =
            escapeHTML(
                report.location ||
                analysis.location ||
                "Location not provided"
            );


        const status =
            getReportStatus(
                report
            );


        const statusLabel =
            status === "resolved"
                ? "Resolved"
                : status === "progress"
                    ? "In Progress"
                    : "Pending";


        const submittedDate =
            formatDate(
                report.submittedAt ||
                report.createdAt
            );


        const severityClass =
            cleanText(
                analysis.severity
            )
                .toLowerCase()
                .replace(
                    /\s+/g,
                    "-"
                );


        return `

            <article
                class="citizen-report-card"
                data-report-id="${reportId}"
            >

                <div class="citizen-report-card-top">

                    <div class="citizen-report-main">

                        <div class="citizen-report-icon">

                            <i class="fa-solid fa-file-lines"></i>

                        </div>


                        <div>

                            <span class="citizen-report-id">
                                ${reportId}
                            </span>

                            <h3>
                                ${problem}
                            </h3>

                        </div>

                    </div>


                    <span
                        class="citizen-status status-${status}"
                    >

                        <span class="status-dot"></span>

                        ${statusLabel}

                    </span>

                </div>


                <div class="citizen-report-details">

                    <div class="citizen-detail">

                        <span>
                            <i class="fa-solid fa-layer-group"></i>
                            Category
                        </span>

                        <strong>
                            ${category}
                        </strong>

                    </div>


                    <div class="citizen-detail">

                        <span>
                            <i class="fa-solid fa-gauge-high"></i>
                            Severity
                        </span>

                        <strong
                            class="severity-${escapeHTML(
                                severityClass
                            )}"
                        >
                            ${severity}
                        </strong>

                    </div>


                    <div class="citizen-detail">

                        <span>
                            <i class="fa-solid fa-building"></i>
                            Department
                        </span>

                        <strong>
                            ${department}
                        </strong>

                    </div>


                    <div class="citizen-detail">

                        <span>
                            <i class="fa-solid fa-location-dot"></i>
                            Location
                        </span>

                        <strong>
                            ${location}
                        </strong>

                    </div>

                </div>


                <div class="citizen-report-footer">

                    <span class="citizen-report-date">

                        <i class="fa-regular fa-calendar"></i>

                        ${submittedDate}

                    </span>


                    <button
                        type="button"
                        class="view-report-button"
                        data-report-id="${reportId}"
                    >

                        View Details

                        <i class="fa-solid fa-arrow-right"></i>

                    </button>

                </div>

            </article>

        `;

    }


    /* =====================================================
       REPORT DETAILS
    ===================================================== */

    function attachReportActions() {

        const buttons =
            document.querySelectorAll(
                ".view-report-button"
            );


        buttons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const reportId =
                            button.dataset.reportId;

                        showReportDetails(
                            reportId
                        );

                    }
                );

            }
        );

    }


    function showReportDetails(reportId) {

        const report =
            allReports.find(
                item =>
                    item.reportId ===
                    reportId
            );


        if (!report) {

            alert(
                "Report details could not be found."
            );

            return;

        }


        const analysis =
            report.analysis ||
            {};


        const details = `

Report ID:
${report.reportId || "N/A"}

Problem:
${analysis.problem || "N/A"}

Category:
${analysis.category || "N/A"}

Severity:
${analysis.severity || "N/A"}

Department:
${analysis.department || "N/A"}

Location:
${report.location || analysis.location || "N/A"}

Status:
${report.status || "Submitted"}

Submitted:
${formatDateTime(
    report.submittedAt ||
    report.createdAt
)}

AI Summary:
${analysis.summary || "N/A"}

Recommended Action:
${analysis.recommendation || "N/A"}

        `.trim();


        alert(details);

    }


    /* =====================================================
       PROFILE POPUP
    ===================================================== */

    if (profileButton) {

        profileButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                if (!profilePopup) {

                    return;

                }

                profilePopup.classList.toggle(
                    "active"
                );

                profilePopup.hidden =
                    !profilePopup.classList.contains(
                        "active"
                    );

            }
        );

    }


    document.addEventListener(
        "click",
        event => {

            if (
                profilePopup &&
                profileButton &&
                !profilePopup.contains(
                    event.target
                ) &&
                !profileButton.contains(
                    event.target
                )
            ) {

                profilePopup.classList.remove(
                    "active"
                );

                profilePopup.hidden =
                    true;

            }

        }
    );


    /* =====================================================
       LOGOUT
    ===================================================== */

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            () => {

                const confirmed =
                    confirm(
                        "Are you sure you want to logout?"
                    );


                if (!confirmed) {

                    return;

                }


                /*
                 * Clear only ChronicAI user/session
                 * information.
                 */

                const keysToRemove = [

                    "citizenName",
                    "userName",
                    "username",
                    "name",
                    "displayName",
                    "citizenUser"

                ];


                keysToRemove.forEach(
                    key => {

                        localStorage.removeItem(
                            key
                        );

                    }
                );


                /*
                 * Return to homepage/login.
                 */

                window.location.href =
                    "index.html";

            }
        );

    }


    /* =====================================================
       AUTO REFRESH
    ===================================================== */

    let refreshTimer =
        null;


    function startAutoRefresh() {

        if (refreshTimer) {

            clearInterval(
                refreshTimer
            );

        }


        /*
         * Refresh reports every 30 seconds.
         * This allows the citizen dashboard to
         * reflect status changes without
         * manually refreshing the page.
         */

        refreshTimer =
            setInterval(
                () => {

                    loadReports();

                },
                30000
            );

    }


    /* =====================================================
       PAGE VISIBILITY
    ===================================================== */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                loadReports();

            }

        }
    );


    /* =====================================================
       INITIALIZE
    ===================================================== */

    loadCitizenName();

    loadReports();

    startAutoRefresh();


    console.log(
        "ChronicAI citizen dashboard initialized successfully 🚀"
    );

});