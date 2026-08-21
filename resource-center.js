"use strict";

/* =========================================================
   CHRONICAI RESOURCE CENTER
   COMPLETE REPLACEMENT
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const RESOURCE_CONFIG = {

    defaultZoom: 2,

    savedLocationMaxAgeMs:
        5 * 60 * 1000,

    /*
     * IMPORTANT:
     *
     * The browser must NOT call Overpass directly.
     *
     * Your Render backend must expose:
     *
     * GET /api/resources?lat=...&lng=...&radius=...
     *
     */

    resourceApi:
        "/api/resources",

    airQualityApi:
        "https://air-quality-api.open-meteo.com/v1/air-quality",

    geocodeApi:
        "https://nominatim.openstreetmap.org/search",

    airRefreshMs:
        15 * 60 * 1000

};


/* =========================================================
   STATE
   ========================================================= */

let map = null;

let userMarker = null;

let accuracyCircle = null;

let searchedLocationMarker = null;

let resourceMarkers = [];

let pollutionZoneLayers = [];

let resources = [];

let userLocation = null;

let locationWatchId = null;

let searchedPollutionLocation = null;

let currentFilter = "all";

let currentRadius = 5;

let pollutionTrackerEnabled = false;

let pollutionRangeKm = 1;

let resourceLoading = false;

let lastResourceSearch = 0;


/* =========================================================
   DOM
   ========================================================= */

const locateBtn =
    document.getElementById(
        "locateBtn"
    );


const refreshBtn =
    document.getElementById(
        "refreshBtn"
    );


const centerMapBtn =
    document.getElementById(
        "centerMapBtn"
    );


const locationStatus =
    document.getElementById(
        "locationStatus"
    );


const mapStatus =
    document.getElementById(
        "mapStatus"
    );


const resourceList =
    document.getElementById(
        "resourceList"
    );


const resourceCount =
    document.getElementById(
        "resourceCount"
    );


const distanceFilter =
    document.getElementById(
        "distanceFilter"
    );


const filterButtons =
    document.querySelectorAll(
        ".filter-btn"
    );


const pollutionTrackerBtn =
    document.getElementById(
        "pollutionTrackerBtn"
    );


const pollutionMapLegend =
    document.getElementById(
        "pollutionMapLegend"
    );


const pollutionRangeButtons =
    document.querySelectorAll(
        ".pollution-range-btn"
    );


/* =========================================================
   AIR QUALITY DOM
   ========================================================= */

const airQualityStatus =
    document.getElementById(
        "airQualityStatus"
    );


const aqiCircle =
    document.getElementById(
        "aqiCircle"
    );


const aqiValue =
    document.getElementById(
        "aqiValue"
    );


const aqiCondition =
    document.getElementById(
        "aqiCondition"
    );


const aqiDescription =
    document.getElementById(
        "aqiDescription"
    );


const oxygenSafetyIcon =
    document.getElementById(
        "oxygenSafetyIcon"
    );


const oxygenSafetyLevel =
    document.getElementById(
        "oxygenSafetyLevel"
    );


const oxygenSafetyDescription =
    document.getElementById(
        "oxygenSafetyDescription"
    );


const pm25Value =
    document.getElementById(
        "pm25Value"
    );


const pm10Value =
    document.getElementById(
        "pm10Value"
    );


const no2Value =
    document.getElementById(
        "no2Value"
    );


const o3Value =
    document.getElementById(
        "o3Value"
    );


const coValue =
    document.getElementById(
        "coValue"
    );


const airQualityUpdated =
    document.getElementById(
        "airQualityUpdated"
    );


const refreshAirQuality =
    document.getElementById(
        "refreshAirQuality"
    );


/* =========================================================
   POLLUTION SEARCH DOM
   ========================================================= */

const pollutionPlaceInput =
    document.getElementById(
        "pollutionPlaceInput"
    );


const pollutionPlaceSearchBtn =
    document.getElementById(
        "pollutionPlaceSearchBtn"
    );


const pollutionLocationStatus =
    document.getElementById(
        "pollutionLocationStatus"
    );


const pollutionLocationResult =
    document.getElementById(
        "pollutionLocationResult"
    );


/* =========================================================
   RESOURCE TYPES
   ========================================================= */

const TYPE_CONFIG = {

    hospital: {

        label:
            "Hospital",

        icon:
            "fa-hospital"

    },


    police: {

        label:
            "Police Station",

        icon:
            "fa-shield-halved"

    },


    fire: {

        label:
            "Fire Station",

        icon:
            "fa-fire-extinguisher"

    },


    government: {

        label:
            "Government Office",

        icon:
            "fa-building-columns"

    },


    relief: {

        label:
            "Relief Center",

        icon:
            "fa-hand-holding-heart"

    }

};


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeMap();

        bindEvents();

        loadSavedLocation();

        updateAirWaitingState();

    }
);


/* =========================================================
   MAP
   ========================================================= */

function initializeMap() {

    if (
        typeof L === "undefined"
    ) {

        console.error(
            "[ChronicAI] Leaflet is not loaded."
        );

        if (mapStatus) {

            mapStatus.textContent =
                "Map unavailable";

        }

        return;

    }


    const mapElement =
        document.getElementById(
            "resourceMap"
        );


    if (
        !mapElement
    ) {

        console.error(
            "[ChronicAI] #resourceMap not found."
        );

        return;

    }


    map =
        L.map(
            "resourceMap"
        )
        .setView(
            [
                20,
                0
            ],
            RESOURCE_CONFIG.defaultZoom
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {

            maxZoom:
                19,

            attribution:
                "&copy; OpenStreetMap contributors"

        }
    )
    .addTo(
        map
    );


    if (mapStatus) {

        mapStatus.textContent =
            "Ready";

    }

}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {

    locateBtn?.addEventListener(
        "click",
        getUserLocation
    );


    refreshBtn?.addEventListener(
        "click",
        refreshEverything
    );


    centerMapBtn?.addEventListener(
        "click",
        centerOnUser
    );


    distanceFilter?.addEventListener(
        "change",
        () => {

            const radius =
                Number(
                    distanceFilter.value
                );


            if (
                Number.isFinite(radius) &&
                radius > 0
            ) {

                currentRadius =
                    radius;

            }


            if (
                userLocation
            ) {

                /*
                 * Re-query because the selected
                 * radius may be larger than the
                 * previous query.
                 */

                loadNearbyResources();

            }

        }
    );


    filterButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

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


                    currentFilter =
                        button.dataset.type ||
                        "all";


                    renderMarkers();

                    renderResources();

                }
            );

        }
    );


    pollutionTrackerBtn?.addEventListener(
        "click",
        togglePollutionTracker
    );


    pollutionRangeButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    pollutionRangeButtons.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    pollutionRangeKm =
                        Number(
                            button.dataset.range
                        ) || 1;


                    if (
                        pollutionTrackerEnabled
                    ) {

                        const target =
                            searchedPollutionLocation ||
                            userLocation;


                        if (
                            target
                        ) {

                            loadPollutionZones(
                                target.lat,
                                target.lng
                            );

                        }

                    }

                }
            );

        }
    );


    refreshAirQuality?.addEventListener(
        "click",
        () => {

            const target =
                searchedPollutionLocation ||
                userLocation;


            if (
                target
            ) {

                loadAirQuality(
                    target.lat,
                    target.lng
                );

            }
            else {

                setAirMessage(
                    "Choose a location first."
                );

            }

        }
    );


    pollutionPlaceSearchBtn?.addEventListener(
        "click",
        searchPollutionLocation
    );


    pollutionPlaceInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                searchPollutionLocation();

            }

        }
    );

}


