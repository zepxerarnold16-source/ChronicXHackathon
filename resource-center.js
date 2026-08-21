/* ============================================================
   CHRONICAI RESOURCE CENTER
   ============================================================

   Architecture:

       Browser
          |
          | GET /api/resources
          v
       ChronicAI Render Server
          |
          | server-side request
          v
       Overpass / OpenStreetMap

   IMPORTANT:
   Never fetch Overpass directly from the browser.
   This avoids browser CORS problems.

============================================================ */

(() => {
    "use strict";

    /* =========================================================
       CONFIGURATION
    ========================================================= */

    const CONFIG = {
        DEFAULT_RADIUS_KM: 5,

        MAX_RADIUS_KM: 50,

        RESOURCE_ENDPOINT: "/api/resources",

        REQUEST_TIMEOUT_MS: 30000,

        LOCATION_TIMEOUT_MS: 15000,

        LOCATION_MAX_AGE_MS: 30000,

        DEFAULT_ZOOM: 13,

        RESOURCE_ZOOM: 14,

        MAX_RESOURCES_DISPLAYED: 300,

        ENABLE_BROWSER_FALLBACK: true
    };


    /* =========================================================
       GLOBAL STATE
    ========================================================= */

    let map = null;

    let userMarker = null;

    let userAccuracyCircle = null;

    let resourceMarkers = [];

    let resourcesData = [];

    let filteredResources = [];

    let currentPosition = null;

    let currentFilter = "all";

    let currentDistanceKm =
        CONFIG.DEFAULT_RADIUS_KM;

    let resourceRequestId = 0;

    let isLoadingResources = false;

    let pollutionEnabled = false;

    let pollutionRangeKm = 1;

    let pollutionLayers = [];


    /* =========================================================
       DOM HELPERS
    ========================================================= */

    function $(id) {
        return document.getElementById(id);
    }


    function safeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value);
    }


    function escapeHtml(value) {
        return safeText(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       DOM REFERENCES
    ========================================================= */

    const locateBtn =
        $("locateBtn");

    const refreshBtn =
        $("refreshBtn");

    const centerMapBtn =
        $("centerMapBtn");

    const resourceMap =
        $("resourceMap");

    const resourceList =
        $("resourceList");

    const resourceCount =
        $("resourceCount");

    const locationStatus =
        $("locationStatus");

    const mapStatus =
        $("mapStatus");

    const distanceFilter =
        $("distanceFilter");

    const filterButtons =
        document.querySelectorAll(
            ".filter-btn"
        );

    const pollutionTrackerBtn =
        $("pollutionTrackerBtn");

    const pollutionMapLegend =
        $("pollutionMapLegend");

    const pollutionRangeButtons =
        document.querySelectorAll(
            ".pollution-range-btn"
        );


    /* =========================================================
       INITIALIZATION
    ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );


    function initialize() {

        console.log(
            "[ChronicAI] Resource Center initializing..."
        );

        initializeMap();

        attachEventListeners();

        updateResourceCount(0);

        setMapStatus("Ready");

        console.log(
            "[ChronicAI] Resource Center initialized."
        );
    }


    /* =========================================================
       MAP
    ========================================================= */

    function initializeMap() {

        if (!resourceMap) {
            console.error(
                "[ChronicAI] #resourceMap not found."
            );

            return;
        }

        if (
            typeof L === "undefined"
        ) {
            console.error(
                "[ChronicAI] Leaflet is not loaded."
            );

            setMapStatus(
                "Map unavailable"
            );

            return;
        }

        map = L.map(
            resourceMap,
            {
                zoomControl: true
            }
        ).setView(
            [20.5937, 78.9629],
            5
        );


        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,

                attribution:
                    '&copy; OpenStreetMap contributors'
            }
        ).addTo(map);


        setMapStatus("Ready");

        setTimeout(() => {

            try {
                map.invalidateSize();
            } catch (error) {
                console.warn(
                    "[ChronicAI] Map resize failed:",
                    error
                );
            }

        }, 300);
    }


    /* =========================================================
       EVENT LISTENERS
    ========================================================= */

    function attachEventListeners() {

        if (locateBtn) {

            locateBtn.addEventListener(
                "click",
                handleLocate
            );
        }


        if (refreshBtn) {

            refreshBtn.addEventListener(
                "click",
                () => {

                    if (!currentPosition) {

                        handleLocate();

                        return;
                    }

                    loadNearbyResources(
                        currentPosition.lat,
                        currentPosition.lng
                    );
                }
            );
        }


        if (centerMapBtn) {

            centerMapBtn.addEventListener(
                "click",
                centerOnUser
            );
        }


        if (distanceFilter) {

            distanceFilter.addEventListener(
                "change",
                () => {

                    currentDistanceKm =
                        Number(
                            distanceFilter.value
                        ) ||
                        CONFIG.DEFAULT_RADIUS_KM;

                    if (currentPosition) {

                        loadNearbyResources(
                            currentPosition.lat,
                            currentPosition.lng
                        );
                    }
                }
            );
        }


        filterButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        filterButtons.forEach(
                            btn =>
                                btn.classList.remove(
                                    "active"
                                )
                        );

                        button.classList.add(
                            "active"
                        );

                        currentFilter =
                            button.dataset.type ||
                            "all";

                        renderResources();
                    }
                );
            }
        );


        if (pollutionTrackerBtn) {

            pollutionTrackerBtn.addEventListener(
                "click",
                togglePollutionTracker
            );
        }


        pollutionRangeButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        pollutionRangeButtons.forEach(
                            btn =>
                                btn.classList.remove(
                                    "active"
                                )
                        );

                        button.classList.add(
                            "active"
                        );

                        pollutionRangeKm =
                            Number(
                                button.dataset.range
                            ) || 1;

                        if (
                            pollutionEnabled &&
                            currentPosition
                        ) {

                            drawPollutionZones();
                        }
                    }
                );
            }
        );
    }


    /* =========================================================
       LOCATION
    ========================================================= */

    function handleLocate() {

        if (
            !navigator.geolocation
        ) {

            showLocationStatus(
                "Geolocation is not supported by this browser.",
                "error"
            );

            return;
        }


        if (locateBtn) {

            locateBtn.disabled = true;

            locateBtn.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
        }


        showLocationStatus(
            "Requesting your location...",
            "loading"
        );


        navigator.geolocation.getCurrentPosition(

            position => {

                if (locateBtn) {

                    locateBtn.disabled = false;

                    locateBtn.innerHTML =
                        '<i class="fa-solid fa-location-crosshairs"></i> Use My Location';
                }


                const lat =
                    Number(
                        position.coords.latitude
                    );

                const lng =
                    Number(
                        position.coords.longitude
                    );


                if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lng)
                ) {

                    showLocationStatus(
                        "Invalid location received.",
                        "error"
                    );

                    return;
                }


                currentPosition = {
                    lat,
                    lng,

                    accuracy:
                        Number(
                            position.coords.accuracy
                        ) || 0
                };


                console.log(
                    "[ChronicAI] Location:",
                    currentPosition
                );


                updateUserLocationOnMap();

                centerOnUser();

                showLocationStatus(
                    `Location found: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                    "success"
                );


                loadNearbyResources(
                    lat,
                    lng
                );
            },


            error => {

                if (locateBtn) {

                    locateBtn.disabled = false;

                    locateBtn.innerHTML =
                        '<i class="fa-solid fa-location-crosshairs"></i> Use My Location';
                }


                console.error(
                    "[ChronicAI] Geolocation error:",
                    error
                );


                let message =
                    "Unable to get your location.";

                switch (error.code) {

                    case error.PERMISSION_DENIED:

                        message =
                            "Location permission was denied. Please allow location access.";

                        break;


                    case error.POSITION_UNAVAILABLE:

                        message =
                            "Your location is currently unavailable.";

                        break;


                    case error.TIMEOUT:

                        message =
                            "Location request timed out. Please try again.";

                        break;
                }


                showLocationStatus(
                    message,
                    "error"
                );
            },


            {
                enableHighAccuracy: true,

                timeout:
                    CONFIG.LOCATION_TIMEOUT_MS,

                maximumAge:
                    CONFIG.LOCATION_MAX_AGE_MS
            }
        );
    }


    /* =========================================================
       UPDATE USER LOCATION ON MAP
    ========================================================= */

    function updateUserLocationOnMap() {

        if (
            !map ||
            !currentPosition
        ) {
            return;
        }


        const {
            lat,
            lng,
            accuracy
        } = currentPosition;


        if (userMarker) {

            userMarker.setLatLng(
                [lat, lng]
            );

        } else {

            userMarker =
                L.marker(
                    [lat, lng]
                )
                .addTo(map)
                .bindPopup(
                    "<strong>Your Location</strong>"
                );
        }


        if (userAccuracyCircle) {

            userAccuracyCircle.setLatLng(
                [lat, lng]
            );

            userAccuracyCircle.setRadius(
                accuracy || 50
            );

        } else {

            userAccuracyCircle =
                L.circle(
                    [lat, lng],
                    {
                        radius:
                            accuracy || 50,

                        color: "#38bdf8",

                        fillColor: "#38bdf8",

                        fillOpacity: 0.12,

                        weight: 1
                    }
                ).addTo(map);
        }
    }


    /* =========================================================
       CENTER MAP
    ========================================================= */

    function centerOnUser() {

        if (
            !map ||
            !currentPosition
        ) {

            showLocationStatus(
                "Get your location first.",
                "error"
            );

            return;
        }


        map.setView(
            [
                currentPosition.lat,
                currentPosition.lng
            ],
            CONFIG.RESOURCE_ZOOM,
            {
                animate: true
            }
        );
    }


    /* =========================================================
       LOAD NEARBY RESOURCES
    ========================================================= */

    async function loadNearbyResources(
        lat,
        lng
    ) {

        /*
         * IMPORTANT:
         * request ID prevents an old request from
         * overwriting a newer request.
         */

        const requestId =
            ++resourceRequestId;


        if (isLoadingResources) {

            console.log(
                "[ChronicAI] A resource request is already running."
            );
        }


        isLoadingResources = true;


        setMapStatus(
            "Searching..."
        );


        setResourceLoadingState();


        try {

            const radiusKm =
                Math.min(
                    Math.max(
                        Number(
                            currentDistanceKm
                        ) || 5,
                        1
                    ),
                    CONFIG.MAX_RADIUS_KM
                );


            console.log(
                "[ChronicAI] Resource search:",
                {
                    lat,
                    lng,
                    radiusKm,
                    requestId
                }
            );


            const resources =
                await fetchResourcesFromBackend(
                    lat,
                    lng,
                    radiusKm
                );


            /*
             * Ignore an old response.
             */

            if (
                requestId !==
                resourceRequestId
            ) {

                console.log(
                    "[ChronicAI] Ignoring stale resource response."
                );

                return;
            }


            resourcesData =
                normalizeResources(
                    resources,
                    lat,
                    lng
                );


            console.log(
                `[ChronicAI] ${resourcesData.length} resources loaded.`
            );


            filteredResources =
                resourcesData;


            setMapStatus(
                resourcesData.length
                    ? "Resources found"
                    : "No resources found"
            );


            renderResources();

            renderResourceMarkers();


            /*
             * Also update air quality if the existing
             * air-quality system exists.
             */

            try {

                if (
                    typeof window.updateAirQualityForLocation ===
                    "function"
                ) {

                    window.updateAirQualityForLocation(
                        lat,
                        lng
                    );
                }

            } catch (airError) {

                console.warn(
                    "[ChronicAI] Air quality update failed:",
                    airError
                );
            }

        } catch (error) {

            /*
             * CRITICAL:
             *
             * Never reference an undeclared resourcesData
             * after a failed request.
             *
             * Always keep it as an array.
             */

            console.error(
                "[ChronicAI] Resource search failed:",
                error
            );


            if (
                requestId !==
                resourceRequestId
            ) {
                return;
            }


            resourcesData = [];

            filteredResources = [];


            setMapStatus(
                "Search unavailable"
            );


            renderResourceError(
                error
            );


            /*
             * Do NOT throw the error again.
             *
             * This prevents:
             *
             * Uncaught (in promise)
             *
             */

            return;

        } finally {

            if (
                requestId ===
                resourceRequestId
            ) {

                isLoadingResources =
                    false;
            }
        }
    }


    /* =========================================================
       BACKEND RESOURCE REQUEST
    ========================================================= */

    async function fetchResourcesFromBackend(
        lat,
        lng,
        radiusKm
    ) {

        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => {
                    controller.abort();
                },
                CONFIG.REQUEST_TIMEOUT_MS
            );


        try {

            const params =
                new URLSearchParams({

                    lat:
                        String(lat),

                    lng:
                        String(lng),

                    radius:
                        String(radiusKm)
                });


            const url =
                `${CONFIG.RESOURCE_ENDPOINT}?${params.toString()}`;


            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache: "no-store",

                        signal:
                            controller.signal
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Resource server HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            /*
             * Accept several common backend formats.
             */

            if (
                Array.isArray(data)
            ) {

                return data;
            }


            if (
                Array.isArray(
                    data.resources
                )
            ) {

                return data.resources;
            }


            if (
                Array.isArray(
                    data.elements
                )
            ) {

                return data.elements;
            }


            throw new Error(
                "Resource server returned an invalid response."
            );

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Resource search timed out."
                );
            }


            throw error;

        } finally {

            clearTimeout(
                timeout
            );
        }
    }


    /* =========================================================
       NORMALIZE RESOURCE DATA
    ========================================================= */

    function normalizeResources(
        input,
        userLat,
        userLng
    ) {

        if (
            !Array.isArray(input)
        ) {

            return [];
        }


        const output = [];


        input.forEach(
            (raw, index) => {

                if (!raw) {
                    return;
                }


                /*
                 * Support backend format.
                 */

                let lat =
                    Number(
                        raw.lat ??
                        raw.latitude ??
                        raw.center?.lat ??
                        raw.geometry?.lat
                    );


                let lng =
                    Number(
                        raw.lng ??
                        raw.lon ??
                        raw.longitude ??
                        raw.center?.lon ??
                        raw.geometry?.lon
                    );


                /*
                 * Support raw Overpass elements.
                 */

                if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lng)
                ) {

                    if (
                        raw.type &&
                        raw.lat !== undefined &&
                        raw.lon !== undefined
                    ) {

                        lat =
                            Number(raw.lat);

                        lng =
                            Number(raw.lon);
                    }
                }


                if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lng)
                ) {

                    return;
                }


                const tags =
                    raw.tags || {};


                const name =
                    raw.name ||
                    tags.name ||
                    tags["official_name"] ||
                    "Unnamed Resource";


                const type =
                    normalizeResourceType(
                        raw.type ||
                        raw.category ||
                        raw.resourceType ||
                        tags.amenity ||
                        tags.emergency ||
                        tags.office ||
                        tags.building ||
                        ""
                    );


                const distance =
                    calculateDistanceKm(
                        userLat,
                        userLng,
                        lat,
                        lng
                    );


                output.push({

                    id:
                        raw.id ??
                        `${type}-${lat}-${lng}-${index}`,

                    name,

                    type,

                    category:
                        type,

                    lat,

                    lng,

                    distance,

                    phone:
                        raw.phone ||
                        tags.phone ||
                        tags["contact:phone"] ||
                        "",

                    address:
                        raw.address ||
                        tags["addr:full"] ||
                        buildAddress(tags),

                    openingHours:
                        raw.openingHours ||
                        tags.opening_hours ||
                        "",

                    website:
                        raw.website ||
                        tags.website ||
                        "",

                    emergency:
                        Boolean(
                            raw.emergency ||
                            tags.emergency === "yes"
                        ),

                    source:
                        raw.source ||
                        "OpenStreetMap"
                });
            }
        );


        /*
         * Remove duplicates.
         */

        const unique =
            new Map();


        output.forEach(
            resource => {

                const key =
                    `${resource.name.toLowerCase()}|` +
                    `${resource.lat.toFixed(5)}|` +
                    `${resource.lng.toFixed(5)}`;


                if (
                    !unique.has(key)
                ) {

                    unique.set(
                        key,
                        resource
                    );
                }
            }
        );


        return Array.from(
            unique.values()
        )
        .sort(
            (a, b) =>
                a.distance -
                b.distance
        )
        .slice(
            0,
            CONFIG.MAX_RESOURCES_DISPLAYED
        );
    }


    /* =========================================================
       RESOURCE TYPE
    ========================================================= */

    function normalizeResourceType(
        value
    ) {

        const type =
            safeText(value)
                .toLowerCase()
                .trim();


        if (
            type.includes("hospital") ||
            type.includes("clinic") ||
            type.includes("doctors") ||
            type.includes("health") ||
            type.includes("pharmacy")
        ) {

            return "hospital";
        }


        if (
            type.includes("police")
        ) {

            return "police";
        }


        if (
            type.includes("fire")
        ) {

            return "fire";
        }


        if (
            type.includes("government") ||
            type.includes("townhall") ||
            type.includes("courthouse") ||
            type.includes("government_office") ||
            type.includes("administrative")
        ) {

            return "government";
        }


        if (
            type.includes("relief") ||
            type.includes("shelter") ||
            type.includes("food_bank") ||
            type.includes("social")
        ) {

            return "relief";
        }


        return "government";
    }


    /* =========================================================
       ADDRESS
    ========================================================= */

    function buildAddress(
        tags
    ) {

        const parts = [

            tags["addr:housenumber"],

            tags["addr:street"],

            tags["addr:suburb"],

            tags["addr:city"],

            tags["addr:postcode"]

        ]
        .filter(Boolean);


        return parts.join(", ");
    }


    /* =========================================================
       DISTANCE
    ========================================================= */

    function calculateDistanceKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {

        const R = 6371;


        const dLat =
            toRadians(
                lat2 - lat1
            );


        const dLon =
            toRadians(
                lon2 - lon1
            );


        const a =
            Math.sin(
                dLat / 2
            ) ** 2 +

            Math.cos(
                toRadians(lat1)
            ) *

            Math.cos(
                toRadians(lat2)
            ) *

            Math.sin(
                dLon / 2
            ) ** 2;


        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );


        return R * c;
    }


    function toRadians(
        degrees
    ) {

        return degrees *
            Math.PI /
            180;
    }


    /* =========================================================
       FILTER RESOURCES
    ========================================================= */

    function getVisibleResources() {

        return resourcesData
            .filter(
                resource => {

                    if (
                        currentFilter !==
                        "all" &&
                        resource.type !==
                        currentFilter
                    ) {

                        return false;
                    }


                    return (
                        resource.distance <=
                        currentDistanceKm
                    );
                }
            )
            .sort(
                (a, b) =>
                    a.distance -
                    b.distance
            );
    }


    /* =========================================================
       RENDER RESOURCE LIST
    ========================================================= */

    function renderResources() {

        if (!resourceList) {
            return;
        }


        filteredResources =
            getVisibleResources();


        updateResourceCount(
            filteredResources.length
        );


        if (
            !filteredResources.length
        ) {

            resourceList.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>

                    <h4>
                        No Resources Found
                    </h4>

                    <p>
                        No resources were found within
                        ${escapeHtml(currentDistanceKm)}
                        km for the selected category.
                    </p>

                    <button
                        type="button"
                        class="primary-resource-btn retry-resource-btn"
                    >
                        <i class="fa-solid fa-rotate"></i>
                        Search Again
                    </button>

                </div>

            `;


            const retry =
                resourceList.querySelector(
                    ".retry-resource-btn"
                );


            if (retry) {

                retry.addEventListener(
                    "click",
                    () => {

                        if (currentPosition) {

                            loadNearbyResources(
                                currentPosition.lat,
                                currentPosition.lng
                            );
                        }
                    }
                );
            }


            return;
        }


        resourceList.innerHTML =
            filteredResources
                .map(
                    renderResourceCard
                )
                .join("");


        attachResourceCardEvents();
    }


    /* =========================================================
       RESOURCE CARD
    ========================================================= */

    function renderResourceCard(
        resource
    ) {

        const icon =
            getResourceIcon(
                resource.type
            );


        const distanceText =
            formatDistance(
                resource.distance
            );


        const phone =
            safeText(
                resource.phone
            );


        const address =
            safeText(
                resource.address
            );


        const mapsUrl =
            createDirectionsUrl(
                resource.lat,
                resource.lng,
                resource.name
            );


        return `

            <article
                class="resource-item"
                data-resource-id="${escapeHtml(resource.id)}"
            >

                <div
                    class="resource-item-icon ${escapeHtml(resource.type)}"
                >
                    <i class="${icon}"></i>
                </div>


                <div class="resource-item-content">

                    <div class="resource-item-top">

                        <h4>
                            ${escapeHtml(resource.name)}
                        </h4>

                        <span class="resource-distance">
                            ${escapeHtml(distanceText)}
                        </span>

                    </div>


                    <span class="resource-type-label">
                        ${escapeHtml(
                            formatResourceType(
                                resource.type
                            )
                        )}
                    </span>


                    ${
                        address
                            ? `
                                <p class="resource-address">
                                    <i class="fa-solid fa-location-dot"></i>
                                    ${escapeHtml(address)}
                                </p>
                              `
                            : ""
                    }


                    <div class="resource-actions">

                        <button
                            type="button"
                            class="resource-action-btn view-resource-btn"
                            data-id="${escapeHtml(resource.id)}"
                        >
                            <i class="fa-solid fa-map-marker-alt"></i>
                            View
                        </button>


                        <a
                            href="${escapeHtml(mapsUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="resource-action-btn"
                        >
                            <i class="fa-solid fa-route"></i>
                            Directions
                        </a>


                        ${
                            phone
                                ? `
                                    <a
                                        href="tel:${escapeHtml(phone)}"
                                        class="resource-action-btn"
                                    >
                                        <i class="fa-solid fa-phone"></i>
                                        Call
                                    </a>
                                  `
                                : ""
                        }

                    </div>

                </div>

            </article>

        `;
    }


    /* =========================================================
       RESOURCE CARD EVENTS
    ========================================================= */

    function attachResourceCardEvents() {

        document
            .querySelectorAll(
                ".view-resource-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const id =
                                button.dataset.id;


                            const resource =
                                resourcesData.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(id)
                                );


                            if (resource) {

                                focusResource(
                                    resource
                                );
                            }
                        }
                    );
                }
            );
    }


    /* =========================================================
       MAP MARKERS
    ========================================================= */

    function renderResourceMarkers() {

        if (!map) {
            return;
        }


        clearResourceMarkers();


        const visible =
            getVisibleResources();


        visible.forEach(
            resource => {

                const marker =
                    L.marker(
                        [
                            resource.lat,
                            resource.lng
                        ]
                    );


                const directions =
                    createDirectionsUrl(
                        resource.lat,
                        resource.lng,
                        resource.name
                    );


                marker.bindPopup(`

                    <div class="resource-popup">

                        <strong>
                            ${escapeHtml(resource.name)}
                        </strong>

                        <div>
                            ${escapeHtml(
                                formatResourceType(
                                    resource.type
                                )
                            )}
                        </div>

                        <div>
                            ${escapeHtml(
                                formatDistance(
                                    resource.distance
                                )
                            )}
                        </div>

                        ${
                            resource.address
                                ? `
                                    <div>
                                        ${escapeHtml(
                                            resource.address
                                        )}
                                    </div>
                                  `
                                : ""
                        }

                        <br>

                        <a
                            href="${escapeHtml(directions)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Get Directions
                        </a>

                    </div>

                `);


                marker.addTo(map);


                resourceMarkers.push(
                    marker
                );
            }
        );
    }


    function clearResourceMarkers() {

        resourceMarkers.forEach(
            marker => {

                try {

                    map.removeLayer(
                        marker
                    );

                } catch (error) {
                    // Ignore already removed markers.
                }
            }
        );


        resourceMarkers = [];
    }


    /* =========================================================
       FOCUS RESOURCE
    ========================================================= */

    function focusResource(
        resource
    ) {

        if (!map) {
            return;
        }


        map.setView(
            [
                resource.lat,
                resource.lng
            ],
            16,
            {
                animate: true
            }
        );


        const marker =
            resourceMarkers.find(
                item => {

                    const pos =
                        item.getLatLng();


                    return (
                        Math.abs(
                            pos.lat -
                            resource.lat
                        ) < 0.00001 &&

                        Math.abs(
                            pos.lng -
                            resource.lng
                        ) < 0.00001
                    );
                }
            );


        if (marker) {

            marker.openPopup();
        }
    }


    /* =========================================================
       ICONS
    ========================================================= */

    function getResourceIcon(
        type
    ) {

        switch (type) {

            case "hospital":

                return "fa-solid fa-hospital";

            case "police":

                return "fa-solid fa-shield-halved";

            case "fire":

                return "fa-solid fa-fire-extinguisher";

            case "relief":

                return "fa-solid fa-hand-holding-heart";

            case "government":

            default:

                return "fa-solid fa-building-columns";
        }
    }


    function formatResourceType(
        type
    ) {

        switch (type) {

            case "hospital":
                return "Hospital / Health";

            case "police":
                return "Police Station";

            case "fire":
                return "Fire Station";

            case "relief":
                return "Relief / Shelter";

            case "government":
                return "Government Office";

            default:
                return "Public Resource";
        }
    }


    /* =========================================================
       DIRECTIONS
    ========================================================= */

    function createDirectionsUrl(
        lat,
        lng,
        name
    ) {

        return (
            "https://www.google.com/maps/dir/?api=1" +
            `&destination=${encodeURIComponent(
                `${lat},${lng}`
            )}` +
            `&destination_place_id=` +
            encodeURIComponent(
                name || ""
            )
        );
    }


    /* =========================================================
       FORMAT DISTANCE
    ========================================================= */

    function formatDistance(
        km
    ) {

        if (
            !Number.isFinite(km)
        ) {

            return "Distance unknown";
        }


        if (km < 1) {

            return `${Math.round(
                km * 1000
            )} m`;
        }


        return `${km.toFixed(1)} km`;
    }


    /* =========================================================
       LOADING STATE
    ========================================================= */

    function setResourceLoadingState() {

        if (!resourceList) {
            return;
        }


        resourceList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">

                    <i class="fa-solid fa-spinner fa-spin"></i>

                </div>

                <h4>
                    Finding Nearby Resources
                </h4>

                <p>
                    Searching hospitals, police stations,
                    fire stations and public services...
                </p>

            </div>

        `;


        updateResourceCount(0);
    }


    /* =========================================================
       ERROR STATE
    ========================================================= */

    function renderResourceError(
        error
    ) {

        if (!resourceList) {
            return;
        }


        const message =
            error?.message ||
            "Unable to load nearby resources.";


        resourceList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">

                    <i class="fa-solid fa-triangle-exclamation"></i>

                </div>

                <h4>
                    Resource Search Unavailable
                </h4>

                <p>
                    ${escapeHtml(message)}
                </p>

                <p>
                    Please try again in a moment.
                </p>

                <button
                    type="button"
                    id="resourceRetryBtn"
                    class="primary-resource-btn"
                >

                    <i class="fa-solid fa-rotate"></i>

                    Retry Search

                </button>

            </div>

        `;


        updateResourceCount(0);


        const retry =
            $("resourceRetryBtn");


        if (retry) {

            retry.addEventListener(
                "click",
                () => {

                    if (currentPosition) {

                        loadNearbyResources(
                            currentPosition.lat,
                            currentPosition.lng
                        );
                    }
                }
            );
        }
    }


    /* =========================================================
       RESOURCE COUNT
    ========================================================= */

    function updateResourceCount(
        count
    ) {

        if (resourceCount) {

            resourceCount.textContent =
                String(count);
        }
    }


    /* =========================================================
       MAP STATUS
    ========================================================= */

    function setMapStatus(
        text
    ) {

        if (mapStatus) {

            mapStatus.textContent =
                text;
        }
    }


    /* =========================================================
       LOCATION STATUS
    ========================================================= */

    function showLocationStatus(
        text,
        type = ""
    ) {

        if (!locationStatus) {
            return;
        }


        locationStatus.className =
            "location-status";


        if (type) {

            locationStatus.classList.add(
                type
            );
        }


        locationStatus.innerHTML = `

            <i class="fa-solid ${
                type === "error"
                    ? "fa-triangle-exclamation"
                    : type === "success"
                        ? "fa-circle-check"
                        : "fa-location-dot"
            }"></i>

            ${escapeHtml(text)}

        `;
    }


    /* =========================================================
       POLLUTION TRACKER
    ========================================================= */

    function togglePollutionTracker() {

        pollutionEnabled =
            !pollutionEnabled;


        if (pollutionTrackerBtn) {

            pollutionTrackerBtn.setAttribute(
                "aria-pressed",
                String(
                    pollutionEnabled
                )
            );


            pollutionTrackerBtn.classList.toggle(
                "active",
                pollutionEnabled
            );
        }


        if (pollutionMapLegend) {

            pollutionMapLegend.classList.toggle(
                "visible",
                pollutionEnabled
            );
        }


        if (pollutionEnabled) {

            drawPollutionZones();

        } else {

            clearPollutionZones();
        }
    }


    /* =========================================================
       POLLUTION ZONES
    ========================================================= */

    function drawPollutionZones() {

        if (
            !map ||
            !currentPosition
        ) {

            return;
        }


        clearPollutionZones();


        const center =
            [
                currentPosition.lat,
                currentPosition.lng
            ];


        /*
         * These are visualization zones, not sensor
         * measurements.
         *
         * Keep them clearly labeled as modeled.
         */

        const zones =
            [
                {
                    radius:
                        pollutionRangeKm *
                        1000 *
                        0.35,

                    className:
                        "low"
                },

                {
                    radius:
                        pollutionRangeKm *
                        1000 *
                        0.68,

                    className:
                        "moderate"
                },

                {
                    radius:
                        pollutionRangeKm *
                        1000,

                    className:
                        "high"
                }
            ];


        zones.forEach(
            zone => {

                const circle =
                    L.circle(
                        center,
                        {
                            radius:
                                zone.radius,

                            color:
                                pollutionColor(
                                    zone.className
                                ),

                            fillColor:
                                pollutionColor(
                                    zone.className
                                ),

                            fillOpacity:
                                0.08,

                            weight: 1
                        }
                    )
                    .addTo(map);


                pollutionLayers.push(
                    circle
                );
            }
        );
    }


    function pollutionColor(
        level
    ) {

        switch (level) {

            case "low":
                return "#22c55e";

            case "moderate":
                return "#eab308";

            case "high":
                return "#ef4444";

            default:
                return "#94a3b8";
        }
    }


    function clearPollutionZones() {

        pollutionLayers.forEach(
            layer => {

                try {

                    map.removeLayer(
                        layer
                    );

                } catch (error) {
                    // Ignore.
                }
            }
        );


        pollutionLayers = [];
    }


    /* =========================================================
       PUBLIC API
    ========================================================= */

    window.ChronicAIResourceCenter = {

        loadNearbyResources,

        getResources: () =>
            [...resourcesData],

        getCurrentPosition: () =>
            currentPosition
                ? {
                    ...currentPosition
                }
                : null,

        refresh: () => {

            if (
                currentPosition
            ) {

                loadNearbyResources(
                    currentPosition.lat,
                    currentPosition.lng
                );
            }
        },

        clear: () => {

            resourcesData = [];

            filteredResources = [];

            clearResourceMarkers();

            updateResourceCount(0);

            renderResources();
        }
    };


    /* =========================================================
       DEBUG INFORMATION
    ========================================================= */

    console.log(
        "[ChronicAI] Resource Center ready."
    );

})();
