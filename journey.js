/* ============================================================
   SAFEJOURNEY — COMPLETE JOURNEY.JS
   ------------------------------------------------------------
   Features:
   • Start Journey
   • Real GPS Current Location
   • Live Map
   • Current Location Marker
   • GPS Accuracy Circle
   • Journey ID
   • Journey Timer
   • Parent / Guardian Section
   • Online / Offline Status
   • Map Resize Fix
   • Mobile Sidebar
   • Local Storage
   • Share Journey
   • Copy Journey ID
   ============================================================ */

"use strict";


/* ============================================================
   GLOBAL STATE
   ============================================================ */

let journeyActive = false;

let journeyId = null;

let watchId = null;

let journeyStartTime = null;

let journeyTimerInterval = null;

let currentPosition = null;

let currentMarker = null;

let accuracyCircle = null;

let map = null;

let mapInitialized = false;

let mapHasRealLocation = false;

let connectedParentJourneyId = null;

let lastLocationTime = null;


/* ============================================================
   HELPER
   ============================================================ */

const $ = (id) => document.getElementById(id);


/* ============================================================
   PAGE SECTIONS
   ============================================================ */

const pageSections = {
    journey: $("journeySection"),
    map: $("mapSection"),
    parent: $("parentSection"),
    status: $("statusSection")
};


/* ============================================================
   NAVIGATION
   ============================================================ */

const navItems =
    document.querySelectorAll(".nav-item");


/* ============================================================
   HEADER
   ============================================================ */

const pageTitle =
    $("pageTitle");

const connectionPill =
    $("connectionPill");

const connectionText =
    $("connectionText");

const mobileMenu =
    $("mobileMenu");

const sidebar =
    $("sidebar");


/* ============================================================
   JOURNEY ELEMENTS
   ============================================================ */

const startJourneyBtn =
    $("startJourneyBtn");

const viewMapBtn =
    $("viewMapBtn");

const journeyIdElement =
    $("journeyId");

const journeyStatusBadge =
    $("journeyStatusBadge");

const copyJourneyId =
    $("copyJourneyId");

const locationStatus =
    $("locationStatus");

const journeyTimer =
    $("journeyTimer");

const gpsAccuracy =
    $("gpsAccuracy");

const safetyStatus =
    $("safetyStatus");

const journeyStartControl =
    $("journeyStartControl");

const journeyStopControl =
    $("journeyStopControl");

const shareJourneyControl =
    $("shareJourneyControl");

const safetyModeText =
    $("safetyModeText");


/* ============================================================
   MAP ELEMENTS
   ============================================================ */

const mapStatusDot =
    $("mapStatusDot");

const mapStatusText =
    $("mapStatusText");

const currentCoordinates =
    $("currentCoordinates");

const latitudeElement =
    $("latitude");

const longitudeElement =
    $("longitude");

const accuracyElement =
    $("accuracy");

const lastUpdated =
    $("lastUpdated");

const centerMapBtn =
    $("centerMapBtn");


/* ============================================================
   PARENT ELEMENTS
   ============================================================ */

const parentJourneyId =
    $("parentJourneyId");

const connectParentBtn =
    $("connectParentBtn");

const parentMessage =
    $("parentMessage");

const connectedJourneyTitle =
    $("connectedJourneyTitle");

const childConnectionStatus =
    $("childConnectionStatus");

const childName =
    $("childName");

const childJourneyId =
    $("childJourneyId");

const parentLocation =
    $("parentLocation");

const parentOpenMapBtn =
    $("parentOpenMapBtn");


/* ============================================================
   STATUS ELEMENTS
   ============================================================ */

const bigJourneyStatus =
    $("bigJourneyStatus");

const bigJourneyMessage =
    $("bigJourneyMessage");

const statusCircleIcon =
    $("statusCircleIcon");

const readyTime =
    $("readyTime");

const startedTime =
    $("startedTime");

const trackingTime =
    $("trackingTime");

const completedTime =
    $("completedTime");


/* ============================================================
   MODAL
   ============================================================ */

const journeyModal =
    $("journeyModal");

const closeJourneyModal =
    $("closeJourneyModal");

const confirmStartJourney =
    $("confirmStartJourney");

const cancelStartJourney =
    $("cancelStartJourney");


/* ============================================================
   TOAST
   ============================================================ */

const toast =
    $("toast");

const toastIcon =
    $("toastIcon");

const toastMessage =
    $("toastMessage");

let toastTimer = null;


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


function initializeApp() {

    console.log(
        "🛡️ SafeJourney starting..."
    );


    setupNavigation();

    setupButtons();

    setupMobileMenu();

    setupConnectionStatus();

    initializeMap();

    restoreJourneyState();

    if (journeyActive) {

        updateJourneyUI();

        startJourneyTimer();

        if (currentPosition) {

            updateLocation(
                currentPosition
            );

        }

        startWatchingLocation();

        showToast(
            "Journey resumed after refresh.",
            "↻"
        );

    }

    updateReadyTime();


    console.log(
        "✅ SafeJourney initialized."
    );

}


/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {

    navItems.forEach(
        (item) => {

            item.addEventListener(
                "click",
                () => {

                    const sectionName =
                        item.dataset.section;

                    switchSection(
                        sectionName
                    );

                }
            );

        }
    );

}


