/* eslint-env browser */
/* global mapboxglVersions */
/* eslint-disable prefer-arrow-callback, prefer-template, no-promise-executor-return, jsdoc/require-property-description */
import {getAccessToken} from './access_token_generated.js';

const accessToken = getAccessToken();

// Regex patterns for content sanitization
const REGEX_PATTERNS = {
    MAPBOX_JS_CDN: /https:\/\/api\.mapbox\.com\/mapbox-gl-js\/v[0-9]+\.[0-9]+\.[0-9]+\/mapbox-gl\.js/g,
    MAPBOX_CSS_CDN: /https:\/\/api\.mapbox\.com\/mapbox-gl-js\/v[0-9]+\.[0-9]+\.[0-9]+\/mapbox-gl\.css/g,
    SENTRY_SCRIPT: /<script src="https:\/\/js\.sentry-cdn\.com\/[0-9a-f]*\.min\.js"\s*crossorigin="anonymous"><\/script>/g,
    INSTRUMENTILE_SCRIPT: /<script>if\(window\.map instanceof mapboxgl\.Map\)var i=new instrumentile.*<\/script>/g,
    API_KEY: /pk\..*?"/g,
    LOCAL_JS_SCRIPT: /<script src="(.*)mapbox-gl(.*)\.js"><\/script>/g,
    LOCAL_CSS_LINK: /<link rel="stylesheet"(.*)mapbox-gl\.css"(.*)\/>/g
};

/**
 * @typedef {Object} Page
 * @property {string} key
 * @property {string} title
 * @property {string} [url]
 */

/** @type {Page[]} */
const pages = [
    {
        "key": "standard-style",
        "title": "Standard Style",
        "url": "./standard-style.html"
    },
    {
        "key": "animate-point-along-route",
        "title": "Animate route",
        "url": "./animate-point-along-route.html"
    },
    {
        "key": "filter-features-within-map-view",
        "title": "Filter features within map view",
        "url": "./filter-features-with-globe.html"
    },
    {
        "key": "custom-style-layer",
        "title": "Add a custom style layer"
    },
    {
        "key": "mapbox-gl-geocoder",
        "title": "Add a geocoder"
    },
    {
        "key": "mapbox-gl-directions",
        "title": "Display driving directions"
    },
    {
        "key": "locate-user",
        "title": "Locate the user"
    },
    {
        "key": "mapbox-gl-draw",
        "title": "Show drawn polygon area"
    },
    {
        "key": "mapbox-gl-compare",
        "title": "Swipe between maps"
    },
    {
        "key": "mapbox-gl-rtl-text",
        "title": "Add support for right-to-left scripts"
    },
    {
        "key": "heatmap-layer",
        "title": "Add a heatmap layer",
        "url": "./heatmap-layer.html"
    },
    {
        "key": "threejs-antenna",
        "title": "Add a 3d model on terrain with ThreeJS",
        "url": "./threejs-antenna.html"
    },
    {
        "key": "free-camera-path",
        "title": "Animate the camera along a path"
    },
    {
        "key": "query-terrain-elevation",
        "title": "Query terrain elevation"
    },
    {
        "key": "add-fog",
        "title": "Add fog to a map"
    },
    {
        "key": "image-on-a-map",
        "title": "Image Source",
        "url": "./image-on-globe.html"
    },
    {
        "key": "extrusion-query",
        "title": "Extrusion Query",
        "url": "./extrusion-query.html"
    },
    {
        "key": "projections",
        "title": "Projections",
        "url": "./projections.html"
    },
    {
        "key": "featurestate",
        "title": "Feature state",
        "url": "./featurestate.html"
    },
    {
        "key": "markers",
        "title": "Markers",
        "url": "./markers.html"
    },
    {
        "key": "video",
        "title": "Video",
        "url": "./video.html"
    },
    {
        "key": "globe-with-video",
        "title": "Globe with Video",
        "url": "./globe-with-video.html"
    },
    {
        "key": "interactions",
        "title": "Interactions",
        "url": "./featuresets.html"
    },
    {
        "key": "precipitation",
        "title": "Precipitation",
        "url": "./precipitation.html"
    },
    {
        "key": "scroll_zoom_blocker",
        "title": "Gestures",
        "url": "./scroll_zoom_blocker.html"
    },
    {
        "key": "raster-array",
        "title": "Raster Array",
        "url": "./raster-array.html"
    },
    {
        "key": "custom-source",
        "title": "Custom Source",
        "url": "./custom-source.html"
    },
    {
        "key": "landmark-icons",
        "title": "Landmark Icons",
        "url": "./landmark-icons.html"
    },
    {
        "key": "atmosphere",
        "title": "Atmosphere",
        "url": "./atmosphere.html"
    }
];

