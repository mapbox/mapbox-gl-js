/* eslint-env browser */
const mapboxgl = {};

document.addEventListener('DOMContentLoaded', () => {
    const jsProdMin = document.createElement("a");
    jsProdMin.href = "/dist/mapbox-gl.js";
    const css = document.createElement("a");
    css.href = "/dist/mapbox-gl.css";

    const titleElement = document.querySelector('#title');
    const container = document.querySelector('#container');
    const prevButton = document.querySelector('#prev');
    const nextButton = document.querySelector('#next');

    const pages = [
        "add-geojson",
        "animate-point",
        "queryrenderedfeatures",
        "scroll-fly-to",
        "popup-on-click",
        "hover-styles",
        "satellite-map",
        "custom-marker-icons",
        "filter-features-within-map-view",
        "video-on-a-map",
        "custom-style-layer",
        "adjust-layer-opacity",
        "check-for-support",
        "mapbox-gl-geocoder",
        "mapbox-gl-directions",
        "mapbox-gl-draw",
        "mapbox-gl-compare",
        "mapbox-gl-rtl-text"
    ];

    const params = {
        page: pages[0]
    };

    location.hash.substr(1).split('&').forEach((param) => {
        const entry = param.split('=', 2);
        params[entry[0]] = entry[1];
    });

    let index = pages.indexOf(params.page);
    if (index < 0) index = 0;

    let req;
    let metadata;

    function load() {
        if (req) {
            req.abort();
        }

        titleElement.innerText = 'Loading…';
        while (container.firstChild) container.removeChild(container.firstChild);

        params.page = pages[index];
        const page = params.page;

        req = new XMLHttpRequest();
        req.addEventListener("load", loadedMetadata);
        req.responseType = 'json';
        req.open("GET", `/test/release/${page}.json`);
        req.send();

        function loadedMetadata() {
            if (req.status !== 200) {
                container.innerText = `Failed to load ${req.responseURL}: ${req.statusText}`;
                return;
            }
            metadata = req.response;
            titleElement.innerText = metadata.title;

            req = new XMLHttpRequest();
            req.addEventListener("load", loadedHTML);
            req.open("GET", metadata.url ? metadata.url : `/test/release/${page}.html`);
            req.send();
        }

        function loadedHTML() {
            if (req.status !== 200) {
                container.innerText = `Failed to load ${req.responseURL}: ${req.statusText}`;
                return;
            }
            const iframe = document.createElement('iframe');
            container.appendChild(iframe);
            const url = URL.createObjectURL(new Blob([
                '<!DOCTYPE html>\n',
                '<html>\n',
                '<head>\n',
                '    <title>Mapbox GL JS debug page</title>\n',
                '    <meta charset="utf-8">\n',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">\n',
                `    <script src="${jsProdMin.href}"><\/script>\n`,
                `    <script>mapboxgl.accessToken = "${mapboxgl.accessToken}";<\/script>\n`,
                `    <link rel="stylesheet" href="${css.href}" />\n`,
                '    <style>\n',
                '        body { margin: 0; padding: 0; }\n',
                '        html, body, #map { height: 100%; }\n',
                '    </style>\n',
                '</head>\n',
                '<body>\n',
                req.response,
                '</body>\n',
                '</html>' ], {type: 'text/html'}));

            iframe.src = url;
        }

        prevButton.disabled = index === 0;
        nextButton.disabled = index + 1 === pages.length;

        location.hash = `page=${page}`;
    }

    prevButton.addEventListener('click', () => {
        if (index > 0) {
            index--;
            load();
        }
    });

    nextButton.addEventListener('click', () => {
        if (index + 1 <= pages.length) {
            index++;
            load();
        }
    });

    load();
});