/* =========================================================
   REFRESH EVERYTHING
   ========================================================= */

function refreshEverything() {

    if (
        userLocation
    ) {

        loadNearbyResources();


        loadAirQuality(
            userLocation.lat,
            userLocation.lng
        );


        if (
            pollutionTrackerEnabled
        ) {

            loadPollutionZones(
                userLocation.lat,
                userLocation.lng
            );

        }


        return;

    }


    getUserLocation();

}


/* =========================================================
   LOCATION
   ========================================================= */

function getUserLocation() {

    if (
        !navigator.geolocation
    ) {

        showLocationError(
            "Your browser does not support location services."
        );

        return;

    }


    if (
        locateBtn
    ) {

        locateBtn.disabled =
            true;

    }


    setLocationStatus(
        "Getting your live location...",
        "normal"
    );


    navigator.geolocation.getCurrentPosition(

        position => {

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
                    position.coords.accuracy || 0
                );


            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {

                handleLocationError(
                    {
                        code:
                            2,

                        message:
                            "Invalid location."
                    }
                );

                return;

            }


            userLocation = {

                lat:
                    latitude,

                lng:
                    longitude,

                accuracy:
                    accuracy

            };


            saveLocation(
                userLocation
            );


            clearSearchedMarker();


            updateUserMarker(
                latitude,
                longitude,
                accuracy
            );


            if (
                map
            ) {

                map.setView(
                    [
                        latitude,
                        longitude
                    ],
                    16,
                    {
                        animate:
                            true
                    }
                );

            }


            setLocationStatus(
                `Location detected ±${Math.round(
                    accuracy
                )}m`,
                "success"
            );


            if (
                locateBtn
            ) {

                locateBtn.disabled =
                    false;

            }


            /*
             * IMPORTANT:
             *
             * Resource loading is intentionally
             * handled separately from location.
             */

            loadNearbyResources();


            loadAirQuality(
                latitude,
                longitude
            );


            if (
                pollutionTrackerEnabled
            ) {

                loadPollutionZones(
                    latitude,
                    longitude
                );

            }


            startLocationWatch();

        },

        error => {

            if (
                locateBtn
            ) {

                locateBtn.disabled =
                    false;

            }


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
                30000

        }

    );

}


/* =========================================================
   LIVE LOCATION WATCH
   ========================================================= */

function startLocationWatch() {

    if (
        !navigator.geolocation
    ) {

        return;

    }


    if (
        locationWatchId !== null
    ) {

        navigator.geolocation.clearWatch(
            locationWatchId
        );

    }


    locationWatchId =
        navigator.geolocation.watchPosition(

            position => {

                const nextLocation = {

                    lat:
                        Number(
                            position.coords.latitude
                        ),

                    lng:
                        Number(
                            position.coords.longitude
                        ),

                    accuracy:
                        Number(
                            position.coords.accuracy || 0
                        )

                };


                if (
                    !Number.isFinite(
                        nextLocation.lat
                    ) ||
                    !Number.isFinite(
                        nextLocation.lng
                    )
                ) {

                    return;

                }


                const movedMeters =
                    userLocation
                        ? calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            nextLocation.lat,
                            nextLocation.lng
                        ) * 1000
                        : Infinity;


                userLocation =
                    nextLocation;


                saveLocation(
                    userLocation
                );


                clearSearchedMarker();


                updateUserMarker(
                    userLocation.lat,
                    userLocation.lng,
                    userLocation.accuracy
                );


                setLocationStatus(
                    `Live location ±${Math.round(
                        userLocation.accuracy
                    )}m`,
                    "success"
                );


                /*
                 * Only refresh expensive APIs after
                 * the user has moved at least 100 m.
                 */

                if (
                    movedMeters >= 100
                ) {

                    loadNearbyResources();


                    loadAirQuality(
                        userLocation.lat,
                        userLocation.lng
                    );


                    if (
                        pollutionTrackerEnabled
                    ) {

                        loadPollutionZones(
                            userLocation.lat,
                            userLocation.lng
                        );

                    }

                }

            },

            error => {

                console.warn(
                    "[ChronicAI] Live location update failed:",
                    error?.message ||
                    error
                );

            },

            {

                enableHighAccuracy:
                    true,

                timeout:
                    30000,

                maximumAge:
                    30000

            }

        );

}


/* =========================================================
   LOCATION UI
   ========================================================= */

function setLocationStatus(
    message,
    type
) {

    if (
        !locationStatus
    ) {

        return;

    }


    locationStatus.innerHTML =
        `
            <i class="fa-solid fa-location-dot"></i>
            ${escapeHtml(message)}
        `;


    locationStatus.classList.remove(
        "success",
        "error"
    );


    if (
        type === "success"
    ) {

        locationStatus.classList.add(
            "success"
        );

    }


    if (
        type === "error"
    ) {

        locationStatus.classList.add(
            "error"
        );

    }

}


function showLocationError(
    message
) {

    setLocationStatus(
        message,
        "error"
    );

}


function handleLocationError(
    error
) {

    let message =
        "Unable to get your location.";


    if (
        error?.code ===
        error?.PERMISSION_DENIED ||
        error?.code === 1
    ) {

        message =
            "Location permission was denied. Allow location access and try again.";

    }
    else if (
        error?.code ===
        error?.POSITION_UNAVAILABLE ||
        error?.code === 2
    ) {

        message =
            "Your location is currently unavailable.";

    }
    else if (
        error?.code ===
        error?.TIMEOUT ||
        error?.code === 3
    ) {

        message =
            "Location request timed out. Please try again.";

    }


    showLocationError(
        message
    );

}


/* =========================================================
   USER MARKER
   ========================================================= */

function updateUserMarker(
    lat,
    lng,
    accuracy
) {

    if (
        !map
    ) {

        return;

    }


    if (
        userMarker
    ) {

        map.removeLayer(
            userMarker
        );

    }


    if (
        accuracyCircle
    ) {

        map.removeLayer(
            accuracyCircle
        );

    }


    const icon =
        L.divIcon(
            {

                className:
                    "resource-user-marker",

                html:
                    `
                        <div style="
                            width:18px;
                            height:18px;
                            border-radius:50%;
                            background:#4da3ff;
                            border:3px solid white;
                            box-shadow:
                                0 0 0 8px rgba(77,163,255,.16),
                                0 0 25px rgba(77,163,255,.75);
                        "></div>
                    `,

                iconSize:
                    [
                        18,
                        18
                    ],

                iconAnchor:
                    [
                        9,
                        9
                    ]

            }
        );


    userMarker =
        L.marker(
            [
                lat,
                lng
            ],
            {

                icon:
                    icon,

                zIndexOffset:
                    3000

            }
        )
        .addTo(
            map
        )
        .bindPopup(
            `
                <strong>
                    Your Location
                </strong>

                <br><br>

                ChronicAI is using this location
                for nearby resources and air-quality
                information.
            `
        );


    accuracyCircle =
        L.circle(
            [
                lat,
                lng
            ],
            {

                radius:
                    Math.max(
                        Number(accuracy) || 0,
                        20
                    ),

                color:
                    "#4da3ff",

                fillColor:
                    "#4da3ff",

                fillOpacity:
                    0.05,

                weight:
                    1

            }
        )
        .addTo(
            map
        );

}


