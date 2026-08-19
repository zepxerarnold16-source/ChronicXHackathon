"use strict";


/* =========================================================
   CHRONICAI RESOURCE CENTER
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const RESOURCE_CONFIG = {

    defaultLat:
        22.5726,

    defaultLng:
        88.3639,

    defaultZoom:
        13,

    overpassEndpoints: [

        "https://overpass-api.de/api/interpreter",

        "https://overpass.kumi.systems/api/interpreter"

    ],

    airQualityApi:
        "https://air-quality-api.open-meteo.com/v1/air-quality",

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

let searchedPollutionLocation = null;

let currentFilter = "all";

let currentRadius = 5;

let pollutionTrackerEnabled = false;

let pollutionRangeKm = 1;


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


/* AIR QUALITY */

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


/* SEARCH LOCATION */

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
   INIT
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

    map =
        L.map(
            "resourceMap"
        )
        .setView(
            [
                RESOURCE_CONFIG.defaultLat,
                RESOURCE_CONFIG.defaultLng
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


    mapStatus.textContent =
        "Ready";

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

            currentRadius =
                Number(
                    distanceFilter.value
                );


            if (
                userLocation
            ) {

                renderMarkers();

                renderResources();

            }

        }
    );


    filterButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    filterButtons.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    button.classList.add(
                        "active"
                    );


                    currentFilter =
                        button.dataset.type;


                    renderMarkers();

                    renderResources();

                }
            );

        }
    );


    /* POLLUTION TRACKER */

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
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    button.classList.add(
                        "active"
                    );


                    pollutionRangeKm =
                        Number(
                            button.dataset.range
                        );


                    if (
                        pollutionTrackerEnabled
                    ) {

                        const target =
                            searchedPollutionLocation ||
                            userLocation;


                        if (target) {

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


    /* AIR QUALITY */

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


    /* SEARCHED POLLUTION */

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
   REFRESH
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


    locateBtn.disabled =
        true;


    setLocationStatus(
        "Getting your live location...",
        "normal"
    );


    navigator.geolocation.getCurrentPosition(

        position => {

            userLocation = {

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


            saveLocation(
                userLocation
            );


            /*
               Remove previously searched map marker
               because user is returning to GPS location.
            */

            clearSearchedMarker();


            updateUserMarker(
                userLocation.lat,
                userLocation.lng,
                userLocation.accuracy
            );


            map.setView(
                [
                    userLocation.lat,
                    userLocation.lng
                ],
                14,
                {
                    animate:
                        true
                }
            );


            setLocationStatus(
                `Location detected ±${Math.round(
                    userLocation.accuracy
                )}m`,
                "success"
            );


            locateBtn.disabled =
                false;


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

        },

        error => {

            locateBtn.disabled =
                false;


            handleLocationError(
                error
            );

        },

        {

            enableHighAccuracy:
                true,

            timeout:
                15000,

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

    if (!locationStatus) {

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
        error.code ===
        error.PERMISSION_DENIED
    ) {

        message =
            "Location permission was denied. Allow location access and try again.";

    }
    else if (
        error.code ===
        error.POSITION_UNAVAILABLE
    ) {

        message =
            "Your location is currently unavailable.";

    }
    else if (
        error.code ===
        error.TIMEOUT
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
                    [18,18],

                iconAnchor:
                    [9,9]

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
                        accuracy,
                        20
                    ),

                color:
                    "#4da3ff",

                fillColor:
                    "#4da3ff",

                fillOpacity:
                    .05,

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


/* =========================================================
   RESOURCES
========================================================= */

async function loadNearbyResources() {

    if (
        !userLocation
    ) {

        return;

    }


    mapStatus.textContent =
        "Searching resources...";


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
                    Searching around your location...
                </p>

            </div>
        `;


    try {

        const data =
            await fetchOverpassData(
                userLocation.lat,
                userLocation.lng,
                currentRadius
            );


        resources =
            normalizeResources(
                data
            );


        saveResources(
            resources
        );


        renderMarkers();

        renderResources();


        mapStatus.textContent =
            resources.length
                ? "Live resource data"
                : "No live resources";

    }

    catch (
        error
    ) {

        console.warn(
            "Resource search failed:",
            error
        );


        resources =
            loadCachedResources();


        renderMarkers();

        renderResources();


        mapStatus.textContent =
            resources.length
                ? "Cached resources"
                : "Offline";

    }

}


/* =========================================================
   OVERPASS
========================================================= */

async function fetchOverpassData(
    lat,
    lng,
    radiusKm
) {

    const radius =
        radiusKm * 1000;


    const query = `

        [out:json][timeout:20];

        (

            nwr[
                amenity=hospital
            ](
                around:${radius},
                ${lat},
                ${lng}
            );

            nwr[
                amenity=police
            ](
                around:${radius},
                ${lat},
                ${lng}
            );

            nwr[
                amenity=fire_station
            ](
                around:${radius},
                ${lat},
                ${lng}
            );

            nwr[
                office=government
            ](
                around:${radius},
                ${lat},
                ${lng}
            );

            nwr[
                amenity=social_centre
            ](
                around:${radius},
                ${lat},
                ${lng}
            );

            nwr[
                amenity=community_centre
            ](
                around:${radius},
                ${lat},
                ${lng}
            );

        );

        out center tags;

    `;


    let lastError =
        null;


    for (
        const endpoint of
        RESOURCE_CONFIG.overpassEndpoints
    ) {

        try {

            const response =
                await fetch(
                    endpoint,
                    {

                        method:
                            "POST",

                        headers:
                            {
                                "Content-Type":
                                    "application/x-www-form-urlencoded"
                            },

                        body:
                            "data=" +
                            encodeURIComponent(
                                query
                            )

                    }
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `Overpass HTTP ${response.status}`
                );

            }


            return await response.json();

        }

        catch (
            error
        ) {

            lastError =
                error;

        }

    }


    throw (
        lastError ||
        new Error(
            "Resource API unavailable."
        )
    );

}


/* =========================================================
   NORMALIZE RESOURCES
========================================================= */

function normalizeResources(
    data
) {

    if (
        !data ||
        !Array.isArray(
            data.elements
        )
    ) {

        return [];

    }


    const normalized =
        [];


    data.elements.forEach(
        element => {

            const tags =
                element.tags ||
                {};


            let type =
                null;


            if (
                tags.amenity ===
                "hospital"
            ) {

                type =
                    "hospital";

            }
            else if (
                tags.amenity ===
                "police"
            ) {

                type =
                    "police";

            }
            else if (
                tags.amenity ===
                "fire_station"
            ) {

                type =
                    "fire";

            }
            else if (
                tags.office ===
                "government"
            ) {

                type =
                    "government";

            }
            else if (
                tags.amenity ===
                    "social_centre" ||
                tags.amenity ===
                    "community_centre"
            ) {

                type =
                    "relief";

            }


            if (!type) {

                return;

            }


            const lat =
                element.lat ??
                element.center?.lat;


            const lng =
                element.lon ??
                element.center?.lon;


            if (
                typeof lat !== "number" ||
                typeof lng !== "number"
            ) {

                return;

            }


            normalized.push({

                id:
                    `${element.type}-${element.id}`,

                name:
                    tags.name ||
                    TYPE_CONFIG[type].label,

                type,

                lat,

                lng,

                address:
                    [
                        tags["addr:housenumber"],
                        tags["addr:street"],
                        tags["addr:suburb"],
                        tags["addr:city"]
                    ]
                    .filter(
                        Boolean
                    )
                    .join(
                        ", "
                    )
                    ||
                    "Address information unavailable",

                phone:
                    tags.phone ||
                    tags["contact:phone"] ||
                    "",

                website:
                    tags.website ||
                    "",

                distance:
                    calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        lat,
                        lng
                    )

            });

        }
    );


    return normalized.sort(
        (a,b) =>
            a.distance -
            b.distance
    );

}


/* =========================================================
   MARKERS
========================================================= */

function renderMarkers() {

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
                currentFilter !== "all" &&
                resource.type !== currentFilter
            ) {

                return;

            }


            if (
                resource.distance >
                currentRadius
            ) {

                return;

            }


            const marker =
                L.marker(
                    [
                        resource.lat,
                        resource.lng
                    ]
                )
                .addTo(
                    map
                );


            marker.bindPopup(
                `
                    <strong>
                        ${escapeHtml(
                            resource.name
                        )}
                    </strong>

                    <br>

                    ${escapeHtml(
                        TYPE_CONFIG[
                            resource.type
                        ].label
                    )}

                    <br>

                    ${formatDistance(
                        resource.distance
                    )}

                    <br><br>

                    <a
                        target="_blank"
                        rel="noopener"
                        href="https://www.google.com/maps/dir/?api=1&destination=${resource.lat},${resource.lng}"
                    >
                        Get Directions
                    </a>
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

    const filtered =
        resources.filter(
            resource => {

                const typeOk =
                    currentFilter === "all" ||
                    resource.type === currentFilter;


                const distanceOk =
                    resource.distance <=
                    currentRadius;


                return (
                    typeOk &&
                    distanceOk
                );

            }
        );


    resourceCount.textContent =
        filtered.length;


    if (
        !filtered.length
    ) {

        resourceList.innerHTML =
            `
                <div class="empty-state">

                    <div class="empty-icon">

                        <i class="fa-solid fa-map-location-dot"></i>

                    </div>

                    <h4>
                        No Resources Found
                    </h4>

                    <p>
                        Try another category or
                        increase the search radius.
                    </p>

                </div>
            `;

        return;

    }


    resourceList.innerHTML =
        filtered
            .map(
                createResourceCard
            )
            .join("");

}


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
                    href="tel:${escapeHtml(
                        resource.phone
                    )}"
                >
                    <i class="fa-solid fa-phone"></i>
                    Call
                </a>
            `
            : "";


    const website =
        resource.website
            ? `
                <a
                    class="resource-action"
                    href="${escapeHtml(
                        resource.website
                    )}"
                    target="_blank"
                    rel="noopener"
                >
                    <i class="fa-solid fa-globe"></i>
                    Web
                </a>
            `
            : "";


    return `

        <article class="resource-item">

            <div class="resource-item-top">

                <div class="resource-type-icon">

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

                    <div class="resource-type">
                        ${escapeHtml(
                            config.label
                        )}
                    </div>

                </div>


                <span class="resource-distance">
                    ${formatDistance(
                        resource.distance
                    )}
                </span>

            </div>


            <div class="resource-address">

                <i class="fa-solid fa-location-dot"></i>

                ${escapeHtml(
                    resource.address
                )}

            </div>


            <div class="resource-actions">

                <a
                    class="resource-action primary"
                    href="https://www.google.com/maps/dir/?api=1&destination=${resource.lat},${resource.lng}"
                    target="_blank"
                    rel="noopener"
                >

                    <i class="fa-solid fa-route"></i>

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
            lat2 - lat1
        );


    const dLng =
        toRadians(
            lon2 - lon1
        );


    const a =
        Math.sin(
            dLat / 2
        ) ** 2

        +

        Math.cos(
            toRadians(lat1)
        )
        *
        Math.cos(
            toRadians(lat2)
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
            Math.sqrt(1-a)
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
        distance.toFixed(1) +
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
                location
            )
        );

    }
    catch {}

}


