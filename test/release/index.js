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
        "key": "custom-style-layer",
        "title": "Add a custom style layer"
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
        "title": "Add a heatmap layer"
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
        "key": "three-js-antenna",
        "title": "Add a 3d model on terrain with ThreeJS",
        "url": "./three-js-antenna.html"
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
        "key": "locate-user",
        "title": "Locate the user"
    },
    {
        "key": "extrusion-query",
        "url": "./extrusion-query.html",
        "title": "Fill extrusion querying with terrain"
    },
    {
        "key": "3d-playground",
        "title": "3D Playground",
        "url": "./3d-playground.html"
    },
    {
        "key": "fog-demo",
        "title": "Fog Demo",
        "url": "./fog-demo.html"
    },
    {
        "key": "fog",
        "title": "Fog",
        "url": "./fog.html"
    },
    {
        "key": "skybox-gradient",
        "title": "Skybox gradient",
        "url": "./skybox-gradient.html"
    },
    {
        "key": "canvas-size",
        "title": "Canvas Size",
        "url": "./canvas-size.html"
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
        "key": "scroll_zoom_blocker",
        "title": "Cooperative gesture handling",
        "url": "./scroll_zoom_blocker.html"
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
        page: pages[0].key,
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

    let pageIndex = 0;
    for (let i = 0; i < pages.length; i++) {
        if (params.page === pages[i].key) {
            pageIndex = i;
            break;
        }
    }
    params.index = pageIndex;
    params.page = pages[pageIndex].key;

    for (let i = 0; i < pages.length; ++i) {
        const page = pages[i];
        const item = document.createElement('a');
        item.classList.add('dropdown-item');
        item.innerHTML = '<span class="item-title">' + page.title + '</span>';
        item.dataset.page = page;
        item.dataset.index = i;
        item.addEventListener('click', function() {
            pageIndex = this.dataset.index;
            if (pageIndex < 0) pageIndex = 0;
            params.page = pages[pageIndex].key;
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

        params.page = pages[pageIndex].key;
        const version = params.version;

        const page = pages[pageIndex];
        titleElement.innerText = page.title;
        versionNumber.innerText = params.version;

        req = new XMLHttpRequest();
        req.addEventListener("load", loadedHTML);

        url = page.url ? page.url : 'https://docs.mapbox.com/mapbox-gl-js/assets/' + page.key + '-demo.html';
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

            if (!page.url) { // Perform cleanups for pages hosted on docs.mapbox.com, otherwise directly use demo code
                const versionLibRegex = /https:\/\/api\.mapbox\.com\/mapbox-gl-js\/v[0-9]+\.[0-9]+\.[0-9]+\/mapbox-gl\.js/g;
                const versionCSSRegex = /https:\/\/api\.mapbox\.com\/mapbox-gl-js\/v[0-9]+\.[0-9]+\.[0-9]+\/mapbox-gl\.css/g;
                const sentryRegex = /<script src="https:\/\/js\.sentry-cdn\.com\/[0-9a-f]*\.min\.js"\s*crossorigin="anonymous"><\/script>/g;
                const instrumentileRegex = /<script>if\(window\.map instanceof mapboxgl\.Map\)var i=new instrumentile.*<\/script>/g;
                const apiKeyRegex = /pk\..*?"/g;

                // Update versions + api key
                doc = doc.replace(versionLibRegex, js);
                doc = doc.replace(versionCSSRegex, css);
                doc = doc.replace(apiKeyRegex, params.access_token + '"');

                // Remove extraneous analytics
                doc = doc.replace(instrumentileRegex, '');
                doc = doc.replace(sentryRegex, '');
            } else { // Perform cleanups of pages locally referenced
                const versionLibRegex = /<script src='(.*)mapbox-gl(.*)\.js'><\/script>/g;
                const versionCSSRegex = /<link rel='stylesheet'(.*)mapbox-gl\.css'(.*)\/>/g;
                const apiKeyRegex = /<script(.*)access_token_generated\.js(.*)\/script>/g;

                doc = doc.replace(versionLibRegex, '<script src="' + js + '"></script>');
                doc = doc.replace(versionCSSRegex, '<link rel="stylesheet" href="' + css + '" />');
                doc = doc.replace(apiKeyRegex, '<script>mapboxgl.accessToken="' + params.access_token + '"</script>');
            }

            iframeDoc.write([doc].join(''));
            iframeDoc.close();
        }

        prevButton.classList[(pageIndex === 0) ? 'add' : 'remove']('disabled');
        nextButton.classList[(pageIndex + 1 === pages.length) ? 'add' : 'remove']('disabled');

        let hash = 'page=' + page.key;
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
        if (pageIndex + 1 < pages.length) {
            pageIndex++;
            load();
        }
    });

    load();
});