/* =========================================================
   CENTER USER
   ========================================================= */

function centerOnUser() {

    if (
        !userLocation
    ) {

        getUserLocation();

        return;

    }


    clearSearchedMarker();


    if (
        map
    ) {

        map.setView(
            [
                userLocation.lat,
                userLocation.lng
            ],
            15,
            {
                animate:
                    true
            }
        );

    }

}


/* =========================================================
   NEARBY RESOURCES
   ========================================================= */

async function loadNearbyResources() {

    if (
        !userLocation
    ) {

        showResourceEmptyState(
            "Location Required",
            'Click "Use My Location" to find nearby civic resources.'
        );

        return;

    }


    if (
        resourceLoading
    ) {

        console.log(
            "[ChronicAI] Resource search already running."
        );

        return;

    }


    const radius =
        Number(
            distanceFilter?.value ||
            currentRadius ||
            5
        );


    currentRadius =
        Number.isFinite(radius) &&
        radius > 0
            ? radius
            : 5;


    resourceLoading =
        true;


    lastResourceSearch =
        Date.now();


    if (
        mapStatus
    ) {

        mapStatus.textContent =
            `Searching within ${currentRadius} km...`;

    }


    if (
        resourceList
    ) {

        resourceList.innerHTML =
            `
                <div class="empty-state">

                    <div class="empty-icon">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                    </div>

                    <h4>
                        Finding Nearby Resources
                    </h4>

                    <p>
                        Searching within
                        ${currentRadius} km...
                    </p>

                </div>
            `;

    }


    try {

        console.log(
            "[ChronicAI] Resource search:",
            {
                lat:
                    userLocation.lat,

                lng:
                    userLocation.lng,

                radius:
                    currentRadius
            }
        );


        const data =
            await fetchResourceApi(
                userLocation.lat,
                userLocation.lng,
                currentRadius
            );


        const normalized =
            normalizeResources(
                data
            );


        resources =
            removeDuplicateResources(
                normalized
            );


        saveResources(
            resources
        );


        renderMarkers();

        renderResources();


        if (
            resources.length
        ) {

            if (
                mapStatus
            ) {

                mapStatus.textContent =
                    `Live resources • ${resources.length} found`;

            }

        }
        else {

            if (
                mapStatus
            ) {

                mapStatus.textContent =
                    "No resources found";

            }

            showResourceEmptyState(
                "No Resources Found",
                `No mapped civic resources were found within ${currentRadius} km. Try a larger radius.`
            );

        }


        console.log(
            "[ChronicAI] Resources displayed:",
            resources.length
        );

    }
    catch (
        error
    ) {

        console.error(
            "[ChronicAI] Resource search failed:",
            error
        );


        /*
         * Try cached resources.
         */

        const cached =
            loadCachedResources();


        resources =
            Array.isArray(cached)
                ? cached
                : [];


        renderMarkers();

        renderResources();


        if (
            resources.length
        ) {

            if (
                mapStatus
            ) {

                mapStatus.textContent =
                    `Cached resources • ${resources.length} found`;

            }

        }
        else {

            if (
                mapStatus
            ) {

                mapStatus.textContent =
                    "Resource service unavailable";

            }


            showResourceEmptyState(
                "Unable to Load Resources",
                "The live resource service could not be reached. Please try Refresh again."
            );

        }

    }
    finally {

        resourceLoading =
            false;

    }

}


/* =========================================================
   RESOURCE API
   ========================================================= */

async function fetchResourceApi(
    lat,
    lng,
    radiusKm
) {

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
        RESOURCE_CONFIG.resourceApi +
        "?" +
        params.toString();


    console.log(
        "[ChronicAI] Requesting:",
        url
    );


    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => {

                controller.abort();

            },
            35000
        );


    try {

        const response =
            await fetch(
                url,
                {

                    method:
                        "GET",

                    headers:
                        {
                            "Accept":
                                "application/json"
                        },

                    credentials:
                        "same-origin",

                    cache:
                        "no-store",

                    signal:
                        controller.signal

                }
            );


        if (
            !response.ok
        ) {

            let details =
                "";


            try {

                details =
                    await response.text();

            }
            catch {}


            throw new Error(
                `Resource API HTTP ${response.status}` +
                (
                    details
                        ? `: ${details.slice(0, 200)}`
                        : ""
                )
            );

        }


        const data =
            await response.json();


        if (
            !data
        ) {

            throw new Error(
                "Empty resource API response."
            );

        }


        /*
         * Accept both:
         *
         * { elements: [...] }
         *
         * and
         *
         * { resources: [...] }
         */

        if (
            Array.isArray(
                data.elements
            )
        ) {

            return data;

        }


        if (
            Array.isArray(
                data.resources
            )
        ) {

            return {
                elements:
                    data.resources
            };

        }


        throw new Error(
            "Resource API returned an invalid JSON structure."
        );

    }
    finally {

        clearTimeout(
            timeout
        );

    }

}


/* =========================================================
   NORMALIZE RESOURCES
   ========================================================= */

function normalizeResources(
    data
) {

    if (
        !data
    ) {

        return [];

    }


    const elements =
        Array.isArray(
            data.elements
        )
            ? data.elements
            : Array.isArray(data)
                ? data
                : [];


    if (
        !elements.length
    ) {

        return [];

    }


    const normalized =
        [];


    elements.forEach(
        element => {

            const tags =
                element.tags ||
                {};


            let type =
                null;


            /*
             * Hospitals.
             */

            if (
                tags.amenity ===
                    "hospital" ||

                tags.healthcare ===
                    "hospital" ||

                tags.amenity ===
                    "clinic" ||

                tags.healthcare ===
                    "clinic" ||

                tags.amenity ===
                    "doctors"
            ) {

                type =
                    "hospital";

            }


            /*
             * Police.
             */

            else if (
                tags.amenity ===
                "police"
            ) {

                type =
                    "police";

            }


            /*
             * Fire.
             */

            else if (
                tags.amenity ===
                "fire_station"
            ) {

                type =
                    "fire";

            }


            /*
             * Government.
             */

            else if (
                tags.office ===
                    "government" ||

                tags.amenity ===
                    "townhall"
            ) {

                type =
                    "government";

            }


            /*
             * Relief/community.
             */

            else if (
                tags.amenity ===
                    "social_centre" ||

                tags.amenity ===
                    "community_centre" ||

                tags.amenity ===
                    "shelter" ||

                tags.amenity ===
                    "food_bank"
            ) {

                type =
                    "relief";

            }


            if (
                !type
            ) {

                return;

            }


            let lat =
                Number(
                    element.lat
                );


            let lng =
                Number(
                    element.lon
                );


            /*
             * Ways and relations use center.
             */

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                lat =
                    Number(
                        element.center?.lat
                    );

                lng =
                    Number(
                        element.center?.lon
                    );

            }


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return;

            }


            const distance =
                userLocation
                    ? calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        lat,
                        lng
                    )
                    : 0;


            const name =
                tags.name ||
                tags.official_name ||
                tags.short_name ||
                TYPE_CONFIG[type].label;


            const addressParts = [

                tags["addr:housenumber"],

                tags["addr:street"],

                tags["addr:suburb"],

                tags["addr:city"],

                tags["addr:postcode"]

            ]
            .filter(
                Boolean
            );


            normalized.push({

                id:
                    `${element.type || "resource"}-${element.id || `${lat}-${lng}`}`,

                name:
                    String(name),

                type:
                    type,

                lat:
                    lat,

                lng:
                    lng,

                address:
                    addressParts.join(
                        ", "
                    ) ||
                    "Address information unavailable",

                phone:
                    tags.phone ||
                    tags["contact:phone"] ||
                    tags["contact:mobile"] ||
                    "",

                website:
                    tags.website ||
                    tags["contact:website"] ||
                    "",

                openingHours:
                    tags.opening_hours ||
                    "",

                distance:
                    distance

            });

        }
    );


    return normalized.sort(
        (
            a,
            b
        ) =>
            a.distance -
            b.distance
    );

}