const versions = {
    'latest': {}
};

for (const [version, metadata] of Object.entries(mapboxglVersions)) {
    versions[version] = metadata;
}

// Wait for DOMContentLoaded
await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));

const titleItem = document.querySelector('#title');
const titleElement = document.querySelector('#title-text');
const titleDropdown = document.querySelector('#title .dropdown');
const container = document.querySelector('#container');
const versionButton = document.querySelector('#version');
const versionItem = document.querySelector('#version-item');
const versionDropdown = document.querySelector('#version-item .dropdown');
const versionNumber = document.querySelector('#version-number');
const prevButton = document.querySelector('#prev');
const nextButton = document.querySelector('#next');

/** @type {AbortController} */
let abortController;

/**
 * Returns the appropriate JS and CSS URLs for the selected version
 * @param {string} version
 * @returns {{js: string, css: string}}
 */
function getUrls(version) {
    if (version === 'latest') {
        return {
            js: './dist/mapbox-gl.js',
            css: './dist/mapbox-gl.css'
        };
    }
    return {
        js: `https://api.mapbox.com/mapbox-gl-js/${version}/mapbox-gl.js`,
        css: `https://api.mapbox.com/mapbox-gl-js/${version}/mapbox-gl.css`
    };
}

/**
 * Sanitizes content from remote docs.mapbox.com pages
 * @param {string} doc
 * @param {string} jsUrl
 * @param {string} cssUrl
 * @returns {string}
 */
function sanitizeRemoteContent(doc, jsUrl, cssUrl) {
    return doc
        .replace(REGEX_PATTERNS.MAPBOX_JS_CDN, jsUrl)
        .replace(REGEX_PATTERNS.MAPBOX_CSS_CDN, cssUrl)
        .replace(REGEX_PATTERNS.API_KEY, `${accessToken}"`)
        .replace(REGEX_PATTERNS.INSTRUMENTILE_SCRIPT, '')
        .replace(REGEX_PATTERNS.SENTRY_SCRIPT, '');
}

/**
 * Sanitizes content from local HTML files
 * @param {string} doc
 * @param {string} jsUrl
 * @param {string} cssUrl
 * @returns {string}
 */
function sanitizeLocalContent(doc, jsUrl, cssUrl) {
    return doc
        .replace(REGEX_PATTERNS.LOCAL_JS_SCRIPT, `<script src="${jsUrl}"></script>`)
        .replace(REGEX_PATTERNS.LOCAL_CSS_LINK, `<link rel="stylesheet" href="${cssUrl}" />`);
}

/**
 * @param {Page} page
 */
async function loadContent(page) {
    if (abortController) {
        abortController.abort();
    }

    container.replaceChildren();

    abortController = new AbortController();
    const url = page.url || `https://docs.mapbox.com/mapbox-gl-js/assets/${page.key}-demo.html`;
    const {js, css} = getUrls(state.version);

    try {
        const response = await fetch(url, {signal: abortController.signal});
        if (!response.ok) {
            container.innerText = `Failed to load ${url}: ${response.statusText}`;
            return;
        }

        let doc = await response.text();

        // Apply correct sanitization based on content source
        doc = page.url ?
            sanitizeLocalContent(doc, js, css) :
            sanitizeRemoteContent(doc, js, css);

        // Create and populate iframe
        const iframe = document.createElement('iframe');
        container.appendChild(iframe);
        const iframeDoc = iframe.contentWindow.document.open("text/html", "replace");
        iframeDoc.write(doc);
        iframeDoc.close();
    } catch (error) {
        if (error.name !== 'AbortError') {
            container.innerText = `Failed to load ${url}: ${error.message}`;
        }
    }
}

