/* eslint-env browser */
/* eslint-disable prefer-arrow-callback,prefer-template */
/* eslint no-loop-func: "off" */
/* eslint camelcase: "off" */
/* global mapboxgl */
/* global mapboxglVersions */

const pages = [
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
        "key": "scroll_zoom_blocker",
        "title": "Gestures",
        "url": "./scroll_zoom_blocker.html"
    },
    {
        "key": "preload-tiles",
        "title": "Preload tiles",
        "url": "./preload-tiles.html"
    },
    {
        "key": "custom-source",
        "title": "Custom Source",
        "url": "./custom-source.html"
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
