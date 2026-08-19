/* =========================================================
   CHRONICAI — MAIN FRONTEND JAVASCRIPT
   Complete Frontend Controller
   UI + Animation + Theme + Navigation
   + ChronicAI Backend / Groq AI Connection
========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    if ("serviceWorker" in navigator) {

        window.addEventListener(
            "load",
            () => {

                navigator.serviceWorker
                    .register("./service-worker.js")
                    .catch((error) => {

                        console.warn(
                            "Service worker registration failed:",
                            error
                        );

                    });

            }
        );

    }

    /* =====================================================
       DOM ELEMENTS
    ===================================================== */

    const pageLoader =
        document.getElementById("pageLoader");

    const mainHeader =
        document.getElementById("mainHeader");

    const themeToggle =
        document.getElementById("themeToggle");

    const mobileMenuButton =
        document.getElementById("mobileMenuButton");

    const mobileNavigation =
        document.getElementById("mobileNavigation");

    const floatingHelp =
        document.getElementById("floatingHelp");

    const aiCore =
        document.querySelector(".ai-core-card");


    /* =====================================================
       PAGE LOADER
    ===================================================== */

    if (pageLoader) {

        window.setTimeout(() => {

            pageLoader.classList.add("hidden");

        }, 700);

    }


    /* =====================================================
       MOBILE NAVIGATION
    ===================================================== */

    if (
        mobileMenuButton &&
        mobileNavigation
    ) {

        mobileMenuButton.addEventListener(
            "click",
            () => {

                const isOpen =
                    mobileNavigation.classList.toggle(
                        "open"
                    );

                mobileMenuButton.classList.toggle(
                    "active",
                    isOpen
                );

                mobileMenuButton.setAttribute(
                    "aria-expanded",
                    String(isOpen)
                );

            }
        );


        const mobileLinks =
            mobileNavigation.querySelectorAll("a");


        mobileLinks.forEach(
            (link) => {

                link.addEventListener(
                    "click",
                    () => {

                        mobileNavigation.classList.remove(
                            "open"
                        );

                        mobileMenuButton.classList.remove(
                            "active"
                        );

                        mobileMenuButton.setAttribute(
                            "aria-expanded",
                            "false"
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       THEME SYSTEM
    ===================================================== */

    const savedTheme =
        localStorage.getItem(
            "civicai-theme"
        );


    function updateThemeIcon(
        isLight
    ) {

        if (!themeToggle) {
            return;
        }

        const icon =
            themeToggle.querySelector("i");

        if (!icon) {
            return;
        }


        if (isLight) {

            icon.className =
                "fa-solid fa-sun";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to dark theme"
            );

        } else {

            icon.className =
                "fa-solid fa-moon";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to light theme"
            );

        }

    }


    if (
        savedTheme ===
        "light"
    ) {

        document.body.classList.add(
            "light-theme"
        );

        updateThemeIcon(true);

    } else {

        document.body.classList.remove(
            "light-theme"
        );

        updateThemeIcon(false);

    }


    if (themeToggle) {

        themeToggle.addEventListener(
            "click",
            () => {

                const isLight =
                    document.body.classList.toggle(
                        "light-theme"
                    );

                localStorage.setItem(
                    "civicai-theme",
                    isLight
                        ? "light"
                        : "dark"
                );

                updateThemeIcon(
                    isLight
                );

            }
        );

    }


    /* =====================================================
       SMOOTH SCROLL
    ===================================================== */

    const anchorLinks =
        document.querySelectorAll(
            'a[href^="#"]'
        );


    anchorLinks.forEach(
        (link) => {

            link.addEventListener(
                "click",
                (event) => {

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


                    let target = null;


                    try {

                        target =
                            document.querySelector(
                                targetId
                            );

                    } catch (error) {

                        console.warn(
                            "Invalid anchor:",
                            targetId
                        );

                        return;

                    }


                    if (!target) {
                        return;
                    }


                    event.preventDefault();


                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });


                    try {

                        history.replaceState(
                            null,
                            "",
                            targetId
                        );

                    } catch (error) {

                        // Ignore history errors.

                    }

                }
            );

        }
    );


    /* =====================================================
       HEADER SCROLL EFFECT
    ===================================================== */

    function handleHeaderScroll() {

        if (!mainHeader) {
            return;
        }


        if (
            window.scrollY >
            40
        ) {

            mainHeader.classList.add(
                "scrolled"
            );

        } else {

            mainHeader.classList.remove(
                "scrolled"
            );

        }

    }


    window.addEventListener(
        "scroll",
        handleHeaderScroll,
        {
            passive: true
        }
    );


    handleHeaderScroll();


    /* =====================================================
       ACTIVE NAVIGATION
    ===================================================== */

    const sections =
        document.querySelectorAll(
            "main section[id]"
        );


    const desktopNavLinks =
        document.querySelectorAll(
            '.desktop-nav a[href^="#"]'
        );


    if (
        sections.length &&
        desktopNavLinks.length &&
        "IntersectionObserver" in window
    ) {

        const sectionObserver =
            new IntersectionObserver(
                (entries) => {

                    entries.forEach(
                        (entry) => {

                            if (
                                !entry.isIntersecting
                            ) {
                                return;
                            }


                            const currentId =
                                entry.target.id;


                            desktopNavLinks.forEach(
                                (link) => {

                                    const href =
                                        link.getAttribute(
                                            "href"
                                        );


                                    link.classList.toggle(
                                        "active",
                                        href ===
                                        `#${currentId}`
                                    );

                                }
                            );

                        }
                    );

                },
                {
                    threshold: 0.30,
                    rootMargin:
                        "-10% 0px -55% 0px"
                }
            );


        sections.forEach(
            (section) => {

                sectionObserver.observe(
                    section
                );

            }
        );

    }


    /* =====================================================
       SCROLL REVEAL ANIMATION
    ===================================================== */

    const animatedElements =
        document.querySelectorAll(
            "[data-animate]"
        );


    function revealAllAnimatedElements() {

        animatedElements.forEach(
            (element) => {

                element.classList.add(
                    "visible"
                );

            }
        );

    }


    function revealInitialElements() {

        animatedElements.forEach(
            (element) => {

                const rect =
                    element.getBoundingClientRect();


                if (
                    rect.top <
                    window.innerHeight + 150
                ) {

                    element.classList.add(
                        "visible"
                    );

                }

            }
        );

    }


    if (
        animatedElements.length &&
        "IntersectionObserver" in window
    ) {

        const animationObserver =
            new IntersectionObserver(
                (entries) => {

                    entries.forEach(
                        (entry) => {

                            if (
                                entry.isIntersecting
                            ) {

                                entry.target.classList.add(
                                    "visible"
                                );


                                animationObserver.unobserve(
                                    entry.target
                                );

                            }

                        }
                    );

                },
                {
                    threshold: 0.05,
                    rootMargin:
                        "0px 0px 150px 0px"
                }
            );


        animatedElements.forEach(
            (element) => {

                animationObserver.observe(
                    element
                );

            }
        );


        window.setTimeout(
            () => {

                revealInitialElements();

            },
            100
        );


        window.setTimeout(
            () => {

                revealAllAnimatedElements();

            },
            2500
        );

    } else {

        revealAllAnimatedElements();

    }


    /* =====================================================
       AI CORE MICRO ANIMATION
    ===================================================== */

    if (aiCore) {

        let aiAnimationPaused =
            false;


        aiCore.addEventListener(
            "mouseenter",
            () => {

                aiAnimationPaused =
                    true;

                aiCore.classList.add(
                    "user-focus"
                );

            }
        );


        aiCore.addEventListener(
            "mouseleave",
            () => {

                aiAnimationPaused =
                    false;

                aiCore.classList.remove(
                    "user-focus"
                );

            }
        );


        const processingText =
            aiCore.querySelector(
                ".processing-label span:first-child"
            );


        const processingMessages = [

            "Understanding citizen input",

            "Analyzing reported problem",

            "Identifying problem category",

            "Checking location context",

            "Finding responsible authority",

            "Preparing smart routing",

            "Generating civic response"

        ];


        let messageIndex = 0;


        if (processingText) {

            window.setInterval(
                () => {

                    if (
                        aiAnimationPaused
                    ) {
                        return;
                    }


                    messageIndex =
                        (
                            messageIndex + 1
                        ) %
                        processingMessages.length;


                    processingText.style.opacity =
                        "0";


                    window.setTimeout(
                        () => {

                            processingText.textContent =
                                processingMessages[
                                    messageIndex
                                ];


                            processingText.style.opacity =
                                "1";

                        },
                        250
                    );


                },
                3000
            );

        }

    }


    /* =====================================================
       AI DETECTION STATUS ANIMATION
    ===================================================== */

    const detectionItems =
        document.querySelectorAll(
            ".detection-item"
        );


    detectionItems.forEach(
        (item, index) => {

            item.style.animationDelay =
                `${index * 0.18}s`;

        }
    );


    /* =====================================================
       FLOATING CARDS
    ===================================================== */

    const floatingCards =
        document.querySelectorAll(
            ".floating-card"
        );


    floatingCards.forEach(
        (card, index) => {

            card.style.animationDelay =
                `${index * 0.7}s`;

        }
    );


    /* =====================================================
       COUNTER ANIMATION
    ===================================================== */

    const counters =
        document.querySelectorAll(
            ".counter"
        );


    function animateCounter(
        element
    ) {

        if (
            element.dataset.counterAnimated ===
            "true"
        ) {
            return;
        }


        const originalText =
            element.textContent.trim();


        const target =
            parseInt(
                originalText.replace(
                    /\D/g,
                    ""
                ),
                10
            );


        if (
            Number.isNaN(target) ||
            target <= 0
        ) {

            return;

        }


        element.dataset.counterAnimated =
            "true";


        const duration =
            1200;


        const startTime =
            performance.now();


        function updateCounter(
            currentTime
        ) {

            const elapsed =
                currentTime -
                startTime;


            const progress =
                Math.min(
                    elapsed /
                    duration,
                    1
                );


            const easedProgress =
                1 -
                Math.pow(
                    1 - progress,
                    3
                );


            const current =
                Math.floor(
                    easedProgress *
                    target
                );


            if (
                /^0\d+$/.test(
                    originalText
                )
            ) {

                element.textContent =
                    String(current)
                        .padStart(
                            2,
                            "0"
                        );

            } else {

                element.textContent =
                    current.toLocaleString();

            }


            if (
                progress < 1
            ) {

                requestAnimationFrame(
                    updateCounter
                );

            } else {

                if (
                    /^0\d+$/.test(
                        originalText
                    )
                ) {

                    element.textContent =
                        String(target)
                            .padStart(
                                2,
                                "0"
                            );

                } else {

                    element.textContent =
                        target.toLocaleString();

                }

            }

        }


        requestAnimationFrame(
            updateCounter
        );

    }


    if (
        counters.length &&
        "IntersectionObserver" in window
    ) {

        const counterObserver =
            new IntersectionObserver(
                (entries) => {

                    entries.forEach(
                        (entry) => {

                            if (
                                entry.isIntersecting
                            ) {

                                animateCounter(
                                    entry.target
                                );


                                counterObserver.unobserve(
                                    entry.target
                                );

                            }

                        }
                    );

                },
                {
                    threshold: 0.15,
                    rootMargin:
                        "0px 0px 100px 0px"
                }
            );


        counters.forEach(
            (counter) => {

                counterObserver.observe(
                    counter
                );

            }
        );

    } else {

        counters.forEach(
            (counter) => {

                animateCounter(
                    counter
                );

            }
        );

    }


    /* =====================================================
       QUICK ACTION CARD EFFECT
    ===================================================== */

    const quickCards =
        document.querySelectorAll(
            ".quick-action-card"
        );


    quickCards.forEach(
        (card) => {

            card.addEventListener(
                "mouseenter",
                () => {

                    card.classList.add(
                        "card-hover"
                    );

                }
            );


            card.addEventListener(
                "mouseleave",
                () => {

                    card.classList.remove(
                        "card-hover"
                    );

                }
            );

        }
    );


    /* =====================================================
       BUTTON RIPPLE EFFECT
    ===================================================== */

    const buttons =
        document.querySelectorAll(
            ".primary-button, .secondary-button, .nav-register"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                function (event) {

                    const oldRipple =
                        this.querySelector(
                            ".button-ripple"
                        );


                    if (oldRipple) {
                        oldRipple.remove();
                    }


                    const ripple =
                        document.createElement(
                            "span"
                        );


                    ripple.className =
                        "button-ripple";


                    const rect =
                        this.getBoundingClientRect();


                    const x =
                        event.clientX -
                        rect.left;


                    const y =
                        event.clientY -
                        rect.top;


                    ripple.style.left =
                        `${x}px`;


                    ripple.style.top =
                        `${y}px`;


                    this.appendChild(
                        ripple
                    );


                    window.setTimeout(
                        () => {

                            if (
                                ripple.parentNode
                            ) {

                                ripple.remove();

                            }

                        },
                        700
                    );

                }
            );

        }
    );


    /* =====================================================
       FLOATING HELP BUTTON
    ===================================================== */

    if (floatingHelp) {

        floatingHelp.addEventListener(
            "click",
            () => {

                openChronicAIHelp();

            }
        );

    }


    function openChronicAIHelp() {

        const existing =
            document.querySelector(
                ".civic-help-popup"
            );


        if (existing) {

            existing.classList.toggle(
                "show"
            );

            return;

        }


        const popup =
            document.createElement(
                "div"
            );


        popup.className =
            "civic-help-popup";


        popup.innerHTML = `

            <div class="help-popup-header">

                <div>

                    <span
                        class="help-status-dot">
                    </span>

                    <strong>
                        ChronicAI Assistant
                    </strong>

                </div>


                <button
                    type="button"
                    class="help-close"
                    aria-label="Close help"
                >
                    ×
                </button>

            </div>


            <div class="help-popup-body">

                <div class="help-ai-icon">

                    <i
                        class="fa-solid fa-brain">
                    </i>

                </div>


                <p>

                    Hello! 👋

                    <br><br>

                    I can help you understand
                    ChronicAI and guide you through
                    reporting a public problem.

                </p>

            </div>


            <div class="help-popup-actions">

                <a href="login.html">

                    <i
                        class="fa-solid fa-camera">
                    </i>

                    Report a Problem

                </a>


                <a href="citizen.html">

                    <i
                        class="fa-solid fa-wand-magic-sparkles">
                    </i>

                    AI Citizen Assistant

                </a>

            </div>

        `;


        document.body.appendChild(
            popup
        );


        requestAnimationFrame(
            () => {

                popup.classList.add(
                    "show"
                );

            }
        );


        const closeButton =
            popup.querySelector(
                ".help-close"
            );


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                () => {

                    popup.classList.remove(
                        "show"
                    );


                    window.setTimeout(
                        () => {

                            if (
                                popup.parentNode
                            ) {

                                popup.remove();

                            }

                        },
                        300
                    );

                }
            );

        }

    }


    /* =====================================================
       PARALLAX BACKGROUND
    ===================================================== */

    const orbs =
        document.querySelectorAll(
            ".floating-orb"
        );


    const canUsePointerEffects =
        window.matchMedia &&
        window.matchMedia(
            "(pointer: fine)"
        ).matches;


    if (
        orbs.length &&
        canUsePointerEffects
    ) {

        window.addEventListener(
            "mousemove",
            (event) => {

                const x =
                    (
                        event.clientX /
                        window.innerWidth
                    ) - 0.5;


                const y =
                    (
                        event.clientY /
                        window.innerHeight
                    ) - 0.5;


                orbs.forEach(
                    (orb, index) => {

                        const strength =
                            12 +
                            index * 8;


                        orb.style.transform =
                            `translate(
                                ${x * strength}px,
                                ${y * strength}px
                            )`;

                    }
                );

            },
            {
                passive: true
            }
        );

    }


    /* =====================================================
       AI CORE MOUSE TILT
    ===================================================== */

    if (
        aiCore &&
        canUsePointerEffects
    ) {

        aiCore.addEventListener(
            "mousemove",
            (event) => {

                const rect =
                    aiCore.getBoundingClientRect();


                if (
                    !rect.width ||
                    !rect.height
                ) {
                    return;
                }


                const x =
                    (
                        event.clientX -
                        rect.left
                    ) /
                    rect.width;


                const y =
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height;


                const rotateX =
                    (
                        0.5 - y
                    ) * 5;


                const rotateY =
                    (
                        x - 0.5
                    ) * 5;


                aiCore.style.transform =
                    `perspective(1000px)
                     rotateX(${rotateX}deg)
                     rotateY(${rotateY}deg)
                     translateY(-4px)`;

            }
        );


        aiCore.addEventListener(
            "mouseleave",
            () => {

                aiCore.style.transform =
                    "";

            }
        );

    }


    /* =====================================================
       CHRONICAI BACKEND CONFIGURATION
    ===================================================== */

    const CHRONICAI_API_BASE = "";


    /* =====================================================
       CHRONICAI API REQUEST HELPER
    ===================================================== */

    async function civicAIRequest(
        endpoint,
        options = {}
    ) {

        const url =
            `${CHRONICAI_API_BASE}${endpoint}`;


        const defaultHeaders = {

            "Content-Type":
                "application/json"

        };


        const response =
            await fetch(
                url,
                {

                    ...options,

                    headers: {

                        ...defaultHeaders,

                        ...(options.headers || {})

                    }

                }
            );


        let data = null;


        try {

            data =
                await response.json();

        }

        catch (error) {

            data = null;

        }


        if (
            !response.ok
        ) {

            throw new Error(
                data?.error ||
                `ChronicAI server error: ${response.status}`
            );

        }


        return data;

    }


    /* =====================================================
       TEST BACKEND CONNECTION
    ===================================================== */

    async function checkChronicAIBackend() {

        try {

            const data =
                await civicAIRequest(
                    "/api/health"
                );


            console.log(
                "ChronicAI Backend:",
                data
            );


            if (
                data?.success
            ) {

                console.log(
                    "ChronicAI Backend connection successful."
                );

            }


            if (
                data?.aiConfigured
            ) {

                console.log(
                    "ChronicAI Groq AI configuration detected."
                );

            } else {

                console.warn(
                    "ChronicAI backend is online, but GROQ_API_KEY is not configured."
                );

            }


            return data;

        }

        catch (error) {

            console.error(
                "ChronicAI Backend Connection Error:",
                error
            );


            return null;

        }

    }


    /* =====================================================
       AI ANALYSIS FUNCTION
       
       Can be used by other ChronicAI pages/scripts:
       
       window.ChronicAI.analyzeReport(...)
    ===================================================== */

    async function analyzeChronicReport({

        description = "",

        location = "",

        image = null,

        reporterName = ""

    } = {}) {

        const cleanDescription =
            String(
                description || ""
            )
                .trim()
                .slice(
                    0,
                    5000
                );


        const cleanLocation =
            String(
                location || ""
            )
                .trim()
                .slice(
                    0,
                    500
                );


        const cleanReporterName =
            String(
                reporterName || ""
            )
                .trim()
                .slice(
                    0,
                    150
                );


        if (
            !cleanDescription &&
            !image
        ) {

            throw new Error(
                "Please provide a problem description or image."
            );

        }


        console.log(
            "ChronicAI: Sending report to AI..."
        );


        const data =
            await civicAIRequest(
                "/api/analyze",
                {

                    method:
                        "POST",

                    body:
                        JSON.stringify({

                            description:
                                cleanDescription,

                            location:
                                cleanLocation,

                            reporterName:
                                cleanReporterName,

                            image:
                                image || null

                        })

                }
            );


        if (
            !data?.success
        ) {

            throw new Error(
                data?.error ||
                "AI analysis failed."
            );

        }


        console.log(
            "ChronicAI: AI analysis received.",
            data.analysis
        );


        return data;

    }


    /* =====================================================
       CREATE CHRONIC REPORT
       
       Can be used by report/citizen page.
    ===================================================== */

    async function createChronicReport({

        reporterName = "",

        reporterUid = "",

        description = "",

        location = "",

        analysis = null

    } = {}) {

        if (
            !analysis ||
            typeof analysis !==
            "object"
        ) {

            throw new Error(
                "AI analysis is required before submitting the report."
            );

        }


        if (
            !String(
                location || ""
            ).trim()
        ) {

            throw new Error(
                "Report location is required."
            );

        }


        console.log(
            "ChronicAI: Saving civic report..."
        );


        const data =
            await civicAIRequest(
                "/api/reports",
                {

                    method:
                        "POST",

                    body:
                        JSON.stringify({

                            reporterName:
                                String(
                                    reporterName || ""
                                ).trim(),

                            reporterUid:
                                String(
                                    reporterUid || ""
                                ).trim(),

                            description:
                                String(
                                    description || ""
                                ).trim(),

                            location:
                                String(
                                    location || ""
                                ).trim(),

                            analysis

                        })

                }
            );


        if (
            !data?.success
        ) {

            throw new Error(
                data?.error ||
                "Unable to save civic report."
            );

        }


        console.log(
            "ChronicAI: Report saved successfully.",
            data.reportId
        );


        return data;

    }


    /* =====================================================
       LOAD ALL CHRONIC REPORTS
    ===================================================== */

    async function loadChronicReports() {

        console.log(
            "ChronicAI: Loading reports..."
        );


        const data =
            await civicAIRequest(
                "/api/reports"
            );


        if (
            !data?.success
        ) {

            throw new Error(
                data?.error ||
                "Unable to load reports."
            );

        }


        return data;

    }


    /* =====================================================
       LOAD SINGLE CHRONIC REPORT
    ===================================================== */

    async function loadChronicReport(
        reportId
    ) {

        const id =
            String(
                reportId || ""
            ).trim();


        if (!id) {

            throw new Error(
                "Report ID is required."
            );

        }


        const data =
            await civicAIRequest(
                `/api/reports/${encodeURIComponent(id)}`
            );


        if (
            !data?.success
        ) {

            throw new Error(
                data?.error ||
                "Report not found."
            );

        }


        return data;

    }


    /* =====================================================
       UPDATE CHRONIC REPORT STATUS
    ===================================================== */

    async function updateChronicReportStatus({

        reportId,

        status,

        adminNote = "",

        assignedTo = "",

        assignedDepartment = ""

    } = {}) {

        const id =
            String(
                reportId || ""
            ).trim();


        if (!id) {

            throw new Error(
                "Report ID is required."
            );

        }


        if (!status) {

            throw new Error(
                "Report status is required."
            );

        }


        const data =
            await civicAIRequest(
                `/api/reports/${encodeURIComponent(id)}/status`,
                {

                    method:
                        "PATCH",

                    body:
                        JSON.stringify({

                            status,

                            adminNote,

                            assignedTo,

                            assignedDepartment

                        })

                }
            );


        if (
            !data?.success
        ) {

            throw new Error(
                data?.error ||
                "Unable to update report status."
            );

        }


        return data;

    }


    /* =====================================================
       ESCALATE CHRONIC REPORT
    ===================================================== */

    async function escalateChronicReport({

        reportId,

        reason = "",

        escalatedTo = ""

    } = {}) {

        const id =
            String(
                reportId || ""
            ).trim();


        if (!id) {

            throw new Error(
                "Report ID is required."
            );

        }


        const data =
            await civicAIRequest(
                `/api/reports/${encodeURIComponent(id)}/escalate`,
                {

                    method:
                        "POST",

                    body:
                        JSON.stringify({

                            reason,

                            escalatedTo

                        })

                }
            );


        if (
            !data?.success
        ) {

            throw new Error(
                data?.error ||
                "Unable to escalate report."
            );

        }


        return data;

    }


    /* =====================================================
       LOAD REPORT TIMELINE
    ===================================================== */

    async function loadChronicReportTimeline(
        reportId
    ) {

        const id =
            String(
                reportId || ""
            ).trim();


        if (!id) {

            throw new Error(
                "Report ID is required."
            );

        }


        const data =
            await civicAIRequest(
                `/api/reports/${encodeURIComponent(id)}/timeline`
            );


        if (
            !data?.success
        ) {

            throw new Error(
                data?.error ||
                "Unable to load report timeline."
            );

        }


        return data;

    }


    /* =====================================================
       GLOBAL CHRONICAI API
       
       Other JS files can use:
       
       window.ChronicAI.analyzeReport()
       window.ChronicAI.createReport()
       window.ChronicAI.getReports()
       etc.
    ===================================================== */

    window.ChronicAI = {

        apiBase:
            CHRONICAI_API_BASE,

        request:
            civicAIRequest,

        checkBackend:
            checkChronicAIBackend,

        analyzeReport:
            analyzeChronicReport,

        createReport:
            createChronicReport,

        getReports:
            loadChronicReports,

        getReport:
            loadChronicReport,

        updateStatus:
            updateChronicReportStatus,

        escalateReport:
            escalateChronicReport,

        getTimeline:
            loadChronicReportTimeline

    };


    /* =====================================================
       AUTOMATIC BACKEND HEALTH CHECK
       
       Only checks when page is running through server.
       Does NOT break frontend if backend is unavailable.
    ===================================================== */

    checkChronicAIBackend();


    /* =====================================================
       RESIZE SAFETY
    ===================================================== */

    window.addEventListener(
        "resize",
        () => {

            revealInitialElements();

        },
        {
            passive: true
        }
    );


    /* =====================================================
       PAGE VISIBILITY
    ===================================================== */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.hidden
            ) {

                document.body.classList.add(
                    "page-hidden"
                );

            } else {

                document.body.classList.remove(
                    "page-hidden"
                );

            }

        }
    );


    /* =====================================================
       KEYBOARD ACCESSIBILITY
    ===================================================== */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }


            if (
                mobileNavigation &&
                mobileNavigation.classList.contains(
                    "open"
                )
            ) {

                mobileNavigation.classList.remove(
                    "open"
                );


                if (
                    mobileMenuButton
                ) {

                    mobileMenuButton.classList.remove(
                        "active"
                    );


                    mobileMenuButton.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                }

            }


            const helpPopup =
                document.querySelector(
                    ".civic-help-popup"
                );


            if (helpPopup) {

                helpPopup.classList.remove(
                    "show"
                );

            }

        }
    );


    /* =====================================================
       GLOBAL ERROR SAFETY
    ===================================================== */

    window.addEventListener(
        "error",
        (event) => {

            console.warn(
                "ChronicAI frontend warning:",
                event.message
            );

        }
    );


    /* =====================================================
       UNHANDLED PROMISE SAFETY
    ===================================================== */

    window.addEventListener(
        "unhandledrejection",
        (event) => {

            console.warn(
                "ChronicAI unhandled promise:",
                event.reason
            );

        }
    );


    /* =====================================================
       INITIALIZE
    ===================================================== */

    document.body.classList.add(
        "civicai-ready"
    );


    /* =====================================================
       FINAL SAFETY CHECK
    ===================================================== */

    window.setTimeout(
        () => {

            revealAllAnimatedElements();

        },
        3000
    );


    /* =====================================================
       CONSOLE INFORMATION
    ===================================================== */

    console.log(
        "================================================"
    );

    console.log(
        "CHRONICAI FRONTEND INITIALIZED 🚀"
    );

    console.log(
        "UI Controller: READY"
    );

    console.log(
        "Theme System: READY"
    );

    console.log(
        "Navigation: READY"
    );

    console.log(
        "Animations: READY"
    );

    console.log(
        "ChronicAI API Controller: READY"
    );

    console.log(
        "Groq API communication: BACKEND"
    );

    console.log(
        "API Endpoint: /api/analyze"
    );

    console.log(
        "Reports Endpoint: /api/reports"
    );

    console.log(
        "================================================"
    );

});