function switchSection(
    sectionName
) {

    navItems.forEach(
        (item) => {

            item.classList.toggle(
                "active",
                item.dataset.section === sectionName
            );

        }
    );


    Object.entries(
        pageSections
    ).forEach(
        ([name, section]) => {

            if (!section) {
                return;
            }

            section.classList.toggle(
                "active",
                name === sectionName
            );

        }
    );


    const titles = {

        journey:
            "Start Your Journey",

        map:
            "Live Map",

        parent:
            "Parent / Guardian",

        status:
            "Journey Status"

    };


    if (pageTitle) {

        pageTitle.textContent =
            titles[sectionName] ||
            "SafeJourney";

    }


    if (sidebar) {

        sidebar.classList.remove(
            "mobile-open"
        );

    }


    /*
     * IMPORTANT:
     *
     * Leaflet maps often break when initialized
     * inside a hidden section.
     *
     * invalidateSize() fixes this.
     */

    if (sectionName === "map") {

        setTimeout(
            () => {

                if (!map) {

                    initializeMap();

                }


                if (map) {

                    map.invalidateSize(
                        true
                    );

                }


                if (
                    currentPosition &&
                    mapHasRealLocation
                ) {

                    setTimeout(
                        () => {

                            centerCurrentLocation(
                                false
                            );

                        },
                        150
                    );

                }

            },
            250
        );

    }

}


/* ============================================================
   MOBILE MENU
   ============================================================ */

function setupMobileMenu() {

    if (!mobileMenu || !sidebar) {
        return;
    }


    mobileMenu.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
            );

        }
    );

}


/* ============================================================
   BUTTONS
   ============================================================ */

function setupButtons() {

    if (startJourneyBtn) {

        startJourneyBtn.addEventListener(
            "click",
            openJourneyModal
        );

    }


    if (journeyStartControl) {

        journeyStartControl.addEventListener(
            "click",
            openJourneyModal
        );

    }


    if (journeyStopControl) {

        journeyStopControl.addEventListener(
            "click",
            stopJourney
        );

    }


    if (viewMapBtn) {

        viewMapBtn.addEventListener(
            "click",
            () => {

                switchSection(
                    "map"
                );

            }
        );

    }


    if (copyJourneyId) {

        copyJourneyId.addEventListener(
            "click",
            copyJourneyIdentifier
        );

    }


    if (shareJourneyControl) {

        shareJourneyControl.addEventListener(
            "click",
            shareJourney
        );

    }


    if (closeJourneyModal) {

        closeJourneyModal.addEventListener(
            "click",
            closeJourneyModalWindow
        );

    }


    if (cancelStartJourney) {

        cancelStartJourney.addEventListener(
            "click",
            closeJourneyModalWindow
        );

    }


    if (confirmStartJourney) {

        confirmStartJourney.addEventListener(
            "click",
            startJourney
        );

    }


    if (centerMapBtn) {

        centerMapBtn.addEventListener(
            "click",
            () => {

                centerCurrentLocation(
                    true
                );

            }
        );

    }


    if (connectParentBtn) {

        connectParentBtn.addEventListener(
            "click",
            connectParentJourney
        );

    }


    if (parentOpenMapBtn) {

        parentOpenMapBtn.addEventListener(
            "click",
            () => {

                switchSection(
                    "map"
                );

            }
        );

    }


    if (parentJourneyId) {

        parentJourneyId.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter"
                ) {

                    connectParentJourney();

                }

            }
        );

    }


    if (journeyModal) {

        journeyModal.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    journeyModal
                ) {

                    closeJourneyModalWindow();

                }

            }
        );

    }

}


/* ============================================================
   MODAL
   ============================================================ */

