/* ============================================================
   CHRONICAI RESOURCE CENTER
   ============================================================

   Architecture:

   Browser
      ↓
   /api/resources
      ↓
   Render backend
      ↓
   Overpass API

   IMPORTANT:
   Do NOT call Overpass directly from this browser file.
   ============================================================ */

(() => {
    "use strict";

    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const CONFIG = {
        DEFAULT_RADIUS_KM: 5,
        MAX_RADIUS_KM: 50,

        RESOURCE_ENDPOINTS: [
            "/api/resources",
            "/api/nearby-resources",
            "/api/overpass/resources"
        ],

        LOCATION_TIMEOUT: 15000,
        LOCATION_MAX_AGE: 30000,

        MAP_DEFAULT_ZOOM: 13,

        SEARCH_DEBOUNCE_MS: 350,

        ENABLE_CONSOLE_LOGS: true
    };


    /* ============================================================
       GLOBAL STATE
       ============================================================ */

    let map = null;
    let userMarker = null;

    let resourceMarkers = [];
    let pollutionLayers = [];

    let currentLocation = null;

    let currentResourceType = "all";
    let currentDistanceKm = CONFIG.DEFAULT_RADIUS_KM;

    let resourcesData = [];

    let resourceRequestId = 0;

    let locationRequestId = 0;

    let pollutionEnabled = false;
    let pollutionRangeKm = 1;

    let lastAirQualityLocation = null;

    let locationWatchId = null;

    let isLoadingResources = false;


    /* ============================================================
       DOM HELPERS
       ============================================================ */

    const $ = (id) => document.getElementById(id);

    function qs(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function qsa(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }


    /* ============================================================
       LOGGING
       ============================================================ */

    function log(...args) {
        if (CONFIG.ENABLE_CONSOLE_LOGS) {
            console.log("[ChronicAI]", ...args);
        }
    }

    function warn(...args) {
        console.warn("[ChronicAI]", ...args);
    }

    function error(...args) {
        console.error("[ChronicAI]", ...args);
    }


    /* ============================================================
       SAFE HTML
       ============================================================ */

    function escapeHTML(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ============================================================
       INITIALIZATION
       ============================================================ */

    document.addEventListener("DOMContentLoaded", () => {
        initializeResourceCenter();
    });


    function initializeResourceCenter() {
        log("Initializing Resource Center...");

        initializeMap();
        bindEvents();
        initializeUI();

        log("Resource Center initialized.");
    }


    /* ============================================================
       MAP
       ============================================================ */

    function initializeMap() {
        const mapElement = $("resourceMap");

        if (!mapElement) {
            warn("resourceMap element not found.");
            return;
        }

        if (typeof L === "undefined") {
            error("Leaflet is not loaded.");
            return;
        }

        try {
            map = L.map("resourceMap", {
                zoomControl: true,
                attributionControl: true
            }).setView(
                [22.5726, 88.3639],
                CONFIG.MAP_DEFAULT_ZOOM
            );

            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution: "&copy; OpenStreetMap contributors"
                }
            ).addTo(map);

            setMapStatus("Ready");

        } catch (err) {
            error("Map initialization failed:", err);
        }
    }


    /* ============================================================
       EVENTS
       ============================================================ */

    function bindEvents() {

        const locateBtn = $("locateBtn");

        if (locateBtn) {
            locateBtn.addEventListener(
                "click",
                requestUserLocation
            );
        }


        const refreshBtn = $("refreshBtn");

        if (refreshBtn) {
            refreshBtn.addEventListener(
                "click",
                () => {
                    if (!currentLocation) {
                        requestUserLocation();
                        return;
                    }

                    loadNearbyResources();
                }
            );
        }


        const centerBtn = $("centerMapBtn");

        if (centerBtn) {
            centerBtn.addEventListener(
                "click",
                centerMapOnUser
            );
        }


        qsa(".filter-btn").forEach((button) => {

            button.addEventListener("click", () => {

                qsa(".filter-btn").forEach((btn) => {
                    btn.classList.remove("active");
                });

                button.classList.add("active");

                currentResourceType =
                    button.dataset.type || "all";

                renderResourceList();
                renderResourceMarkers();
            });
        });


        const distanceFilter = $("distanceFilter");

        if (distanceFilter) {

            distanceFilter.addEventListener(
                "change",
                () => {

                    const value =
                        Number(distanceFilter.value);

                    if (
                        Number.isFinite(value) &&
                        value > 0
                    ) {
                        currentDistanceKm = value;
                    }

                    if (currentLocation) {
                        loadNearbyResources();
                    }
                }
            );
        }


        const pollutionBtn =
            $("pollutionTrackerBtn");

        if (pollutionBtn) {

            pollutionBtn.addEventListener(
                "click",
                togglePollutionTracker
            );
        }


        qsa(".pollution-range-btn").forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const range =
                            Number(button.dataset.range);

                        if (!Number.isFinite(range)) {
                            return;
                        }

                        pollutionRangeKm = range;

                        qsa(
                            ".pollution-range-btn"
                        ).forEach((btn) => {
                            btn.classList.remove(
                                "active"
                            );
                        });

                        button.classList.add("active");

                        if (
                            pollutionEnabled &&
                            currentLocation
                        ) {
                            renderPollutionZones();
                        }
                    }
                );
            }
        );


        const airRefresh =
            $("refreshAirQuality");

        if (airRefresh) {

            airRefresh.addEventListener(
                "click",
                () => {

                    if (currentLocation) {
                        loadAirQuality(
                            currentLocation.lat,
                            currentLocation.lon
                        );
                    } else {
                        requestUserLocation();
                    }
                }
            );
        }


        const pollutionSearchBtn =
            $("pollutionPlaceSearchBtn");

        if (pollutionSearchBtn) {

            pollutionSearchBtn.addEventListener(
                "click",
                searchPollutionLocation
            );
        }


        const pollutionInput =
            $("pollutionPlaceInput");

        if (pollutionInput) {

            pollutionInput.addEventListener(
                "keydown",
                (event) => {

                    if (event.key === "Enter") {
                        event.preventDefault();
                        searchPollutionLocation();
                    }
                }
            );
        }
    }


    /* ============================================================
       UI INITIALIZATION
       ============================================================ */

    function initializeUI() {

        setLocationStatus(
            "Waiting for your location..."
        );

        setMapStatus("Ready");

        updateResourceCount(0);

        setAirQualityWaiting();
    }


    /* ============================================================
       LOCATION
       ============================================================ */

    function requestUserLocation() {

        if (!navigator.geolocation) {

            setLocationStatus(
                "Geolocation is not supported by this browser."
            );

            return;
        }


        const locateBtn = $("locateBtn");

        if (locateBtn) {
            locateBtn.disabled = true;

            locateBtn.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
        }


        const requestId = ++locationRequestId;


        setLocationStatus(
            "Requesting your location..."
        );


        navigator.geolocation.getCurrentPosition(
            async (position) => {

                if (requestId !== locationRequestId) {
                    return;
                }


                const latitude =
                    Number(position.coords.latitude);

                const longitude =
                    Number(position.coords.longitude);


                if (
                    !Number.isFinite(latitude) ||
                    !Number.isFinite(longitude)
                ) {

                    handleLocationError(
                        new Error("Invalid coordinates")
                    );

                    return;
                }


                currentLocation = {
                    lat: latitude,
                    lon: longitude,
                    accuracy:
                        Number(position.coords.accuracy) || null
                };


                log(
                    "Location obtained:",
                    currentLocation
                );


                updateUserMarker();

                setLocationStatus(
                    `Location found (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
                );


                if (map) {

                    map.setView(
                        [latitude, longitude],
                        Math.max(
                            map.getZoom(),
                            13
                        )
                    );
                }


                try {

                    await loadNearbyResources();

                } catch (err) {

                    error(
                        "Resource loading failed:",
                        err
                    );

                } finally {

                    try {
                        await loadAirQuality(
                            latitude,
                            longitude
                        );
                    } catch (err) {
                        warn(
                            "Air quality loading failed:",
                            err
                        );
                    }

                    restoreLocateButton();
                }
            },


            (geoError) => {

                if (requestId !== locationRequestId) {
                    return;
                }

                handleLocationError(geoError);
                restoreLocateButton();
            },


            {
                enableHighAccuracy: true,
                timeout: CONFIG.LOCATION_TIMEOUT,
                maximumAge: CONFIG.LOCATION_MAX_AGE
            }
        );
    }


    function handleLocationError(geoError) {

        let message =
            "Unable to determine your location.";

        if (geoError) {

            switch (geoError.code) {

                case 1:
                    message =
                        "Location permission was denied.";
                    break;

                case 2:
                    message =
                        "Your location could not be determined.";
                    break;

                case 3:
                    message =
                        "Location request timed out.";
                    break;
            }
        }


        setLocationStatus(message);

        setMapStatus("Location unavailable");

        warn("Geolocation error:", geoError);
    }


    function restoreLocateButton() {

        const locateBtn = $("locateBtn");

        if (!locateBtn) {
            return;
        }

        locateBtn.disabled = false;

        locateBtn.innerHTML =
            '<i class="fa-solid fa-location-crosshairs"></i> Use My Location';
    }


    /* ============================================================
       USER MARKER
       ============================================================ */

    function updateUserMarker() {

        if (!map || !currentLocation) {
            return;
        }


        const {
            lat,
            lon
        } = currentLocation;


        if (userMarker) {

            userMarker.setLatLng([
                lat,
                lon
            ]);

        } else {

            userMarker = L.marker(
                [lat, lon]
            )
                .addTo(map)
                .bindPopup(
                    "<strong>Your Location</strong>"
                );
        }
    }


    function centerMapOnUser() {

        if (!currentLocation) {
            requestUserLocation();
            return;
        }

        if (!map) {
            return;
        }

        map.setView(
            [
                currentLocation.lat,
                currentLocation.lon
            ],
            Math.max(
                map.getZoom(),
                14
            )
        );

        if (userMarker) {
            userMarker.openPopup();
        }
    }


    /* ============================================================
       RESOURCE LOADING
       ============================================================ */

    async function loadNearbyResources() {

        if (!currentLocation) {
            warn(
                "Cannot load resources without location."
            );
            return;
        }


        const requestId = ++resourceRequestId;


        if (isLoadingResources) {
            log(
                "A previous resource request is still running."
            );
        }

        isLoadingResources = true;


        setMapStatus("Finding resources...");

        showResourceLoading();


        const {
            lat,
            lon
        } = currentLocation;


        try {

            const resources =
                await fetchResourcesFromBackend(
                    lat,
                    lon,
                    currentDistanceKm
                );


            /*
             * Ignore stale requests.
             */

            if (requestId !== resourceRequestId) {
                return;
            }


            resourcesData =
                normalizeResources(resources);


            resourcesData =
                resourcesData.filter(
                    (resource) => {

                        if (
                            !Number.isFinite(
                                resource.lat
                            ) ||
                            !Number.isFinite(
                                resource.lon
                            )
                        ) {
                            return false;
                        }

                        return (
                            resource.distanceKm === null ||
                            resource.distanceKm <=
                            currentDistanceKm
                        );
                    }
                );


            resourcesData.sort(
                (a, b) => {

                    const da =
                        Number.isFinite(
                            a.distanceKm
                        )
                            ? a.distanceKm
                            : Infinity;

                    const db =
                        Number.isFinite(
                            b.distanceKm
                        )
                            ? b.distanceKm
                            : Infinity;

                    return da - db;
                }
            );


            log(
                "Normalized resources:",
                resourcesData
            );


            renderResourceList();

            renderResourceMarkers();

            updateResourceCount(
                getVisibleResources().length
            );


            if (resourcesData.length > 0) {

                setMapStatus(
                    `${resourcesData.length} resources found`
                );

                setLocationStatus(
                    `Found ${resourcesData.length} nearby resources`
                );

            } else {

                setMapStatus(
                    "No resources found"
                );

                showNoResources();
            }


        } catch (err) {

            if (requestId !== resourceRequestId) {
                return;
            }


            error(
                "Resource search failed:",
                err
            );


            resourcesData = [];

            clearResourceMarkers();

            updateResourceCount(0);


            showResourceError(err);


            setMapStatus(
                "Resource search unavailable"
            );

        } finally {

            if (requestId === resourceRequestId) {
                isLoadingResources = false;
            }
        }
    }


    /* ============================================================
       BACKEND REQUEST
       ============================================================ */

    async function fetchResourcesFromBackend(
        lat,
        lon,
        radiusKm
    ) {

        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lon),
            radius: String(
                Math.min(
                    CONFIG.MAX_RADIUS_KM,
                    radiusKm
                )
            )
        });


        let lastError = null;


        for (
            const endpoint
            of CONFIG.RESOURCE_ENDPOINTS
        ) {

            try {

                log(
                    "Trying resource endpoint:",
                    endpoint
                );


                const response =
                    await fetch(
                        `${endpoint}?${params.toString()}`,
                        {
                            method: "GET",
                            headers: {
                                Accept:
                                    "application/json"
                            },
                            credentials: "same-origin"
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }


                const data =
                    await response.json();


                if (!data) {
                    throw new Error(
                        "Empty server response"
                    );
                }


                /*
                 * Accept several backend response shapes.
                 */

                if (Array.isArray(data)) {
                    return data;
                }


                if (Array.isArray(data.resources)) {
                    return data.resources;
                }


                if (Array.isArray(data.elements)) {
                    return data.elements;
                }


                if (
                    data.data &&
                    Array.isArray(data.data)
                ) {
                    return data.data;
                }


                throw new Error(
                    "Backend returned no resources array"
                );


            } catch (err) {

                lastError = err;

                warn(
                    `Endpoint ${endpoint} failed:`,
                    err.message
                );
            }
        }


        throw (
            lastError ||
            new Error(
                "No resource backend is available."
            )
        );
    }


    /* ============================================================
       NORMALIZE RESOURCES
       ============================================================ */

    function normalizeResources(input) {

        if (!Array.isArray(input)) {
            return [];
        }


        return input
            .map((raw) => {

                const tags =
                    raw.tags || {};


                const lat =
                    Number(
                        raw.lat ??
                        raw.latitude ??
                        raw.center?.lat
                    );


                const lon =
                    Number(
                        raw.lon ??
                        raw.lng ??
                        raw.longitude ??
                        raw.center?.lon
                    );


                if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lon)
                ) {
                    return null;
                }


                const name =
                    firstNonEmpty(
                        raw.name,
                        tags.name,
                        tags["official_name"],
                        tags["short_name"],
                        getDefaultResourceName(
                            raw.type,
                            tags
                        )
                    );


                const type =
                    normalizeResourceType(
                        raw.type ||
                        raw.category ||
                        tags.amenity ||
                        tags.office ||
                        tags.emergency ||
                        tags.building ||
                        ""
                    );


                const phone =
                    firstNonEmpty(
                        raw.phone,
                        raw.telephone,
                        tags.phone,
                        tags["contact:phone"]
                    );


                const address =
                    firstNonEmpty(
                        raw.address,
                        tags["addr:full"],
                        buildAddress(tags)
                    );


                let distanceKm =
                    Number(
                        raw.distanceKm ??
                        raw.distance ??
                        raw.distance_km
                    );


                if (
                    !Number.isFinite(
                        distanceKm
                    ) &&
                    currentLocation
                ) {

                    distanceKm =
                        calculateDistanceKm(
                            currentLocation.lat,
                            currentLocation.lon,
                            lat,
                            lon
                        );
                }


                if (
                    !Number.isFinite(
                        distanceKm
                    )
                ) {
                    distanceKm = null;
                }


                return {

                    id:
                        String(
                            raw.id ??
                            raw.osm_id ??
                            `${lat}-${lon}-${name}`
                        ),

                    name,

                    type,

                    lat,

                    lon,

                    phone,

                    address,

                    distanceKm,

                    website:
                        firstNonEmpty(
                            raw.website,
                            tags.website,
                            tags["contact:website"]
                        ),

                    openingHours:
                        firstNonEmpty(
                            raw.openingHours,
                            tags.opening_hours
                        ),

                    raw
                };
            })
            .filter(Boolean);
    }


    function firstNonEmpty(...values) {

        for (const value of values) {

            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ""
            ) {
                return String(value).trim();
            }
        }

        return "";
    }


    function buildAddress(tags) {

        const parts = [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:suburb"],
            tags["addr:city"]
        ].filter(Boolean);


        return parts.join(", ");
    }


    function getDefaultResourceName(
        type,
        tags
    ) {

        const normalized =
            normalizeResourceType(
                type ||
                tags?.amenity ||
                ""
            );


        const names = {
            hospital: "Hospital",
            police: "Police Station",
            fire: "Fire Station",
            government: "Government Office",
            relief: "Relief Center",
            other: "Public Resource"
        };


        return (
            names[normalized] ||
            "Public Resource"
        );
    }


    /* ============================================================
       RESOURCE TYPE
       ============================================================ */

    function normalizeResourceType(value) {

        const text =
            String(value || "")
                .toLowerCase()
                .trim();


        if (
            text.includes("hospital") ||
            text.includes("clinic") ||
            text.includes("health") ||
            text.includes("doctors")
        ) {
            return "hospital";
        }


        if (
            text.includes("police")
        ) {
            return "police";
        }


        if (
            text.includes("fire")
        ) {
            return "fire";
        }


        if (
            text.includes("government") ||
            text.includes("government_office") ||
            text.includes("townhall") ||
            text.includes("public_service") ||
            text.includes("post_office") ||
            text.includes("administrative")
        ) {
            return "government";
        }


        if (
            text.includes("relief") ||
            text.includes("shelter") ||
            text.includes("food_bank") ||
            text.includes("social")
        ) {
            return "relief";
        }


        return "other";
    }


    /* ============================================================
       FILTERING
       ============================================================ */

    function getVisibleResources() {

        return resourcesData.filter(
            (resource) => {

                if (
                    currentResourceType !==
                    "all"
                ) {

                    if (
                        resource.type !==
                        currentResourceType
                    ) {
                        return false;
                    }
                }


                if (
                    Number.isFinite(
                        resource.distanceKm
                    )
                ) {

                    if (
                        resource.distanceKm >
                        currentDistanceKm
                    ) {
                        return false;
                    }
                }


                return true;
            }
        );
    }


    /* ============================================================
       RESOURCE LIST
       ============================================================ */

    function renderResourceList() {

        const list =
            $("resourceList");

        if (!list) {
            return;
        }


        const resources =
            getVisibleResources();


        updateResourceCount(
            resources.length
        );


        if (!resources.length) {

            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>

                    <h4>No Resources Found</h4>

                    <p>
                        No matching resources were found
                        within ${escapeHTML(
                            currentDistanceKm
                        )} km.
                    </p>
                </div>
            `;

            return;
        }


        list.innerHTML =
            resources
                .map(
                    createResourceCard
                )
                .join("");


        /*
         * Add click handlers.
         */

        qsa(
            "[data-resource-id]",
            list
        ).forEach((card) => {

            card.addEventListener(
                "click",
                () => {

                    const id =
                        card.dataset.resourceId;

                    focusResource(id);
                }
            );
        });
    }


    function createResourceCard(resource) {

        const icon =
            getResourceIcon(
                resource.type
            );


        const distance =
            Number.isFinite(
                resource.distanceKm
            )
                ? `${resource.distanceKm.toFixed(1)} km`
                : "Distance unavailable";


        const phoneHTML =
            resource.phone
                ? `
                    <a
                        href="tel:${escapeHTML(
                            resource.phone
                        )}"
                        class="resource-contact-btn"
                        onclick="event.stopPropagation()"
                    >
                        <i class="fa-solid fa-phone"></i>
                        Call
                    </a>
                `
                : "";


        const directionsUrl =
            createDirectionsUrl(
                resource.lat,
                resource.lon
            );


        return `
            <article
                class="resource-item"
                data-resource-id="${escapeHTML(
                    resource.id
                )}"
            >

                <div class="resource-item-icon ${escapeHTML(
                    resource.type
                )}">
                    <i class="${icon}"></i>
                </div>

                <div class="resource-item-content">

                    <div class="resource-item-top">

                        <span class="resource-type">
                            ${escapeHTML(
                                formatResourceType(
                                    resource.type
                                )
                            )}
                        </span>

                        <span class="resource-distance">
                            ${escapeHTML(distance)}
                        </span>

                    </div>

                    <h4>
                        ${escapeHTML(
                            resource.name
                        )}
                    </h4>

                    ${
                        resource.address
                            ? `
                                <p>
                                    <i class="fa-solid fa-location-dot"></i>
                                    ${escapeHTML(
                                        resource.address
                                    )}
                                </p>
                            `
                            : ""
                    }

                    ${
                        resource.openingHours
                            ? `
                                <p>
                                    <i class="fa-solid fa-clock"></i>
                                    ${escapeHTML(
                                        resource.openingHours
                                    )}
                                </p>
                            `
                            : ""
                    }

                    <div class="resource-item-actions">

                        ${
                            phoneHTML
                        }

                        <a
                            href="${directionsUrl}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="resource-contact-btn"
                            onclick="event.stopPropagation()"
                        >
                            <i class="fa-solid fa-route"></i>
                            Directions
                        </a>

                    </div>

                </div>

            </article>
        `;
    }


    function getResourceIcon(type) {

        const icons = {

            hospital:
                "fa-solid fa-hospital",

            police:
                "fa-solid fa-shield-halved",

            fire:
                "fa-solid fa-fire-extinguisher",

            government:
                "fa-solid fa-building-columns",

            relief:
                "fa-solid fa-hand-holding-heart",

            other:
                "fa-solid fa-location-dot"
        };


        return (
            icons[type] ||
            icons.other
        );
    }


    function formatResourceType(type) {

        const labels = {

            hospital: "Hospital",

            police: "Police",

            fire: "Fire",

            government: "Government",

            relief: "Relief",

            other: "Public Resource"
        };


        return (
            labels[type] ||
            "Public Resource"
        );
    }


    /* ============================================================
       MAP MARKERS
       ============================================================ */

    function renderResourceMarkers() {

        if (!map) {
            return;
        }


        clearResourceMarkers();


        const resources =
            getVisibleResources();


        resources.forEach((resource) => {

            const marker =
                L.marker([
                    resource.lat,
                    resource.lon
                ]);


            const popup = `
                <div class="resource-popup">

                    <strong>
                        ${escapeHTML(
                            resource.name
                        )}
                    </strong>

                    <div>
                        ${escapeHTML(
                            formatResourceType(
                                resource.type
                            )
                        )}
                    </div>

                    ${
                        Number.isFinite(
                            resource.distanceKm
                        )
                            ? `
                                <div>
                                    ${resource.distanceKm.toFixed(1)}
                                    km away
                                </div>
                            `
                            : ""
                    }

                    ${
                        resource.address
                            ? `
                                <div>
                                    ${escapeHTML(
                                        resource.address
                                    )}
                                </div>
                            `
                            : ""
                    }

                    <br>

                    <a
                        href="${createDirectionsUrl(
                            resource.lat,
                            resource.lon
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Get Directions
                    </a>

                </div>
            `;


            marker
                .bindPopup(popup)
                .addTo(map);


            resourceMarkers.push({
                id: resource.id,
                marker
            });
        });
    }


    function clearResourceMarkers() {

        resourceMarkers.forEach(
            ({ marker }) => {

                try {
                    marker.remove();
                } catch (_) {}
            }
        );


        resourceMarkers = [];
    }


    function focusResource(id) {

        const resource =
            resourcesData.find(
                (item) =>
                    String(item.id) ===
                    String(id)
            );


        if (!resource || !map) {
            return;
        }


        map.setView(
            [
                resource.lat,
                resource.lon
            ],
            Math.max(
                map.getZoom(),
                16
            )
        );


        const entry =
            resourceMarkers.find(
                (item) =>
                    String(item.id) ===
                    String(id)
            );


        if (entry) {
            entry.marker.openPopup();
        }
    }


    /* ============================================================
       RESOURCE UI STATES
       ============================================================ */

    function showResourceLoading() {

        const list =
            $("resourceList");

        if (!list) {
            return;
        }


        list.innerHTML = `
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
    }


    function showNoResources() {

        const list =
            $("resourceList");

        if (!list) {
            return;
        }


        list.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    <i class="fa-solid fa-map-location-dot"></i>
                </div>

                <h4>
                    No Resources Found
                </h4>

                <p>
                    Try increasing the search distance
                    or changing the resource category.
                </p>

            </div>
        `;
    }


    function showResourceError(err) {

        const list =
            $("resourceList");

        if (!list) {
            return;
        }


        list.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h4>
                    Resource Search Unavailable
                </h4>

                <p>
                    The resource server could not be reached.
                    Please try Refresh in a moment.
                </p>

            </div>
        `;


        /*
         * Do NOT expose raw server/CORS errors
         * to normal users.
         */

        if (CONFIG.ENABLE_CONSOLE_LOGS) {
            console.error(
                "[ChronicAI] Resource backend error:",
                err
            );
        }
    }


    function updateResourceCount(count) {

        const element =
            $("resourceCount");

        if (element) {
            element.textContent =
                String(count);
        }
    }


    /* ============================================================
       MAP STATUS
       ============================================================ */

    function setMapStatus(message) {

        const element =
            $("mapStatus");

        if (element) {
            element.textContent =
                message;
        }
    }


    function setLocationStatus(message) {

        const element =
            $("locationStatus");

        if (!element) {
            return;
        }


        element.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            ${escapeHTML(message)}
        `;
    }


    /* ============================================================
       DIRECTIONS
       ============================================================ */

    function createDirectionsUrl(
        lat,
        lon
    ) {

        return (
            "https://www.google.com/maps/dir/?api=1" +
            `&destination=${encodeURIComponent(
                `${lat},${lon}`
            )}`
        );
    }


    /* ============================================================
       DISTANCE
       ============================================================ */

    function calculateDistanceKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {

        const earthRadiusKm =
            6371;


        const dLat =
            degreesToRadians(
                lat2 - lat1
            );


        const dLon =
            degreesToRadians(
                lon2 - lon1
            );


        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(
                degreesToRadians(lat1)
            ) *
            Math.cos(
                degreesToRadians(lat2)
            ) *
            Math.sin(dLon / 2) ** 2;


        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );


        return earthRadiusKm * c;
    }


    function degreesToRadians(value) {
        return value *
            Math.PI /
            180;
    }


    /* ============================================================
       POLLUTION TRACKER
       ============================================================ */

    function togglePollutionTracker() {

        pollutionEnabled =
            !pollutionEnabled;


        const button =
            $("pollutionTrackerBtn");


        if (button) {

            button.setAttribute(
                "aria-pressed",
                String(
                    pollutionEnabled
                )
            );

            button.classList.toggle(
                "active",
                pollutionEnabled
            );
        }


        const legend =
            $("pollutionMapLegend");


        if (legend) {

            legend.classList.toggle(
                "visible",
                pollutionEnabled
            );
        }


        if (pollutionEnabled) {

            if (currentLocation) {
                renderPollutionZones();
            } else {
                requestUserLocation();
            }

        } else {

            clearPollutionLayers();
        }
    }


    function renderPollutionZones() {

        if (!map || !currentLocation) {
            return;
        }


        clearPollutionLayers();


        const center =
            [
                currentLocation.lat,
                currentLocation.lon
            ];


        /*
         * These are visualization zones based on
         * the current modeled AQI, not direct sensor
         * measurements.
         */

        const aqi =
            Number(
                $("aqiValue")?.textContent
            );


        let baseClass =
            "green";


        if (
            Number.isFinite(aqi)
        ) {

            if (aqi <= 50) {
                baseClass = "green";
            } else if (aqi <= 100) {
                baseClass = "yellow";
            } else {
                baseClass = "red";
            }
        }


        const radius =
            pollutionRangeKm *
            1000;


        const circle =
            L.circle(
                center,
                {
                    radius,

                    className:
                        `pollution-zone-${baseClass}`,

                    fillOpacity: 0.14,

                    weight: 1
                }
            ).addTo(map);


        pollutionLayers.push(circle);
    }


    function clearPollutionLayers() {

        pollutionLayers.forEach(
            (layer) => {

                try {
                    layer.remove();
                } catch (_) {}
            }
        );


        pollutionLayers = [];
    }


    /* ============================================================
       POLLUTION LOCATION SEARCH
       ============================================================ */

    async function searchPollutionLocation() {

        const input =
            $("pollutionPlaceInput");


        const status =
            $("pollutionLocationStatus");


        const result =
            $("pollutionLocationResult");


        if (!input) {
            return;
        }


        const query =
            input.value.trim();


        if (!query) {

            if (status) {
                status.textContent =
                    "Please enter a city or area.";
            }

            return;
        }


        if (status) {
            status.textContent =
                "Searching location...";
        }


        try {

            /*
             * Nominatim should also ideally be called
             * through your backend in production.
             *
             * This implementation uses the public endpoint
             * only for location search.
             */

            const url =
                "https://nominatim.openstreetmap.org/search?" +
                new URLSearchParams({
                    q: query,
                    format: "json",
                    limit: "1"
                });


            const response =
                await fetch(url, {
                    headers: {
                        Accept:
                            "application/json"
                    }
                });


            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const results =
                await response.json();


            if (
                !Array.isArray(results) ||
                !results.length
            ) {

                throw new Error(
                    "Location not found"
                );
            }


            const place =
                results[0];


            const lat =
                Number(place.lat);


            const lon =
                Number(place.lon);


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon)
            ) {
                throw new Error(
                    "Invalid coordinates"
                );
            }


            if (status) {
                status.textContent =
                    place.display_name ||
                    query;
            }


            if (map) {

                map.setView(
                    [lat, lon],
                    12
                );
            }


            await loadAirQuality(
                lat,
                lon
            );


            renderPollutionSearchResult(
                place
            );


        } catch (err) {

            error(
                "Pollution location search failed:",
                err
            );


            if (status) {
                status.textContent =
                    "Unable to find that location.";
            }


            if (result) {

                result.innerHTML = `
                    <div class="pollution-location-empty">

                        <div class="pollution-location-empty-icon">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>

                        <h3>
                            Location Not Found
                        </h3>

                        <p>
                            Try a city name or nearby area.
                        </p>

                    </div>
                `;
            }
        }
    }


    function renderPollutionSearchResult(
        place
    ) {

        const result =
            $("pollutionLocationResult");


        if (!result) {
            return;
        }


        result.innerHTML = `
            <div class="pollution-location-result-card">

                <div class="pollution-location-result-icon">
                    <i class="fa-solid fa-location-dot"></i>
                </div>

                <div>

                    <span class="air-small-title">
                        SELECTED LOCATION
                    </span>

                    <h3>
                        ${escapeHTML(
                            place.display_name
                        )}
                    </h3>

                    <p>
                        Air quality information
                        is shown below.
                    </p>

                </div>

            </div>
        `;
    }


    /* ============================================================
       AIR QUALITY
       ============================================================ */

    async function loadAirQuality(
        lat,
        lon
    ) {

        lastAirQualityLocation = {
            lat,
            lon
        };


        setAirQualityLoading();


        try {

            /*
             * Primary backend route.
             *
             * Your server should proxy the actual
             * air-quality provider.
             */

            const endpoint =
                "/api/air-quality";


            const params =
                new URLSearchParams({
                    lat: String(lat),
                    lon: String(lon)
                });


            const response =
                await fetch(
                    `${endpoint}?${params.toString()}`,
                    {
                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Air quality HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            const normalized =
                normalizeAirQuality(data);


            renderAirQuality(
                normalized
            );


            if (pollutionEnabled) {
                renderPollutionZones();
            }


        } catch (err) {

            error(
                "Air quality request failed:",
                err
            );


            setAirQualityError();
        }
    }


    function normalizeAirQuality(data) {

        const source =
            data?.data ||
            data?.result ||
            data ||
            {};


        const aqi =
            Number(
                source.aqi ??
                source.us_aqi ??
                source.AQI ??
                source.current?.aqi
            );


        const pm25 =
            Number(
                source.pm25 ??
                source.pm2_5 ??
                source["pm2.5"] ??
                source.current?.pm2_5
            );


        const pm10 =
            Number(
                source.pm10 ??
                source.current?.pm10
            );


        const no2 =
            Number(
                source.no2 ??
                source.current?.no2
            );


        const o3 =
            Number(
                source.o3 ??
                source.current?.o3
            );


        const co =
            Number(
                source.co ??
                source.current?.co
            );


        return {
            aqi: finiteOrNull(aqi),
            pm25: finiteOrNull(pm25),
            pm10: finiteOrNull(pm10),
            no2: finiteOrNull(no2),
            o3: finiteOrNull(o3),
            co: finiteOrNull(co),
            updatedAt:
                source.updatedAt ||
                source.timestamp ||
                source.time ||
                new Date().toISOString()
        };
    }


    function finiteOrNull(value) {

        return Number.isFinite(value)
            ? value
            : null;
    }


    function renderAirQuality(data) {

        const aqi =
            data.aqi;


        setText(
            "aqiValue",
            aqi !== null
                ? Math.round(aqi)
                : "—"
        );


        setText(
            "pm25Value",
            formatNumber(data.pm25)
        );


        setText(
            "pm10Value",
            formatNumber(data.pm10)
        );


        setText(
            "no2Value",
            formatNumber(data.no2)
        );


        setText(
            "o3Value",
            formatNumber(data.o3)
        );


        setText(
            "coValue",
            formatNumber(data.co)
        );


        const condition =
            getAQICondition(aqi);


        setText(
            "aqiCondition",
            condition.title
        );


        setText(
            "aqiDescription",
            condition.description
        );


        const aqiCircle =
            $("aqiCircle");


        if (aqiCircle) {

            aqiCircle.className =
                `aqi-circle ${condition.className}`;
        }


        const oxygenIcon =
            $("oxygenSafetyIcon");


        if (oxygenIcon) {

            oxygenIcon.className =
                `oxygen-safety-icon ${condition.className}`;
        }


        setText(
            "oxygenSafetyLevel",
            condition.oxygenLevel
        );


        setText(
            "oxygenSafetyDescription",
            condition.oxygenDescription
        );


        const status =
            $("airQualityStatus");


        if (status) {

            status.className =
                `air-quality-status ${condition.className}`;

            status.innerHTML = `
                <span class="air-status-dot"></span>
                ${escapeHTML(
                    condition.title
                )}
            `;
        }


        const updated =
            $("airQualityUpdated");


        if (updated) {

            const date =
                new Date(
                    data.updatedAt
                );


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                updated.textContent =
                    "Air quality data updated.";

            } else {

                updated.textContent =
                    `Updated ${date.toLocaleString()}`;
            }
        }
    }


    function getAQICondition(aqi) {

        if (
            !Number.isFinite(aqi)
        ) {

            return {
                title: "Unavailable",
                description:
                    "Air quality data is currently unavailable.",
                className: "good",
                oxygenLevel: "Unavailable",
                oxygenDescription:
                    "Pollution-based safety indicator unavailable."
            };
        }


        if (aqi <= 50) {

            return {
                title: "Good",
                description:
                    "Air quality is generally considered good.",
                className: "good",
                oxygenLevel: "Good",
                oxygenDescription:
                    "Low pollution burden based on the reported AQI."
            };
        }


        if (aqi <= 100) {

            return {
                title: "Moderate",
                description:
                    "Air quality is acceptable for most people.",
                className: "moderate",
                oxygenLevel: "Moderate",
                oxygenDescription:
                    "Moderate pollution burden based on the reported AQI."
            };
        }


        if (aqi <= 150) {

            return {
                title: "Caution",
                description:
                    "Sensitive people may experience effects.",
                className: "caution",
                oxygenLevel: "Caution",
                oxygenDescription:
                    "Increased pollution burden based on the reported AQI."
            };
        }


        if (aqi <= 200) {

            return {
                title: "Poor",
                description:
                    "Health effects may occur with prolonged exposure.",
                className: "poor",
                oxygenLevel: "Poor",
                oxygenDescription:
                    "High pollution burden based on the reported AQI."
            };
        }


        return {
            title: "High Risk",
            description:
                "Air quality is unhealthy and exposure should be reduced.",
            className: "high-risk",
            oxygenLevel: "High Risk",
            oxygenDescription:
                "Very high pollution burden based on the reported AQI."
        };
    }


    function formatNumber(value) {

        return Number.isFinite(value)
            ? value.toFixed(1)
            : "—";
    }


    function setText(
        id,
        value
    ) {

        const element =
            $(id);

        if (element) {
            element.textContent =
                value;
        }
    }


    function setAirQualityWaiting() {

        setText(
            "aqiValue",
            "—"
        );

        setText(
            "aqiCondition",
            "Waiting for location"
        );

        setText(
            "aqiDescription",
            "Turn on your location to check air quality."
        );

        setText(
            "oxygenSafetyLevel",
            "—"
        );
    }


    function setAirQualityLoading() {

        const status =
            $("airQualityStatus");

        if (status) {

            status.className =
                "air-quality-status loading";

            status.innerHTML = `
                <span class="air-status-dot"></span>
                Loading
            `;
        }
    }


    function setAirQualityError() {

        setText(
            "aqiValue",
            "—"
        );

        setText(
            "aqiCondition",
            "Unavailable"
        );

        setText(
            "aqiDescription",
            "Air quality data could not be loaded."
        );

        setText(
            "oxygenSafetyLevel",
            "Unavailable"
        );


        const status =
            $("airQualityStatus");

        if (status) {

            status.className =
                "air-quality-status poor";

            status.innerHTML = `
                <span class="air-status-dot"></span>
                Unavailable
            `;
        }
    }


    /* ============================================================
       OPTIONAL LIVE LOCATION WATCH
       ============================================================ */

    function startLocationWatch() {

        if (
            !navigator.geolocation ||
            locationWatchId !== null
        ) {
            return;
        }


        locationWatchId =
            navigator.geolocation.watchPosition(
                (position) => {

                    const lat =
                        Number(
                            position.coords.latitude
                        );

                    const lon =
                        Number(
                            position.coords.longitude
                        );


                    if (
                        !Number.isFinite(lat) ||
                        !Number.isFinite(lon)
                    ) {
                        return;
                    }


                    currentLocation = {
                        lat,
                        lon,
                        accuracy:
                            Number(
                                position.coords.accuracy
                            ) || null
                    };


                    updateUserMarker();
                },

                (err) => {

                    warn(
                        "Live location update failed:",
                        err
                    );
                },

                {
                    enableHighAccuracy: true,
                    maximumAge: 30000,
                    timeout: 15000
                }
            );
    }


    function stopLocationWatch() {

        if (
            locationWatchId !== null &&
            navigator.geolocation
        ) {

            navigator.geolocation.clearWatch(
                locationWatchId
            );

            locationWatchId = null;
        }
    }


    /* ============================================================
       GLOBAL CLEANUP
       ============================================================ */

    window.addEventListener(
        "beforeunload",
        () => {
            stopLocationWatch();
        }
    );


    /* ============================================================
       DEBUG API
       ============================================================ */

    window.ChronicAIResourceCenter = {

        getLocation() {
            return currentLocation;
        },

        getResources() {
            return resourcesData;
        },

        reload() {
            return loadNearbyResources();
        },

        locate() {
            return requestUserLocation();
        },

        startLocationWatch() {
            startLocationWatch();
        },

        stopLocationWatch() {
            stopLocationWatch();
        }
    };

})();
