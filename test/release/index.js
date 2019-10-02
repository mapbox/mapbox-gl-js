/* eslint-env browser */
/* eslint-disable prefer-arrow-callback,prefer-template */
/* eslint no-loop-func: "off" */
/* eslint camelcase: "off" */
/* global mapboxgl */
/* global mapboxglVersions */

const pages = {
    "geojson-markers": {
        "title": "Add GeoJSON marker"
    },
    "animate-point-along-line": {
        "title": "Animate point"
    },
    "queryrenderedfeatures": {
        "title": "Get features under the mouse pointer"
    },
    "scroll-fly-to": {
        "title": "Fly to a location based on scroll position"
    },
    "popup-on-click": {
        "title": "Display a popup on click"
    },
    "hover-styles": {
        "title": "Create a hover effect"
    },
    "satellite-map": {
        "title": "Display a satellite map"
    },
    "custom-marker-icons": {
        "title": "Add custom icons with Markers"
    },
    "filter-features-within-map-view": {
        "title": "Filter features within map view"
    },
    "video-on-a-map": {
        "title": "Add a video"
    },
    "custom-style-layer": {
        "title": "Add a custom style layer"
    },
    "adjust-layer-opacity": {
        "title": "Adjust a layer's opacity"
    },
    "check-for-support": {
        "title": "Check for browser support"
    },
    "mapbox-gl-geocoder": {
        "title": "Add a geocoder"
    },
    "mapbox-gl-directions": {
        "title": "Display driving directions"
    },
    "mapbox-gl-draw": {
        "title": "Show drawn polygon area"
    },
    "mapbox-gl-compare": {
        "title": "Swipe between maps"
    },
    "mapbox-gl-rtl-text": {
        "title": "Add support for right-to-left scripts"
    }
};

const pageKeys = Object.keys(pages);

const versions = {
    'latest': {}
};

Object.keys(mapboxglVersions).forEach(function(version) {
    versions[version] = mapboxglVersions[version];
});

document.addEventListener('DOMContentLoaded', function() {
    const jsLatest = document.createElement("a");
    jsLatest.href = "../../dist/mapbox-gl.js";
    const cssLatest = document.createElement("a");
    cssLatest.href = "../../dist/mapbox-gl.css";

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

    document.querySelector('.navbar-expand').addEventListener('click', function() {
        versionItem.classList.remove('active');
        titleItem.classList.remove('active');
    });

    const params = {
        page: pages[0],
        version: 'latest'
    };

    location.hash.substr(1).split('&').forEach(function (param) {
        const entry = param.split('=', 2);
        params[entry[0]] = entry[1];
    });

    if (!params.access_token) {
        if (mapboxgl.accessToken) {
            params.access_token = mapboxgl.accessToken;
        } else {
            params.access_token = prompt("Access Token");
        }
    }

    let pageIndex = pageKeys.indexOf(params.page);
    if (pageIndex < 0) pageIndex = 0;
    params.page = pageKeys[pageIndex];

    titleElement.addEventListener('click', function() {
        versionItem.classList.remove('active');
        titleItem.classList[titleItem.classList.contains('active') ? 'remove' : 'add']('active');
    });

    Object.keys(pages).forEach(function(page) {
        const item = document.createElement('a');
        item.classList.add('dropdown-item');
        const metadata = pages[page];
        item.innerHTML = '<span class="item-title">' + metadata.title + '</span>';
        item.dataset.page = page;
        item.addEventListener('click', function() {
            params.page = this.dataset.page;
            pageIndex = pageKeys.indexOf(this.dataset.page);
            if (pageIndex < 0) pageIndex = 0;
            params.page = pageKeys[pageIndex];
            titleItem.classList.remove('active');
            load();
        });
        titleDropdown.appendChild(item);
    });

    if (!(params.version in versions)) {
        params.version = 'latest';
    }

    versionNumber.innerText = params.version;
    versionButton.addEventListener('click', function() {
        titleItem.classList.remove('active');
        versionItem.classList[versionItem.classList.contains('active') ? 'remove' : 'add']('active');
    });

    Object.keys(versions).forEach(function(version) {
        const item = document.createElement('a');
        item.classList.add('dropdown-item');
        const metadata = versions[version];
        if (metadata.prerelease) {
            item.classList.add('item-prerelease');
        }
        item.innerHTML = '<span class="item-title">' + version + '</span> <span class="item-meta">' + (metadata.released ? (new Date(metadata.released)).toISOString().substr(0, 10) : '&lt;unknown&gt;') +  '</span>';
        item.dataset.version = version;
        item.addEventListener('click', function() {
            params.version = this.dataset.version;
            versionItem.classList.remove('active');
            load();
        });
        versionDropdown.appendChild(item);
    });

    let req;
    let url;

    function load() {
        if (req) {
            req.abort();
        }

        while (container.firstChild) container.removeChild(container.firstChild);

        params.page = pageKeys[pageIndex];
        const page = params.page;
        const version = params.version;

        const metadata = pages[page];
        titleElement.innerText = metadata.title;
        versionNumber.innerText = params.version;

        req = new XMLHttpRequest();
        req.addEventListener("load", loadedHTML);
        url = metadata.url ? metadata.url : 'https://raw.githubusercontent.com/mapbox/mapbox-gl-js-docs/publisher-production/docs/pages/example/' + page + '.html';
        req.open("GET", url);
        req.send();

        function loadedHTML() {
            if (req.status !== 200) {
                container.innerText = 'Failed to load ' + url + ': ' + req.statusText;
                return;
            }
            const iframe = document.createElement('iframe');
            container.appendChild(iframe);
            const iframeDoc = iframe.contentWindow.document.open("text/html", "replace");

            const js = version === 'latest' ? jsLatest.href : 'https://api.mapbox.com/mapbox-gl-js/' + version + '/mapbox-gl.js';
            const css = version === 'latest' ? cssLatest.href : 'https://api.mapbox.com/mapbox-gl-js/' + version + '/mapbox-gl.css';

            iframeDoc.write([
                '<!DOCTYPE html>',
                '<html>',
                '<head>',
                '    <title>Mapbox GL JS debug page</title>',
                '    <meta charset="utf-8">',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">',
                '    <script src="' + js + '"><\/script>',
                '    <script>mapboxgl.accessToken = "' + params.access_token + '";<\/script>',
                '    <link rel="stylesheet" href="' + css + '" />',
                '    <style>',
                '        body { margin: 0; padding: 0; }',
                '        html, body, #map { height: 100%; }',
                '    </style>',
                '</head>',
                '<body>',
                req.response,
                '</body>',
                '</html>' ].join(''));
            iframeDoc.close();
        }

        prevButton.classList[(pageIndex === 0) ? 'add' : 'remove']('disabled');
        nextButton.classList[(pageIndex + 1 === pageKeys.length) ? 'add' : 'remove']('disabled');

        let hash = 'page=' + page;
        if (version !== 'latest') {
            hash += '&version=' + version;
        }
        if (!mapboxgl.accessToken) {
            hash += '&access_token=' + params.access_token;
        }
        location.hash = hash;
    }

    prevButton.addEventListener('click', function() {
        if (pageIndex > 0) {
            pageIndex--;
            load();
        }
    });

    nextButton.addEventListener('click', function() {
        if (pageIndex + 1 <= pageKeys.length) {
            pageIndex++;
            load();
        }
    });

    load();
});