function openJourneyModal() {

    if (journeyActive) {

        switchSection(
            "map"
        );

        return;

    }


    if (!journeyModal) {
        startJourney();
        return;
    }


    journeyModal.classList.add(
        "active"
    );


    journeyModal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeJourneyModalWindow() {

    if (!journeyModal) {
        return;
    }


    journeyModal.classList.remove(
        "active"
    );


    journeyModal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* ============================================================
   START JOURNEY
   ============================================================ */

async function startJourney() {

    if (journeyActive) {
        return;
    }


    if (
        !navigator.geolocation
    ) {

        showToast(
            "This browser does not support GPS location.",
            "!"
        );

        return;

    }


    if (confirmStartJourney) {

        confirmStartJourney.disabled =
            true;

        confirmStartJourney.innerHTML =
            "📍 Getting your location...";

    }


    try {

        console.log(
            "📍 Requesting current GPS..."
        );


        /*
         * Get REAL current location
         */

        const position =
            await getCurrentPosition();


        if (
            !position ||
            !position.coords
        ) {

            throw new Error(
                "Invalid GPS position."
            );

        }


        currentPosition =
            position;


        /*
         * Create unique Journey ID
         */

        journeyId =
            generateJourneyId();


        journeyActive =
            true;


        journeyStartTime =
            Date.now();


        lastLocationTime =
            Date.now();


        /*
         * Reset map location state
         */

        mapHasRealLocation =
            false;


        if (map) {

            map._safeJourneyHasLocation =
                false;

        }


        /*
         * Save local state
         */

        saveJourneyState();


        /*
         * Update UI
         */

        updateJourneyUI();


        /*
         * Start timer
         */

        startJourneyTimer();


        /*
         * Immediately show GPS location
         */

        updateLocation(
            position
        );


        /*
         * Continue watching GPS
         */

        startWatchingLocation();


        closeJourneyModalWindow();


        /*
         * Go to journey section first
         */

        switchSection(
            "journey"
        );


        showToast(
            "Journey started successfully.",
            "✓"
        );


        console.log(
            "📍 GPS:",
            position.coords.latitude,
            position.coords.longitude
        );


    } catch (error) {

        console.error(
            "❌ Location Error:",
            error
        );


        handleLocationError(
            error
        );


    } finally {

        if (confirmStartJourney) {

            confirmStartJourney.disabled =
                false;

            confirmStartJourney.innerHTML =
                "Allow & Start Journey";

        }

    }

}


/* ============================================================
   GET CURRENT GPS POSITION
   ============================================================ */

function getCurrentPosition() {

    return new Promise(
        (resolve, reject) => {

            navigator.geolocation.getCurrentPosition(

                (position) => {

                    console.log(
                        "✅ GPS position received."
                    );

                    resolve(
                        position
                    );

                },

                (error) => {

                    console.error(
                        "GPS ERROR:",
                        error
                    );

                    reject(
                        error
                    );

                },

                {

                    enableHighAccuracy:
                        true,

                    timeout:
                        20000,

                    maximumAge:
                        0

                }

            );

        }
    );

}


/* ============================================================
   WATCH GPS LOCATION
   ============================================================ */

function startWatchingLocation() {

    if (
        !navigator.geolocation
    ) {
        return;
    }


    if (
        watchId !== null
    ) {

        navigator.geolocation.clearWatch(
            watchId
        );

        watchId = null;

    }


    watchId =
        navigator.geolocation.watchPosition(

            (position) => {

                if (!journeyActive) {
                    return;
                }


                if (
                    !position ||
                    !position.coords
                ) {
                    return;
                }


                console.log(
                    "📍 GPS UPDATE:",
                    position.coords.latitude,
                    position.coords.longitude
                );


                currentPosition =
                    position;


                lastLocationTime =
                    Date.now();


                updateLocation(
                    position
                );


                saveJourneyState();

            },


            (error) => {

                console.warn(
                    "⚠️ GPS watch error:",
                    error
                );


                if (
                    error.code === 1
                ) {

                    showToast(
                        "Location permission was denied.",
                        "!"
                    );

                }

            },

            {

                enableHighAccuracy:
                    true,

                timeout:
                    20000,

                maximumAge:
                    3000

            }

        );

}


/* ============================================================
   UPDATE LOCATION
   ============================================================ */

function updateLocation(
    position
) {

    if (
        !position ||
        !position.coords
    ) {
        return;
    }


    const latitude =
        Number(
            position.coords.latitude
        );


    const longitude =
        Number(
            position.coords.longitude
        );


    const accuracy =
        Number(
            position.coords.accuracy
        );


    /*
     * Validate GPS
     */

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        console.warn(
            "Invalid GPS coordinates."
        );

        return;

    }


    currentPosition =
        position;


    lastLocationTime =
        Date.now();


    /*
     * ========================================================
     * UPDATE TEXT
     * ========================================================
     */

    if (latitudeElement) {

        latitudeElement.textContent =
            latitude.toFixed(6);

    }


    if (longitudeElement) {

        longitudeElement.textContent =
            longitude.toFixed(6);

    }


    if (accuracyElement) {

        accuracyElement.textContent =
            formatDistance(
                accuracy
            );

    }


    if (gpsAccuracy) {

        gpsAccuracy.textContent =
            formatDistance(
                accuracy
            );

    }


    if (currentCoordinates) {

        currentCoordinates.textContent =
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

    }


    if (lastUpdated) {

        lastUpdated.textContent =
            formatTime(
                new Date()
            );

    }


    if (locationStatus) {

        locationStatus.textContent =
            "Live";

        locationStatus.style.color =
            "";

    }


    if (safetyStatus) {

        safetyStatus.textContent =
            "Protected";

        safetyStatus.style.color =
            "";

    }


    if (safetyModeText) {

        safetyModeText.textContent =
            "Active";

    }


    if (mapStatusText) {

        mapStatusText.textContent =
            "GPS location active";

    }


    if (mapStatusDot) {

        mapStatusDot.classList.add(
            "online"
        );

    }


    /*
     * ========================================================
     * UPDATE MAP
     * ========================================================
     */

    updateMapMarker(
        latitude,
        longitude,
        accuracy
    );


    /*
     * ========================================================
     * STATUS
     * ========================================================
     */

    if (trackingTime) {

        trackingTime.textContent =
            `Active • ${formatTime(new Date())}`;

    }


    if (bigJourneyStatus) {

        bigJourneyStatus.textContent =
            "Journey Active";

    }


    if (bigJourneyMessage) {

        bigJourneyMessage.textContent =
            "Your live location is being monitored.";

    }


    if (statusCircleIcon) {

        statusCircleIcon.textContent =
            "●";

    }

}


/* ============================================================
   INITIALIZE MAP
   ============================================================ */

function initializeMap() {

    /*
     * Check Leaflet
     */

    if (
        typeof L === "undefined"
    ) {

        console.error(
            "❌ Leaflet is not loaded."
        );

        if (mapStatusText) {

            mapStatusText.textContent =
                "Map library unavailable";

        }

        return;

    }


    /*
     * Already initialized
     */

    if (
        mapInitialized &&
        map
    ) {

        setTimeout(
            () => {

                map.invalidateSize(
                    true
                );

            },
            100
        );

        return;

    }


    const mapElement =
        document.getElementById(
            "liveMap"
        );


    if (!mapElement) {

        console.error(
            "❌ #liveMap element not found."
        );

        return;

    }


    /*
     * IMPORTANT:
     *
     * Don't pretend a default location is the user's
     * location.
     *
     * We start at neutral world view.
     */

    map =
        L.map(
            mapElement,
            {

                center:
                    [20, 0],

                zoom:
                    2,

                zoomControl:
                    true,

                attributionControl:
                    true,

                preferCanvas:
                    true

            }
        );


    /*
     * OpenStreetMap
     */

    const tileLayer =
        L.tileLayer(

            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

            {

                maxZoom:
                    19,

                minZoom:
                    2,

                updateWhenIdle:
                    true,

                updateWhenZooming:
                    false,

                keepBuffer:
                    2,

                attribution:
                    '&copy; OpenStreetMap contributors'

            }

        );


    tileLayer.addTo(
        map
    );


    /*
     * Tile error handling
     */

    tileLayer.on(
        "tileerror",
        (event) => {

            console.warn(
                "Map tile failed:",
                event
            );

        }
    );


    /*
     * Map load
     */

    map.whenReady(
        () => {

            console.log(
                "🗺️ Map ready."
            );


            setTimeout(
                () => {

                    map.invalidateSize(
                        true
                    );

                },
                100
            );


            setTimeout(
                () => {

                    map.invalidateSize(
                        true
                    );

                },
                500
            );


            setTimeout(
                () => {

                    map.invalidateSize(
                        true
                    );

                },
                1000
            );

        }
    );


    /*
     * Resize observer
     *
     * This is a major fix for maps inside
     * hidden/animated sections.
     */

    if (
        window.ResizeObserver
    ) {

        const resizeObserver =
            new ResizeObserver(
                () => {

                    if (map) {

                        map.invalidateSize(
                            true
                        );

                    }

                }
            );


        resizeObserver.observe(
            mapElement
        );


        map._safeJourneyResizeObserver =
            resizeObserver;

    }


    /*
     * Window resize
     */

    window.addEventListener(
        "resize",
        handleMapResize
    );


    /*
     * Orientation change
     */

    window.addEventListener(
        "orientationchange",
        () => {

            setTimeout(
                () => {

                    if (map) {

                        map.invalidateSize(
                            true
                        );

                    }

                },
                500
            );

        }
    );


    mapInitialized =
        true;


    console.log(
        "✅ Live map initialized."
    );

}


/* ============================================================
   MAP RESIZE
   ============================================================ */

function handleMapResize() {

    if (!map) {
        return;
    }


    clearTimeout(
        handleMapResize.timer
    );


    handleMapResize.timer =
        setTimeout(
            () => {

                map.invalidateSize(
                    true
                );

            },
            150
        );

}


/* ============================================================
   UPDATE MAP MARKER
   ============================================================ */

function updateMapMarker(
    latitude,
    longitude,
    accuracy
) {

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        return;
    }


    /*
     * Make sure map exists
     */

    if (!map) {

        initializeMap();

    }


    if (!map) {
        return;
    }


    const position = [
        latitude,
        longitude
    ];


    const safeAccuracy =
        Number.isFinite(accuracy) &&
        accuracy > 0
            ? accuracy
            : 20;


    /*
     * ========================================================
     * CURRENT LOCATION ICON
     * ========================================================
     */

    const currentLocationIcon =
        L.divIcon(
            {

                className:
                    "safejourney-location-marker",

                html: `
                    <div class="location-marker-pulse">
                        <div class="location-marker-dot"></div>
                    </div>
                `,

                iconSize:
                    [40, 40],

                iconAnchor:
                    [20, 20],

                popupAnchor:
                    [0, -20]

            }
        );


    /*
     * ========================================================
     * CREATE MARKER
     * ========================================================
     */

    if (!currentMarker) {

        currentMarker =
            L.marker(
                position,
                {

                    icon:
                        currentLocationIcon,

                    zIndexOffset:
                        1000,

                    keyboard:
                        false

                }
            ).addTo(
                map
            );


        currentMarker.bindPopup(
            `
            <div style="
                min-width:170px;
                font-family:Arial,sans-serif;
                line-height:1.5;
            ">

                <strong style="
                    font-size:14px;
                ">
                    📍 Your Current Location
                </strong>

                <br>

                <span style="
                    font-size:12px;
                    color:#555;
                ">
                    Live GPS location
                </span>

                <hr style="
                    border:none;
                    border-top:1px solid #ddd;
                    margin:8px 0;
                ">

                <span style="
                    font-size:11px;
                    color:#555;
                ">
                    Latitude:
                    ${latitude.toFixed(6)}
                </span>

                <br>

                <span style="
                    font-size:11px;
                    color:#555;
                ">
                    Longitude:
                    ${longitude.toFixed(6)}
                </span>

                <br>

                <span style="
                    font-size:11px;
                    color:#555;
                ">
                    Accuracy:
                    ${Math.round(safeAccuracy)} m
                </span>

            </div>
            `
        );


    } else {

        /*
         * Move marker
         */

        currentMarker.setLatLng(
            position
        );


        /*
         * Update popup
         */

        currentMarker.setPopupContent(
            `
            <div style="
                min-width:170px;
                font-family:Arial,sans-serif;
                line-height:1.5;
            ">

                <strong style="
                    font-size:14px;
                ">
                    📍 Your Current Location
                </strong>

                <br>

                <span style="
                    font-size:12px;
                    color:#555;
                ">
                    Live GPS location
                </span>

                <hr style="
                    border:none;
                    border-top:1px solid #ddd;
                    margin:8px 0;
                ">

                <span style="
                    font-size:11px;
                    color:#555;
                ">
                    Latitude:
                    ${latitude.toFixed(6)}
                </span>

                <br>

                <span style="
                    font-size:11px;
                    color:#555;
                ">
                    Longitude:
                    ${longitude.toFixed(6)}
                </span>

                <br>

                <span style="
                    font-size:11px;
                    color:#555;
                ">
                    Accuracy:
                    ${Math.round(safeAccuracy)} m
                </span>

            </div>
            `
        );

    }


    /*
     * ========================================================
     * ACCURACY CIRCLE
     * ========================================================
     */

    if (!accuracyCircle) {

        accuracyCircle =
            L.circle(
                position,
                {

                    radius:
                        safeAccuracy,

                    color:
                        "#4285f4",

                    weight:
                        1.5,

                    opacity:
                        0.8,

                    fillColor:
                        "#4285f4",

                    fillOpacity:
                        0.12

                }
            ).addTo(
                map
            );


    } else {

        accuracyCircle.setLatLng(
            position
        );


        accuracyCircle.setRadius(
            safeAccuracy
        );

    }


    /*
     * ========================================================
     * FIRST REAL GPS LOCATION
     * ========================================================
     */

    if (!mapHasRealLocation) {

        mapHasRealLocation =
            true;


        map._safeJourneyHasLocation =
            true;


        setTimeout(
            () => {

                if (!map) {
                    return;
                }


                map.invalidateSize(
                    true
                );


                map.setView(
                    position,
                    17,
                    {

                        animate:
                            true,

                        duration:
                            1

                    }
                );


            },
            150
        );

    }

}