/* =========================================================
   REMOVE DUPLICATES
   ========================================================= */

function removeDuplicateResources(
    items
) {

    const seen =
        new Set();


    return items.filter(
        item => {

            const key =
                item.id ||
                `${item.name}-${item.lat.toFixed(5)}-${item.lng.toFixed(5)}`;


            if (
                seen.has(key)
            ) {

                return false;

            }


            seen.add(
                key
            );


            return true;

        }
    );

}


/* =========================================================
   RESOURCE EMPTY STATE
   ========================================================= */

function showResourceEmptyState(
    title,
    message
) {

    if (
        !resourceList
    ) {

        return;

    }


    resourceList.innerHTML =
        `
            <div class="empty-state">

                <div class="empty-icon">
                    <i class="fa-solid fa-map-location-dot"></i>
                </div>

                <h4>
                    ${escapeHtml(title)}
                </h4>

                <p>
                    ${escapeHtml(message)}
                </p>

            </div>
        `;


    if (
        resourceCount
    ) {

        resourceCount.textContent =
            "0";

    }

}


/* =========================================================
   RESOURCE MARKERS
   ========================================================= */

function renderMarkers() {

    if (
        !map
    ) {

        return;

    }


    resourceMarkers.forEach(
        marker => {

            try {

                map.removeLayer(
                    marker
                );

            }
            catch {}

        }
    );


    resourceMarkers =
        [];


    resources.forEach(
        resource => {

            if (
                currentFilter !==
                    "all" &&

                resource.type !==
                    currentFilter
            ) {

                return;

            }


            if (
                resource.distance >
                currentRadius
            ) {

                return;

            }


            const config =
                TYPE_CONFIG[
                    resource.type
                ];


            const icon =
                L.divIcon(
                    {

                        className:
                            "resource-marker",

                        html:
                            `
                                <div style="
                                    width:34px;
                                    height:34px;
                                    border-radius:50%;
                                    background:#07111f;
                                    border:2px solid white;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    box-shadow:0 4px 15px rgba(0,0,0,.35);
                                ">
                                    <i
                                        class="fa-solid ${config.icon}"
                                        style="
                                            font-size:15px;
                                            color:white;
                                        "
                                    ></i>
                                </div>
                            `,

                        iconSize:
                            [
                                34,
                                34
                            ],

                        iconAnchor:
                            [
                                17,
                                17
                            ]

                    }
                );


            const marker =
                L.marker(
                    [
                        resource.lat,
                        resource.lng
                    ],
                    {
                        icon:
                            icon
                    }
                )
                .addTo(
                    map
                );


            marker.bindPopup(
                `
                    <div>

                        <strong>
                            ${escapeHtml(
                                resource.name
                            )}
                        </strong>

                        <br>

                        ${escapeHtml(
                            config.label
                        )}

                        <br>

                        ${formatDistance(
                            resource.distance
                        )}

                        ${
                            resource.address
                                ? `
                                    <br><br>
                                    ${escapeHtml(
                                        resource.address
                                    )}
                                  `
                                : ""
                        }

                        <br><br>

                        <a
                            target="_blank"
                            rel="noopener noreferrer"
                            href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                resource.lat +
                                "," +
                                resource.lng
                            )}"
                        >
                            Get Directions
                        </a>

                    </div>
                `
            );


            resourceMarkers.push(
                marker
            );

        }
    );

}


/* =========================================================
   RESOURCE LIST
   ========================================================= */

function renderResources() {

    if (
        !resourceList
    ) {

        return;

    }


    const filtered =
        resources.filter(
            resource => {

                const typeOk =
                    currentFilter ===
                        "all" ||

                    resource.type ===
                        currentFilter;


                const distanceOk =
                    Number(
                        resource.distance
                    ) <=
                    Number(
                        currentRadius
                    );


                return (
                    typeOk &&
                    distanceOk
                );

            }
        );


    if (
        resourceCount
    ) {

        resourceCount.textContent =
            filtered.length;

    }


    if (
        !filtered.length
    ) {

        showResourceEmptyState(
            "No Resources Found",
            "Try another category or increase the search radius."
        );

        return;

    }


    resourceList.innerHTML =
        filtered
            .map(
                createResourceCard
            )
            .join("");

}


/* =========================================================
   RESOURCE CARD
   ========================================================= */

function createResourceCard(
    resource
) {

    const config =
        TYPE_CONFIG[
            resource.type
        ];


    const phone =
        resource.phone
            ? `
                <a
                    class="resource-action"
                    href="tel:${encodeURIComponent(
                        resource.phone
                    )}"
                >
                    <i class="fa-solid fa-phone"></i>
                    Call
                </a>
            `
            : "";


    let website =
        "";


    if (
        resource.website
    ) {

        let websiteUrl =
            String(
                resource.website
            ).trim();


        if (
            !/^https?:\/\//i.test(
                websiteUrl
            )
        ) {

            websiteUrl =
                "https://" +
                websiteUrl;

        }


        website =
            `
                <a
                    class="resource-action"
                    href="${escapeHtml(
                        websiteUrl
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <i class="fa-solid fa-globe"></i>
                    Web
                </a>
            `;

    }


    return `
        <article
            class="resource-item"
        >

            <div
                class="resource-item-top"
            >

                <div
                    class="resource-type-icon"
                >

                    <i
                        class="fa-solid ${config.icon}"
                    ></i>

                </div>


                <div>

                    <h4>
                        ${escapeHtml(
                            resource.name
                        )}
                    </h4>

                    <div
                        class="resource-type"
                    >
                        ${escapeHtml(
                            config.label
                        )}
                    </div>

                </div>


                <span
                    class="resource-distance"
                >
                    ${formatDistance(
                        resource.distance
                    )}
                </span>

            </div>


            <div
                class="resource-address"
            >

                <i
                    class="fa-solid fa-location-dot"
                ></i>

                ${escapeHtml(
                    resource.address
                )}

            </div>


            <div
                class="resource-actions"
            >

                <a
                    class="resource-action primary"
                    href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        resource.lat +
                        "," +
                        resource.lng
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                >

                    <i
                        class="fa-solid fa-route"
                    ></i>

                    Directions

                </a>


                ${phone}


                ${website}

            </div>

        </article>
    `;

}