/**
 * @param {number} pageIndex
 */
function loadPage(pageIndex) {
    const page = pages[pageIndex];

    // Update state
    state.page = page.key;
    state.index = pageIndex;

    // Update UI
    titleElement.innerText = page.title;
    versionNumber.innerText = state.version;

    // Update navigation buttons
    prevButton.classList.toggle('disabled', pageIndex === 0);
    nextButton.classList.toggle('disabled', pageIndex + 1 === pages.length);

    // Update URL hash
    let hash = `page=${page.key}`;
    if (state.version !== 'latest') {
        hash += `&version=${state.version}`;
    }

    location.hash = hash;

    // Load content
    loadContent(page);
}

/**
 * Initialize the state from URL parameters
 * @returns {{page: string, version: string, index: number}}
 */
function initState() {
    const state = {
        page: pages[0].key,
        version: 'latest',
        index: 0
    };

    const searchParams = new URLSearchParams(location.hash.slice(1));
    for (const [key, value] of searchParams) {
        state[key] = value;
    }

    if (!(state.version in versions)) {
        state.version = 'latest';
    }

    const pageIndex = pages.findIndex(p => p.key === state.page);
    if (pageIndex === -1) {
        state.index = 0;
        state.page = pages[0].key;
    } else {
        state.index = pageIndex;
        state.page = pages[pageIndex].key;
    }

    return state;
}

/**
 * Initialize all UI elements and event listeners
 * @param {{page: string, version: string, index: number}} state
 */
function initUI(state) {
    function closeDropdown() {
        versionItem.classList.remove('active');
        titleItem.classList.remove('active');
    }

    // Navbar expand button
    document.querySelector('.navbar-expand').addEventListener('click', closeDropdown);

    // Title dropdown toggle
    titleElement.addEventListener('click', () => {
        versionItem.classList.remove('active');
        titleItem.classList.toggle('active');
    });

    // Create page dropdown items
    for (const [i, page] of pages.entries()) {
        const item = document.createElement('a');
        item.classList.add('dropdown-item');
        item.innerHTML = `<span class="item-title">${page.title}</span>`;
        item.addEventListener('click', () => {
            state.page = page.key;
            state.index = i;
            closeDropdown();
            loadPage(i);
        });
        titleDropdown.appendChild(item);
    }

    // Navigation buttons
    prevButton.addEventListener('click', () => {
        if (state.index > 0) {
            state.index--;
            loadPage(state.index);
        }
    });

    nextButton.addEventListener('click', () => {
        if (state.index + 1 < pages.length) {
            state.index++;
            loadPage(state.index);
        }
    });

    // Version selector
    versionNumber.innerText = state.version;
    versionButton.addEventListener('click', () => {
        titleItem.classList.remove('active');
        versionItem.classList.toggle('active');
    });

    // Create version dropdown items
    for (const [version, metadata] of Object.entries(versions)) {
        const item = document.createElement('a');
        item.classList.add('dropdown-item');
        if (metadata.prerelease) {
            item.classList.add('item-prerelease');
        }
        item.innerHTML = `<span class="item-title">${version}</span> <span class="item-meta">${metadata.released?.split('T')[0] || '&lt;unknown&gt;'}</span>`;
        item.addEventListener('click', () => {
            state.version = version;
            closeDropdown();
            loadPage(state.index);
        });
        versionDropdown.appendChild(item);
    }
}

const state = initState();
initUI(state);

loadPage(state.index);