/* ============================================================
   CENTER CURRENT LOCATION
   ============================================================ */

function centerCurrentLocation(
    animate = true
) {

    /*
     * No map?
     */

    if (!map) {

        initializeMap();

    }


    if (!map) {
        return;
    }


    /*
     * No GPS yet?
     */

    if (!currentPosition) {

        if (
            !navigator.geolocation
        ) {

            showToast(
                "GPS is not supported by this browser.",
                "!"
            );

            return;

        }


        showToast(
            "Getting your current location...",
            "📍"
        );


        navigator.geolocation.getCurrentPosition(

            (position) => {

                currentPosition =
                    position;


                updateLocation(
                    position
                );


                setTimeout(
                    () => {

                        centerCurrentLocation(
                            true
                        );

                    },
                    100
                );

            },

            (error) => {

                handleLocationError(
                    error
                );

            },

            {

                enableHighAccuracy:
                    true,

                timeout:
                    20000,

                maximumAge:
                    0

            }

        );


        return;

    }


    const latitude =
        Number(
            currentPosition.coords.latitude
        );


    const longitude =
        Number(
            currentPosition.coords.longitude
        );


    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        showToast(
            "Current GPS location is invalid.",
            "!"
        );

        return;

    }


    const position = [
        latitude,
        longitude
    ];


    /*
     * Fix Leaflet rendering
     */

    map.invalidateSize(
        true
    );


    /*
     * Center
     */

    map.setView(
        position,
        17,
        {

            animate:
                animate,

            duration:
                0.8

        }
    );


    /*
     * Open current location popup
     */

    if (currentMarker) {

        setTimeout(
            () => {

                currentMarker.openPopup();

            },
            animate ? 500 : 100
        );

    }


    /*
     * Update marker
     */

    updateMapMarker(
        latitude,
        longitude,
        currentPosition.coords.accuracy
    );

}