/* =========================================================
   DISTANCE
   ========================================================= */

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R =
        6371;


    const dLat =
        toRadians(
            lat2 -
            lat1
        );


    const dLng =
        toRadians(
            lon2 -
            lon1
        );


    const a =
        Math.sin(
            dLat / 2
        ) ** 2

        +

        Math.cos(
            toRadians(
                lat1
            )
        )

        *

        Math.cos(
            toRadians(
                lat2
            )
        )

        *

        Math.sin(
            dLng / 2
        ) ** 2;


    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(
                1 - a
            )
        )
    );

}


function toRadians(
    value
) {

    return (
        value *
        Math.PI /
        180
    );

}


function formatDistance(
    distance
) {

    if (
        !Number.isFinite(
            distance
        )
    ) {

        return "—";

    }


    if (
        distance < 1
    ) {

        return (
            Math.round(
                distance * 1000
            ) +
            " m"
        );

    }


    return (
        distance.toFixed(
            1
        ) +
        " km"
    );

}


/* =========================================================
   LOCATION CACHE
   ========================================================= */

function saveLocation(
    location
) {

    try {

        localStorage.setItem(
            "chronicai_resource_location",
            JSON.stringify(
                {
                    ...location,
                    savedAt:
                        Date.now()
                }
            )
        );

    }
    catch {}

}


function loadSavedLocation() {

    /*
     * Do not automatically trust an old location.
     *
     * The user explicitly chooses "Use My Location".
     */

    try {

        const raw =
            localStorage.getItem(
                "chronicai_resource_location"
            );


        if (
            !raw
        ) {

            return;

        }


        const saved =
            JSON.parse(
                raw
            );


        if (
            !saved ||
            !Number.isFinite(
                Number(saved.lat)
            ) ||
            !Number.isFinite(
                Number(saved.lng)
            )
        ) {

            return;

        }


        /*
         * Only use the cache if it is recent.
         */

        if (
            Date.now() -
            Number(
                saved.savedAt || 0
            ) >
            RESOURCE_CONFIG.savedLocationMaxAgeMs
        ) {

            return;

        }


        /*
         * We intentionally don't automatically activate
         * location from cache. This keeps the permission
         * model clear.
         */

    }
    catch {}

}


/* =========================================================
   RESOURCE CACHE
   ========================================================= */

function saveResources(
    data
) {

    try {

        localStorage.setItem(
            "chronicai_resource_cache",
            JSON.stringify(
                data
            )
        );

    }
    catch {}

}


function loadCachedResources() {

    try {

        const raw =
            localStorage.getItem(
                "chronicai_resource_cache"
            );


        if (
            !raw
        ) {

            return [];

        }


        const data =
            JSON.parse(
                raw
            );


        return Array.isArray(
            data
        )
            ? data
            : [];

    }
    catch {

        return [];

    }

}


/* =========================================================
   AIR QUALITY
   ========================================================= */

