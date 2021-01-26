/* eslint-env browser */
/* eslint-disable prefer-arrow-callback,prefer-template */
/* eslint no-loop-func: "off" */
/* eslint camelcase: "off" */
/* global mapboxgl */
/* global mapboxglVersions */

const pages = [
    {
        "key": "geojson-markers",
        "title": "Add GeoJSON marker"
    },
    {
        "key": "animate-point-along-line",
        "title": "Animate point"
    },
    {
        "key": "queryrenderedfeatures",
        "title": "Get features under the mouse pointer"
    },
    {
        "key": "queryrenderedfeatures",
        "title": "Get features under the mouse pointer (3d)",
        "inject3d": true
    },
    {
        "key": "scroll-fly-to",
        "title": "Fly to a location based on scroll position"
    },
    {
        "key": "popup-on-click",
        "title": "Display a popup on click"
    },
    {
        "key": "hover-styles",
        "title": "Create a hover effect"
    },
    {
        "key": "satellite-map",
        "title": "Display a satellite map"
    },
    {
        "key": "satellite-map",
        "title": "Display a satellite map (3d)",
        "inject3d": true
    },
    {
        "key": "custom-marker-icons",
        "title": "Add custom icons with Markers"
    },
    {
        "key": "filter-features-within-map-view",
        "title": "Filter features within map view"
    },
    {
        "key": "video-on-a-map",
        "title": "Add a video"
    },
    {
        "key": "video-on-a-map",
        "title": "Add a video (3d)",
        "inject3d": true
    },
    {
        "key": "custom-style-layer",
        "title": "Add a custom style layer"
    },
    {
        "key": "custom-style-layer",
        "title": "Add a custom style layer (3d)",
        "inject3d": true
    },
    {
        "key": "adjust-layer-opacity",
        "title": "Adjust a layer's opacity"
    },
    {
        "key": "check-for-support",
        "title": "Check for browser support"
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
        "key": "mapbox-gl-directions",
        "title": "Display driving directions (3d)",
        "inject3d": true
    },
    {
        "key": "mapbox-gl-draw",
        "title": "Show drawn polygon area"
    },
    {
        "key": "mapbox-gl-draw",
        "title": "Show drawn polygon area (3d)",
        "inject3d": true
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
        "title": "Add a heatmap layer"
    },
    {
        "key": "heatmap-layer",
        "title": "Add a heatmap layer (3d)",
        "inject3d": true
    },
    {
        "key": "add-terrain",
        "title": "Add Terrain"
    },
    {
        "key": "atmospheric-sky",
        "title": "Atmospheric Sky"
    },
    {
        "key": "free-camera-point",
        "title": "Free Camera Point"
    },
    {
        "key": "add-3d-model",
        "title": "Add a 3d model"
    },
    {
        "key": "free-camera-path",
        "title": "Animate the camera along a path"
    },
    {
        "key": "image-on-a-map",
        "title": "Image Source"
    },
    {
        "key": "image-on-a-map",
        "title": "Image Source (3d)",
        "inject3d": true
    },
    {
        "key": "3d-playground",
        "title": "3D Playground",
        "url": "./3d-playground.html"
    },
    {
        "key": "skybox-gradient",
        "title": "Skybox gradient",
        "url": "./skybox-gradient.html"
    }
];

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
        page: pages[0].page,
        version: 'latest',
        index: 0
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

    titleElement.addEventListener('click', function() {
        versionItem.classList.remove('active');
        titleItem.classList[titleItem.classList.contains('active') ? 'remove' : 'add']('active');
    });

    let pageIndex = params.index;
    if (pageIndex < 0) pageIndex = 0;
    params.page = pages[pageIndex];
    params.index = pageIndex;

    for (let i = 0; i < pages.length; ++i) {
        const page = pages[i];
        const item = document.createElement('a');
        item.classList.add('dropdown-item');
        item.innerHTML = '<span class="item-title">' + page.title + '</span>';
        item.dataset.page = page;
        item.dataset.index = i;
        item.addEventListener('click', function() {
            params.page = this.dataset.page;
            pageIndex = this.dataset.index;
            if (pageIndex < 0) pageIndex = 0;
            params.page = pages[pageIndex];
            params.index = pageIndex;
            titleItem.classList.remove('active');
            load();
        });
        titleDropdown.appendChild(item);
    }

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

        params.page = pages[pageIndex].page;
        const version = params.version;

        const page = pages[pageIndex];
        titleElement.innerText = page.title;
        versionNumber.innerText = params.version;

        req = new XMLHttpRequest();
        req.addEventListener("load", loadedHTML);
        url = page.url ? page.url : 'https://raw.githubusercontent.com/mapbox/mapbox-gl-js-docs/publisher-production/docs/pages/example/' + page.key + '.html';
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

            let doc = req.response;
            // Only inject 3d code in version > v1
            if (page.inject3d && params.version.substr(0, 2) !== 'v1' && params.version.substr(0, 2) !== 'v0') {
                const regex0 = /new mapboxgl\.Map((.|\n)*?)}\)\);/g;
                const regex1 = /new mapboxgl\.Map((.|\n)*?)}\);/g;
                const match = req.response.match(regex0);
                const regex = match && match.length > 0 ? regex0 : regex1;
                doc = req.response.replace(regex, '$&' +
                    `map.on('style.load', function () {
                        map.addSource('mapbox_dem', {
                            "type": "raster-dem",
                            "url": "mapbox://mapbox.mapbox-terrain-dem-v1",
                            "tileSize": 512,
                            "maxzoom": 14
                        });

                        map.addLayer({
                            'id': 'sky_layer',
                            'type': 'sky',
                            'paint': {
                                'sky-type': 'atmosphere',
                                'sky-atmosphere-sun': [0, 0],
                                'sky-opacity': [
                                    'interpolate',
                                    ['exponential', 0.1],
                                    ['zoom'],
                                    5,
                                    0,
                                    22,
                                    1
                                ]
                            }
                        });

                        map.setTerrain({"source": "mapbox_dem", "exaggeration": 1.2});
                    });`
                );
            }
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
                doc,
                '</body>',
                '</html>' ].join(''));
            iframeDoc.close();
        }

        prevButton.classList[(pageIndex === 0) ? 'add' : 'remove']('disabled');
        nextButton.classList[(pageIndex + 1 === pages.length) ? 'add' : 'remove']('disabled');

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
        if (pageIndex + 1 <= pages.length) {
            pageIndex++;
            load();
        }
    });

    load();
});