/* ============================================================
   JOURNEY TIMER
   ============================================================ */

function startJourneyTimer() {

    stopJourneyTimer();


    updateJourneyTimer();


    journeyTimerInterval =
        setInterval(
            updateJourneyTimer,
            1000
        );

}


function updateJourneyTimer() {

    if (
        !journeyStartTime
    ) {

        if (journeyTimer) {

            journeyTimer.textContent =
                "00:00:00";

        }

        return;

    }


    const elapsed =
        Date.now() -
        journeyStartTime;


    if (journeyTimer) {

        journeyTimer.textContent =
            formatDuration(
                elapsed
            );

    }

}


function stopJourneyTimer() {

    if (
        journeyTimerInterval !==
        null
    ) {

        clearInterval(
            journeyTimerInterval
        );


        journeyTimerInterval =
            null;

    }

}


/* ============================================================
   STOP JOURNEY
   ============================================================ */

function stopJourney() {

    if (!journeyActive) {

        showToast(
            "No active journey.",
            "!"
        );

        return;

    }


    const confirmed =
        window.confirm(
            "Are you sure you want to end this journey?"
        );


    if (!confirmed) {
        return;
    }


    journeyActive =
        false;


    /*
     * Stop GPS watcher
     */

    if (
        watchId !== null
    ) {

        navigator.geolocation.clearWatch(
            watchId
        );


        watchId =
            null;

    }


    stopJourneyTimer();


    const completedAt =
        new Date();


    if (completedTime) {

        completedTime.textContent =
            `Completed • ${formatTime(completedAt)}`;

    }


    if (locationStatus) {

        locationStatus.textContent =
            "Stopped";

    }


    if (gpsAccuracy) {

        gpsAccuracy.textContent =
            "--";

    }


    if (safetyStatus) {

        safetyStatus.textContent =
            "Ready";

    }


    if (safetyModeText) {

        safetyModeText.textContent =
            "Ready";

    }


    if (mapStatusText) {

        mapStatusText.textContent =
            "Location inactive";

    }


    if (mapStatusDot) {

        mapStatusDot.classList.remove(
            "online"
        );

    }


    if (journeyStatusBadge) {

        journeyStatusBadge.classList.remove(
            "active"
        );


        journeyStatusBadge.innerHTML =
            "<span></span> Completed";

    }


    if (journeyStopControl) {

        journeyStopControl.disabled =
            true;

    }


    if (journeyStartControl) {

        journeyStartControl.disabled =
            false;

    }


    if (startJourneyBtn) {

        startJourneyBtn.disabled =
            false;

        startJourneyBtn.textContent =
            "📍 Start Journey";

    }


    if (bigJourneyStatus) {

        bigJourneyStatus.textContent =
            "Journey Completed";

    }


    if (bigJourneyMessage) {

        bigJourneyMessage.textContent =
            "Your journey has ended successfully.";

    }


    if (statusCircleIcon) {

        statusCircleIcon.textContent =
            "✓";

    }


    saveJourneyState();


    showToast(
        "Journey completed.",
        "✓"
    );


    switchSection(
        "status"
    );

}