async function loadAirQuality(
    latitude,
    longitude
) {

    if (
        !Number.isFinite(
            Number(latitude)
        ) ||
        !Number.isFinite(
            Number(longitude)
        )
    ) {

        return;

    }


    setAirLoading();


    const params =
        new URLSearchParams({

            latitude:
                String(latitude),

            longitude:
                String(longitude),

            current:
                [
                    "us_aqi",
                    "european_aqi",
                    "pm2_5",
                    "pm10",
                    "nitrogen_dioxide",
                    "ozone",
                    "carbon_monoxide"
                ].join(","),

            timezone:
                "auto"

        });


    try {

        const response =
            await fetch(
                RESOURCE_CONFIG.airQualityApi +
                "?" +
                params.toString()
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `Air quality HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        const current =
            data.current ||
            {};


        const values = {

            aqi:
                Number(
                    current.us_aqi ??
                    current.european_aqi ??
                    NaN
                ),

            pm25:
                Number(
                    current.pm2_5 ??
                    NaN
                ),

            pm10:
                Number(
                    current.pm10 ??
                    NaN
                ),

            no2:
                Number(
                    current.nitrogen_dioxide ??
                    NaN
                ),

            o3:
                Number(
                    current.ozone ??
                    NaN
                ),

            co:
                Number(
                    current.carbon_monoxide ??
                    NaN
                )

        };


        renderAirQuality(
            values
        );

    }
    catch (
        error
    ) {

        console.error(
            "[ChronicAI] Air quality error:",
            error
        );


        setAirError();

    }

}


/* =========================================================
   AIR UI
   ========================================================= */

function setAirLoading() {

    if (
        !airQualityStatus
    ) {

        return;

    }


    airQualityStatus.className =
        "air-quality-status loading";


    airQualityStatus.innerHTML =
        `
            <span
                class="air-status-dot"
            ></span>

            Loading
        `;

}


function updateAirWaitingState() {

    if (
        !airQualityStatus
    ) {

        return;

    }


    airQualityStatus.className =
        "air-quality-status loading";


    airQualityStatus.innerHTML =
        `
            <span
                class="air-status-dot"
            ></span>

            Waiting
        `;

}


function setAirError() {

    if (
        airQualityStatus
    ) {

        airQualityStatus.className =
            "air-quality-status poor";


        airQualityStatus.innerHTML =
            `
                <span
                    class="air-status-dot"
                ></span>

                Unavailable
            `;

    }


    if (
        aqiValue
    ) {

        aqiValue.textContent =
            "—";

    }


    if (
        aqiCondition
    ) {

        aqiCondition.textContent =
            "Data unavailable";

    }


    if (
        aqiDescription
    ) {

        aqiDescription.textContent =
            "Air-quality data could not be loaded right now.";

    }


    if (
        airQualityUpdated
    ) {

        airQualityUpdated.textContent =
            "Air-quality update failed.";

    }

}


function setAirMessage(
    message
) {

    if (
        airQualityUpdated
    ) {

        airQualityUpdated.textContent =
            message;

    }

}


/* =========================================================
   AIR RENDER
   ========================================================= */

function renderAirQuality(
    values
) {

    const category =
        getAQICategory(
            values.aqi
        );


    if (
        airQualityStatus
    ) {

        airQualityStatus.className =
            `air-quality-status ${category.className}`;


        airQualityStatus.innerHTML =
            `
                <span
                    class="air-status-dot"
                ></span>

                ${category.label}
            `;

    }


    if (
        aqiCircle
    ) {

        aqiCircle.className =
            `aqi-circle ${category.className}`;

    }


    if (
        aqiValue
    ) {

        aqiValue.textContent =
            Number.isFinite(
                values.aqi
            )
                ? Math.round(
                    values.aqi
                )
                : "—";

    }


    if (
        aqiCondition
    ) {

        aqiCondition.textContent =
            category.label;

    }


    if (
        aqiDescription
    ) {

        aqiDescription.textContent =
            category.description;

    }


    if (
        oxygenSafetyIcon
    ) {

        oxygenSafetyIcon.className =
            `oxygen-safety-icon ${category.className}`;

    }


    if (
        oxygenSafetyLevel
    ) {

        oxygenSafetyLevel.textContent =
            category.safety;

    }


    if (
        oxygenSafetyDescription
    ) {

        oxygenSafetyDescription.textContent =
            category.safetyText;

    }


    if (
        pm25Value
    ) {

        pm25Value.textContent =
            formatAirValue(
                values.pm25
            );

    }


    if (
        pm10Value
    ) {

        pm10Value.textContent =
            formatAirValue(
                values.pm10
            );

    }


    if (
        no2Value
    ) {

        no2Value.textContent =
            formatAirValue(
                values.no2
            );

    }


    if (
        o3Value
    ) {

        o3Value.textContent =
            formatAirValue(
                values.o3
            );

    }


    if (
        coValue
    ) {

        coValue.textContent =
            formatAirValue(
                values.co
            );

    }


    if (
        airQualityUpdated
    ) {

        airQualityUpdated.textContent =
            "Updated " +
            new Date().toLocaleTimeString();

    }

}


/* =========================================================
   AQI CATEGORY
   ========================================================= */

function getAQICategory(
    aqi
) {

    if (
        !Number.isFinite(
            Number(aqi)
        )
    ) {

        return {

            className:
                "poor",

            label:
                "Unavailable",

            safety:
                "Unavailable",

            description:
                "Air-quality data is unavailable.",

            safetyText:
                "This indicator is unavailable."

        };

    }


    if (
        aqi <= 50
    ) {

        return {

            className:
                "good",

            label:
                "Good",

            safety:
                "Good",

            description:
                "Air quality is generally favorable.",

            safetyText:
                "Pollution is relatively low. This is a pollution-based safety indicator, not a direct oxygen concentration measurement."

        };

    }


    if (
        aqi <= 100
    ) {

        return {

            className:
                "moderate",

            label:
                "Moderate",

            safety:
                "Moderate",

            description:
                "Air quality is acceptable for many people.",

            safetyText:
                "Sensitive people may prefer to reduce prolonged outdoor exposure."

        };

    }


    if (
        aqi <= 150
    ) {

        return {

            className:
                "caution",

            label:
                "Caution",

            safety:
                "Caution",

            description:
                "Pollution may affect sensitive groups.",

            safetyText:
                "Sensitive people should consider reducing prolonged outdoor exposure."

        };

    }


    if (
        aqi <= 200
    ) {

        return {

            className:
                "poor",

            label:
                "Poor",

            safety:
                "Poor",

            description:
                "Air pollution is elevated and may affect health.",

            safetyText:
                "Reduce prolonged exposure where practical."

        };

    }


    return {

        className:
            "high-risk",

        label:
            "High Risk",

        safety:
            "High Risk",

        description:
            "Very high pollution conditions may be present.",

        safetyText:
            "Follow local health guidance and minimize exposure when conditions are severe."

    };

}


function formatAirValue(
    value
) {

    if (
        !Number.isFinite(
            Number(value)
        )
    ) {

        return "—";

    }


    return Number(value) < 10
        ? Number(value).toFixed(1)
        : Math.round(
            Number(value)
        );

}


/* =========================================================
   POLLUTION TRACKER
   ========================================================= */

async function togglePollutionTracker() {

    pollutionTrackerEnabled =
        !pollutionTrackerEnabled;


    pollutionTrackerBtn?.classList.toggle(
        "active",
        pollutionTrackerEnabled
    );


    pollutionTrackerBtn?.setAttribute(
        "aria-pressed",
        String(
            pollutionTrackerEnabled
        )
    );


    pollutionMapLegend?.classList.toggle(
        "show",
        pollutionTrackerEnabled
    );


    if (
        !pollutionTrackerEnabled
    ) {

        clearPollutionZones();


        if (
            mapStatus
        ) {

            mapStatus.textContent =
                "Ready";

        }


        return;

    }


    const target =
        searchedPollutionLocation ||
        userLocation;


    if (
        !target
    ) {

        if (
            mapStatus
        ) {

            mapStatus.textContent =
                "Choose a location first";

        }


        return;

    }


    try {

        if (
            mapStatus
        ) {

            mapStatus.textContent =
                `Loading ${pollutionRangeKm} km pollution zones...`;

        }


        await loadPollutionZones(
            target.lat,
            target.lng
        );


        if (
            mapStatus
        ) {

            mapStatus.textContent =
                `Pollution ${pollutionRangeKm} km`;

        }

    }
    catch (
        error
    ) {

        console.error(
            "[ChronicAI] Pollution tracker error:",
            error
        );


        if (
            mapStatus
        ) {

            mapStatus.textContent =
                "Pollution unavailable";

        }

    }

}


/* =========================================================
   LOAD POLLUTION ZONES
   ========================================================= */

async function loadPollutionZones(
    centerLat,
    centerLng
) {

    clearPollutionZones();


    const spread =
        pollutionRangeKm === 1
            ? 0.08
            : 0.25;


    const points = [

        [
            centerLat + spread,
            centerLng - spread
        ],

        [
            centerLat + spread,
            centerLng
        ],

        [
            centerLat + spread,
            centerLng + spread
        ],

        [
            centerLat,
            centerLng - spread
        ],

        [
            centerLat,
            centerLng
        ],

        [
            centerLat,
            centerLng + spread
        ],

        [
            centerLat - spread,
            centerLng - spread
        ],

        [
            centerLat - spread,
            centerLng
        ],

        [
            centerLat - spread,
            centerLng + spread
        ]

    ];


    const latitudes =
        points
            .map(
                point =>
                    point[0].toFixed(4)
            )
            .join(",");


    const longitudes =
        points
            .map(
                point =>
                    point[1].toFixed(4)
            )
            .join(",");


    const params =
        new URLSearchParams({

            latitude:
                latitudes,

            longitude:
                longitudes,

            current:
                [
                    "us_aqi",
                    "pm2_5",
                    "pm10",
                    "nitrogen_dioxide",
                    "ozone",
                    "carbon_monoxide"
                ].join(","),

            timezone:
                "auto"

        });


    const response =
        await fetch(
            RESOURCE_CONFIG.airQualityApi +
            "?" +
            params.toString()
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Pollution API HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    const locations =
        Array.isArray(data)
            ? data
            : [data];


    locations.forEach(
        (
            item,
            index
        ) => {

            const current =
                item.current ||
                {};


            const fallback =
                points[
                    index
                ] ||
                points[
                    points.length - 1
                ];


            const zone = {

                lat:
                    Number(
                        item.latitude ??
                        fallback[0]
                    ),

                lng:
                    Number(
                        item.longitude ??
                        fallback[1]
                    ),

                aqi:
                    Number(
                        current.us_aqi ??
                        NaN
                    ),

                pm25:
                    Number(
                        current.pm2_5 ??
                        NaN
                    ),

                pm10:
                    Number(
                        current.pm10 ??
                        NaN
                    ),

                no2:
                    Number(
                        current.nitrogen_dioxide ??
                        NaN
                    ),

                o3:
                    Number(
                        current.ozone ??
                        NaN
                    ),

                co:
                    Number(
                        current.carbon_monoxide ??
                        NaN
                    )

            };


            if (
                Number.isFinite(
                    zone.lat
                ) &&
                Number.isFinite(
                    zone.lng
                )
            ) {

                drawPollutionZone(
                    zone
                );

            }

        }
    );

}


/* =========================================================
   DRAW POLLUTION ZONE
   ========================================================= */

function drawPollutionZone(
    zone
) {

    if (
        !map
    ) {

        return;

    }


    const category =
        getPollutionMapCategory(
            zone.aqi
        );


    const circle =
        L.circle(
            [
                zone.lat,
                zone.lng
            ],
            {

                radius:
                    pollutionRangeKm *
                    1000,

                color:
                    category.color,

                fillColor:
                    category.color,

                fillOpacity:
                    0.15,

                opacity:
                    0.78,

                weight:
                    1.5

            }
        );


    circle.bindPopup(
        `
            <div
                class="pollution-zone-popup"
            >

                <h4>
                    Pollution Zone
                </h4>

                <div>
                    AQI:
                    <strong>
                        ${
                            Number.isFinite(
                                zone.aqi
                            )
                                ? Math.round(
                                    zone.aqi
                                )
                                : "—"
                        }
                    </strong>
                </div>

                <div
                    class="pollution-condition"
                    style="color:${category.color}"
                >
                    ${category.label}
                </div>

                <div
                    class="pollution-popup-details"
                >

                    Radius:
                    ${pollutionRangeKm} km

                    <br>

                    PM2.5:
                    ${formatAirValue(
                        zone.pm25
                    )}
                    µg/m³

                    <br>

                    PM10:
                    ${formatAirValue(
                        zone.pm10
                    )}
                    µg/m³

                    <br>

                    NO₂:
                    ${formatAirValue(
                        zone.no2
                    )}
                    µg/m³

                    <br>

                    O₃:
                    ${formatAirValue(
                        zone.o3
                    )}
                    µg/m³

                    <br>

                    CO:
                    ${formatAirValue(
                        zone.co
                    )}
                    µg/m³

                    <br><br>

                    Model-estimated air quality.

                </div>

            </div>
        `
    );


    circle.addTo(
        map
    );


    pollutionZoneLayers.push(
        circle
    );

}


/* =========================================================
   POLLUTION CATEGORY
   ========================================================= */

function getPollutionMapCategory(
    aqi
) {

    if (
        !Number.isFinite(
            Number(aqi)
        )
    ) {

        return {

            label:
                "Unavailable",

            color:
                "#64748b"

        };

    }


    if (
        aqi <= 50
    ) {

        return {

            label:
                "Low Pollution",

            color:
                "#22c55e"

        };

    }


    if (
        aqi <= 100
    ) {

        return {

            label:
                "Moderate Pollution",

            color:
                "#eab308"

        };

    }


    return {

        label:
            "High Pollution",

        color:
            "#ef4444"

    };

}


/* =========================================================
   CLEAR POLLUTION
   ========================================================= */

function clearPollutionZones() {

    pollutionZoneLayers.forEach(
        layer => {

            try {

                map?.removeLayer(
                    layer
                );

            }
            catch {}

        }
    );


    pollutionZoneLayers =
        [];

}


/* =========================================================
   SEARCH POLLUTION LOCATION
   ========================================================= */

async function searchPollutionLocation() {

    const query =
        String(
            pollutionPlaceInput?.value ||
            ""
        ).trim();


    if (
        !query
    ) {

        setPollutionLocationStatus(
            "Enter a city or area first.",
            "error"
        );

        return;

    }


    if (
        pollutionPlaceSearchBtn
    ) {

        pollutionPlaceSearchBtn.disabled =
            true;

    }


    setPollutionLocationStatus(
        "Finding location...",
        "normal"
    );


    if (
        pollutionLocationResult
    ) {

        pollutionLocationResult.innerHTML =
            `
                <div
                    class="pollution-location-empty"
                >

                    <div
                        class="pollution-location-empty-icon"
                    >

                        <i
                            class="fa-solid fa-spinner fa-spin"
                        ></i>

                    </div>

                    <h3>
                        Searching...
                    </h3>

                    <p>
                        Finding the location and
                        loading pollution data.
                    </p>

                </div>
            `;

    }


    try {

        const place =
            await geocodePlace(
                query
            );


        if (
            !place
        ) {

            throw new Error(
                "Location not found."
            );

        }


        const lat =
            Number(
                place.lat
            );


        const lng =
            Number(
                place.lon
            );


        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
        ) {

            throw new Error(
                "Invalid location returned."
            );

        }


        const air =
            await fetchAirForPlace(
                lat,
                lng
            );


        searchedPollutionLocation = {

            lat,

            lng,

            name:
                place.name ||
                query,

            displayName:
                place.display_name ||
                query,

            air

        };


        renderPollutionLocationResult(
            searchedPollutionLocation
        );


        setPollutionLocationStatus(
            "Location pollution loaded successfully.",
            "success"
        );

    }
    catch (
        error
    ) {

        console.error(
            "[ChronicAI] Pollution search error:",
            error
        );


        if (
            pollutionLocationResult
        ) {

            pollutionLocationResult.innerHTML =
                `
                    <div
                        class="pollution-location-empty"
                    >

                        <div
                            class="pollution-location-empty-icon"
                        >

                            <i
                                class="fa-solid fa-triangle-exclamation"
                            ></i>

                        </div>

                        <h3>
                            Could not load pollution
                        </h3>

                        <p>
                            Try another city,
                            town or area name.
                        </p>

                    </div>
                `;

        }


        setPollutionLocationStatus(
            error.message ||
            "Unable to load pollution data.",
            "error"
        );

    }
    finally {

        if (
            pollutionPlaceSearchBtn
        ) {

            pollutionPlaceSearchBtn.disabled =
                false;

        }

    }

}


/* =========================================================
   GEOCODE
   ========================================================= */

async function geocodePlace(
    query
) {

    const params =
        new URLSearchParams({

            q:
                query,

            format:
                "jsonv2",

            limit:
                "1"

        });


    const response =
        await fetch(
            RESOURCE_CONFIG.geocodeApi +
            "?" +
            params.toString(),
            {

                headers:
                    {
                        "Accept":
                            "application/json"
                    }

            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Location search HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    if (
        !Array.isArray(data) ||
        !data.length
    ) {

        return null;

    }


    return data[0];

}


/* =========================================================
   AIR FOR SEARCHED LOCATION
   ========================================================= */

async function fetchAirForPlace(
    latitude,
    longitude
) {

    const params =
        new URLSearchParams({

            latitude:
                String(latitude),

            longitude:
                String(longitude),

            current:
                [
                    "us_aqi",
                    "european_aqi",
                    "pm2_5",
                    "pm10",
                    "nitrogen_dioxide",
                    "ozone",
                    "carbon_monoxide"
                ].join(","),

            timezone:
                "auto"

        });


    const response =
        await fetch(
            RESOURCE_CONFIG.airQualityApi +
            "?" +
            params.toString()
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Air quality HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    const current =
        data.current ||
        {};


    return {

        aqi:
            Number(
                current.us_aqi ??
                current.european_aqi ??
                NaN
            ),

        pm25:
            Number(
                current.pm2_5 ??
                NaN
            ),

        pm10:
            Number(
                current.pm10 ??
                NaN
            ),

        no2:
            Number(
                current.nitrogen_dioxide ??
                NaN
            ),

        o3:
            Number(
                current.ozone ??
                NaN
            ),

        co:
            Number(
                current.carbon_monoxide ??
                NaN
            )

    };

}


/* =========================================================
   POLLUTION SEARCH RESULT
   ========================================================= */

function renderPollutionLocationResult(
    location
) {

    if (
        !pollutionLocationResult
    ) {

        return;

    }


    const air =
        location.air;


    const category =
        getAQICategory(
            air.aqi
        );


    pollutionLocationResult.innerHTML =
        `
            <div
                class="pollution-place-result"
            >

                <div
                    class="pollution-place-summary"
                >

                    <h3
                        class="pollution-place-name"
                    >
                        ${escapeHtml(
                            location.name
                        )}
                    </h3>

                    <div
                        class="pollution-place-address"
                    >
                        ${escapeHtml(
                            location.displayName
                        )}
                    </div>

                    <div
                        class="pollution-place-condition ${category.className}"
                    >
                        ${category.label}
                    </div>

                    <div
                        class="pollution-place-aqi"
                    >

                        AQI

                        <strong>
                            ${
                                Number.isFinite(
                                    air.aqi
                                )
                                    ? Math.round(
                                        air.aqi
                                    )
                                    : "—"
                            }
                        </strong>

                    </div>

                    <button
                        type="button"
                        id="showSearchedPollutionOnMap"
                        class="pollution-map-place-btn"
                    >

                        <i
                            class="fa-solid fa-map-location-dot"
                        ></i>

                        Show on Map

                    </button>

                </div>


                <div
                    class="pollution-place-values"
                >

                    <div
                        class="pollution-place-values-grid"
                    >

                        ${createPollutionValue(
                            "PM2.5",
                            air.pm25
                        )}

                        ${createPollutionValue(
                            "PM10",
                            air.pm10
                        )}

                        ${createPollutionValue(
                            "NO₂",
                            air.no2
                        )}

                        ${createPollutionValue(
                            "O₃",
                            air.o3
                        )}

                        ${createPollutionValue(
                            "CO",
                            air.co
                        )}

                        <div
                            class="pollution-place-value"
                        >

                            <span>
                                Safety
                            </span>

                            <strong>
                                ${escapeHtml(
                                    category.safety
                                )}
                            </strong>

                            <small>
                                indicator
                            </small>

                        </div>

                    </div>

                </div>

            </div>
        `;


    document
        .getElementById(
            "showSearchedPollutionOnMap"
        )
        ?.addEventListener(
            "click",
            showSearchedPollutionOnMap
        );

}


function createPollutionValue(
    label,
    value
) {

    return `
        <div
            class="pollution-place-value"
        >

            <span>
                ${escapeHtml(
                    label
                )}
            </span>

            <strong>
                ${formatAirValue(
                    value
                )}
            </strong>

            <small>
                µg/m³
            </small>

        </div>
    `;

}


/* =========================================================
   SHOW SEARCHED LOCATION
   ========================================================= */

async function showSearchedPollutionOnMap() {

    if (
        !searchedPollutionLocation ||
        !map
    ) {

        return;

    }


    const location =
        searchedPollutionLocation;


    map.setView(
        [
            location.lat,
            location.lng
        ],
        12,
        {
            animate:
                true
        }
    );


    clearSearchedMarker();


    const icon =
        L.divIcon(
            {

                className:
                    "searched-pollution-marker",

                html:
                    `
                        <div style="
                            width:20px;
                            height:20px;
                            border-radius:50%;
                            background:#ffffff;
                            border:5px solid #8b5cf6;
                            box-shadow:
                                0 0 0 8px rgba(139,92,246,.17),
                                0 0 25px rgba(139,92,246,.65);
                        "></div>
                    `,

                iconSize:
                    [
                        20,
                        20
                    ],

                iconAnchor:
                    [
                        10,
                        10
                    ]

            }
        );


    searchedLocationMarker =
        L.marker(
            [
                location.lat,
                location.lng
            ],
            {

                icon:
                    icon,

                zIndexOffset:
                    4000

            }
        )
        .addTo(
            map
        )
        .bindPopup(
            `
                <strong>
                    ${escapeHtml(
                        location.name
                    )}
                </strong>

                <br><br>

                AQI:
                ${
                    Number.isFinite(
                        location.air.aqi
                    )
                        ? Math.round(
                            location.air.aqi
                        )
                        : "—"
                }

                <br>

                ${escapeHtml(
                    getAQICategory(
                        location.air.aqi
                    ).label
                )}
            `
        )
        .openPopup();


    pollutionTrackerEnabled =
        true;


    pollutionTrackerBtn?.classList.add(
        "active"
    );


    pollutionTrackerBtn?.setAttribute(
        "aria-pressed",
        "true"
    );


    pollutionMapLegend?.classList.add(
        "show"
    );


    try {

        if (
            mapStatus
        ) {

            mapStatus.textContent =
                `Loading ${pollutionRangeKm} km pollution...`;

        }


        await loadPollutionZones(
            location.lat,
            location.lng
        );


        if (
            mapStatus
        ) {

            mapStatus.textContent =
                `Pollution map — ${location.name}`;

        }

    }
    catch (
        error
    ) {

        console.error(
            "[ChronicAI] Pollution map error:",
            error
        );


        if (
            mapStatus
        ) {

            mapStatus.textContent =
                "Pollution map unavailable";

        }

    }

}


/* =========================================================
   CLEAR SEARCHED MARKER
   ========================================================= */

function clearSearchedMarker() {

    if (
        searchedLocationMarker
    ) {

        try {

            map?.removeLayer(
                searchedLocationMarker
            );

        }
        catch {}


        searchedLocationMarker =
            null;

    }

}


/* =========================================================
   POLLUTION SEARCH STATUS
   ========================================================= */

function setPollutionLocationStatus(
    message,
    type
) {

    if (
        !pollutionLocationStatus
    ) {

        return;

    }


    pollutionLocationStatus.textContent =
        message;


    pollutionLocationStatus.classList.remove(
        "error",
        "success"
    );


    if (
        type === "error"
    ) {

        pollutionLocationStatus.classList.add(
            "error"
        );

    }


    if (
        type === "success"
    ) {

        pollutionLocationStatus.classList.add(
            "success"
        );

    }

}


/* =========================================================
   AUTO AIR QUALITY REFRESH
   ========================================================= */

setInterval(
    () => {

        const target =
            searchedPollutionLocation ||
            userLocation;


        if (
            !target
        ) {

            return;

        }


        loadAirQuality(
            target.lat,
            target.lng
        );


        if (
            pollutionTrackerEnabled
        ) {

            loadPollutionZones(
                target.lat,
                target.lng
            );

        }

    },
    RESOURCE_CONFIG.airRefreshMs
);


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ??
            ""
        );


    return div.innerHTML;

}