function loadSavedLocation() {

    try {

        const raw =
            localStorage.getItem(
                "chronicai_resource_location"
            );


        if (!raw) {

            return;

        }


        const saved =
            JSON.parse(
                raw
            );


        if (
            typeof saved.lat !== "number" ||
            typeof saved.lng !== "number"
        ) {

            return;

        }


        userLocation =
            saved;


        updateUserMarker(
            saved.lat,
            saved.lng,
            saved.accuracy || 50
        );


        map.setView(
            [
                saved.lat,
                saved.lng
            ],
            13
        );


        setLocationStatus(
            "Using saved location. Tap Use My Location to update.",
            "success"
        );


        loadAirQuality(
            saved.lat,
            saved.lng
        );

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


        if (!raw) {

            return [];

        }


        const data =
            JSON.parse(
                raw
            );


        return Array.isArray(data)
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
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        return;

    }


    setAirLoading();


    const params =
        new URLSearchParams({

            latitude,

            longitude,

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
            data.current || {};


        const values = {

            aqi:
                Number(
                    current.us_aqi ??
                    current.european_aqi ??
                    0
                ),

            pm25:
                Number(
                    current.pm2_5 ??
                    0
                ),

            pm10:
                Number(
                    current.pm10 ??
                    0
                ),

            no2:
                Number(
                    current.nitrogen_dioxide ??
                    0
                ),

            o3:
                Number(
                    current.ozone ??
                    0
                ),

            co:
                Number(
                    current.carbon_monoxide ??
                    0
                )

        };


        renderAirQuality(
            values
        );

    }
    catch (error) {

        console.error(
            "Air quality error:",
            error
        );


        setAirError();

    }

}


/* =========================================================
   AIR UI
========================================================= */

function setAirLoading() {

    if (!airQualityStatus) {

        return;

    }


    airQualityStatus.className =
        "air-quality-status loading";


    airQualityStatus.innerHTML =
        `
            <span class="air-status-dot"></span>
            Loading
        `;

}


function updateAirWaitingState() {

    if (!airQualityStatus) {

        return;

    }


    airQualityStatus.className =
        "air-quality-status loading";


    airQualityStatus.innerHTML =
        `
            <span class="air-status-dot"></span>
            Waiting
        `;

}


function setAirError() {

    if (airQualityStatus) {

        airQualityStatus.className =
            "air-quality-status poor";

        airQualityStatus.innerHTML =
            `
                <span class="air-status-dot"></span>
                Unavailable
            `;

    }


    if (aqiCondition) {

        aqiCondition.textContent =
            "Data unavailable";

    }


    if (aqiDescription) {

        aqiDescription.textContent =
            "Air-quality data could not be loaded right now.";

    }


    if (airQualityUpdated) {

        airQualityUpdated.textContent =
            "Air-quality update failed.";

    }

}


function setAirMessage(
    message
) {

    if (airQualityUpdated) {

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


    if (airQualityStatus) {

        airQualityStatus.className =
            `air-quality-status ${category.className}`;

        airQualityStatus.innerHTML =
            `
                <span class="air-status-dot"></span>
                ${category.label}
            `;

    }


    if (aqiCircle) {

        aqiCircle.className =
            `aqi-circle ${category.className}`;

    }


    if (aqiValue) {

        aqiValue.textContent =
            Math.round(values.aqi);

    }


    if (aqiCondition) {

        aqiCondition.textContent =
            category.label;

    }


    if (aqiDescription) {

        aqiDescription.textContent =
            category.description;

    }


    if (oxygenSafetyIcon) {

        oxygenSafetyIcon.className =
            `oxygen-safety-icon ${category.className}`;

    }


    if (oxygenSafetyLevel) {

        oxygenSafetyLevel.textContent =
            category.safety;

    }


    if (oxygenSafetyDescription) {

        oxygenSafetyDescription.textContent =
            category.safetyText;

    }


    if (pm25Value) {

        pm25Value.textContent =
            formatAirValue(values.pm25);

    }


    if (pm10Value) {

        pm10Value.textContent =
            formatAirValue(values.pm10);

    }


    if (no2Value) {

        no2Value.textContent =
            formatAirValue(values.no2);

    }


    if (o3Value) {

        o3Value.textContent =
            formatAirValue(values.o3);

    }


    if (coValue) {

        coValue.textContent =
            formatAirValue(values.co);

    }


    if (airQualityUpdated) {

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

    if (aqi <= 50) {

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


    if (aqi <= 100) {

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


    if (aqi <= 150) {

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


    if (aqi <= 200) {

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
        !Number.isFinite(value)
    ) {

        return "—";

    }


    return value < 10
        ? value.toFixed(1)
        : Math.round(value);

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


    if (!pollutionTrackerEnabled) {

        clearPollutionZones();

        mapStatus.textContent =
            "Ready";

        return;

    }


    const target =
        searchedPollutionLocation ||
        userLocation;


    if (!target) {

        mapStatus.textContent =
            "Choose a location first";

        return;

    }


    mapStatus.textContent =
        `Loading ${pollutionRangeKm} km pollution zones...`;


    try {

        await loadPollutionZones(
            target.lat,
            target.lng
        );


        mapStatus.textContent =
            `Pollution ${pollutionRangeKm} km`;

    }
    catch (error) {

        console.error(
            "Pollution tracker error:",
            error
        );


        mapStatus.textContent =
            "Pollution unavailable";

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


    /*
       This is intentionally a visual model layer.
       1 km = local visual zone
       5 km = wider visual zone
    */

    const spread =
        pollutionRangeKm === 1
            ? 0.08
            : 0.25;


    const points = [

        [centerLat + spread, centerLng - spread],
        [centerLat + spread, centerLng],
        [centerLat + spread, centerLng + spread],

        [centerLat, centerLng - spread],
        [centerLat, centerLng],
        [centerLat, centerLng + spread],

        [centerLat - spread, centerLng - spread],
        [centerLat - spread, centerLng],
        [centerLat - spread, centerLng + spread]

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


    if (!response.ok) {

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
        (item, index) => {

            const current =
                item.current || {};


            const zone = {

                lat:
                    Number(
                        item.latitude ??
                        points[index][0]
                    ),

                lng:
                    Number(
                        item.longitude ??
                        points[index][1]
                    ),

                aqi:
                    Number(
                        current.us_aqi ??
                        0
                    ),

                pm25:
                    Number(
                        current.pm2_5 ??
                        0
                    ),

                pm10:
                    Number(
                        current.pm10 ??
                        0
                    ),

                no2:
                    Number(
                        current.nitrogen_dioxide ??
                        0
                    ),

                o3:
                    Number(
                        current.ozone ??
                        0
                    ),

                co:
                    Number(
                        current.carbon_monoxide ??
                        0
                    )

            };


            drawPollutionZone(
                zone
            );

        }
    );

}


/* =========================================================
   DRAW POLLUTION CIRCLE
========================================================= */

function drawPollutionZone(
    zone
) {

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
                    pollutionRangeKm * 1000,

                color:
                    category.color,

                fillColor:
                    category.color,

                fillOpacity:
                    .15,

                opacity:
                    .78,

                weight:
                    1.5

            }
        );


    circle.bindPopup(
        `

            <div class="pollution-zone-popup">

                <h4>
                    Pollution Zone
                </h4>


                <div>

                    AQI:
                    <strong>
                        ${Math.round(
                            zone.aqi
                        )}
                    </strong>

                </div>


                <div
                    class="pollution-condition"
                    style="color:${category.color}"
                >

                    ${category.label}

                </div>


                <div class="pollution-popup-details">

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
   MAP CATEGORY
========================================================= */

function getPollutionMapCategory(
    aqi
) {

    if (aqi <= 50) {

        return {

            label:
                "Low Pollution",

            color:
                "#22c55e"

        };

    }


    if (aqi <= 100) {

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

                map.removeLayer(
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
   EXPLORE POLLUTION BY LOCATION
========================================================= */

async function searchPollutionLocation() {

    const query =
        String(
            pollutionPlaceInput?.value || ""
        ).trim();


    if (!query) {

        setPollutionLocationStatus(
            "Enter a city or area first.",
            "error"
        );

        return;

    }


    pollutionPlaceSearchBtn.disabled =
        true;


    setPollutionLocationStatus(
        "Finding location...",
        "normal"
    );


    pollutionLocationResult.innerHTML =
        `
            <div class="pollution-location-empty">

                <div class="pollution-location-empty-icon">

                    <i class="fa-solid fa-spinner fa-spin"></i>

                </div>

                <h3>
                    Searching...
                </h3>

                <p>
                    Finding the location and loading pollution data.
                </p>

            </div>
        `;


    try {

        const place =
            await geocodePlace(
                query
            );


        if (!place) {

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
    catch (error) {

        console.error(
            error
        );


        pollutionLocationResult.innerHTML =
            `
                <div class="pollution-location-empty">

                    <div class="pollution-location-empty-icon">

                        <i class="fa-solid fa-triangle-exclamation"></i>

                    </div>

                    <h3>
                        Could not load pollution
                    </h3>

                    <p>
                        Try another city, town or area name.
                    </p>

                </div>
            `;


        setPollutionLocationStatus(
            error.message ||
            "Unable to load pollution data.",
            "error"
        );

    }
    finally {

        pollutionPlaceSearchBtn.disabled =
            false;

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
            "https://nominatim.openstreetmap.org/search?" +
            params.toString(),
            {

                headers:
                    {
                        "Accept":
                            "application/json"
                    }

            }
        );


    if (!response.ok) {

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

            latitude,

            longitude,

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


    if (!response.ok) {

        throw new Error(
            `Air quality HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    const current =
        data.current || {};


    return {

        aqi:
            Number(
                current.us_aqi ??
                current.european_aqi ??
                0
            ),

        pm25:
            Number(
                current.pm2_5 ??
                0
            ),

        pm10:
            Number(
                current.pm10 ??
                0
            ),

        no2:
            Number(
                current.nitrogen_dioxide ??
                0
            ),

        o3:
            Number(
                current.ozone ??
                0
            ),

        co:
            Number(
                current.carbon_monoxide ??
                0
            )

    };

}


/* =========================================================
   RESULT
========================================================= */

function renderPollutionLocationResult(
    location
) {

    const air =
        location.air;


    const category =
        getAQICategory(
            air.aqi
        );


    pollutionLocationResult.innerHTML =
        `

            <div class="pollution-place-result">


                <!-- SUMMARY -->

                <div class="pollution-place-summary">

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
                            ${Math.round(
                                air.aqi
                            )}
                        </strong>

                    </div>


                    <button
                        type="button"
                        id="showSearchedPollutionOnMap"
                        class="pollution-map-place-btn"
                    >

                        <i class="fa-solid fa-map-location-dot"></i>

                        Show on Map

                    </button>

                </div>



                <!-- VALUES -->

                <div class="pollution-place-values">

                    <div
                        class="pollution-place-values-grid"
                    >


                        <div class="pollution-place-value">

                            <span>
                                PM2.5
                            </span>

                            <strong>
                                ${formatAirValue(
                                    air.pm25
                                )}
                            </strong>

                            <small>
                                µg/m³
                            </small>

                        </div>


                        <div class="pollution-place-value">

                            <span>
                                PM10
                            </span>

                            <strong>
                                ${formatAirValue(
                                    air.pm10
                                )}
                            </strong>

                            <small>
                                µg/m³
                            </small>

                        </div>


                        <div class="pollution-place-value">

                            <span>
                                NO₂
                            </span>

                            <strong>
                                ${formatAirValue(
                                    air.no2
                                )}
                            </strong>

                            <small>
                                µg/m³
                            </small>

                        </div>


                        <div class="pollution-place-value">

                            <span>
                                O₃
                            </span>

                            <strong>
                                ${formatAirValue(
                                    air.o3
                                )}
                            </strong>

                            <small>
                                µg/m³
                            </small>

                        </div>


                        <div class="pollution-place-value">

                            <span>
                                CO
                            </span>

                            <strong>
                                ${formatAirValue(
                                    air.co
                                )}
                            </strong>

                            <small>
                                µg/m³
                            </small>

                        </div>


                        <div class="pollution-place-value">

                            <span>
                                Safety
                            </span>

                            <strong>
                                ${category.safety}
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


/* =========================================================
   SHOW SEARCHED LOCATION ON MAP
========================================================= */

async function showSearchedPollutionOnMap() {

    if (
        !searchedPollutionLocation
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


    /*
       Remove old searched location marker.
    */

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
                    [20,20],

                iconAnchor:
                    [10,10]

            }
        );


    searchedLocationMarker =
        L.marker(
            [
                location.lat,
                location.lng
            ],
            {

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
                ${Math.round(
                    location.air.aqi
                )}

                <br>

                ${escapeHtml(
                    getAQICategory(
                        location.air.aqi
                    ).label
                )}
            `
        )
        .openPopup();


    /*
       Automatically enable pollution tracker.
    */

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


    /*
       Draw pollution circles around searched place.
    */

    mapStatus.textContent =
        `Loading ${pollutionRangeKm} km pollution...`;


    try {

        await loadPollutionZones(
            location.lat,
            location.lng
        );


        mapStatus.textContent =
            `Pollution map — ${location.name}`;

    }
    catch (error) {

        console.error(
            error
        );


        mapStatus.textContent =
            "Pollution map unavailable";

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

            map.removeLayer(
                searchedLocationMarker
            );

        }
        catch {}

        searchedLocationMarker =
            null;

    }

}


/* =========================================================
   SEARCH STATUS
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
   AUTO REFRESH
========================================================= */

setInterval(
    () => {

        const target =
            searchedPollutionLocation ||
            userLocation;


        if (!target) {

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
            value ?? ""
        );


    return div.innerHTML;

}