/* ============================================================
   UPDATE JOURNEY UI
   ============================================================ */

function updateJourneyUI() {

    if (!journeyActive) {

        if (journeyIdElement) {

            journeyIdElement.textContent =
                "Not Started";

        }


        if (journeyStatusBadge) {

            journeyStatusBadge.classList.remove(
                "active"
            );


            journeyStatusBadge.innerHTML =
                "<span></span> Inactive";

        }


        if (copyJourneyId) {

            copyJourneyId.disabled =
                true;

        }


        if (journeyStopControl) {

            journeyStopControl.disabled =
                true;

        }


        return;

    }


    if (journeyIdElement) {

        journeyIdElement.textContent =
            journeyId;

    }


    if (journeyStatusBadge) {

        journeyStatusBadge.classList.add(
            "active"
        );


        journeyStatusBadge.innerHTML =
            "<span></span> Active";

    }


    if (copyJourneyId) {

        copyJourneyId.disabled =
            false;

    }


    if (journeyStopControl) {

        journeyStopControl.disabled =
            false;

    }


    if (journeyStartControl) {

        journeyStartControl.disabled =
            true;

    }


    if (startJourneyBtn) {

        startJourneyBtn.textContent =
            "📍 Journey Active";

        startJourneyBtn.disabled =
            true;

    }


    if (startedTime) {

        startedTime.textContent =
            formatTime(
                new Date(
                    journeyStartTime
                )
            );

    }


    if (readyTime) {

        readyTime.textContent =
            "Journey initialized";

    }


    if (bigJourneyStatus) {

        bigJourneyStatus.textContent =
            "Journey Active";

    }


    if (bigJourneyMessage) {

        bigJourneyMessage.textContent =
            "Waiting for continuous GPS updates...";

    }

}


/* ============================================================
   GENERATE JOURNEY ID
   ============================================================ */

function generateJourneyId() {

    const now =
        Date.now()
            .toString(36)
            .toUpperCase();


    const random =
        Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();


    return (
        `SJ-${now.slice(-5)}-${random}`
    );

}


/* ============================================================
   COPY JOURNEY ID
   ============================================================ */

async function copyJourneyIdentifier() {

    if (!journeyId) {

        showToast(
            "Start a journey first.",
            "!"
        );

        return;

    }


    try {

        if (
            navigator.clipboard &&
            navigator.clipboard.writeText
        ) {

            await navigator.clipboard.writeText(
                journeyId
            );

        } else {

            const temp =
                document.createElement(
                    "input"
                );


            temp.value =
                journeyId;


            document.body.appendChild(
                temp
            );


            temp.select();


            document.execCommand(
                "copy"
            );


            temp.remove();

        }


        showToast(
            "Journey ID copied.",
            "✓"
        );


    } catch (error) {

        console.error(
            "Copy error:",
            error
        );


        showToast(
            "Could not copy Journey ID.",
            "!"
        );

    }

}


/* ============================================================
   SHARE JOURNEY
   ============================================================ */

async function shareJourney() {

    if (!journeyId) {

        showToast(
            "Start a journey first.",
            "!"
        );

        return;

    }


    const shareText =
        `Track my SafeJourney using Journey ID: ${journeyId}`;


    if (
        navigator.share
    ) {

        try {

            await navigator.share({

                title:
                    "SafeJourney",

                text:
                    shareText

            });


            return;

        } catch (error) {

            /*
             * User cancelled share.
             */

        }

    }


    try {

        await navigator.clipboard.writeText(
            shareText
        );


        showToast(
            "Sharing message copied.",
            "✓"
        );

    } catch (error) {

        showToast(
            shareText,
            "!"
        );

    }

}


/* ============================================================
   PARENT CONNECTION
   ============================================================ */

function connectParentJourney() {

    if (!parentJourneyId) {
        return;
    }


    const enteredId =
        parentJourneyId.value
            .trim()
            .toUpperCase();


    if (!enteredId) {

        showParentMessage(
            "Please enter a Journey ID.",
            "error"
        );

        return;

    }


    if (
        !isValidJourneyId(
            enteredId
        )
    ) {

        showParentMessage(
            "Invalid Journey ID format.",
            "error"
        );

        return;

    }


    connectedParentJourneyId =
        enteredId;


    if (childJourneyId) {

        childJourneyId.textContent =
            enteredId;

    }


    if (connectedJourneyTitle) {

        connectedJourneyTitle.textContent =
            "Journey Connected";

    }


    if (childName) {

        childName.textContent =
            "Journey User";

    }


    if (childConnectionStatus) {

        childConnectionStatus.textContent =
            "Connected";

        childConnectionStatus.classList.remove(
            "offline"
        );

        childConnectionStatus.classList.add(
            "online"
        );

    }


    if (
        journeyActive &&
        journeyId === enteredId
    ) {

        if (parentLocation) {

            parentLocation.textContent =
                "This device's journey";

        }

    } else {

        if (parentLocation) {

            parentLocation.textContent =
                "Waiting for live location";

        }

    }


    showParentMessage(
        "Journey connected successfully.",
        "success"
    );


    showToast(
        "Parent connection established.",
        "✓"
    );

}


/* ============================================================
   JOURNEY ID VALIDATION
   ============================================================ */

function isValidJourneyId(
    id
) {

    return /^SJ-[A-Z0-9]{5}-[A-Z0-9]{5}$/
        .test(id);

}


/* ============================================================
   PARENT MESSAGE
   ============================================================ */

function showParentMessage(
    message,
    type = ""
) {

    if (!parentMessage) {
        return;
    }


    parentMessage.textContent =
        message;


    parentMessage.className =
        "parent-message";


    if (type) {

        parentMessage.classList.add(
            type
        );

    }

}


/* ============================================================
   ONLINE / OFFLINE
   ============================================================ */

function setupConnectionStatus() {

    updateConnectionStatus();


    window.addEventListener(
        "online",
        updateConnectionStatus
    );


    window.addEventListener(
        "offline",
        updateConnectionStatus
    );

}


function updateConnectionStatus() {

    if (!connectionPill) {
        return;
    }


    if (
        navigator.onLine
    ) {

        connectionPill.classList.add(
            "online"
        );


        connectionPill.classList.remove(
            "offline"
        );


        if (connectionText) {

            connectionText.textContent =
                "Online";

        }

    } else {

        connectionPill.classList.add(
            "offline"
        );


        connectionPill.classList.remove(
            "online"
        );


        if (connectionText) {

            connectionText.textContent =
                "Offline";

        }

    }

}


/* ============================================================
   LOCATION ERROR
   ============================================================ */

function handleLocationError(
    error
) {

    let message =
        "Unable to access your location.";


    if (!error) {

        showToast(
            message,
            "!"
        );

        return;

    }


    switch (
        error.code
    ) {

        case 1:

            message =
                "Location permission was denied. Please allow location access in your browser.";

            break;


        case 2:

            message =
                "Your location is currently unavailable. Please turn on GPS/location services.";

            break;


        case 3:

            message =
                "GPS request timed out. Please try again.";

            break;


        default:

            message =
                "Could not get your current location.";

            break;

    }


    showToast(
        message,
        "!"
    );

}


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function saveJourneyState() {

    try {

        const state = {

            journeyActive:
                journeyActive,

            journeyId:
                journeyId,

            journeyStartTime:
                journeyStartTime,

            lastLocationTime:
                lastLocationTime

        };


        if (
            currentPosition &&
            currentPosition.coords
        ) {

            state.location = {

                latitude:
                    currentPosition.coords.latitude,

                longitude:
                    currentPosition.coords.longitude,

                accuracy:
                    currentPosition.coords.accuracy

            };

        }


        localStorage.setItem(
            "safeJourneyState",
            JSON.stringify(
                state
            )
        );


    } catch (error) {

        console.warn(
            "Could not save journey state:",
            error
        );

    }

}


/* ============================================================
   RESTORE STATE
   ============================================================ */

function restoreJourneyState() {

    try {

        const raw =
            localStorage.getItem(
                "safeJourneyState"
            );


        if (!raw) {
            return;
        }


        const state =
            JSON.parse(
                raw
            );


        if (
            state.journeyId
        ) {

            journeyId =
                state.journeyId;

        }


        if (
            state.journeyStartTime
        ) {

            journeyStartTime =
                state.journeyStartTime;

        }


        if (
            state.location &&
            Number.isFinite(
                Number(state.location.latitude)
            ) &&
            Number.isFinite(
                Number(state.location.longitude)
            )
        ) {

            currentPosition = {
                coords: {
                    latitude:
                        Number(
                            state.location.latitude
                        ),
                    longitude:
                        Number(
                            state.location.longitude
                        ),
                    accuracy:
                        Number(
                            state.location.accuracy
                        ) || 20
                }
            };

        }


        if (
            state.journeyActive &&
            state.journeyId &&
            state.journeyStartTime
        ) {

            journeyActive = true;
            lastLocationTime =
                state.lastLocationTime ||
                state.journeyStartTime;

            if (journeyIdElement) {

                journeyIdElement.textContent =
                    state.journeyId;

            }


            if (journeyStatusBadge) {

                journeyStatusBadge.innerHTML =
                    "<span></span> Active";

                journeyStatusBadge.classList.add(
                    "active"
                );

            }

        }

    } catch (error) {

        console.warn(
            "Could not restore journey state:",
            error
        );

    }

}


/* ============================================================
   READY TIME
   ============================================================ */

function updateReadyTime() {

    if (readyTime) {

        readyTime.textContent =
            `Ready • ${formatTime(new Date())}`;

    }

}


/* ============================================================
   TOAST
   ============================================================ */

function showToast(
    message,
    icon = "✓"
) {

    if (!toast) {
        console.log(
            message
        );
        return;
    }


    if (toastMessage) {

        toastMessage.textContent =
            message;

    }


    if (toastIcon) {

        toastIcon.textContent =
            icon;

    }


    toast.classList.add(
        "show"
    );


    if (toastTimer) {

        clearTimeout(
            toastTimer
        );

    }


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3500
        );

}


/* ============================================================
   FORMAT DISTANCE
   ============================================================ */

function formatDistance(
    meters
) {

    if (
        meters === null ||
        meters === undefined ||
        !Number.isFinite(
            Number(meters)
        )
    ) {

        return "--";

    }


    meters =
        Number(meters);


    if (
        meters < 1000
    ) {

        return (
            `${Math.round(meters)} m`
        );

    }


    return (
        `${(
            meters / 1000
        ).toFixed(2)} km`
    );

}


/* ============================================================
   FORMAT DURATION
   ============================================================ */

function formatDuration(
    milliseconds
) {

    let totalSeconds =
        Math.floor(
            milliseconds / 1000
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    totalSeconds %=
        3600;


    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    return [

        String(hours)
            .padStart(2, "0"),

        String(minutes)
            .padStart(2, "0"),

        String(seconds)
            .padStart(2, "0")

    ].join(":");

}


/* ============================================================
   FORMAT TIME
   ============================================================ */

function formatTime(
    date
) {

    if (
        !(date instanceof Date)
    ) {

        date =
            new Date(
                date
            );

    }


    return date.toLocaleTimeString(
        [],
        {

            hour:
                "2-digit",

            minute:
                "2-digit",

            second:
                "2-digit"

        }
    );

}


/* ============================================================
   BEFORE UNLOAD
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        saveJourneyState();

    }
);

window.addEventListener(
    "pagehide",
    () => {

        saveJourneyState();

    }
);


/* ============================================================
   VISIBILITY CHANGE
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            journeyActive &&
            !document.hidden
        ) {

            startJourneyTimer();

            if (currentPosition) {

                updateLocation(
                    currentPosition
                );

            }

            startWatchingLocation();

        }

        if (
            !document.hidden &&
            map
        ) {

            setTimeout(
                () => {

                    map.invalidateSize(
                        true
                    );


                    /*
                     * If we already have a real GPS
                     * location, don't lose the marker.
                     */

                    if (
                        currentPosition &&
                        mapHasRealLocation
                    ) {

                        updateMapMarker(
                            currentPosition.coords.latitude,
                            currentPosition.coords.longitude,
                            currentPosition.coords.accuracy
                        );

                    }

                },
                250
            );

        }

    }
);


/* ============================================================
   NETWORK CHANGE
   ============================================================ */

window.addEventListener(
    "online",
    () => {

        if (map) {

            setTimeout(
                () => {

                    map.invalidateSize(
                        true
                    );

                },
                500
            );

        }

    }
);


/* ============================================================
   GLOBAL DEBUG OBJECT
   ============================================================ */

window.SafeJourney = {

    getJourneyId:
        () => journeyId,

    isActive:
        () => journeyActive,

    getCurrentPosition:
        () => currentPosition,

    getMap:
        () => map,

    start:
        startJourney,

    stop:
        stopJourney,

    centerLocation:
        centerCurrentLocation

};


/* ============================================================
   FINAL LOG
   ============================================================ */

console.log(
    "🛡️ SafeJourney JS loaded successfully."
);